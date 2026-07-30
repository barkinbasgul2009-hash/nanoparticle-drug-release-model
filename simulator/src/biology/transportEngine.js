// Transport engine (Phase 3). The biological simulation core: it moves independent
// NLC particles from the topical formulation THROUGH the skin barriers to the target
// region, using ONLY passive mechanisms (Brownian + concentration-driven drift)
// modified by evidence-based, per-layer mobility. It is PURE (no canvas/DOM), fully
// deterministic under a seed, and headless-testable.
//
// Species-driven + evidence-gated: the engine simulates ONLY for a species whose
// topical transport is SUPPORTED by evidence (rat). For human/mouse (NOT REPORTED)
// it BLOCKS - no particles, no motion - with NO fallback to rat.
//
// It implements NO drug release, cell entry, endocytosis, payload or PK/PD.

import { makeRng } from './rng.js';
import { Particle } from './particle.js';

/** Schematic SIMULATION-SCALE constants (NOT biological rates - only relative
 * timing). The BIOLOGICAL content (mobility ordering, states, evidence) lives in
 * the registry; these just set how fast the schematic animation advances. */
export const DEFAULT_PARAMS = Object.freeze({
  driftRatePerHour: 0.15,  // downward concentration-driven drift (normalized depth / h)
  brownianAmp: 0.008,      // thermal jitter amplitude (normalized)
  dtHours: 0.2,            // simulation time step
  spawnDepth: -0.03,       // just above the surface (formulation compartment)
  spawnXSpread: [0.15, 0.85],
});

export class TransportEngine {
  /**
   * @param {{
   *   transportModel: import('./transportModel.js').TransportModel,
   *   anatomyModel: import('../anatomy/anatomyModel.js').AnatomyModel,
   *   stateMachine: import('./transportStates.js').BiologicalStateMachine,
   *   evidenceEngine?: import('../evidence/evidenceEngine.js').EvidenceEngine,
   *   species?: string, seed?: number, params?: object, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.transportModel || !deps.anatomyModel || !deps.stateMachine) {
      throw new Error('TransportEngine requires transportModel, anatomyModel and stateMachine');
    }
    this.transport = deps.transportModel;
    this.anatomy = deps.anatomyModel;
    this.sm = deps.stateMachine;
    this.evidence = deps.evidenceEngine || null;
    this.logger = deps.logger || null;
    this.params = { ...DEFAULT_PARAMS, ...(deps.params || {}) };
    this.seed = deps.seed || 12345;
    this.rng = makeRng(this.seed);
    /** @type {Particle[]} */
    this.particles = [];
    this.timeH = 0;
    this.species = deps.species || this.anatomy.activeSpecies;
    this._recompute();
  }

  /** Recompute per-species layer depth bands + support/blocked status. */
  _recompute() {
    this.layerBands = computeLayerBands(this.anatomy, this.species);
    this._bandById = new Map(this.layerBands.map((b) => [b.id, b]));
    const dermis = this._bandById.get('dermis');
    // Target = centre of the dermis band (topical target tissue; no systemic stage).
    this.arrivalDepth = dermis ? (dermis.start + dermis.end) / 2 : 0.6;
    this.surfaceTop = 0; // first tissue band starts at depth 0
    this.evidenceLevel = this.transport.evidenceLevelFor(this.species); // EXPERIMENTAL|PREDICTIVE|UNAVAILABLE
    this.predictive = this.evidenceLevel === 'PREDICTIVE';
    this.supported = this.transport.canAnimateSpecies(this.species);
    this._speciesEvidence = this.transport.evidenceForSpecies(this.species);
    // The evidence gate: EXPERIMENTAL + PREDICTIVE animate; UNAVAILABLE (NOT_REPORTED) is blocked.
    this.blocked = this.evidence
      ? !this.evidence.canAnimate(this._speciesEvidence)
      : !this.supported;
  }

  /** Evidence Level of the active species (EXPERIMENTAL | PREDICTIVE | UNAVAILABLE). */
  evidenceLevelName() { return this.evidenceLevel; }
  isPredictive() { return this.predictive; }
  isExperimental() { return this.evidenceLevel === 'EXPERIMENTAL'; }
  /** Species-facing Evidence Level message (UX). */
  message() { return this.transport.messageFor(this.species); }

  /** Switch species (species-driven; recomputes bands + gate; clears particles). */
  setSpecies(species) {
    this.species = species;
    this.particles = [];
    this.timeH = 0;
    this.rng = makeRng(this.seed);
    this._recompute();
    this._log('info', 'transport', `species -> ${species} (${this.blocked ? 'BLOCKED: ' + this.blockReason() : 'supported'})`);
    return this.species;
  }

  isBlocked() { return this.blocked; }

  /** Why transport is blocked for the current species (or null if supported). */
  blockReason() {
    if (!this.blocked) return null;
    const s = this.transport.speciesSupport(this.species);
    return (s && s.reason) || `transport NOT REPORTED for species '${this.species}'`;
  }

  /** Evidence descriptor for the current species' transport (for UI badges). */
  speciesEvidence() { return this._speciesEvidence; }

  /**
   * Spawn n particles at the formulation. No-op (returns []) when blocked - an
   * unsupported species cannot animate transport (no fallback).
   * @param {number} n
   */
  spawn(n = 12) {
    if (this.blocked) {
      this._log('debug', 'transport', `spawn blocked for ${this.species}: ${this.blockReason()}`);
      return [];
    }
    const [x0, x1] = this.params.spawnXSpread;
    const created = [];
    const firstEv = this.sm.evidenceForTransition('formulation');
    for (let i = 0; i < n; i += 1) {
      const x = x0 + (x1 - x0) * this.rng.next();
      const p = new Particle({
        species: this.species,
        x,
        d: this.params.spawnDepth,
        state: 'formulation',
        layer: null,
        charge: this.transport.particleSpec.charge_classes ? this.transport.particleSpec.charge_classes[0] : 'cationic',
        evidence: firstEv,
      });
      this.particles.push(p);
      created.push(p);
    }
    this._log('info', 'transport', `spawned ${created.length} particles (${this.species})`);
    return created;
  }

  /**
   * Advance the whole simulation by one time step. Returns the events that
   * occurred (transitions, barrier crossings, arrivals). No-op when blocked.
   * @param {number} [dtHours]
   */
  step(dtHours = this.params.dtHours) {
    if (this.blocked) return [];
    const events = [];
    this.timeH += dtHours;
    for (const p of this.particles) {
      if (p.transportStatus === 'arrived') { this._jitterInPlace(p, dtHours); continue; }
      const prevState = p.state;
      const layerId = this._layerAt(p.d);
      const m = layerId ? this.transport.mobilityFor(layerId) : 1; // formulation = free
      // concentration-driven downward drift, scaled by evidence-based mobility
      const drift = this.params.driftRatePerHour * m * dtHours;
      // Brownian jitter (both axes), scaled by mobility and sqrt(dt)
      const j = this.params.brownianAmp * m * Math.sqrt(dtHours);
      p.d += drift + j * this.rng.normal();
      p.x = clamp(p.x + j * this.rng.normal(), 0.03, 0.97);
      // clamp depth to the bottom of the dermis (target tissue; no deeper travel)
      const dermis = this._bandById.get('dermis');
      if (dermis) p.d = Math.min(p.d, dermis.end);
      p.d = Math.max(p.d, this.params.spawnDepth);

      // resolve new state from depth
      const nowLayer = this._layerAt(p.d);
      p.layer = nowLayer;
      let nowState = this._stateAt(p.d);
      p.transportStatus = nowLayer === 'stratum_corneum' ? 'crossing_barrier' : 'moving';

      if (p.d >= this.arrivalDepth) {
        nowState = 'target_region';
        p.transportStatus = 'arrived';
      }
      if (nowState !== prevState) {
        const ev = this.sm.evidenceForTransition(prevState);
        p.state = nowState;
        p.evidenceTag = ev;
        p.recordCrossing(prevState, nowState, ev);
        events.push({
          type: nowState === 'target_region' ? 'arrival' : 'transition',
          particleId: p.id, from: prevState, to: nowState, evidence: ev,
        });
      }
    }
    return events;
  }

  /** Run `steps` steps; returns a summary of the run. */
  run(steps, dtHours = this.params.dtHours) {
    const all = [];
    for (let i = 0; i < steps; i += 1) all.push(...this.step(dtHours));
    return { events: all, stats: this.stats(), timeH: this.timeH };
  }

  /** Counts by state + arrived count. */
  stats() {
    const byState = {};
    for (const p of this.particles) byState[p.state] = (byState[p.state] || 0) + 1;
    return { total: this.particles.length, arrived: byState.target_region || 0, byState };
  }

  reset() { this.particles = []; this.timeH = 0; this.rng = makeRng(this.seed); }

  /** Tiny in-place jitter for arrived particles (stays put; still 'alive'). */
  _jitterInPlace(p, dtHours) {
    const j = this.params.brownianAmp * 0.3 * Math.sqrt(dtHours);
    p.x = clamp(p.x + j * this.rng.normal(), 0.03, 0.97);
  }

  /** Tissue layer id at a normalized depth, or null if above the surface. */
  _layerAt(d) {
    if (d < this.surfaceTop) return null;
    for (const b of this.layerBands) if (d >= b.start && d < b.end) return b.id;
    return this.layerBands.length ? this.layerBands[this.layerBands.length - 1].id : null;
  }

  /** State id at a normalized depth (maps layer -> state; formulation above surface). */
  _stateAt(d) {
    if (d < this.surfaceTop) return 'formulation';
    const layer = this._layerAt(d);
    if (layer === 'skin_surface') return 'skin_surface';
    if (layer === 'stratum_corneum') return 'stratum_corneum';
    if (layer === 'viable_epidermis') return 'viable_epidermis';
    // dermis or below maps to dermis until the arrival depth flips it to target
    return 'dermis';
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

/**
 * Compute normalized depth bands [start,end] over the full tissue stack (excludes
 * 'air') using the ACTIVE species' draw weights. Species-driven: switching species
 * changes the barrier depths, so the transport follows the selected anatomy.
 * @param {import('../anatomy/anatomyModel.js').AnatomyModel} anatomy
 * @param {string} species
 */
export function computeLayerBands(anatomy, species) {
  const weights = anatomy.weightsForSpecies(species); // throws on unsupported species
  const stack = anatomy.layers.filter((l) => l.id !== 'air');
  const total = stack.reduce((s, l) => s + (weights[l.id] || 0), 0) || 1;
  let acc = 0;
  return stack.map((l) => {
    const start = acc / total;
    acc += (weights[l.id] || 0);
    return { id: l.id, start, end: acc / total };
  });
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default TransportEngine;
