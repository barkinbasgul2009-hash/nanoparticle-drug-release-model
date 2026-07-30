// Target engagement engine (Phase 5A). The first pharmacology layer: it detects
// intracellular drug molecules, places schematic molecular targets, and models
// drug-target ENCOUNTER -> BINDING -> OCCUPANCY -> (optional) DISSOCIATION, with
// competition and saturation. It is a SEPARATE layer that READS the intracellular /
// uptake outputs read-only and modifies nothing upstream - binding state lives ONLY
// here (the Phase-4D molecule is never changed). It stops at target binding; nothing
// downstream (signalling, PD, apoptosis, ...) is modelled.

import { makeRng } from './rng.js';
import { labelAnimates, isPrediction } from '../evidence/evidenceEngine.js';
import { TargetProtein } from './targetProtein.js';

/** Schematic SIMULATION-SCALE constants (NOT biology). Binding kinetics (kon/koff)
 * come from the registry ONLY when evidence exists; these just set encounter range. */
export const DEFAULT_PARAMS = Object.freeze({
  encounterRadius: 0.06,   // schematic reaction radius in the (x,u) patch
  dtHours: 0.5,
});

export class TargetEngagementEngine {
  /**
   * @param {{
   *   registry:any, intracellularEngine:object, uptakeEngine:object, evidenceEngine?:object,
   *   species?:string, formulationId?:string, params?:object, seed?:number, logger?:object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registry || !deps.intracellularEngine || !deps.uptakeEngine) {
      throw new Error('TargetEngagementEngine requires registry, intracellularEngine, uptakeEngine');
    }
    this.registry = deps.registry;
    this.intra = deps.intracellularEngine;   // read-only source of intracellular drug
    this.cells = deps.uptakeEngine.cells;
    this.uptake = deps.uptakeEngine;
    this.evidence = deps.evidenceEngine || null;
    this.logger = deps.logger || null;
    this.params = { ...DEFAULT_PARAMS, ...(deps.params || {}) };
    this.formulationId = deps.formulationId || 'B1_nlc';
    this.formulation = (deps.registry.formulations || {})[this.formulationId];
    if (!this.formulation) throw new Error(`unknown target formulation: ${this.formulationId}`);
    this.speciesTarget = deps.registry.species_target || {};
    this.seed = deps.seed || 8642;
    this.rng = makeRng(this.seed);
    /** @type {TargetProtein[]} */
    this.targets = [];
    /** @type {Map<string,{targetId:string, x:number, u:number, tBindH:number}>} bound drug id -> binding */
    this.bindings = new Map();
    this.timeH = 0;
    this.species = deps.species || deps.intracellularEngine.species;
    this._recompute();
  }

  _recompute() {
    const b = this.formulation.binding || {};
    this.evidenceLevel = b.evidence_level || 'NOT_REPORTED';
    this.bindingModel = b.model; // 'reversible' | 'irreversible' | null
    this.kon = typeof b.kon === 'number' ? b.kon : null;
    this.koff = typeof b.koff === 'number' ? b.koff : null;
    this.blocked = !labelAnimates(this.evidenceLevel) || !this.bindingModel;
    this._placeTargets();
  }

  _placeTargets() {
    this.targets = [];
    TargetProtein._resetSequence();
    if (this.blocked) return;
    const defs = this.formulation.targets || [];
    for (const d of defs) {
      const cell = this.cells.cells.find((c) => c.id === d.cellId) || this.cells.cells[0];
      if (!cell) continue;
      const compartment = d.compartment || (this.registry.target_types[d.type] && this.registry.target_types[d.type].default_compartment) || 'cytoplasm';
      // cytoplasmic targets sit in the cytoplasm annulus; nuclear targets at the nuclear membrane
      const nucR = cell.radius * 0.42;
      const r = compartment === 'nucleus' ? nucR + 0.02 : (nucR + cell.radius) / 2;
      const ang = (d.angle != null ? d.angle : this.rng.next() * Math.PI * 2);
      this.targets.push(new TargetProtein({
        type: d.type, x: cell.x + Math.cos(ang) * r, u: cell.u + Math.sin(ang) * r,
        compartment, availableSites: d.availableSites || 1, species: this.species,
        evidenceLevel: this.evidenceLevel, kineticModel: this.bindingModel, cellId: cell.id,
      }));
    }
  }

  isBlocked() { return this.blocked; }
  evidenceLevelName() { return this.evidenceLevel; }
  isPredicted() { return isPrediction(this.evidenceLevel); }
  message() { const s = this.speciesTarget[this.species]; return (s && s.message) || `Target Engagement Evidence: ${this.evidenceLevel}.`; }
  /** Kd = koff/kon and residence time = 1/koff, ONLY when both rates exist (else null). */
  kd() { return (this.kon > 0 && this.koff >= 0) ? this.koff / this.kon : (typeof this.formulation.binding.Kd === 'number' ? this.formulation.binding.Kd : null); }
  residenceTime() { return this.koff > 0 ? 1 / this.koff : null; }

  setSpecies(species) {
    this.species = species;
    this.bindings.clear();
    this.timeH = 0;
    this.rng = makeRng(this.seed);
    this._recompute();
    return this.species;
  }

  /** Is a drug molecule compartment-compatible with a target? (nuclear gate) */
  _canEngage(mol, target) {
    if (target.compartment === 'nucleus') {
      // requires Phase-4D nucleus targeting to have reached the nuclear membrane
      return mol.compartment === 'nuclear_membrane' || mol.targetCompartment === 'nucleus';
    }
    return true; // cytoplasmic target
  }

  step(dtHours = this.params.dtHours) {
    if (this.blocked) return [];
    this.timeH += dtHours;
    const events = [];
    // 1) dissociation (reversible only; irreversible never dissociates)
    if (this.bindingModel === 'reversible' && this.koff > 0) {
      const pOff = 1 - Math.exp(-this.koff * dtHours);
      for (const [drugId, b] of [...this.bindings.entries()]) {
        if (this.rng.next() < pOff) {
          const t = this.targets.find((x) => x.id === b.targetId);
          if (t) t.release(drugId);
          this.bindings.delete(drugId);
          events.push({ type: 'dissociation', drugId, targetId: b.targetId });
        }
      }
    }
    // 2) encounter + binding for FREE alive molecules (competition: first bound occupies)
    const pOn = this.kon > 0 ? 1 - Math.exp(-this.kon * dtHours) : 0;
    for (const mol of this.intra.molecules) {
      if (!mol.alive || this.bindings.has(mol.id)) continue; // already bound or degraded
      for (const t of this.targets) {
        if (!t.hasFreeSite() || !this._canEngage(mol, t)) continue;
        const d = Math.hypot(mol.x - t.x, mol.u - t.u);
        if (d > this.params.encounterRadius) continue; // must physically reach the vicinity
        events.push({ type: 'encounter', drugId: mol.id, targetId: t.id });
        if (this.rng.next() < pOn && t.bind(mol.id)) {
          // capture the binding at the target (bound drug is held at the target)
          this.bindings.set(mol.id, { targetId: t.id, x: t.x, u: t.u, tBindH: this.timeH });
          events.push({ type: 'binding', drugId: mol.id, targetId: t.id });
          break; // this molecule is now bound
        }
      }
    }
    return events;
  }

  run(steps, dtHours = this.params.dtHours) {
    const all = [];
    for (let i = 0; i < steps; i += 1) all.push(...this.step(dtHours));
    return { events: all, stats: this.stats(), timeH: this.timeH };
  }

  /** Is a given drug id currently bound? (for the renderer; read-only) */
  isBound(drugId) { return this.bindings.has(drugId); }
  bindingOf(drugId) { return this.bindings.get(drugId) || null; }

  /** Overall occupancy + saturation across all targets. */
  stats() {
    let sites = 0; let occ = 0;
    for (const t of this.targets) { sites += t.availableSites; occ += t.occupiedSites; }
    return {
      targets: this.targets.length,
      sites,
      occupied: occ,
      bound: this.bindings.size,
      saturation: sites > 0 ? occ / sites : 0,
      byTarget: this.targets.map((t) => ({ id: t.id, type: t.type, occupancy: t.occupancy(), occupied: t.occupiedSites, available: t.availableSites })),
    };
  }

  /** Occupancy bucket (0/25/50/75/100) for display. */
  saturationBucket() {
    const s = this.stats().saturation;
    return s >= 0.99 ? 100 : s >= 0.75 ? 75 : s >= 0.5 ? 50 : s >= 0.25 ? 25 : 0;
  }

  reset() { this.bindings.clear(); this.timeH = 0; this.rng = makeRng(this.seed); this._placeTargets(); }
}

export default TargetEngagementEngine;
