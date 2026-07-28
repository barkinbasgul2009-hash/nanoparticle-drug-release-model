// Headless capture + validation driver for the Phase-2 application sequence.
//
// Drives Chromium over the DevTools Protocol rather than --virtual-time-budget: the scene does
// enough work at load (18 MB GLB, PMREM, cream-patch extraction) that the virtual clock reliably
// expires before the first real frame, and the capture comes back showing the loading state.
// Here we WAIT for window.__ready, then set the playhead explicitly and capture — deterministic,
// and it doubles as the in-browser assertion harness (it reads back the real frame state).
//
//   node simulator/tools/capture-application.mjs <outDir> [port]
//
// Requires a static server on 127.0.0.1:8099 serving simulator/ (see the header of the repo docs).

import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.argv[2] || '/tmp/p2shots';
const SERVER = process.env.SERVER || 'http://127.0.0.1:8099';
const CDP_PORT = Number(process.argv[3] || 9333);

/** Frames to capture: [label, progress]. Chosen to land inside each authored stage. */
export const CAPTURES = [
  ['01-neutral', 0.02], ['02-prepare', 0.20], ['03-approach', 0.33],
  ['04-contact', 0.41], ['05-stroke1', 0.52], ['06-stroke2', 0.67],
  ['07-release', 0.80], ['08-hero', 0.94], ['09-final', 1.00],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp() {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`, '--window-size=1200,1000', 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      const list = await r.json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
  }
  if (!target) { proc.kill(); throw new Error('Chromium DevTools endpoint never came up'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const myId = ++id;
    pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  return { proc, ws, send, close() { ws.close(); proc.kill(); } };
}

/** Evaluate an expression in the page and return its JSON value. */
async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result && r.result.result ? r.result.result.value : undefined;
}

export async function run() {
  mkdirSync(OUT, { recursive: true });
  const c = await cdp();
  const results = [];
  try {
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    await c.send('Page.navigate', { url: `${SERVER}/application-preview.html` });

    // wait for the scene to actually exist — no fixed sleeps, no virtual clock
    let ready = false;
    for (let i = 0; i < 240; i++) {
      await sleep(500);
      ready = await evaluate(c.send, 'window.__ready === true').catch(() => false);
      if (ready) break;
    }
    if (!ready) {
      const hud = await evaluate(c.send, 'document.getElementById("hud").textContent');
      throw new Error(`scene never became ready. HUD: ${hud}`);
    }

    for (const [label, p] of CAPTURES) {
      // set the playhead, let a couple of real frames draw, then capture
      await evaluate(c.send, `window.__apply(${p})`);
      await sleep(700);
      const frame = await evaluate(c.send, `(() => {
        const f = window.__frame(); if (!f) return null;
        return {
          progress: f.progress, stage: f.stage, shot: f.choreography.camera.shotId,
          contactValid: f.contact.valid, contactExpected: f.contact.expected,
          gapMm: f.contact.gap * 1000, axial: f.contact.axial, palmDot: f.contact.palmDot,
          creamPresent: f.choreography.cream.present, coverage: f.choreography.cream.coverage,
          opacity: f.choreography.cream.opacity,
          elbowTreated: f.ik.treated.elbowAngle * 180 / Math.PI,
          elbowApplying: f.ik.applying.elbowAngle * 180 / Math.PI,
          camDist: f.choreography.camera.dist,
        };
      })()`);
      const shot = await c.send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(`${OUT}/${label}.png`, Buffer.from(shot.result.data, 'base64'));
      results.push({ label, ...frame });
    }
  } finally {
    c.close();
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = await run();
  console.log('\nlabel        p     stage      shot         contact  gap(mm)  axial  palm  cream  cover  opac  elbowT elbowA  cam');
  for (const r of rows) {
    console.log(
      r.label.padEnd(12),
      r.progress.toFixed(2).padStart(5),
      r.stage.padEnd(10),
      String(r.shot).padEnd(12),
      String(r.contactValid).padStart(7),
      r.gapMm.toFixed(1).padStart(8),
      r.axial.toFixed(3).padStart(6),
      r.palmDot.toFixed(2).padStart(5),
      String(r.creamPresent).padStart(6),
      r.coverage.toFixed(3).padStart(6),
      r.opacity.toFixed(2).padStart(5),
      r.elbowTreated.toFixed(0).padStart(6),
      r.elbowApplying.toFixed(0).padStart(6),
      r.camDist.toFixed(2).padStart(5),
    );
  }
  console.log(`\nwrote ${rows.length} frames to ${OUT}`);
}
