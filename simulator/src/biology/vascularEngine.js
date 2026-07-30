// Phase-7B tumour-vasculature / angiogenesis engine. The active vascular component of the
// tumour microenvironment - but NOT an immune / metastasis / fibroblast phase. It models only
// vascular architecture (density / maturity / organization), perfusion, oxygen + nutrient
// supply, and permeability, and combines them into a drug-DELIVERY modifier. It reads the
// Phase-7B registries (and the active species / tumour model / formulation), optionally reads
// the Phase-7A microenvironment engine READ-ONLY for a combined delivery+penetration view, and
// modifies nothing upstream. Deterministic (pure arithmetic, no RNG), registry-driven,
// evidence- and prediction-aware, tumour-model / formulation / species aware.
//
// Core principle: blood vessels do NOT signal, do NOT induce apoptosis. They MODIFY oxygen /
// nutrient / drug accessibility / penetration opportunity only. The delivery modifier is an
// ADVISORY output (effective drug arrival); applying it downstream never mutates upstream
// engines.
//
// STOP boundary: vascular delivery modifies drug availability. No VEGF/HIF signalling, vascular
// inflammation, immune infiltration, fibroblast recruitment, lymphatics, or metastasis.

import { VascularState } from './vascularObjects.js';
import { isVascularEvidenceLevel, isVascularPrediction, isVascularTransfer, vascularLevelActive } from '../evidence/evidenceEngine.js';

const KNOWN_SPECIES = new Set(['mouse', 'human', 'rat']);

export class VascularEngine {
  /**
   * @param {{
   *   contextRegistry:any, angiogenesisRegistry:any, perfusionRegistry:any, oxygenSupplyRegistry:any,
   *   nutrientRegistry:any, permeabilityRegistry:any, deliveryRegistry:any,
   *   evidenceRegistry:any, predictionRegistry:any,
   *   microenvironmentEngine?: object, species?: string, tumourModel?: string, formulation?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    const req = ['contextRegistry', 'angiogenesisRegistry', 'perfusionRegistry', 'oxygenSupplyRegistry', 'nutrientRegistry', 'permeabilityRegistry', 'deliveryRegistry', 'evidenceRegistry', 'predictionRegistry'];
    if (!deps || req.some((k) => !deps[k])) throw new Error('VascularEngine requires the Phase-7B registries');
    this.ctxReg = deps.contextRegistry;
    this.angReg = deps.angiogenesisRegistry;
    this.perfReg = deps.perfusionRegistry;
    this.oxyReg = deps.oxygenSupplyRegistry;
    this.nutReg = deps.nutrientRegistry;
    this.permReg = deps.permeabilityRegistry;
    this.delReg = deps.deliveryRegistry;
    this.evReg = deps.evidenceRegistry;
    this.predReg = deps.predictionRegistry;
    this.micro = deps.microenvironmentEngine || null;   // optional read-only Phase-7A source
    this.logger = deps.logger || null;
    this.species = deps.species || 'human';
    this.tumourModel = deps.tumourModel || this._canonicalTumourModel(this.species);
    this._formulationOverride = deps.formulation || null;
    this._build();
  }

  _canonicalTumourModel(species) { return species === 'mouse' ? 'B16BL6' : species === 'human' ? 'human_skin_melanoma_predictive' : species === 'rat' ? 'none' : null; }

  _profile() {
    return Object.values(this.ctxReg.profiles || {}).find((p) => p.species === this.species && p.tumour_model === this.tumourModel) || null;
  }

  _build() {
    const p = this._profile();
    this.profile = p;
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    this.available = !!(p && p.vascular_available);
    this.formulation = this._formulationOverride && p && (p.supported_formulations || []).includes(this._formulationOverride)
      ? this._formulationOverride : (p ? p.formulation : null);
    this.state = new VascularState('vasc_0', {
      species: this.species, tumour_model: this.tumourModel, formulation: this.formulation,
      evidence_level: p ? p.evidence_level : 'NOT_REPORTED', prediction_level: p ? p.prediction_level : 'NOT_REPORTED',
      confidence: p ? p.confidence : 'LOW', uncertainty: p ? p.uncertainty : '',
    });
    if (this.available) this._compute();
  }

  isIdle() { return !this.available; }

  // ---- controls (any context change fully rebuilds the vascular field) ----

  setSpecies(speciesId) { this.species = speciesId; this.tumourModel = this._canonicalTumourModel(speciesId); this._formulationOverride = null; this._build(); this._log('info', 'vascular', `species -> ${speciesId} (${this.tumourModel}; available=${this.available})`); return this; }
  setTumourModel(model) { this.tumourModel = model; this._formulationOverride = null; this._build(); return this; }
  setFormulation(formulationId) { if (this.profile && (this.profile.supported_formulations || []).includes(formulationId)) { this._formulationOverride = formulationId; this._build(); } return this; }
  restart() { const fo = this._formulationOverride; this._build(); this._formulationOverride = fo; return this; }
  reset() { return this.restart(); }

  // ---- vascular-field computation (deterministic) ------------------------

  _compute() {
    const comp = this.profile.components || {};
    const s = this.state;

    // vessel architecture (angiogenic state + maturity).
    const ang = (this.angReg.angiogenic_states || {})[comp.angiogenic_state || 'moderately_vascularized'] || {};
    const mat = (this.angReg.vessel_maturity || {})[comp.vessel_maturity || 'developing'] || {};
    Object.assign(s.network.vessels, {
      angiogenicState: comp.angiogenic_state || 'moderately_vascularized', vesselDensity: ang.vessel_density ?? 0.5,
      branchingComplexity: ang.branching_complexity || 'moderate', organization: ang.organization || 'irregular',
      maturity: comp.vessel_maturity || 'developing', maturityValue: mat.maturity_value ?? 0.45, deliveryEfficiency: mat.delivery_efficiency ?? 0.5,
    });
    s.network.density = ang.vessel_density ?? 0.5; s.network.organization = ang.organization || 'irregular';
    const vesselDensity = clamp01(ang.vessel_density ?? 0.5);
    const maturityEfficiency = clamp01(mat.delivery_efficiency ?? 0.5);

    // perfusion / oxygen supply / nutrient / permeability.
    const perf = (this.perfReg.perfusion_states || {})[comp.perfusion || 'moderate'] || {};
    Object.assign(s.perfusion, { state: comp.perfusion || 'moderate', efficiency: perf.efficiency ?? 0.55 });
    const perfusionEff = clamp01(perf.efficiency ?? 0.55);
    const oxy = (this.oxyReg.oxygen_supply_states || {})[comp.oxygen_supply || 'moderate'] || {};
    Object.assign(s.oxygen, { state: comp.oxygen_supply || 'moderate', supply: oxy.supply ?? 0.55 });
    const nut = (this.nutReg.nutrient_states || {})[comp.nutrient || 'adequate'] || {};
    Object.assign(s.nutrient, { state: comp.nutrient || 'adequate', availability: nut.availability ?? 0.65 });
    const perm = (this.permReg.permeability_states || {})[comp.permeability || 'moderate'] || {};
    Object.assign(s.permeability, { state: comp.permeability || 'moderate', value: perm.value ?? 0.45 });
    const permeability = clamp01(perm.value ?? 0.45);

    // vascular delivery modifier (perfusion + permeability + density + maturity efficiency).
    const w = this.delReg.combination_weights || { perfusion: 0.4, permeability: 0.25, vessel_density: 0.2, maturity_efficiency: 0.15 };
    const floor = this.delReg.delivery_floor ?? 0.05;
    const deliveryModifier = clamp(w.perfusion * perfusionEff + w.permeability * permeability + w.vessel_density * vesselDensity + w.maturity_efficiency * maturityEfficiency, floor, 1);
    const deliveryState = this._deliveryState(deliveryModifier);
    Object.assign(s.delivery, { deliveryModifier: r3(deliveryModifier), effectiveArrival: r3(deliveryModifier), deliveryState });

    // deterministic evaluation timeline (vascular field is computed once per context).
    this.timeline = [
      { kind: 'milestone', event: 'vascular_profile_loaded', detail: { tumourModel: this.tumourModel, evidenceLevel: this.profile.evidence_level } },
      { kind: 'milestone', event: 'vascular_network_generated', detail: { angiogenicState: s.network.vessels.angiogenicState, density: s.network.density } },
      { kind: 'milestone', event: 'perfusion_calculated', detail: { state: s.perfusion.state, efficiency: s.perfusion.efficiency } },
      { kind: 'milestone', event: 'oxygen_supply_updated', detail: { state: s.oxygen.state, supply: s.oxygen.supply } },
      { kind: 'milestone', event: 'nutrient_environment_updated', detail: { state: s.nutrient.state, availability: s.nutrient.availability } },
      { kind: 'milestone', event: 'permeability_applied', detail: { state: s.permeability.state, value: s.permeability.value } },
      { kind: 'milestone', event: 'drug_delivery_modified', detail: { deliveryModifier: s.delivery.deliveryModifier, state: deliveryState } },
      { kind: 'milestone', event: 'transport_continues', detail: {} },
    ];
  }

  _deliveryState(mod) {
    const t = this.delReg.state_thresholds || {};
    if (mod < (t.poor_delivery ?? 0.25)) return 'poor_delivery';
    if (mod < (t.limited_delivery ?? 0.45)) return 'limited_delivery';
    if (mod < (t.moderate_delivery ?? 0.65)) return 'moderate_delivery';
    if (mod < (t.good_delivery ?? 0.82)) return 'good_delivery';
    return 'excellent_delivery';
  }

  /** Vascular field is static per context; step() advances time (replay/animator compatible). */
  step(dtHours) { const dt = typeof dtHours === 'number' ? dtHours : 0.5; this.timeH += dt; this._stepCount += 1; this.state.updatedAt = this.timeH; return []; }
  run(steps, dtHours) { for (let i = 0; i < steps; i++) this.step(dtHours); return []; }

  // ---- advisory outputs (never mutate upstream) --------------------------

  /** The key modifier: effective vascular drug delivery [floor,1] (advisory). */
  deliveryModifier() { return this.available ? this.state.delivery.deliveryModifier : 1; }
  perfusionModifier() { return this.available ? this.state.perfusion.efficiency : 1; }
  oxygenModifier() { return this.available ? this.state.oxygen.supply : 1; }
  nutrientModifier() { return this.available ? this.state.nutrient.availability : 1; }
  permeabilityModifier() { return this.available ? this.state.permeability.value : 1; }
  vesselDensity() { return this.available ? this.state.network.density : 0; }

  /** Integrates with Phase 7A READ-ONLY: combined vascular delivery x passive penetration. */
  effectiveDeliveryPenetration() {
    const pen = (this.micro && this.micro.penetrationModifier && !this.micro.isIdle()) ? this.micro.penetrationModifier() : 1;
    return r3(this.deliveryModifier() * pen);
  }

  // ---- accessors ---------------------------------------------------------

  getTimeline() { return this.timeline.slice(); }

  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.evidence_level === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'MECHANISTIC_PREDICTION'); }
  summaryMessage() {
    if (this.isIdle()) return `Tumour vasculature: Not Reported / Unavailable for ${this.species} (${this.tumourModel}).`;
    return `Vasculature (${this.tumourModel}): ${this.profile.evidence_level} - ${this.state.network.vessels.angiogenicState} / ${this.state.delivery.deliveryState}; delivery modifier ${r3(this.state.delivery.deliveryModifier)} (schematic; modifies delivery/oxygen/nutrient only).`;
  }

  stats() {
    return {
      available: this.available, species: this.species, tumourModel: this.tumourModel, formulation: this.formulation,
      angiogenicState: this.state.network.vessels.angiogenicState, vesselMaturity: this.state.network.vessels.maturity, deliveryState: this.state.delivery.deliveryState,
      vesselDensity: r3(this.state.network.density), perfusion: r3(this.state.perfusion.efficiency), oxygenSupply: r3(this.state.oxygen.supply),
      nutrient: r3(this.state.nutrient.availability), permeability: r3(this.state.permeability.value),
      deliveryModifier: r3(this.state.delivery.deliveryModifier),
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED', timeH: r2(this.timeH),
    };
  }

  frame() {
    const p = this.profile || {};
    const s = this.state;
    return {
      species: this.species, tumourModel: this.tumourModel, formulation: this.formulation, available: this.available,
      vessels: { angiogenicState: s.network.vessels.angiogenicState, density: s.network.density, branching: s.network.vessels.branchingComplexity, organization: s.network.organization, maturity: s.network.vessels.maturity },
      perfusion: { state: s.perfusion.state, efficiency: s.perfusion.efficiency },
      oxygenSupply: { state: s.oxygen.state, supply: s.oxygen.supply },
      nutrient: { state: s.nutrient.state, availability: s.nutrient.availability },
      permeability: { state: s.permeability.state, value: s.permeability.value },
      delivery: { deliveryModifier: s.delivery.deliveryModifier, effectiveArrival: s.delivery.effectiveArrival, deliveryState: s.delivery.deliveryState },
      effectiveDeliveryPenetration: this.effectiveDeliveryPenetration(),
      evidenceLevel: p.evidence_level || 'NOT_REPORTED', predictionLevel: p.prediction_level || 'NOT_REPORTED',
      predicted: p.evidence_level ? isVascularPrediction(p.evidence_level) : false,
      contextTransfer: p.evidence_level ? isVascularTransfer(p.evidence_level) : false,
      confidence: s.confidence, uncertainty: s.uncertainty,
      humanTranslationWarning: p.human_translation_warning || null,
      // STOP boundary: vascular delivery modifies drug availability only.
      modifiesDelivery: true, modifiesSignalling: false, inducesApoptosis: false, remodels: false,
      deliveryModifierEvidence: this.available ? 'PREDICTED' : 'NOT_EVALUATED',
      immuneEvidence: 'NOT_EVALUATED', vegfSignallingEvidence: 'NOT_EVALUATED', hifRegulationEvidence: 'NOT_EVALUATED', metastasisEvidence: 'NOT_EVALUATED',
      timeH: r2(this.timeH), summaryLevel: this.summaryLevel(),
    };
  }

  // ---- validation --------------------------------------------------------

  /** Registry + consistency integrity. STOP at delivery; no downstream biology fields. */
  validate() {
    const errors = []; const warnings = [];
    const FORBIDDEN = ['immune', 'macrophage', 'nk_cell', 't_cell', 'b_cell', 'fibroblast', 'caf', 'vegf', 'hif', 'lymphatic', 'metasta', 'invasion', 'intravasation', 'extravasation', 'coagulation', 'thrombosis', 'inflammation', 'remodel', 'clearance', 'endothelial_signalling'];
    const perfIdx = { very_low: 0, low: 1, moderate: 2, high: 3, very_high: 4 };
    const profs = this.ctxReg.profiles || {};
    const evRecs = this.evReg.evidence_records || {};
    const seen = new Set();
    for (const [pid, p] of Object.entries(profs)) {
      if (seen.has(pid)) errors.push(`duplicate vascular profile id: ${pid}`); seen.add(pid);
      if (p.profile_id && p.profile_id !== pid) errors.push(`profile ${pid} profile_id mismatch`);
      if (!KNOWN_SPECIES.has(p.species)) errors.push(`profile ${pid} invalid/unsupported species: ${p.species}`);
      if (!p.tumour_model) errors.push(`profile ${pid} missing tumour_model`);
      if (!isVascularEvidenceLevel(p.evidence_level)) errors.push(`profile ${pid} invalid evidence_level`);
      // no rat available tumour vasculature (no fallback from skin permeation)
      if (p.species === 'rat' && p.vascular_available) errors.push(`profile ${pid} rat must not have an available vasculature (no rat fallback)`);
      if (!p.vascular_available) {
        if (p.evidence_level !== 'NOT_REPORTED' && p.evidence_level !== 'UNAVAILABLE') errors.push(`profile ${pid} unavailable but evidence_level ${p.evidence_level}`);
        continue;
      }
      // prediction labelling: an active vasculature is NEVER experimental (only predictions exist)
      if (!isVascularPrediction(p.evidence_level)) errors.push(`profile ${pid} active vasculature must be a labelled prediction (got ${p.evidence_level})`);
      // evidence completeness
      const refs = (p.evidence_refs || []);
      if (!refs.length) errors.push(`profile ${pid} available but has no evidence_refs`);
      for (const rid of refs) if (!evRecs[rid]) errors.push(`profile ${pid} references missing evidence record ${rid}`);
      const c = p.components || {};
      // component variants must exist in their registries (renderer compatibility)
      if (c.angiogenic_state && !(this.angReg.angiogenic_states && this.angReg.angiogenic_states[c.angiogenic_state])) errors.push(`profile ${pid} unsupported angiogenic_state ${c.angiogenic_state}`);
      if (c.vessel_maturity && !(this.angReg.vessel_maturity && this.angReg.vessel_maturity[c.vessel_maturity])) errors.push(`profile ${pid} unsupported vessel_maturity ${c.vessel_maturity}`);
      if (c.perfusion && !(this.perfReg.perfusion_states && this.perfReg.perfusion_states[c.perfusion])) errors.push(`profile ${pid} unsupported perfusion ${c.perfusion}`);
      if (c.oxygen_supply && !(this.oxyReg.oxygen_supply_states && this.oxyReg.oxygen_supply_states[c.oxygen_supply])) errors.push(`profile ${pid} unsupported oxygen_supply ${c.oxygen_supply}`);
      if (c.nutrient && !(this.nutReg.nutrient_states && this.nutReg.nutrient_states[c.nutrient])) errors.push(`profile ${pid} unsupported nutrient ${c.nutrient}`);
      if (c.permeability && !(this.permReg.permeability_states && this.permReg.permeability_states[c.permeability])) errors.push(`profile ${pid} unsupported permeability ${c.permeability}`);
      // registry-driven support-list checks (chosen variant must be in the profile's supported list)
      if (c.angiogenic_state && (p.supported_vascular_state || []).length && !p.supported_vascular_state.includes(c.angiogenic_state)) errors.push(`profile ${pid} angiogenic_state ${c.angiogenic_state} not in supported_vascular_state`);
      if (c.perfusion && (p.supported_perfusion || []).length && !p.supported_perfusion.includes(c.perfusion)) errors.push(`profile ${pid} perfusion ${c.perfusion} not in supported_perfusion`);
      if (c.oxygen_supply && (p.supported_oxygen || []).length && !p.supported_oxygen.includes(c.oxygen_supply)) errors.push(`profile ${pid} oxygen_supply ${c.oxygen_supply} not in supported_oxygen`);
      // formulation compatibility
      if (p.formulation && (p.supported_formulations || []).length && !p.supported_formulations.includes(p.formulation)) errors.push(`profile ${pid} formulation ${p.formulation} not in supported_formulations`);
      // consistency: oxygen supply and perfusion are both blood-flow-derived - reject an
      // impossible combination (e.g. very_high oxygen supply with very_low perfusion).
      if (c.oxygen_supply != null && c.perfusion != null && perfIdx[c.oxygen_supply] != null && perfIdx[c.perfusion] != null) {
        if (Math.abs(perfIdx[c.oxygen_supply] - perfIdx[c.perfusion]) >= 3) errors.push(`profile ${pid} inconsistent oxygen/perfusion combination: ${c.oxygen_supply} + ${c.perfusion}`);
      }
      // forbidden downstream biology must not be declared as a vascular field
      for (const bad of FORBIDDEN) if ((p.tumour_model || '').toLowerCase().includes(bad)) errors.push(`profile ${pid} references a forbidden downstream concept: ${bad}`);
    }
    // runtime: delivery modifier bounds
    if (this.available) {
      const dm = this.state.delivery.deliveryModifier;
      if (dm < 0 || dm > 1) errors.push('delivery modifier out of [0,1]');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default VascularEngine;
