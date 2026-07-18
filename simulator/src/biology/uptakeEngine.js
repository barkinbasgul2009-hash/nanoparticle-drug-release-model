// Uptake engine (Phase 4B). The free-drug-molecule simulation layer: it turns the
// release engine's released payload into INDEPENDENT drug molecules, diffuses them
// (Brownian) through the extracellular space, and lets them PASSIVELY cross a cell
// membrane into the cytoplasm, where they continue to diffuse. It is a SEPARATE
// layer - it reads (never writes) transport + release state and never moves carriers.
//
// Passive ONLY. No receptors, channels, pumps, vesicles or ANY endocytic route, and
// nothing intracellular beyond simple diffusion (no organelles, binding, metabolism).
// Coordinates live in the isotropic (x,u) patch of the target (dermis) tissue.

import { makeRng } from './rng.js';
import { DrugMolecule } from './drugMolecule.js';

/** Schematic SIMULATION-SCALE constants (NOT measured coefficients). The passive
 * MODEL is evidence-tagged; these magnitudes are schematic (diffusion / permeability
 * are NOT REPORTED for this system). */
export const DEFAULT_PARAMS = Object.freeze({
  moleculesPerCarrier: 5,
  diffusionExtracellular: 0.03,
  diffusionCytoplasm: 0.018,
  crossProbability: 0.35,   // per-contact passive-crossing probability (schematic)
  contactBand: 0.02,
  dtHours: 0.5,
  patchMin: 0.02,
  patchMax: 0.98,
});

export class UptakeEngine {
  /**
   * @param {{
   *   registry:any, cellField:import('./cellField.js').CellField,
   *   transportEngine:object, releaseEngine:object, evidenceEngine?:object,
   *   species?:string, params?:object, seed?:number, logger?:object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registry || !deps.cellField || !deps.transportEngine || !deps.releaseEngine) {
      throw new Error('UptakeEngine requires registry, cellField, transportEngine and releaseEngine');
    }
    this.registry = deps.registry;
    this.cells = deps.cellField;
    this.transport = deps.transportEngine;
    this.release = deps.releaseEngine;
    this.evidence = deps.evidenceEngine || null;
    this.logger = deps.logger || null;
    this.params = { ...DEFAULT_PARAMS, ...(deps.params || {}) };
    this.speciesUptake = deps.registry.species_uptake || {};
    this.uptakeModel = deps.registry.uptake_model || {};
    this.seed = deps.seed || 24680;
    this.rng = makeRng(this.seed);
    /** @type {DrugMolecule[]} */
    this.molecules = [];
    this._spawnedPerCarrier = new Map();
    this.timeH = 0;
    this.species = deps.species || this.transport.species;
    this._recompute();
  }

  _recompute() {
    this.evidenceLevel = this.evidenceLevelFor(this.species);
    this._speciesEvidence = this.evidenceForSpecies(this.species);
    this.blocked = this.evidence
      ? !this.evidence.canAnimate(this._speciesEvidence)
      : this.evidenceLevel === 'UNAVAILABLE';
  }

  /** Evidence Level for a species' uptake: EXPERIMENTAL | PREDICTIVE | UNAVAILABLE. */
  evidenceLevelFor(species) {
    const s = this.speciesUptake[species];
    return s && s.evidence_level ? s.evidence_level : 'UNAVAILABLE';
  }

  /** Evidence descriptor for a species' uptake (for the gate + panel). */
  evidenceForSpecies(species) {
    const s = this.speciesUptake[species];
    const level = this.evidenceLevelFor(species);
    if (!s) return { confidence: 'NOT_REPORTED', referenceIds: [], species, evidenceLevel: level, message: 'Cell Uptake Evidence: Unavailable.', limitations: ['no uptake record'] };
    return {
      confidence: s.confidence || 'MECHANISTIC_TRANSFER',
      referenceIds: s.referenceIds || [],
      principleRefs: s.principle_refs || [],
      species,
      evidenceLevel: level,
      predictive: level === 'PREDICTIVE',
      message: s.message || `Cell Uptake Evidence: ${level}.`,
      limitations: [s.observational_support || ''].filter(Boolean),
    };
  }

  isBlocked() { return this.blocked; }
  evidenceLevelName() { return this.evidenceLevel; }
  message() { return this._speciesEvidence.message; }
  speciesEvidence() { return this._speciesEvidence; }

  /** Follow the selected species (clears molecules; re-evaluates the gate). */
  setSpecies(species) {
    this.species = species;
    this.molecules = [];
    this._spawnedPerCarrier.clear();
    this.timeH = 0;
    this.rng = makeRng(this.seed);
    this._recompute();
    return this.species;
  }

  /** Dermis band {start,end} for the current species (from the transport engine). */
  _dermisBand() {
    const b = (this.transport.layerBands || []).find((x) => x.id === 'dermis');
    return b || { start: 0.3, end: 0.7 };
  }

  /** Expected molecule count = released payload quantised (moleculesPerCarrier). */
  expectedMoleculeCount() {
    if (this.blocked) return 0;
    let n = 0;
    for (const p of this.transport.particles) {
      const rs = this.release.stateFor(p.id);
      if (!rs) continue;
      n += Math.round(rs.releasedFraction * this.params.moleculesPerCarrier);
    }
    return n;
  }

  /** Spawn molecules so the population tracks the released payload (continuous, packetised). */
  _spawnFromRelease() {
    const events = [];
    const band = this._dermisBand();
    const span = Math.max(1e-6, band.end - band.start);
    for (const p of this.transport.particles) {
      if (p.transportStatus !== 'arrived') continue;
      const rs = this.release.stateFor(p.id);
      if (!rs) continue;
      const target = Math.round(rs.releasedFraction * this.params.moleculesPerCarrier);
      const already = this._spawnedPerCarrier.get(p.id) || 0;
      for (let i = already; i < target; i += 1) {
        const uCarrier = Math.max(0, Math.min(1, (p.d - band.start) / span));
        const jx = (this.rng.signed()) * 0.02;
        const ju = (this.rng.signed()) * 0.02;
        const m = new DrugMolecule({
          x: clamp(p.x + jx, this.params.patchMin, this.params.patchMax),
          u: clamp(uCarrier + ju, this.params.patchMin, this.params.patchMax),
          species: this.species,
          diffusion: this.params.diffusionExtracellular,
          releaseTimeH: this.timeH,
          evidence: this._speciesEvidence,
          carrierId: p.id,
        });
        this.molecules.push(m);
        events.push({ type: 'molecule_released', moleculeId: m.id, carrierId: p.id });
      }
      if (target > already) this._spawnedPerCarrier.set(p.id, target);
    }
    return events;
  }

  /** Brownian diffusion of every molecule (separate compartments). */
  _diffuse(dtHours) {
    const s = Math.sqrt(dtHours);
    for (const m of this.molecules) {
      if (!m.alive) continue;
      const amp = (m.compartment === 'cytoplasm' ? this.params.diffusionCytoplasm : this.params.diffusionExtracellular) * s;
      // clamp each Brownian step so motion stays smooth and bounded (never a teleport)
      const cap = 0.028;
      m.vx = clamp(amp * this.rng.normal(), -cap, cap);
      m.vu = clamp(amp * this.rng.normal(), -cap, cap);
      let nx = m.x + m.vx;
      let nu = m.u + m.vu;
      // reflect at the patch boundary
      nx = reflect(nx, this.params.patchMin, this.params.patchMax);
      nu = reflect(nu, this.params.patchMin, this.params.patchMax);
      if (m.compartment === 'cytoplasm') {
        const cell = this.cells.cells.find((c) => c.id === m.cellId);
        if (cell) { const q = this.cells.confineToCytoplasm(nx, nu, cell); nx = q.x; nu = q.u; }
      }
      m.x = nx; m.u = nu;
    }
  }

  /** Passive membrane crossing: only extracellular molecules IN CONTACT may cross. */
  _attemptUptake() {
    const events = [];
    for (const m of this.molecules) {
      if (!m.alive || m.compartment !== 'extracellular') continue;
      const contact = this.cells.membraneContact(m.x, m.u, this.params.contactBand);
      // also treat a molecule that diffused just inside a cell as a contact
      const penetrated = this.cells.cytoplasmCell(m.x, m.u);
      const cell = contact ? contact.cell : penetrated;
      if (!cell) continue;
      m.contacted = true;
      if (this.rng.next() < this.params.crossProbability) {
        const inside = this.cells.justInside(m.x, m.u, cell);
        m.x = inside.x; m.u = inside.u;
        m.compartment = 'cytoplasm';
        m.cellId = cell.id;
        events.push({ type: 'passive_uptake', moleculeId: m.id, cellId: cell.id });
      } else {
        // failed to cross -> stay just OUTSIDE the membrane (bounce, small step)
        const dx = m.x - cell.x; const du = m.u - cell.u; const d = Math.hypot(dx, du) || 1e-9;
        const outR = cell.radius + this.params.contactBand * 0.25;
        m.x = cell.x + (dx / d) * outR; m.u = cell.u + (du / d) * outR;
      }
    }
    return events;
  }

  /** Advance the whole uptake layer one step (spawn -> diffuse -> passive uptake). */
  step(dtHours = this.params.dtHours) {
    if (this.blocked) return [];
    this.timeH += dtHours;
    const events = [];
    events.push(...this._spawnFromRelease());
    this._diffuse(dtHours);
    events.push(...this._attemptUptake());
    return events;
  }

  run(steps, dtHours = this.params.dtHours) {
    const all = [];
    for (let i = 0; i < steps; i += 1) all.push(...this.step(dtHours));
    return { events: all, stats: this.stats(), timeH: this.timeH };
  }

  /** Population statistics. */
  stats() {
    let ec = 0; let cy = 0; let contacted = 0;
    for (const m of this.molecules) {
      if (m.compartment === 'cytoplasm') cy += 1; else ec += 1;
      if (m.contacted) contacted += 1;
    }
    return { total: this.molecules.length, extracellular: ec, cytoplasm: cy, contacted };
  }

  reset() { this.molecules = []; this._spawnedPerCarrier.clear(); this.timeH = 0; this.rng = makeRng(this.seed); }
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function reflect(v, lo, hi) {
  if (v < lo) return lo + (lo - v);
  if (v > hi) return hi - (v - hi);
  return v;
}

export default UptakeEngine;
