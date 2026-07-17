// Global scale hierarchy (L1..L6). Architectural only: it defines the ordered
// levels and per-level slots (visible structures, allowed labels, camera limits,
// transition rules). The actual biological structures visible at each level are
// injected from loaded blueprint data - none are hardcoded here.

/**
 * @typedef {object} ScaleLevel
 * @property {string} id            // 'L1'..'L6'
 * @property {string} name          // 'Body'..'Molecule'
 * @property {number} order         // 0-based index
 * @property {string[]} visibleStructures  // filled from blueprint later
 * @property {string[]} allowedLabels
 * @property {object} cameraLimits  // opaque descriptor (min/max distance etc.)
 * @property {string[]} canTransitionTo
 */

export class ScaleSystem {
  /** @param {{ levels: Array<{id:string,name:string}>, logger?: object }} opts */
  constructor(opts) {
    if (!opts || !Array.isArray(opts.levels)) throw new Error('ScaleSystem requires levels[]');
    this.logger = opts.logger || null;
    /** @type {ScaleLevel[]} */
    this.levels = opts.levels.map((l, i) => ({
      id: l.id,
      name: l.name,
      order: i,
      visibleStructures: [],
      allowedLabels: [],
      cameraLimits: {},
      // Default rule: can move to adjacent levels only (guided zoom).
      canTransitionTo: adjacency(opts.levels, i),
    }));
    /** @type {Map<string, ScaleLevel>} */
    this.byId = new Map(this.levels.map((l) => [l.id, l]));
  }

  get(id) { return this.byId.get(id); }
  list() { return this.levels; }
  ids() { return this.levels.map((l) => l.id); }

  /**
   * Populate a level's slots from loaded blueprint data. Safe no-op if the id
   * is unknown so the app degrades gracefully.
   * @param {string} id
   * @param {Partial<ScaleLevel>} slots
   */
  configureLevel(id, slots) {
    const lvl = this.byId.get(id);
    if (!lvl) { this._log('warn', 'app', `configureLevel: unknown level ${id}`); return; }
    Object.assign(lvl, {
      visibleStructures: slots.visibleStructures || lvl.visibleStructures,
      allowedLabels: slots.allowedLabels || lvl.allowedLabels,
      cameraLimits: slots.cameraLimits || lvl.cameraLimits,
      canTransitionTo: slots.canTransitionTo || lvl.canTransitionTo,
    });
  }

  /** @param {string} from @param {string} to @returns {boolean} */
  canTransition(from, to) {
    const lvl = this.byId.get(from);
    return !!lvl && lvl.canTransitionTo.includes(to);
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

/** Adjacent-level ids for guided zoom. */
function adjacency(levels, i) {
  const out = [];
  if (i > 0) out.push(levels[i - 1].id);
  if (i < levels.length - 1) out.push(levels[i + 1].id);
  return out;
}

export default ScaleSystem;
