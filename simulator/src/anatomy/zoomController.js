// Zoom controller (Phase 2). Maps a continuous zoom value in [0,1] to a discrete
// scale level (L1..L6) using the scale system order. Zoom drives visibility only
// through the scale system + anatomy registry - it holds NO biological values and
// performs NO rendering itself. There is no animation; a zoom change is applied
// immediately (the renderer redraws a static frame).

export class ZoomController {
  /**
   * @param {{ scaleSystem: object, state?: object, onChange?: (levelId:string)=>void, logger?: object }} opts
   */
  constructor(opts) {
    if (!opts || !opts.scaleSystem) throw new Error('ZoomController requires scaleSystem');
    this.scaleSystem = opts.scaleSystem;
    this.state = opts.state || null;
    this.onChange = opts.onChange || null;
    this.logger = opts.logger || null;
    this.levels = this.scaleSystem.ids();     // ['L1'..'L6'] far -> near
    this.zoom = 0;                             // 0 = far (overview), 1 = extreme close
    this.levelId = this.levels[0];
  }

  /** Map a zoom fraction to a level id. 0 -> first level, 1 -> last level. */
  levelForZoom(zoom) {
    const z = clamp01(zoom);
    const idx = Math.min(this.levels.length - 1, Math.floor(z * this.levels.length));
    return this.levels[idx];
  }

  /** Set continuous zoom; updates the current level and notifies on change. */
  setZoom(zoom) {
    this.zoom = clamp01(zoom);
    const level = this.levelForZoom(this.zoom);
    if (level !== this.levelId) {
      this.levelId = level;
      if (this.state && this.state.setScale) this.state.setScale(level);
      if (this.onChange) this.onChange(level);
      this._log('info', 'scene', `zoom -> level ${level}`);
    }
    return this.levelId;
  }

  /** Jump directly to a level (used by scene selection). */
  setLevel(levelId) {
    if (!this.levels.includes(levelId)) throw new Error(`unknown level: ${levelId}`);
    const idx = this.levels.indexOf(levelId);
    this.zoom = this.levels.length > 1 ? idx / (this.levels.length - 1) : 0;
    this.levelId = levelId;
    if (this.state && this.state.setScale) this.state.setScale(levelId);
    if (this.onChange) this.onChange(levelId);
    return this.levelId;
  }

  current() { return this.levelId; }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export default ZoomController;
