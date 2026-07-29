// Deterministic browser frame capture for Phase 2B.
//
// WHY THIS EXISTS. The earlier MediaRecorder path (record-application.mjs) encodes VP8/VP9 inside
// the headless browser. Under SwiftShader that encoder is the bottleneck, not the renderer, and a
// full 420-frame sequence never completed in this container (architecture-lock conflict C-5). This
// tool removes the in-browser encoder entirely:
//
//   1. choose an output fps and frame count,
//   2. set masterProgress EXPLICITLY for each frame (never an independent recording clock),
//   3. render that exact progress,
//   4. pull the frame out over CDP as a PNG,
//   5. hand the finished sequence to tools/blender/encode_video.py, which uses Blender's bundled
//      FFmpeg to produce a real playable file.
//
// The narrative clock is still the page's masterProgress and nothing else, so a captured sequence
// is a seek test as much as it is a recording: frame i is `progress = i / (N-1)` reached by direct
// seek, and it must match continuous playback to the same value.
//
//   node simulator/tools/capture-frames.mjs --url <page> --out <dir> [options]
//
// Options:
//   --frames N            number of evenly spaced frames over [0,1]  (default 421)
//   --size WxH            window size (default 1280x720)
//   --shots a=0.1,b=0.42  capture only these named progress points instead of a sweep
//   --mode <name>         appended to the page query string as presentationMode=<name>
//   --query k=v,k=v       extra query parameters
//   --prefix name         filename prefix for sweep frames (default "f")
//   --port N              devtools port
//
// Requires a static server on http://127.0.0.1:8099 serving simulator/ (override with SERVER).

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SERVER = process.env.SERVER || 'http://127.0.0.1:8099';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connect(port = 9344, size = '1280,720') {
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--use-gl=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--remote-debugging-port=${port}`, `--window-size=${size}`, 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
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
  return { send, close() { try { ws.close(); } catch { /* already gone */ } proc.kill(); } };
}

export async function evaluate(send, expression, timeoutMs = 600_000) {
  const r = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, timeout: timeoutMs,
  });
  const ex = r.result && r.result.exceptionDetails;
  if (ex) throw new Error(ex.exception ? (ex.exception.description || ex.text) : JSON.stringify(ex));
  return r.result && r.result.result ? r.result.result.value : undefined;
}

/** Wait for the page to publish `window.__ready`, surfacing its own diagnostics on failure. */
export async function waitReady(send, tries = 240) {
  for (let i = 0; i < tries; i++) {
    await sleep(500);
    if (await evaluate(send, 'window.__ready === true').catch(() => false)) return true;
    const err = await evaluate(send, 'window.__error || null').catch(() => null);
    if (err) throw new Error(`page reported: ${err}`);
  }
  const hud = await evaluate(send, '(document.getElementById("hud")||{}).textContent').catch(() => '?');
  throw new Error(`scene never became ready. HUD: ${hud}`);
}

/**
 * Seek to an exact master progress and draw it. Returns the page's frame diagnostics so a capture
 * run doubles as a state probe.
 */
export async function seekAndDraw(send, p) {
  return evaluate(send, `(async () => {
    const set = window.__setProgress || window.__apply;
    set(${p});
    if (window.__drawNow) window.__drawNow();
    await new Promise((r) => requestAnimationFrame(r));
    return window.__diag ? window.__diag() : null;
  })()`);
}

export async function shot(send, file, format = 'png', quality = 92) {
  const params = { format, captureBeyondViewport: false };
  if (format === 'jpeg') params.quality = quality;
  const r = await send('Page.captureScreenshot', params);
  const data = r.result && r.result.data;
  if (!data) throw new Error('captureScreenshot returned no data');
  const buf = Buffer.from(data, 'base64');
  writeFileSync(file, buf);
  return buf.length;
}

/**
 * @param {{url:string, out:string, frames?:number, size?:string, shots?:Array<[string,number]>,
 *          prefix?:string, port?:number, onFrame?:Function}} opts
 */
export async function capture(opts) {
  const size = opts.size || '1280,720';
  const port = opts.port || 9401;
  const c = await connect(port, size);
  const started = Date.now();
  try {
    await c.send('Page.enable');
    await c.send('Runtime.enable');
    // Pin the viewport to an EXACT size. The headless window size is not the viewport size (browser
    // chrome is deducted), which produced odd-numbered frame heights that no video encoder accepts.
    const [vw, vh] = size.split(',').map(Number);
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: vw, height: vh, deviceScaleFactor: 1, mobile: !!opts.mobile,
    });
    await c.send('Page.navigate', { url: opts.url });
    await waitReady(c.send);
    // The harness owns every draw from here on; the page's idle loop must stop rendering or each
    // captured frame costs three SwiftShader passes instead of one.
    await evaluate(c.send, 'window.__captureMode = true');
    const loadMs = Date.now() - started;
    mkdirSync(opts.out, { recursive: true });
    const fmt = opts.format || 'png';

    const list = opts.shots
      || Array.from({ length: opts.frames || 421 },
        (_, i) => [`${opts.prefix || 'f'}${String(i).padStart(4, '0')}`, i / ((opts.frames || 421) - 1)]);

    const frames = [];
    const t0 = Date.now();
    let drawMs = 0; let shotMs = 0;
    for (const [name, p] of list) {
      const ta = Date.now();
      const diag = await seekAndDraw(c.send, p);
      const tb = Date.now();
      const file = join(opts.out, `${name}.${fmt === 'jpeg' ? 'jpg' : 'png'}`);
      const bytes = await shot(c.send, file, fmt, opts.quality);
      shotMs += Date.now() - tb; drawMs += tb - ta;
      frames.push({ name, progress: p, file, bytes, diag });
      if (opts.onFrame) opts.onFrame(frames[frames.length - 1], frames.length, list.length);
    }
    const ms = Date.now() - t0;
    return {
      frames, loadMs, ms, msPerFrame: ms / list.length, out: opts.out,
      drawMsPerFrame: drawMs / list.length, shotMsPerFrame: shotMs / list.length,
    };
  } finally { c.close(); }
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    if (k.startsWith('--')) { a[k.slice(2)] = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : 'true'; }
  }
  return a;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = parseArgs(process.argv.slice(2));
  if (!a.url || !a.out) {
    console.error('usage: node capture-frames.mjs --url <page> --out <dir> [--frames N] [--size WxH] [--shots name=p,...] [--mode m] [--query k=v,...]');
    process.exit(2);
  }
  const q = new URLSearchParams();
  if (a.mode) q.set('presentationMode', a.mode);
  q.set('clean', '1');
  for (const kv of (a.query ? a.query.split(',') : [])) { const [k, v] = kv.split('='); q.set(k, v); }
  const url = `${SERVER}/${a.url}?${q.toString()}`;

  const shots = a.shots
    ? a.shots.split(',').map((s) => { const [n, p] = s.split('='); return [n, Number(p)]; })
    : null;

  const r = await capture({
    url,
    out: a.out,
    frames: a.frames ? Number(a.frames) : undefined,
    size: a.size ? a.size.replace('x', ',') : undefined,
    shots,
    prefix: a.prefix,
    format: a.format,
    quality: a.quality ? Number(a.quality) : undefined,
    port: a.port ? Number(a.port) : undefined,
    onFrame: (f, i, n) => { if (i % 25 === 0 || i === n) process.stderr.write(`  ${i}/${n} ${f.name} ${(f.bytes / 1024).toFixed(0)}KB\n`); },
  });
  const summary = {
    url, out: r.out, frames: r.frames.length, loadMs: r.loadMs,
    msPerFrame: Math.round(r.msPerFrame), drawMsPerFrame: Math.round(r.drawMsPerFrame),
    shotMsPerFrame: Math.round(r.shotMsPerFrame), totalMs: r.ms,
  };
  if (a.manifest) writeFileSync(a.manifest, JSON.stringify({ ...summary, frames: r.frames }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}
