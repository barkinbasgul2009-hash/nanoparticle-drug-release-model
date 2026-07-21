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
    this.timeH = 0; this._stepCount = 0;
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

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default VascularEngine;
