// Records the Phase-2 sequence to WebM from the REAL browser canvas, over the DevTools Protocol.
//
// No external encoder is involved (this environment has no ffmpeg): the page uses MediaRecorder on
// canvas.captureStream(0) and drives every frame itself with track.requestFrame(), so the encoded
// video is exactly fps*seconds frames at a steady rate even though SwiftShader renders far slower
// than real time. That also makes the recording reproducible rather than dependent on machine speed.
//
//   node simulator/tools/record-application.mjs <outFile.webm> [seconds] [fps] [--hud]
//
// Requires a static server on 127.0.0.1:8099 serving simulator/.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SERVER = process.env.SERVER || 'http://127.0.0.1:8099';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect(port = 9344, size = '1280,760') {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    `--remote-debugging-port=${port}`, `--window-size=${size}`, 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up */ }
  }
  if (!target) { proc.kill(); throw new Error('DevTools endpoint never came up'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const myId = ++id; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return { send, close() { ws.close(); proc.kill(); } };
}

export async function evaluate(send, expression, timeoutMs = 900_000) {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, timeout: timeoutMs,
  });
  const ex = r.result && r.result.exceptionDetails;
  if (ex) throw new Error(ex.exception ? (ex.exception.description || ex.text) : JSON.stringify(ex));
  return r.result && r.result.result ? r.result.result.value : undefined;
}

export async function waitReady(send) {
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    if (await evaluate(send, 'window.__ready === true').catch(() => false)) return true;
  }
  const hud = await evaluate(send, 'document.getElementById("hud").textContent').catch(() => '?');
  throw new Error(`scene never became ready. HUD: ${hud}`);
}

export async function record(outFile, { seconds = 14, fps = 30, hud = false, port = 9344 } = {}) {
  const c = await connect(port);
  try {
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    await c.send('Page.navigate', { url: `${SERVER}/application-preview.html` });
    await waitReady(c.send);
    const b64 = await evaluate(
      c.send,
      `window.__record({ seconds: ${seconds}, fps: ${fps}, hud: ${hud ? 'true' : 'false'} })`,
    );
    if (!b64) throw new Error('recorder returned no data');
    mkdirSync(dirname(outFile), { recursive: true });
    const buf = Buffer.from(b64, 'base64');
    writeFileSync(outFile, buf);
    return { file: outFile, bytes: buf.length, frames: Math.round(seconds * fps), fps, seconds };
  } finally { c.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2];
  if (!out) { console.error('usage: node record-application.mjs <out.webm> [seconds] [fps] [--hud]'); process.exit(2); }
  const seconds = Number(process.argv[3] || 14);
  const fps = Number(process.argv[4] || 30);
  const hud = process.argv.includes('--hud');
  const r = await record(out, { seconds, fps, hud });
  console.log(`wrote ${r.file}  ${(r.bytes / 1024).toFixed(0)} KB  ${r.frames} frames @ ${r.fps}fps (${r.seconds}s)${hud ? ' [HUD]' : ' [clean]'}`);
}
