// Endocytosis engine (Phase 4C). Simulates the intracellular fate of CARRIER
// nanoparticles: approach -> membrane contact -> wrapping (pathway) -> internalized
// -> early endosome -> late endosome -> lysosome -> (escape -> cytoplasm, only if the
// formulation evidence supports it). It is a SEPARATE layer that READS the uptake +
// transport outputs (carriers + cells) read-only and MODIFIES nothing upstream. It
// applies ONLY to carriers, never to free drug molecules. Nothing beyond intracellular
// trafficking is modelled (no nucleus, PD, PK, signalling, degradation chemistry...).

import { makeRng } from './rng.js';

/** Schematic SIMULATION-SCALE motion constants (NOT biology). Biological content
 * (pathways, probabilities, dwell, escape) lives in the registry. */
export const DEFAULT_PARAMS = Object.freeze({
  approachStep: 0.02,
  wrapRate: 0.16,
  interiorDrift: 0.012,
  contactBand: 0.02,
  approachRange: 0.4,
  dtHours: 0.5,
});

export class EndocytosisEngine {
  /**
   * @param {{
   *   registry:any, fsm:import('./endocytosisStates.js').EndocytosisFSM,
   *   uptakeEngine:object, evidenceEngine?:object, species?:string,
   *   formulationId?:string, params?:object, seed?:number, logger?:object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registry || !deps.fsm || !deps.uptakeEngine) {
      throw new Error('EndocytosisEngine requires registry, fsm and uptakeEngine');
    }
    this.registry = deps.registry;
    this.fsm = deps.fsm;
    this.uptake = deps.uptakeEngine;         // read-only source of carriers + cells
    this.cells = deps.uptakeEngine.cells;
    this.evidence = deps.evidenceEngine || null;
    this.logger = deps.logger || null;
    this.params = { ...DEFAULT_PARAMS, ...(deps.params || {}) };
    this.formulationId = deps.formulationId || 'B1_nlc';
    this.formulation = (deps.registry.formulations || {})[this.formulationId];
    if (!this.formulation) throw new Error(`unknown endocytosis formulation: ${this.formulationId}`);
    this.speciesEndo = deps.registry.species_endocytosis || {};
    this.speciesTraffic = deps.registry.species_trafficking || {};
    this.seed = deps.seed || 1357;
    this.rng = makeRng(this.seed);
    /** @type {Map<string, object>} per-carrier FSM state (endocytosis-owned) */
    this.states = new Map();
    this.timeH = 0;
    this.species = deps.species || deps.uptakeEngine.species;
    this._recompute();
  }

  _recompute() {
    this.evidenceLevel = this._levelFor(this.speciesEndo, this.species);
    this.traffickingLevel = this._levelFor(this.speciesTraffic, this.species);
    this._endoEvidence = this._evidenceFor(this.speciesEndo, this.species, 'Endocytosis');
    this._trafEvidence = this._evidenceFor(this.speciesTraffic, this.species, 'Intracellular Trafficking');
    this.blocked = this.evidence ? !this.evidence.canAnimate(this._endoEvidence) : this.evidenceLevel === 'UNAVAILABLE';
  }

  _levelFor(map, sp) { const s = map[sp]; return s && s.evidence_level ? s.evidence_level : 'UNAVAILABLE'; }
  _evidenceFor(map, sp, label) {
    const s = map[sp];
    if (!s) return { confidence: 'NOT_REPORTED', referenceIds: [], species: sp, evidenceLevel: 'UNAVAILABLE', message: `${label} Evidence: Unavailable.` };
    return {
      confidence: s.confidence || 'MECHANISTIC_TRANSFER',
      referenceIds: s.referenceIds || [],
      species: sp,
      evidenceLevel: s.evidence_level,
      predictive: s.evidence_level === 'PREDICTIVE',
      message: s.message || `${label} Evidence: ${s.evidence_level}.`,
      limitations: [s.observational_support || ''].filter(Boolean),
    };
  }

  isBlocked() { return this.blocked; }
  evidenceLevelName() { return this.evidenceLevel; }
  traffickingLevelName() { return this.traffickingLevel; }
  message() { return this._endoEvidence.message; }
  traffickingMessage() { return this._trafEvidence.message; }
  endocytosisEvidence() { return this._endoEvidence; }
  traffickingEvidence() { return this._trafEvidence; }

  /** Does the formulation's evidence support endosomal escape? */
  escapeAllowed() {
    const e = this.formulation.escape || {};
    return e.state !== 'no_escape' && (e.escape_probability || 0) > 0;
  }

  setSpecies(species) {
    this.species = species;
    this.states.clear();
    this.timeH = 0;
    this.rng = makeRng(this.seed);
    this._recompute();
    return this.species;
  }

  _dermisBand() {
    const b = (this.uptake.transport.layerBands || []).find((x) => x.id === 'dermis');
    return b || { start: 0.3, end: 0.7 };
  }

  _nearestCell(x, u) {
    let best = null;
    for (const c of this.cells.cells) {
      const d = Math.hypot(x - c.x, u - c.u);
      if (!best || d < best.d) best = { cell: c, d };
    }
    return best;
  }

  /** Weighted pathway pick from the registry (never hard-coded). */
  _selectPathway() {
    const w = this.formulation.pathway_weights || {};
    const entries = Object.entries(w);
    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    let r = this.rng.next() * total;
    for (const [name, v] of entries) { r -= v; if (r <= 0) return name; }
    return entries.length ? entries[0][0] : 'clathrin_mediated';
  }

  /** Advance every arrived carrier's intracellular fate one step. */
  step(dtHours = this.params.dtHours) {
    if (this.blocked) return [];
    this.timeH += dtHours;
    const events = [];
    const band = this._dermisBand();
    const span = Math.max(1e-6, band.end - band.start);
    for (const p of this.uptake.transport.particles) {
      if (p.transportStatus !== 'arrived') continue;      // only carriers that reached the target
      let s = this.states.get(p.id);
      if (!s) {
        const u = Math.max(0, Math.min(1, (p.d - band.start) / span));
        const near = this._nearestCell(p.x, u);
        s = {
          carrierId: p.id, state: this.fsm.initial, pathway: null,
          cellId: near && near.d <= this.params.approachRange ? near.cell.id : null,
          ex: p.x, eu: u, wrap: 0, dwell: 0, stalled: false,
        };
        this.states.set(p.id, s);
      }
      this._advance(s, events);
    }
    return events;
  }

  /** Run `steps` steps; returns a summary. */
  run(steps, dtHours = this.params.dtHours) {
    const all = [];
    for (let i = 0; i < steps; i += 1) all.push(...this.step(dtHours));
    return { events: all, stats: this.stats(), timeH: this.timeH };
  }

  _cell(id) { return this.cells.cells.find((c) => c.id === id) || null; }

  _to(s, next, events) {
    this.fsm.assertTransition(s.state, next); // rejects illegal transitions
    s.state = next; s.dwell = 0;
    events.push({ type: 'endocytosis_transition', carrierId: s.carrierId, to: next, pathway: s.pathway });
  }

  _advance(s, events) {
    const cell = this._cell(s.cellId);
    switch (s.state) {
      case 'EXTRACELLULAR': {
        if (!cell || s.stalled) return;                    // no cell in range (or stalled) -> stays extracellular
        // approach the membrane
        const dx = cell.x - s.ex; const du = cell.u - s.eu; const d = Math.hypot(dx, du) || 1e-9;
        const target = cell.radius + this.params.contactBand;
        if (d <= target) { this._to(s, 'MEMBRANE_CONTACT', events); return; }
        const stp = Math.min(this.params.approachStep, d - target);
        s.ex += (dx / d) * stp; s.eu += (du / d) * stp;
        return;
      }
      case 'MEMBRANE_CONTACT': {
        // decide (once) whether this carrier endocytoses (registry probability)
        if (this.rng.next() < (this.formulation.endocytosis_probability || 0)) {
          s.pathway = this._selectPathway();
          this._to(s, 'WRAPPING', events);
        } else {
          s.stalled = true; // does not endocytose; remains at membrane contact
        }
        return;
      }
      case 'WRAPPING': {
        s.wrap = Math.min(1, s.wrap + this.params.wrapRate);
        if (s.wrap >= 1 && cell) {
          const inside = this.cells.justInside(s.ex, s.eu, cell);
          s.ex = inside.x; s.eu = inside.u;
          this._to(s, 'INTERNALIZED', events);
        }
        return;
      }
      case 'INTERNALIZED': { this._to(s, 'EARLY_ENDOSOME', events); return; }
      case 'EARLY_ENDOSOME': {
        this._drift(s, cell);
        if (s.dwell++ >= (this.formulation.trafficking_profile.early_endosome_dwell || 8)) {
          if (this._tryEscape(s, events)) return;
          this._to(s, 'LATE_ENDOSOME', events);
        }
        return;
      }
      case 'LATE_ENDOSOME': {
        this._drift(s, cell);
        if (s.dwell++ >= (this.formulation.trafficking_profile.late_endosome_dwell || 8)) {
          if (this._tryEscape(s, events)) return;
          this._to(s, 'LYSOSOME', events);
        }
        return;
      }
      case 'LYSOSOME': {
        this._drift(s, cell);
        if (s.dwell++ >= (this.formulation.trafficking_profile.lysosome_dwell || 6)) {
          this._tryEscape(s, events);          // no-op unless escape supported; else terminal
        }
        return;
      }
      case 'ESCAPED': { this._to(s, 'CYTOPLASM', events); return; }
      default: return; // CYTOPLASM (terminal) / stalled
    }
  }

  /** Attempt endosomal escape if (and only if) the formulation evidence supports it. */
  _tryEscape(s, events) {
    if (!this.escapeAllowed()) return false;
    if (this.rng.next() < (this.formulation.escape.escape_probability || 0)) {
      this._to(s, 'ESCAPED', events);
      return true;
    }
    return false;
  }

  /** Drift the vesicle a little toward the cell interior (schematic). */
  _drift(s, cell) {
    if (!cell) return;
    const dx = cell.x - s.ex; const du = cell.u - s.eu; const d = Math.hypot(dx, du) || 1e-9;
    const maxR = cell.radius * 0.4;
    if (d > maxR) { s.ex += (dx / d) * this.params.interiorDrift; s.eu += (du / d) * this.params.interiorDrift; }
  }

  /** Per-carrier render/test frame in patch coords. */
  frame() {
    const out = [];
    for (const s of this.states.values()) {
      out.push({
        carrierId: s.carrierId, x: s.ex, u: s.eu, state: s.state,
        pathway: s.pathway, compartment: this.fsm.compartment(s.state), wrap: s.wrap,
      });
    }
    return out;
  }

  stats() {
    const byState = {}; const byPathway = {};
    for (const s of this.states.values()) {
      byState[s.state] = (byState[s.state] || 0) + 1;
      if (s.pathway) byPathway[s.pathway] = (byPathway[s.pathway] || 0) + 1;
    }
    return { total: this.states.size, byState, byPathway };
  }

  reset() { this.states.clear(); this.timeH = 0; this.rng = makeRng(this.seed); }
}

export default EndocytosisEngine;
