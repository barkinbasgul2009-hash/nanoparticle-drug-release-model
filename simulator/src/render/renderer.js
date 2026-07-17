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
 * Renderer factory. Phase 1 always returns the NullRenderer. Later phases can
 * return a WebGL renderer here without touching call sites.
 * @param {{ kind?: string, logger?: object }} [opts]
 * @returns {Renderer}
 */
export function createRenderer(opts = {}) {
  // Only 'null' is available in Phase 1.
  return new NullRenderer(opts);
}

export default createRenderer;
