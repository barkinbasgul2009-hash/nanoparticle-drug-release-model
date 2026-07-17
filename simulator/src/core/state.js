// Global application state store (Phase 1 foundation).
// A tiny observable store; emits change events via an injected bus.
// Holds app/session state only - no biological data lives here.

/**
 * @typedef {object} AppState
 * @property {string|null} currentPreset
 * @property {string|null} currentScene
 * @property {string|null} species        // active anatomy species (Phase 2.6)
 * @property {string} currentScale       // one of the scale-level ids (L1..L6)
 * @property {string|null} selectedStructure
 * @property {string|null} selectedEvidence
 * @property {string|null} selectedCitation
 * @property {object} ui                 // arbitrary UI flags (panel open/closed)
 * @property {object} camera             // last-known camera descriptor (data only)
 * @property {boolean} debug
 */

/** @returns {AppState} */
export function createInitialState() {
  return {
    currentPreset: null,
    currentScene: null,
    species: null,
    currentScale: 'L1',
    selectedStructure: null,
    selectedEvidence: null,
    selectedCitation: null,
    ui: {},
    camera: null,
    debug: false,
  };
}

export class StateStore {
  /** @param {{ bus?: {emit:Function}, initial?: AppState }} [opts] */
  constructor(opts = {}) {
    /** @type {AppState} */
    this.state = opts.initial || createInitialState();
    this.bus = opts.bus || null;
    /** @type {Array<{prev:AppState, next:AppState, patch:object}>} */
    this.history = [];
    this.maxHistory = 100;
  }

  get() { return this.state; }

  /** @param {Partial<AppState>} patch */
  set(patch) {
    const prev = this.state;
    const next = { ...prev, ...patch };
    this.state = next;
    this.history.push({ prev, next, patch });
    if (this.history.length > this.maxHistory) this.history.shift();
    if (this.bus) this.bus.emit('state:change', { prev, next, patch });
    return next;
  }

  /** Convenience transitions used across the app. */
  setPreset(id) { return this.set({ currentPreset: id }); }
  setScene(id) { return this.set({ currentScene: id }); }
  setSpecies(id) { return this.set({ species: id }); }
  setScale(levelId) { return this.set({ currentScale: levelId }); }
  select(kind, id) {
    const key = kind === 'structure' ? 'selectedStructure'
      : kind === 'evidence' ? 'selectedEvidence'
        : kind === 'citation' ? 'selectedCitation' : null;
    if (!key) throw new Error(`Unknown selection kind: ${kind}`);
    return this.set({ [key]: id });
  }

  reset() { return this.set(createInitialState()); }
}

export default StateStore;
