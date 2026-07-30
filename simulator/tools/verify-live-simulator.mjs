#!/usr/bin/env node
// LIVE PRODUCTION CHECK for the Phase 2B application page.
//
//   node simulator/tools/verify-live-simulator.mjs <baseUrl>
//
// A green deploy job means an artifact was accepted. A matching page hash means the right bytes are
// being served. Neither tells you the 3D scene actually renders — the GLB could 404, WebGL could
// fail, a module could throw. This drives a real browser at the REAL public URL and asserts the
// things a person would check by looking:
//
//   the page loads · no fatal browser error · the presentation mode is the one we deployed and did
//   not silently fall back · the Blender-authored human is in the scene with a bound skeleton ·
//   the sequence actually moves when masterProgress advances · every request succeeded ·
//   the procedural rollback still works
//
// Requires Playwright (CI installs it). Exits non-zero on the first failed assertion.

import { chromium } from 'playwright';

const BASE = (process.argv[2] || '').replace(/\/$/, '');
if (!BASE) {
  console.error('usage: verify-live-simulator.mjs <baseUrl>');
  process.exit(2);
}
const PAGE = `${BASE}/simulator/phase2b-preview.html`;

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name.padEnd(40)} ${detail}`);
};

const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const failedRequests = [];
const consoleErrors = [];
page.on('response', (r) => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', (r) => failedRequests.push(`FAILED ${r.url()} (${r.failure()?.errorText})`));
page.on('pageerror', (e) => consoleErrors.push(String(e && (e.message || e))));

try {
  console.log(`Live page: ${PAGE}`);
  // ~21 MB of GLB over the public internet; be patient before calling it broken.
  await page.goto(PAGE, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  let ready = false;
  let pageErr = null;
  for (let i = 0; i < 150; i += 1) {
    const s = await page.evaluate(() => ({ ready: !!window.__ready, error: window.__error || null }));
    if (s.error) { pageErr = s.error; break; }
    if (s.ready) { ready = true; break; }
    await page.waitForTimeout(1000);
  }
  check('live simulator page loads, scene ready', ready, ready ? 'window.__ready === true' : (pageErr || 'timed out'));
  if (!ready) throw new Error(pageErr || 'never became ready');

  check('no fatal browser error', !pageErr && consoleErrors.length === 0,
    pageErr || consoleErrors.join(' | ') || 'no page errors, no unhandled rejections');

  const m = await page.evaluate(() => window.__mode);
  check('presentation mode is blender-baked', m.mode === 'blender-baked', `mode=${m.mode}`);
  check('did not fall back to procedural', m.fellBack === false, `fellBack=${m.fellBack}, reason=${m.reason ?? 'null'}`);

  const sc = await page.evaluate(() => {
    const s = window.__scene();
    let meshes = 0, tris = 0, skinned = 0, bones = 0;
    s.scene.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        meshes += 1; if (o.isSkinnedMesh) skinned += 1;
        const g = o.geometry;
        if (g && g.index) tris += g.index.count / 3;
        else if (g && g.attributes && g.attributes.position) tris += g.attributes.position.count / 3;
      }
      if (o.isBone) bones += 1;
    });
    return { meshes, tris: Math.round(tris), skinned, bones };
  });
  check('Blender-authored human is visible', sc.meshes > 0 && sc.tris > 10000,
    `${sc.meshes} meshes, ${sc.tris.toLocaleString()} triangles`);
  check('skinned skeleton is bound', sc.skinned > 0 && sc.bones >= 25,
    `${sc.skinned} skinned meshes over ${sc.bones} bones`);

  const motion = await page.evaluate(() => {
    const s = window.__scene();
    let hand = null;
    s.scene.traverse((o) => { if (!hand && o.isBone && /^hand_(r|l)$/i.test(o.name)) hand = o; });
    if (!hand) return { error: 'no hand bone' };
    const pts = [];
    for (const p of [0, 0.2, 0.4, 0.55, 0.7, 0.85, 1]) {
      window.__setProgress(p); window.__drawNow();
      s.scene.updateMatrixWorld(true);
      const f = window.__frame();
      const e = hand.matrixWorld.elements;
      pts.push({ t: f ? f.clipTime : null, event: f ? f.event : null, pos: [e[12], e[13], e[14]] });
    }
    return { bone: hand.name, pts };
  });
  if (motion.error) {
    check('cream-application sequence plays', false, motion.error);
  } else {
    const times = motion.pts.map((x) => x.t);
    check('clip time advances with masterProgress',
      times.every((t, i) => i === 0 || t >= times[i - 1]) && times.at(-1) > times[0],
      `${times[0].toFixed(2)}s -> ${times.at(-1).toFixed(2)}s`);
    let travel = 0;
    for (let i = 1; i < motion.pts.length; i += 1) {
      const a = motion.pts[i - 1].pos, b = motion.pts[i].pos;
      travel += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    }
    check('cream-application sequence plays', travel > 0.05,
      `bone "${motion.bone}" travels ${(travel * 100).toFixed(1)} cm`);
    const events = [...new Set(motion.pts.map((x) => x.event).filter(Boolean))];
    check('narrative events fire along the clip', events.length >= 2, events.join(' -> '));
  }

  await page.evaluate(() => { window.__setProgress(0.62); window.__drawNow(); });
  await page.waitForTimeout(500);
  const png = await page.screenshot();
  check('renders a non-trivial frame', png.length > 40000, `${(png.length / 1024).toFixed(0)} KB PNG`);
  if (process.env.SHOT_OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.SHOT_OUT, png);
  }

  const glb = await page.evaluate(() => performance.getEntriesByType('resource')
    .filter((r) => r.name.endsWith('.glb'))
    .map((r) => ({ url: r.name, status: r.responseStatus ?? 200, bytes: r.transferSize })));
  check('GLB and texture assets returned successfully', failedRequests.length === 0,
    failedRequests.length ? failedRequests.join(', ') : 'no request returned >= 400 or failed');
  check('baked GLB fetched from production', glb.length > 0 && glb.every((g) => g.status === 200),
    glb.map((g) => `${g.status} ${g.url.split('/').pop()}`).join(', ') || 'no .glb request seen');

  const back = await page.evaluate(() => window.__setMode('procedural-fallback'));
  check('procedural-fallback rollback works live', back.mode === 'procedural-fallback',
    `switched to ${back.mode}`);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} live checks passed`);
process.exit(failed.length ? 1 : 0);
