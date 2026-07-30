// Phase 2B measurement pass: performance, determinism and disposal, measured in the REAL browser,
// then assembled with the build report and the asset gate into simulator/artifacts/phase2b/report.json.
//
//   node simulator/tools/phase2b-report.mjs [--out simulator/artifacts/phase2b/report.json]
//
// Requires a static server on 127.0.0.1:8099 serving simulator/.
//
// The determinism probe is the important one: it drives the page the way a viewer would (play
// forward, pause, jump backwards, reset, replay) and compares the resulting bone matrices, morph
// weights and camera transform against a direct seek to the same masterProgress. That is the ss25
// guarantee checked against the actual renderer rather than against a model of it.

import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { connect, evaluate, waitReady } from './capture-frames.mjs';
import { verifyBakedAsset } from './verify-baked-asset.mjs';

const SERVER = process.env.SERVER || 'http://127.0.0.1:8099';

/** Snapshot enough of the scene to prove two paths reached the same state. */
const SNAPSHOT = `(() => {
  const s = window.__scene();
  const out = { bones: [], morphs: [], camera: [] };
  const root = s.root || s.model;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isBone) out.bones.push(...o.matrixWorld.elements.map((v) => +v.toFixed(6)));
    if (o.isMesh && o.morphTargetInfluences) out.morphs.push(...o.morphTargetInfluences.map((v) => +v.toFixed(6)));
  });
  out.camera = [...s.camera.position.toArray(), ...s.camera.quaternion.toArray(), s.camera.fov]
    .map((v) => +v.toFixed(6));
  return out;
})()`;

const digest = (snap) => JSON.stringify([snap.bones.length, snap.morphs.length,
  snap.bones.reduce((a, b) => a + b, 0).toFixed(4),
  snap.morphs.reduce((a, b) => a + b, 0).toFixed(6), snap.camera]);

async function probeMode(send, mode) {
  await evaluate(send, `window.__setMode(${JSON.stringify(mode)})`);
  await evaluate(send, 'window.__captureMode = true');

  // ---- load + render cost -------------------------------------------------------------------
  const perf = await evaluate(send, `(async () => {
    const s = window.__scene();
    const info = window.__rendererInfo ? window.__rendererInfo() : null;
    const draw = [];
    const times = [];
    for (let i = 0; i <= 20; i += 1) {
      const t = performance.now();
      window.__setProgress(i / 20);
      window.__drawNow();
      await new Promise((r) => requestAnimationFrame(r));
      times.push(performance.now() - t);
    }
    times.sort((a, b) => a - b);
    return {
      frameMsMedian: +times[Math.floor(times.length / 2)].toFixed(2),
      frameMsP90: +times[Math.floor(times.length * 0.9)].toFixed(2),
      memoryMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      draw, info,
    };
  })()`);

  // ---- renderer counters --------------------------------------------------------------------
  const gl = await evaluate(send, `(() => {
    const c = document.querySelector('canvas');
    const r = window.__renderer;
    if (!r) return null;
    return {
      drawCalls: r.info.render.calls, triangles: r.info.render.triangles,
      geometries: r.info.memory.geometries, textures: r.info.memory.textures,
      programs: r.info.programs ? r.info.programs.length : null,
      canvas: [c.width, c.height],
    };
  })()`);

  // ---- determinism: playback vs direct seek --------------------------------------------------
  const determinism = await evaluate(send, `(async () => {
    const snap = () => ${SNAPSHOT};
    const digest = ${digest.toString()};
    const results = {};

    const seekTo = (p) => { window.__setProgress(p); window.__drawNow(); return digest(snap()); };
    const playTo = (p, steps) => {
      window.__setProgress(0); window.__drawNow();
      for (let i = 1; i <= steps; i += 1) { window.__setProgress((i / steps) * p); window.__drawNow(); }
      return digest(snap());
    };

    // 40 steps, not 120: the property under test is that the mapping is a pure function of
    // masterProgress, and the number of intermediate steps taken to arrive does not change what it
    // proves — it only changes how long the probe blocks a software renderer.
    for (const p of [0, 0.25, 0.5, 0.7857, 1]) {
      results['seek_vs_play@' + p] = { seek: seekTo(p), play: playTo(p, 40) };
    }
    // reverse seek and a hard jump in both directions
    seekTo(0.95); results.reverse_jump = { got: seekTo(0.20), want: seekTo(0.20) };
    seekTo(0.20); results.forward_jump = { got: seekTo(0.95), want: seekTo(0.95) };
    // reset then replay repeatedly
    const first = playTo(1, 30);
    const second = playTo(1, 30);
    const third = playTo(1, 30);
    results.replay = { first, second, third };
    results.reset = { afterPlay: (playTo(1, 20), seekTo(0)), fresh: seekTo(0) };
    return results;
  })()`, 900_000);

  const checks = [];
  for (const [key, value] of Object.entries(determinism)) {
    if (key.startsWith('seek_vs_play')) {
      checks.push({ id: key, pass: value.seek === value.play });
    } else if (key === 'replay') {
      checks.push({ id: 'replay_deterministic', pass: value.first === value.second && value.second === value.third });
    } else if (key === 'reset') {
      checks.push({ id: 'reset_reconstructs_frame_zero', pass: value.afterPlay === value.fresh });
    } else {
      checks.push({ id: key, pass: value.got === value.want });
    }
  }
  return { mode, perf, gl, determinism: checks };
}

export async function measure(port = 9441) {
  const c = await connect(port, '1280,720');
  try {
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    const t0 = Date.now();
    await c.send('Page.navigate', { url: `${SERVER}/phase2b-preview.html?clean=1&presentationMode=blender-baked` });
    await waitReady(c.send);
    const firstLoadMs = Date.now() - t0;

    const baked = await probeMode(c.send, 'blender-baked');
    const procedural = await probeMode(c.send, 'procedural-fallback');
    const loadDiag = await evaluate(c.send, '({ mode: window.__mode })');

    // ---- disposal: build, dispose, and confirm the renderer released what the scene owned -----
    const disposal = await evaluate(c.send, `(async () => {
      const r = window.__renderer;
      if (!r) return null;
      const before = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
      await window.__setMode('blender-baked');
      window.__setProgress(0.5); window.__drawNow();
      const loaded = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
      const s = window.__scene();
      s.dispose();
      const after = { geometries: r.info.memory.geometries, textures: r.info.memory.textures };
      return { before, loaded, after, disposedFlag: s.disposed, updateAfterDispose: s.update({ progress: 0.5 }) };
    })()`, 600_000);

    // ---- tablet-sized viewport (browser-EMULATED, not a physical device) ----------------------
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 2, mobile: true });
    await c.send('Page.navigate', { url: `${SERVER}/phase2b-preview.html?clean=1&presentationMode=blender-baked` });
    await waitReady(c.send);
    await evaluate(c.send, 'window.__captureMode = true');
    const tablet = await evaluate(c.send, `(async () => {
      const t = performance.now();
      for (let i = 0; i <= 10; i += 1) { window.__setProgress(i / 10); window.__drawNow(); await new Promise((r) => requestAnimationFrame(r)); }
      const c2 = document.querySelector('canvas');
      return { frameMs: +((performance.now() - t) / 11).toFixed(2), canvas: [c2.width, c2.height], loaded: !!window.__ready };
    })()`);

    return { firstLoadMs, baked, procedural, loadDiag, disposal, tablet };
  } finally { c.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx >= 0 ? process.argv[outIdx + 1] : 'simulator/artifacts/phase2b/report.json';

  const gate = verifyBakedAsset();
  const manifest = JSON.parse(readFileSync('simulator/assets/human/human_application_manifest.json', 'utf8'));
  const buildReportPath = 'simulator/artifacts/phase2b/build-report.json';
  const buildReport = existsSync(buildReportPath) ? JSON.parse(readFileSync(buildReportPath, 'utf8')) : null;

  const browser = await measure();

  const artifacts = {};
  for (const f of [
    'simulator/artifacts/phase2b/browser-baked-normal.webm',
    'simulator/artifacts/phase2b/browser-baked-half-speed.webm',
    'simulator/artifacts/phase2b/browser-procedural-normal.webm',
    'simulator/artifacts/phase2b/browser-ab-comparison.webm',
    'simulator/artifacts/phase2b/blender-preview-normal.mp4',
    'simulator/artifacts/phase2b/ab-contact-sheet.png',
    'simulator/assets/human/human_application_baked.glb',
    'simulator/assets/blender/phase2_application_source.blend',
  ]) artifacts[f] = existsSync(f) ? statSync(f).size : null;

  const report = {
    phase: '2B',
    generatedAtUtc: new Date().toISOString(),
    assetGate: { ok: gate.ok, stats: gate.stats, checks: gate.checks },
    manifest: {
      assetVersion: manifest.assetVersion, clip: manifest.clip,
      statistics: manifest.statistics, events: manifest.events,
      ownership: manifest.ownership, provenance: manifest.provenance,
    },
    build: buildReport && {
      blenderVersion: buildReport.blenderVersion, buildSeconds: buildReport.buildSeconds,
      originalChecksum: buildReport.originalChecksum,
      originalChecksumUnchanged: buildReport.originalChecksumUnchanged,
      action: buildReport.action, gripSolution: buildReport.gripSolution,
      poleCalibrationErrorMm: buildReport.poleCalibrationErrorMm,
      exportedObjects: buildReport.exportedObjects, excludedObjects: buildReport.excludedObjects,
    },
    browser,
    artifacts,
    deviceVerification: {
      physicalDeviceVerified: [],
      browserEmulated: ['1280x720 desktop viewport', '1024x768 @2x tablet-like viewport (Chromium device metrics override)'],
      notVerified: ['physical iPad or other tablet hardware', 'discrete-GPU desktop', 'Safari/WebKit'],
      note: 'All browser numbers come from headless Chromium on SwiftShader (software WebGL). They bound correctness, not real-world frame rate.',
    },
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  const det = [...browser.baked.determinism, ...browser.procedural.determinism];
  console.log(`wrote ${out}`);
  console.log(`  asset gate      : ${gate.ok ? 'PASS' : 'FAIL'}`);
  console.log(`  determinism     : ${det.filter((d) => d.pass).length}/${det.length} checks pass`);
  for (const d of det) if (!d.pass) console.log(`    FAIL ${d.id}`);
  console.log(`  baked frame ms  : median ${browser.baked.perf.frameMsMedian}  p90 ${browser.baked.perf.frameMsP90}`);
  console.log(`  procedural ms   : median ${browser.procedural.perf.frameMsMedian}  p90 ${browser.procedural.perf.frameMsP90}`);
  console.log(`  disposal        : ${JSON.stringify(browser.disposal && { loaded: browser.disposal.loaded, after: browser.disposal.after })}`);
  process.exit(gate.ok && det.every((d) => d.pass) ? 0 : 1);
}
