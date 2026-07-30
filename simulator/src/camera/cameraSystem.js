// Camera infrastructure (Phase 1). Pure data + configuration - NO rendering, NO
// animation, NO WebGL/Three.js dependency. It holds a camera DESCRIPTOR that a
// future renderer will consume. Clip planes and guided/cinematic/educational
// modes are declared but inert in Phase 1.

/**
 * @typedef {object} CameraDescriptor
 * @property {'perspective'|'orthographic'} mode
 * @property {number} fovDegrees
 * @property {number} near
 * @property {number} far
 * @property {[number,number,number]} position
 * @property {[number,number,number]} target
 * @property {[number,number,number]} up
 * @property {ClipPlane[]} clipPlanes
 * @property {'free'|'guided'|'cinematic'|'educational'} navMode
 */

/** @typedef {{ enabled: boolean, normal:[number,number,number], constant:number }} ClipPlane */

export class CameraSystem {
  /** @param {{ config?: object, logger?: object }} [opts] */
  constructor(opts = {}) {
    this.logger = opts.logger || null;
    const c = (opts.config && opts.config.camera) || {};
    /** @type {CameraDescriptor} */
    this.camera = {
      mode: c.defaultMode || 'perspective',
      fovDegrees: numOr(c.fovDegrees, 45),
      near: numOr(c.near, 0.1),
      far: numOr(c.far, 1000),
      position: [0, 0, 10],
      target: [0, 0, 0],
      up: [0, 1, 0],
      clipPlanes: [],
      navMode: 'free',
    };
    this._clipEnabled = !!c.clipPlanesEnabled;
    this._log('info', 'camera', `camera initialized (${this.camera.mode})`);
  }

  get() { return this.camera; }

  /** @param {'perspective'|'orthographic'} mode */
  setMode(mode) {
    if (mode !== 'perspective' && mode !== 'orthographic') throw new Error(`bad camera mode: ${mode}`);
    this.camera.mode = mode;
    return this.camera;
  }

  /** @param {'free'|'guided'|'cinematic'|'educational'} navMode */
  setNavMode(navMode) { this.camera.navMode = navMode; return this.camera; }

  /** Data-only pose update; no interpolation in Phase 1. */
  setPose(position, target, up) {
    if (position) this.camera.position = position;
    if (target) this.camera.target = target;
    if (up) this.camera.up = up;
    return this.camera;
  }

  /**
   * Declare a clip plane (cross-section is implemented in a later phase). Stored
   * but inert unless clip planes are enabled in config.
   * @param {ClipPlane} plane
   */
  addClipPlane(plane) {
    this.camera.clipPlanes.push({ ...plane, enabled: this._clipEnabled && !!plane.enabled });
    return this.camera;
  }

  clearClipPlanes() { this.camera.clipPlanes = []; return this.camera; }

  /** Serializable snapshot for the state store / debug panel. */
  snapshot() { return JSON.parse(JSON.stringify(this.camera)); }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function numOr(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }

export default CameraSystem;
