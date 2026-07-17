// Debug tools (Phase 1). Reports foundation status: loaded preset/scene/
// references/citations, current scale, camera descriptor, and app state. Includes
// an optional FPS meter that samples the rAF heartbeat in a browser (it renders
// nothing and is a no-op in Node).

export class DebugTools {
  /**
   * @param {{
   *   state?: object, presetEngine?: object, sceneManager?: object,
   *   citationEngine?: object, scaleSystem?: object, cameraSystem?: object,
   *   loader?: object, logger?: object, enabled?: boolean, showFps?: boolean
   * }} deps
   */
  constructor(deps = {}) {
    this.deps = deps;
    this.enabled = deps.enabled !== false;
    this.showFps = !!deps.showFps;
    this.fps = 0;
    this._rafId = null;
    this._frames = 0;
    this._last = 0;
  }

  /** Collect a full status snapshot for display or logging. */
  snapshot() {
    const d = this.deps;
    return {
      enabled: this.enabled,
      fps: this.fps,
      preset: d.presetEngine ? (d.state && d.state.get().currentPreset) : null,
      presetsLoaded: d.presetEngine ? d.presetEngine.list().map((p) => p.id) : [],
      activeScene: d.sceneManager ? d.sceneManager.activeId : null,
      scenesRegistered: d.sceneManager ? d.sceneManager.list().map((s) => s.id) : [],
      referencesLoaded: d.loader ? d.loader.cache.size : 0,
      citations: d.citationEngine ? d.citationEngine.size() : 0,
      currentScale: d.state ? d.state.get().currentScale : null,
      scaleLevels: d.scaleSystem ? d.scaleSystem.ids() : [],
      camera: d.cameraSystem ? d.cameraSystem.snapshot() : null,
      state: d.state ? d.state.get() : null,
    };
  }

  /** Start the FPS heartbeat (browser only; renders nothing). */
  startFps() {
    if (!this.showFps || typeof requestAnimationFrame === 'undefined') return;
    const tick = (t) => {
      if (!this._last) this._last = t;
      this._frames += 1;
      if (t - this._last >= 1000) {
        this.fps = this._frames;
        this._frames = 0;
        this._last = t;
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stopFps() {
    if (this._rafId != null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }
}

export default DebugTools;
