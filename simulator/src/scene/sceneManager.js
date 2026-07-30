// Scene manager (Phase 1). Registers, activates, transitions, and cleans up
// independent scientific scenes. NO scenes are registered here - later phases
// (Anatomy, B1, ...) register their own. Scenes implement a small lifecycle
// contract; the manager never assumes rendering.

/**
 * @typedef {object} SceneMeta
 * @property {string} id
 * @property {string} [title]
 * @property {string} [preset]     // owning preset id, if any
 * @property {string} [scale]      // scale level id this scene lives at
 * @property {object} [evidence]   // evidence descriptor (opaque to the manager)
 */

/**
 * @typedef {object} Scene
 * @property {SceneMeta} meta
 * @property {(ctx: object) => (void|Promise<void>)} [init]
 * @property {(ctx: object) => void} [enter]
 * @property {(ctx: object) => void} [exit]
 * @property {() => void} [dispose]
 */

export class SceneManager {
  /** @param {{ bus?: {emit:Function}, logger?: object }} [opts] */
  constructor(opts = {}) {
    /** @type {Map<string, Scene>} */
    this.scenes = new Map();
    this.bus = opts.bus || null;
    this.logger = opts.logger || null;
    /** @type {string|null} */
    this.activeId = null;
    /** @type {object} */
    this.shared = {}; // shared state available to all scenes
  }

  /** @param {Scene} scene */
  register(scene) {
    if (!scene || !scene.meta || !scene.meta.id) throw new Error('scene must have meta.id');
    if (this.scenes.has(scene.meta.id)) throw new Error(`scene already registered: ${scene.meta.id}`);
    this.scenes.set(scene.meta.id, scene);
    this._log('info', 'scene', `registered scene ${scene.meta.id}`);
    if (this.bus) this.bus.emit('scene:registered', scene.meta);
    return scene;
  }

  /** @param {string} id */
  has(id) { return this.scenes.has(id); }
  /** @param {string} id */
  get(id) { return this.scenes.get(id); }
  list() { return [...this.scenes.values()].map((s) => s.meta); }

  /**
   * Transition to a scene: exit the current, enter the target. Idempotent for
   * the already-active scene.
   * @param {string} id
   * @param {object} [ctx] shared context passed to lifecycle hooks
   */
  async transitionTo(id, ctx = {}) {
    if (!this.scenes.has(id)) throw new Error(`unknown scene: ${id}`);
    if (this.activeId === id) return this.scenes.get(id);
    const context = { ...ctx, shared: this.shared };

    if (this.activeId) {
      const current = this.scenes.get(this.activeId);
      if (current && current.exit) current.exit(context);
      if (this.bus) this.bus.emit('scene:exit', current.meta);
    }

    const next = this.scenes.get(id);
    if (next.init && !next._initialized) {
      await next.init(context);
      next._initialized = true;
    }
    if (next.enter) next.enter(context);
    this.activeId = id;
    this._log('info', 'scene', `active scene -> ${id}`);
    if (this.bus) this.bus.emit('scene:enter', next.meta);
    return next;
  }

  /** Dispose a single scene and drop it from the registry. */
  dispose(id) {
    const s = this.scenes.get(id);
    if (!s) return;
    if (this.activeId === id) this.activeId = null;
    if (s.dispose) s.dispose();
    this.scenes.delete(id);
    this._log('info', 'scene', `disposed scene ${id}`);
  }

  /** Dispose every scene (app teardown). */
  clear() {
    for (const id of [...this.scenes.keys()]) this.dispose(id);
    this.shared = {};
    this.activeId = null;
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default SceneManager;
