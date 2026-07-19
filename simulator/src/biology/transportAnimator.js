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
    this.releaseEngine = deps.releaseEngine || null; // Phase 4: separate release process
    this.uptakeEngine = deps.uptakeEngine || null;   // Phase 4B: separate uptake layer
    this.endocytosisEngine = deps.endocytosisEngine || null; // Phase 4C: separate endocytosis layer
    this.intracellularEngine = deps.intracellularEngine || null; // Phase 4D: separate intracellular layer
    this.targetEngine = deps.targetEngine || null;   // Phase 5A: separate target-engagement layer
    this.signalEngine = deps.signalEngine || null;   // Phase 5B.2: separate signal-propagation layer
    this.transcriptionEngine = deps.transcriptionEngine || null; // Phase 5C: separate transcription layer
    this.renderer = deps.renderer || null;
    this.logger = deps.logger || null;
    this.spawnCount = deps.spawnCount || 14;
    this.spawnBatches = Math.max(1, deps.spawnBatches || 6);
    this.maxSteps = deps.maxSteps || 1200;
    this.untilReleased = !!deps.untilReleased; // continue until payloads empty, not just arrival
    this.onEvent = deps.onEvent || null;
    this.running = false;
    this._raf = null;
    this._step = 0;
    this._spawned = 0;
  }

  /** Reset the run (clears particles + release state + counters). */
  reset() {
    this.engine.reset();
    if (this.releaseEngine) this.releaseEngine.reset();
    if (this.uptakeEngine) this.uptakeEngine.reset();
    if (this.endocytosisEngine) this.endocytosisEngine.reset();
    if (this.intracellularEngine) this.intracellularEngine.reset();
    if (this.targetEngine) this.targetEngine.reset();
    if (this.signalEngine) this.signalEngine.restart();
    if (this.transcriptionEngine) this.transcriptionEngine.restart();
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
    // Phase 4: after transport advances, the SEPARATE release engine releases payload
    // from any particles that have ARRIVED. Transport and release never mix.
    if (this.releaseEngine) events.push(...this.releaseEngine.step(dtHours));
    // Phase 4B: the SEPARATE uptake layer turns released payload into free molecules,
    // diffuses them, and lets them passively enter cells. It never moves carriers.
    if (this.uptakeEngine) events.push(...this.uptakeEngine.step(dtHours));
    // Phase 4C: the SEPARATE endocytosis layer advances carrier fate (reads carriers +
    // cells; never moves carriers or touches upstream engines).
    if (this.endocytosisEngine) events.push(...this.endocytosisEngine.step(dtHours));
    // Phase 4D: the SEPARATE intracellular-release layer releases free drug from
    // cytoplasmic carriers, diffuses it, degrades it, and (if supported) targets the
    // nucleus. It reads endocytosis/uptake read-only and never modifies them.
    if (this.intracellularEngine) events.push(...this.intracellularEngine.step(dtHours));
    // Phase 5A: the SEPARATE target-engagement layer models drug-target binding. It
    // reads intracellular drug read-only and never modifies it.
    if (this.targetEngine) events.push(...this.targetEngine.step(dtHours));
    // Phase 5B.2: the SEPARATE signal-propagation layer advances runtime signaling
    // (activation/suppression/feedback/predictions). It reads the frozen graph +
    // runtime registry read-only and modifies no upstream engine.
    if (this.signalEngine) events.push(...this.signalEngine.step(dtHours));
    // Phase 5C: the SEPARATE transcription layer advances gene regulation (TF activation ->
    // nuclear import -> DNA binding -> transcription -> mRNA). It reads the signal output
    // read-only and modifies no upstream engine. STOPS at mRNA.
    if (this.transcriptionEngine) events.push(...this.transcriptionEngine.step(dtHours));
    this._step += 1;
    if (this.onEvent) for (const e of events) this.onEvent(e);
    if (this.renderer && this.renderer.draw) this.renderer.draw();
    return { blocked: false, events, step: this._step };
  }

  /** Have all spawned particles arrived (and, if requested, emptied)? */
  isComplete() {
    if (this.engine.isBlocked()) return true;
    const s = this.engine.stats();
    const arrived = this._spawned >= this.spawnCount && s.arrived >= this._spawned && s.total > 0;
    if (!arrived) return false;
    if (this.untilReleased && this.releaseEngine) return this.releaseEngine.allEmpty();
    return true;
  }

  /** Headless run to completion (deterministic): returns the final summary. */
  runHeadless(dtHours) {
    this.reset();
    while (!this.isComplete() && this._step < this.maxSteps) this.tick(dtHours);
    return {
      steps: this._step,
      blocked: this.engine.isBlocked(),
      stats: this.engine.stats(),
      release: this.releaseEngine ? this.releaseEngine.stats() : null,
      uptake: this.uptakeEngine ? this.uptakeEngine.stats() : null,
      endocytosis: this.endocytosisEngine ? this.endocytosisEngine.stats() : null,
      intracellular: this.intracellularEngine ? this.intracellularEngine.stats() : null,
      targetEngagement: this.targetEngine ? this.targetEngine.stats() : null,
      signalPropagation: this.signalEngine ? this.signalEngine.stats() : null,
      transcription: this.transcriptionEngine ? this.transcriptionEngine.stats() : null,
      timeH: this.engine.timeH,
    };
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
