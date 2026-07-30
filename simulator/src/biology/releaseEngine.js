// Release engine (Phase 4). The drug-release simulation: for each particle that
// has ARRIVED at the target region, it releases the encapsulated payload following
// the evidence-selected first-order model. Drug inside decreases, released amount
// increases, and an aggregate release curve is maintained until the carrier empties.
//
// This is a COMPLETELY separate process from transport. The engine READS each
// particle's transportStatus (never writes it) and never moves particles. Release
// state lives here (keyed by particle id), NOT on the transport Particle, keeping
// the two domains cleanly separated. It implements NOTHING beyond release - no
// uptake, membrane crossing, endocytosis, PK, PD, etc.

/** Schematic SIMULATION-SCALE release rate (NOT a measured constant). The MODEL
 * (first-order) is evidence-based; k is NOT REPORTED, so this schematic rate is
 * anchored to span the reported 1-48 h release window and claims no exact value. */
export const DEFAULT_PARAMS = Object.freeze({
  schematicKPerHour: 0.0625, // ~ spans the reported 1-48 h window; schematic only
  emptyThreshold: 0.99,      // released fraction at which the carrier is 'empty'
  dtHours: 0.5,
});

export class ReleaseEngine {
  /**
   * @param {{
   *   releaseModel: import('./releaseModel.js').ReleaseModel,
   *   transportEngine?: object, particles?: object[],
   *   evidenceEngine?: object, params?: object, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.releaseModel) throw new Error('ReleaseEngine requires a releaseModel');
    this.model = deps.releaseModel;
    this.transport = deps.transportEngine || null;
    this._particles = deps.particles || null; // optional explicit source
    this.evidence = deps.evidenceEngine || null;
    this.logger = deps.logger || null;
    this.params = { ...DEFAULT_PARAMS, ...(deps.params || {}) };
    /** @type {Map<string, {payloadFraction:number, releasedFraction:number, releaseState:string, tReleaseH:number}>} */
    this.states = new Map();
    /** @type {Array<{t:number, released:number}>} aggregate release curve */
    this.curvePoints = [];
    this.timeH = 0;
  }

  /** Current particle source (transport engine's particles, or an explicit list). */
  particles() {
    if (this._particles) return this._particles;
    return this.transport && this.transport.particles ? this.transport.particles : [];
  }

  /** Release state for a particle id (or null if release has not begun). */
  stateFor(id) { return this.states.get(id) || null; }

  /** Payload fraction remaining for a particle (1 if release has not begun). */
  payloadOf(id) { const s = this.states.get(id); return s ? s.payloadFraction : 1; }

  /**
   * Advance drug release by one step. Only particles with transportStatus ===
   * 'arrived' release; everything else is ignored (transport must end first).
   * @param {number} [dtHours]
   * @returns {object[]} events (release_start / release_complete)
   */
  step(dtHours = this.params.dtHours) {
    const events = [];
    this.timeH += dtHours;
    const k = this.params.schematicKPerHour;
    for (const p of this.particles()) {
      if (p.transportStatus !== 'arrived') continue; // release begins only after transport ends
      let s = this.states.get(p.id);
      if (!s) {
        s = { payloadFraction: 1, releasedFraction: 0, releaseState: 'loaded', tReleaseH: 0 };
        this.states.set(p.id, s);
      }
      if (s.releaseState === 'empty') continue;
      if (s.releaseState === 'loaded') {
        s.releaseState = 'releasing';
        events.push({ type: 'release_start', particleId: p.id, evidence: this.model.evidence() });
      }
      s.tReleaseH += dtHours;
      s.releasedFraction = this.model.fractionReleased(s.tReleaseH, k);
      s.payloadFraction = 1 - s.releasedFraction; // conservation
      if (s.releasedFraction >= this.params.emptyThreshold) {
        s.releasedFraction = 1;
        s.payloadFraction = 0;
        s.releaseState = 'empty';
        events.push({ type: 'release_complete', particleId: p.id, evidence: this.model.evidence() });
      }
    }
    // update the aggregate release curve (mean released fraction across releasing carriers)
    const st = this.stats();
    if (st.withState > 0) this.curvePoints.push({ t: this.timeH, released: st.meanReleased });
    return events;
  }

  /** Run `steps` release steps; returns a summary. */
  run(steps, dtHours = this.params.dtHours) {
    const all = [];
    for (let i = 0; i < steps; i += 1) all.push(...this.step(dtHours));
    return { events: all, stats: this.stats(), curve: this.curve(), timeH: this.timeH };
  }

  /** Aggregate release statistics. */
  stats() {
    let releasing = 0; let empty = 0; let sum = 0; let withState = 0;
    for (const s of this.states.values()) {
      withState += 1;
      sum += s.releasedFraction;
      if (s.releaseState === 'releasing') releasing += 1;
      else if (s.releaseState === 'empty') empty += 1;
    }
    return {
      withState,
      releasing,
      empty,
      meanReleased: withState ? sum / withState : 0,
    };
  }

  /** The aggregate release curve (time -> mean released fraction). */
  curve() { return this.curvePoints.slice(); }

  /** True once every particle that began releasing has emptied (and at least one has). */
  allEmpty() {
    if (this.states.size === 0) return false;
    for (const s of this.states.values()) if (s.releaseState !== 'empty') return false;
    return true;
  }

  /** Evidence descriptor for the release model. */
  evidenceDescriptor() { return this.model.evidence(); }

  reset() { this.states.clear(); this.curvePoints = []; this.timeH = 0; }
}

export default ReleaseEngine;
