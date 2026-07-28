// Renderer boundary (Phase 1). Establishes the rendering RESPONSIBILITY as a
// swappable interface, but implements only a NullRenderer that draws nothing.
// No WebGL, no Three.js, no shaders, no materials, no lighting - those arrive in
// a later phase behind this same interface.

/**
 * @typedef {object} Renderer
 * @property {(mountEl: any) => void} mount
 * @property {() => void} clear
 * @property {(cameraDescriptor: object) => void} setCamera
 * @property {() => void} dispose
 * @property {string} kind
 */

/** A renderer that intentionally does nothing. @implements {Renderer} */
export class NullRenderer {
  constructor(opts = {}) {
    this.logger = opts.logger || null;
    this.kind = 'null';
    this.mounted = false;
  }

  mount(/* mountEl */) {
    this.mounted = true;
    this._log('info', 'app', 'NullRenderer mounted (no biological rendering in Phase 1)');
  }

  clear() { /* no-op */ }
  setCamera(/* cameraDescriptor */) { /* no-op: data accepted, nothing drawn */ }
  dispose() { this.mounted = false; }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

/**
 * Renderer factory. Selects a renderer by kind. Phase 1 shipped 'null'; Phase 2
 * adds the static-anatomy 'canvas' renderer behind the same interface. No call
 * sites change - only the requested kind. The canvas renderer is imported lazily
 * so the null path stays dependency-free.
 * @param {{ kind?: string, logger?: object }} [opts]
 * @returns {Renderer | Promise<Renderer>}
 */
export function createRenderer(opts = {}) {
  const kind = opts.kind || 'null';
  if (kind === 'null') return new NullRenderer(opts);
  if (kind === 'canvas') {
    // Lazy import keeps the null path free of the anatomy layout engine.
    return import('./canvasRenderer.js').then((m) => new m.CanvasRenderer(opts));
  }
  // Phase 2 adds the WebGL path. Also lazily imported, so the null and canvas paths never pull in
  // Three.js and the 2D scientific tools stay dependency-free.
  if (kind === 'three') return import('./threeRenderer.js').then((m) => new m.ThreeRenderer(opts));
  throw new Error(`unknown renderer kind: ${kind}`);
}

export default createRenderer;
