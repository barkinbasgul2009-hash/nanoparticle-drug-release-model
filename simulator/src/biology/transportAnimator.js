// Transport animator (Phase 3). Drives the transport engine over time and asks the
// renderer to repaint. It implements ONLY: spawn, movement, barrier crossing, layer
// transitions and arrival - no intracellular animation, no easing tricks, no effects.
// Movement is smooth because it is many small evidence-based steps, not scripted keyframes.
//
// In a browser it uses requestAnimationFrame; headless (tests) call tick()/runHeadless().

export class TransportAnimator {
  /**
   * @param {{
   *   engine: import('./transportEngine.js').TransportEngine,
   *   renderer?: object, logger?: object,
   *   spawnCount?: number, spawnBatches?: number, maxSteps?: number,
   *   onEvent?: (e:object)=>void
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.engine) throw new Error('TransportAnimator requires an engine');
    this.engine = deps.engine;
    this.renderer = deps.renderer || null;
    this.logger = deps.logger || null;
    this.spawnCount = deps.spawnCount || 14;
    this.spawnBatches = Math.max(1, deps.spawnBatches || 6);
    this.maxSteps = deps.maxSteps || 1200;
    this.onEvent = deps.onEvent || null;
    this.running = false;
    this._raf = null;
    this._step = 0;
    this._spawned = 0;
  }

  /** Reset the run (clears particles + counters). */
  reset() {
    this.engine.reset();
    this._step = 0;
    this._spawned = 0;
    if (this.renderer && this.renderer.draw) this.renderer.draw();
  }

  /** One animation tick: staggered spawn, one engine step, one repaint. */
  tick(dtHours) {
    if (this.engine.isBlocked()) return { blocked: true, reason: this.engine.blockReason(), events: [] };
    // Staggered spawning so particles enter over time (not all at once).
    const perBatch = Math.ceil(this.spawnCount / this.spawnBatches);
    const spawnEvery = Math.max(1, Math.floor(this.maxSteps / (this.spawnBatches * 6)));
    if (this._spawned < this.spawnCount && this._step % spawnEvery === 0) {
      const n = Math.min(perBatch, this.spawnCount - this._spawned);
      this.engine.spawn(n);
      this._spawned += n;
    }
    const events = this.engine.step(dtHours);
    this._step += 1;
    if (this.onEvent) for (const e of events) this.onEvent(e);
    if (this.renderer && this.renderer.draw) this.renderer.draw();
    return { blocked: false, events, step: this._step };
  }

  /** Have all spawned particles arrived (run complete)? */
  isComplete() {
    if (this.engine.isBlocked()) return true;
    const s = this.engine.stats();
    return this._spawned >= this.spawnCount && s.arrived >= this._spawned && s.total > 0;
  }

  /** Headless run to completion (deterministic): returns the final summary. */
  runHeadless(dtHours) {
    this.reset();
    while (!this.isComplete() && this._step < this.maxSteps) this.tick(dtHours);
    return { steps: this._step, blocked: this.engine.isBlocked(), stats: this.engine.stats(), timeH: this.engine.timeH };
  }

  /** Browser animation loop. Auto-stops when complete or at maxSteps. */
  start(dtHours) {
    if (this.running) return;
    if (this.engine.isBlocked()) {
      this._log('info', 'transport', `not started: ${this.engine.blockReason()}`);
      return;
    }
    this.running = true;
    const raf = (typeof requestAnimationFrame !== 'undefined')
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(Date.now()), 16);
    const loop = () => {
      if (!this.running) return;
      this.tick(dtHours);
      if (this.isComplete() || this._step >= this.maxSteps) { this.stop(); return; }
      this._raf = raf(loop);
    };
    this._raf = raf(loop);
  }

  stop() {
    this.running = false;
    if (this._raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default TransportAnimator;
