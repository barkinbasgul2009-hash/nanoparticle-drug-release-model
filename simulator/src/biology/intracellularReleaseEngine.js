// Intracellular release engine (Phase 4D). Monitors carriers that have reached the
// CYTOPLASM (post endosomal escape) and, ONLY when the formulation evidence supports
// it, releases intracellular free drug that diffuses in the cytoplasm, optionally
// degrades, and optionally drifts toward the nucleus (stopping at the nuclear
// membrane - never entering). It is a SEPARATE layer that READS the endocytosis /
// uptake / release outputs read-only and modifies nothing upstream. Nothing beyond
// nucleus targeting is modelled (no DNA/RNA, transcription, PD, PK, apoptosis, ...).

import { makeRng } from './rng.js';
import { IntracellularDrug } from './intracellularDrug.js';

/** Schematic SIMULATION-SCALE motion constants (NOT biology). Biological content
 * (model choice, degradation, targeting decision) lives in the registry. */
export const DEFAULT_PARAMS = Object.freeze({
  moleculesPerCarrier: 4,
  diffusionCytoplasm: 0.016,
  targetingDriftStep: 0.01,
  membraneBand: 0.012,
  dtHours: 0.5,
});

export class IntracellularReleaseEngine {
  /**
   * @param {{
   *   registry:any, releaseModel:import('./intracellularReleaseModel.js').IntracellularReleaseModel,
   *   endocytosisEngine:object, uptakeEngine:object, evidenceEngine?:object,
   *   species?:string, formulationId?:string, params?:object, seed?:number, logger?:object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registry || !deps.releaseModel || !deps.endocytosisEngine || !deps.uptakeEngine) {
      throw new Error('IntracellularReleaseEngine requires registry, releaseModel, endocytosisEngine, uptakeEngine');
    }
    this.registry = deps.registry;
    this.model = deps.releaseModel;
    this.endo = deps.endocytosisEngine;      // read-only source of cytoplasmic carriers
    this.cells = deps.uptakeEngine.cells;     // cell geometry
    this.uptake = deps.uptakeEngine;
    this.evidence = deps.evidenceEngine || null;
    this.logger = deps.logger || null;
    this.params = { ...DEFAULT_PARAMS, ...(deps.params || {}) };
    this.formulationId = deps.formulationId || 'B1_nlc';
    this.formulation = (deps.registry.formulations || {})[this.formulationId];
    if (!this.formulation) throw new Error(`unknown intracellular formulation: ${this.formulationId}`);
    this.speciesIntra = deps.registry.species_intracellular || {};
    this.nucleusCfg = deps.registry.nucleus || { radius_fraction: 0.4, membrane_thickness: 0.006 };
    this.seed = deps.seed || 9753;
    this.rng = makeRng(this.seed);
    /** @type {IntracellularDrug[]} */
    this.molecules = [];
    this._carriers = new Map();   // carrierId -> { t0, spawned }
    this.degradedCount = 0;
    this.timeH = 0;
    this.species = deps.species || deps.endocytosisEngine.species;
    this._recompute();
  }

  _recompute() {
    const rel = this.formulation.intracellular_release || {};
    this.releaseLevel = rel.evidence_level || 'NOT_REPORTED';
    this._evidence = this._evidenceDescriptor();
    this.blocked = this.evidence ? !this.evidence.canAnimate(this._evidence) : !(this.releaseLevel === 'EXPERIMENTAL' || this.releaseLevel === 'PREDICTIVE');
  }

  _evidenceDescriptor() {
    const sp = this.speciesIntra[this.species];
    const confidence = this.releaseLevel === 'EXPERIMENTAL' ? 'QUALITATIVELY_SUPPORTED'
      : this.releaseLevel === 'PREDICTIVE' ? 'MECHANISTIC_TRANSFER' : 'NOT_REPORTED';
    return {
      confidence,
      referenceIds: (this.formulation.intracellular_release && this.formulation.intracellular_release.evidence_level === 'EXPERIMENTAL') ? (sp && sp.referenceIds) || [] : [],
      species: this.species,
      evidenceLevel: this.releaseLevel,
      message: (sp && sp.message) || `Intracellular Release Evidence: ${this.releaseLevel}.`,
    };
  }

  isBlocked() { return this.blocked; }
  evidenceLevelName() { return this.releaseLevel; }
  message() { return this._evidence.message; }
  evidenceDescriptor() { return this._evidence; }

  /** Degradation mode (or null) - only applied when evidence supports it. */
  degradationMode() {
    const d = this.formulation.degradation || {};
    return (d.evidence_level === 'EXPERIMENTAL' || d.evidence_level === 'PREDICTIVE') ? d.mode : null;
  }

  /** Nucleus-targeting mode - 'none' unless targeting evidence supports otherwise. */
  targetingMode() {
    const t = this.formulation.nucleus_targeting || {};
    return (t.evidence_level === 'EXPERIMENTAL' || t.evidence_level === 'PREDICTIVE') ? (t.mode || 'none') : 'none';
  }

  setSpecies(species) {
    this.species = species;
    this.molecules = [];
    this._carriers.clear();
    this.degradedCount = 0;
    this.timeH = 0;
    this.rng = makeRng(this.seed);
    this._recompute();
    return this.species;
  }

  /** Schematic nucleus geometry for a cell (concentric). */
  nucleusFor(cell) {
    return { x: cell.x, u: cell.u, radius: cell.radius * this.nucleusCfg.radius_fraction, membraneThickness: this.nucleusCfg.membrane_thickness, label: this.nucleusCfg.label };
  }

  _cell(id) { return this.cells.cells.find((c) => c.id === id) || null; }

  /** Cytoplasmic carriers (endocytosis state CYTOPLASM). */
  _cytoplasmicCarriers() {
    const out = [];
    for (const s of this.endo.states.values()) if (s.state === 'CYTOPLASM') out.push(s);
    return out;
  }

  /** Expected intracellular molecule count = released fraction quantised per carrier. */
  expectedMoleculeCount() {
    if (this.blocked) return 0;
    const rel = this.formulation.intracellular_release || {};
    let n = 0;
    for (const s of this._cytoplasmicCarriers()) {
      const rec = this._carriers.get(s.carrierId);
      const t = rec ? this.timeH - rec.t0 : 0;
      const F = this.model.fractionReleased(rel.model, rel.params, t);
      n += Math.round(F * this.params.moleculesPerCarrier);
    }
    return n;
  }

  step(dtHours = this.params.dtHours) {
    if (this.blocked) return [];
    this.timeH += dtHours;
    const events = [];
    events.push(...this._releaseFromCarriers());
    this._diffuse(dtHours);
    events.push(...this._degrade());
    return events;
  }

  _releaseFromCarriers() {
    const events = [];
    const rel = this.formulation.intracellular_release || {};
    const target = this.targetingMode();
    for (const s of this._cytoplasmicCarriers()) {
      let rec = this._carriers.get(s.carrierId);
      if (!rec) { rec = { t0: this.timeH, spawned: 0 }; this._carriers.set(s.carrierId, rec); }
      const t = this.timeH - rec.t0;
      const F = this.model.fractionReleased(rel.model, rel.params, t);
      const want = Math.round(F * this.params.moleculesPerCarrier);
      for (let i = rec.spawned; i < want; i += 1) {
        const jx = this.rng.signed() * 0.01; const ju = this.rng.signed() * 0.01;
        const m = new IntracellularDrug({
          x: s.ex + jx, u: s.eu + ju, species: this.species,
          diffusion: this.params.diffusionCytoplasm, cellId: s.cellId, parentCarrierId: s.carrierId,
          releaseTimeH: this.timeH, evidenceLevel: this.releaseLevel,
          targetCompartment: target === 'none' ? 'cytoplasm' : 'nucleus',
        });
        this.molecules.push(m);
        events.push({ type: 'intracellular_release', moleculeId: m.id, carrierId: s.carrierId });
      }
      if (want > rec.spawned) rec.spawned = want;
    }
    return events;
  }

  _diffuse(dtHours) {
    const s = Math.sqrt(dtHours);
    const cap = 0.026;
    const target = this.targetingMode();
    for (const m of this.molecules) {
      if (!m.alive || m.compartment === 'nuclear_membrane') continue; // stopped at nucleus / degraded
      const cell = this._cell(m.cellId);
      if (!cell) continue;
      const nuc = this.nucleusFor(cell);
      // Brownian
      m.vx = clamp(m.diffusion * s * this.rng.normal(), -cap, cap);
      m.vu = clamp(m.diffusion * s * this.rng.normal(), -cap, cap);
      let nx = m.x + m.vx; let nu = m.u + m.vu;
      // optional nucleus targeting drift (evidence-gated)
      if (target !== 'none') {
        const dx = nuc.x - nx; const du = nuc.u - nu; const d = Math.hypot(dx, du) || 1e-9;
        const stepAmt = this.params.targetingDriftStep * (target === 'evidence_supported' ? 1 : 0.5);
        nx += (dx / d) * stepAmt; nu += (du / d) * stepAmt;
      }
      // confine to the cytoplasm annulus: inside the cell membrane, OUTSIDE the nucleus
      const q = this._confine(nx, nu, cell, nuc, m);
      m.x = q.x; m.u = q.u;
    }
  }

  /** Keep a molecule inside the cell and outside the nucleus; stop at nuclear membrane if targeting. */
  _confine(x, u, cell, nuc, m) {
    // cell membrane (outer)
    let dx = x - cell.x; let du = u - cell.u; let d = Math.hypot(dx, du);
    const maxR = cell.radius - (this.cells.membraneThickness || 0.008) * 1.5;
    if (d > maxR) { const k = maxR / (d || 1e-9); x = cell.x + dx * k; u = cell.u + du * k; }
    // nuclear membrane (inner) - never enter
    dx = x - nuc.x; du = u - nuc.u; d = Math.hypot(dx, du);
    const minR = nuc.radius + nuc.membraneThickness + this.params.membraneBand;
    if (d < minR) {
      const k = minR / (d || 1e-9);
      x = nuc.x + dx * k; u = nuc.u + du * k;
      if (this.targetingMode() !== 'none') m.compartment = 'nuclear_membrane'; // stopped at the membrane
    }
    return { x, u };
  }

  _degrade() {
    const mode = this.degradationMode();
    if (!mode || mode === 'stable') return [];
    const events = [];
    const d = this.formulation.degradation || {};
    const rate = (d.params && d.params.rate_per_step) || 0;
    if (rate <= 0) return [];
    const floor = mode === 'partial' ? ((d.params && d.params.residual_fraction) || 0.5) : 0;
    for (const m of this.molecules) {
      if (!m.alive) continue;
      const aliveFrac = 1 - this.degradedCount / Math.max(1, this.molecules.length);
      if (mode === 'partial' && aliveFrac <= floor) break;
      if (this.rng.next() < rate) { m.alive = false; this.degradedCount += 1; events.push({ type: 'intracellular_degradation', moleculeId: m.id }); }
    }
    return events;
  }

  run(steps, dtHours = this.params.dtHours) {
    const all = [];
    for (let i = 0; i < steps; i += 1) all.push(...this.step(dtHours));
    return { events: all, stats: this.stats(), timeH: this.timeH };
  }

  stats() {
    let alive = 0; let cytoplasm = 0; let nuclearMembrane = 0;
    for (const m of this.molecules) {
      if (m.alive) alive += 1;
      if (m.compartment === 'cytoplasm') cytoplasm += 1; else if (m.compartment === 'nuclear_membrane') nuclearMembrane += 1;
    }
    return { total: this.molecules.length, alive, degraded: this.degradedCount, cytoplasm, nuclearMembrane };
  }

  reset() { this.molecules = []; this._carriers.clear(); this.degradedCount = 0; this.timeH = 0; this.rng = makeRng(this.seed); }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default IntracellularReleaseEngine;
