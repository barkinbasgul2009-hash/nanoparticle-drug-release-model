// Phase-7A passive tumour-microenvironment (TME) engine. The first TME layer - but NOT an
// immune / angiogenesis / metastasis / remodeling phase. It models only the PASSIVE physical /
// biochemical environment (ECM / collagen / hyaluronic acid / interstitial space / oxygen /
// hypoxia / mechanical barrier) that MODIFIES drug penetration. It reads the Phase-7A
// registries (and the active species / tumour model / formulation) and produces passive
// modifiers. It is deterministic (pure arithmetic, no RNG), registry-driven, evidence- and
// prediction-aware, and species / tumour-model / formulation aware.
//
// Core principle: the microenvironment MODIFIES transport / uptake / penetration - it never
// REPLACES an upstream engine, never alters upstream biological logic, and never directly
// modifies intracellular signalling. Its penetration modifier is an ADVISORY output (effective
// drug availability); applying it downstream is deferred and never mutates upstream engines.
//
// STOP boundary: microenvironment modifies penetration. No immune / vascular / ECM-remodeling /
// fibrosis / angiogenesis / migration / metastasis biology.

import { MicroenvironmentState } from './microenvironmentObjects.js';
import { isMicroenvironmentEvidenceLevel, isMicroenvironmentPrediction, isMicroenvironmentTransfer, microenvironmentLevelActive } from '../evidence/evidenceEngine.js';

const KNOWN_SPECIES = new Set(['mouse', 'human', 'rat']);

export class MicroenvironmentEngine {
  /**
   * @param {{
   *   contextRegistry:any, ecmRegistry:any, diffusionRegistry:any, mechanicalRegistry:any,
   *   oxygenRegistry:any, hypoxiaRegistry:any, penetrationRegistry:any,
   *   evidenceRegistry:any, predictionRegistry:any,
   *   species?: string, tumourModel?: string, formulation?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    const req = ['contextRegistry', 'ecmRegistry', 'diffusionRegistry', 'mechanicalRegistry', 'oxygenRegistry', 'hypoxiaRegistry', 'penetrationRegistry', 'evidenceRegistry', 'predictionRegistry'];
    if (!deps || req.some((k) => !deps[k])) throw new Error('MicroenvironmentEngine requires the Phase-7A registries');
    this.ctxReg = deps.contextRegistry;
    this.ecmReg = deps.ecmRegistry;
    this.diffReg = deps.diffusionRegistry;
    this.mechReg = deps.mechanicalRegistry;
    this.oxyReg = deps.oxygenRegistry;
    this.hypReg = deps.hypoxiaRegistry;
    this.penReg = deps.penetrationRegistry;
    this.evReg = deps.evidenceRegistry;
    this.predReg = deps.predictionRegistry;
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
    this.available = !!(p && p.microenvironment_available);
    this.formulation = this._formulationOverride && p && (p.supported_formulations || []).includes(this._formulationOverride)
      ? this._formulationOverride : (p ? p.formulation : null);
    this.state = new MicroenvironmentState('tme_0', {
      species: this.species, tumour_model: this.tumourModel, formulation: this.formulation,
      evidence_level: p ? p.evidence_level : 'NOT_REPORTED', prediction_level: p ? p.prediction_level : 'NOT_REPORTED',
      confidence: p ? p.confidence : 'LOW', uncertainty: p ? p.uncertainty : '',
    });
    if (this.available) this._compute();
  }

  isIdle() { return !this.available; }

  // ---- controls (any context change fully rebuilds the passive field) ----

  setSpecies(speciesId) { this.species = speciesId; this.tumourModel = this._canonicalTumourModel(speciesId); this._formulationOverride = null; this._build(); this._log('info', 'microenv', `species -> ${speciesId} (${this.tumourModel}; available=${this.available})`); return this; }
  setTumourModel(model) { this.tumourModel = model; this._formulationOverride = null; this._build(); return this; }
  setFormulation(formulationId) { if (this.profile && (this.profile.supported_formulations || []).includes(formulationId)) { this._formulationOverride = formulationId; this._build(); } return this; }
  restart() { const fo = this._formulationOverride; this._build(); this._formulationOverride = fo; return this; }
  reset() { return this.restart(); }

  // ---- passive-field computation (deterministic) -------------------------

  _variant(reg, group, key) { return (reg[group] && reg[group].variants && reg[group].variants[key]) || {}; }

  _compute() {
    const comp = this.profile.components || {};
    const s = this.state;

    // ECM composite (collagen / hyaluronic acid / proteoglycan / fluid).
    const col = this._variant(this.ecmReg, 'collagen', comp.collagen || 'moderate');
    const ha = this._variant(this.ecmReg, 'hyaluronic_acid', comp.hyaluronic_acid || 'moderate');
    const pg = this._variant(this.ecmReg, 'proteoglycan', comp.proteoglycan || 'moderate');
    const fl = this._variant(this.ecmReg, 'extracellular_fluid', comp.extracellular_fluid || 'moderate');
    Object.assign(s.ecm.collagen, { variant: comp.collagen || 'moderate', density: col.density ?? 0.5, alignment: col.alignment || 'mixed', packing: col.packing || 'medium', porosityEffect: col.porosity_effect ?? 0.5, penetrationEffect: col.penetration_effect ?? 0.4 });
    s.ecm.hyaluronicAcid = { variant: comp.hyaluronic_acid || 'moderate', diffusionModifier: ha.diffusion_modifier ?? 0.35, interstitialResistance: ha.interstitial_resistance ?? 0.4, hydrationModifier: ha.hydration_modifier ?? 0.5 };
    s.ecm.proteoglycan = { variant: comp.proteoglycan || 'moderate', resistance: pg.resistance ?? 0.35 };
    s.ecm.extracellularFluid = { variant: comp.extracellular_fluid || 'moderate', porosity: fl.porosity ?? 0.45 };
    const w = (this.ecmReg.ecm_composite && this.ecmReg.ecm_composite.composite_weights) || { collagen: 0.45, hyaluronic_acid: 0.3, proteoglycan: 0.15, extracellular_fluid: 0.1 };
    const ecmResistance = clamp01(
      w.collagen * (col.penetration_effect ?? 0.4) +
      w.hyaluronic_acid * (ha.interstitial_resistance ?? 0.4) +
      w.proteoglycan * (pg.resistance ?? 0.35) +
      w.extracellular_fluid * (1 - (fl.porosity ?? 0.45)));
    s.ecm.density = r3(w.collagen * (col.density ?? 0.5) + w.hyaluronic_acid * (ha.hydration_modifier ?? 0.5) + w.proteoglycan * (pg.resistance ?? 0.35) + w.extracellular_fluid * (1 - (fl.porosity ?? 0.45)));
    s.ecm.porosity = r3(fl.porosity ?? 0.45);
    s.ecm.penetrationResistance = r3(ecmResistance);

    // interstitial / diffusion.
    const it = this._variant(this.diffReg, 'interstitial_space', comp.interstitial || 'moderate');
    Object.assign(s.interstitial, { variant: comp.interstitial || 'moderate', availableVolume: it.available_volume ?? 0.5, fluidResistance: it.fluid_resistance ?? 0.4, pathLength: it.path_length ?? 0.5, mobilityModifier: it.mobility_modifier ?? 0.6, diffusionResistance: it.diffusion_resistance ?? 0.4 });
    const diffusionResistance = clamp01(it.diffusion_resistance ?? 0.4);
    s.diffusion.resistance = r3(diffusionResistance); s.diffusion.mobilityModifier = r3(it.mobility_modifier ?? 0.6);
    s.ecm.diffusionResistance = r3(diffusionResistance);
    s.ecm.stiffness = r3((col.density ?? 0.5) * 0.6 + diffusionResistance * 0.4);

    // mechanical barrier.
    const mech = (this.mechReg.barrier_states || {})[comp.mechanical || 'moderate'] || {};
    Object.assign(s.mechanical, { state: comp.mechanical || 'moderate', score: mech.score ?? 0.4 });
    const mechanicalScore = clamp01(mech.score ?? 0.4);

    // oxygen + hypoxia.
    const oxy = (this.oxyReg.oxygen_states || {})[comp.oxygen || 'normoxic'] || {};
    Object.assign(s.oxygen, { state: comp.oxygen || 'normoxic', availability: oxy.availability ?? 0.9, diffusion: oxy.diffusion ?? 0.85 });
    const hyp = (this.hypReg.hypoxia_states || {})[comp.hypoxia || 'normoxic'] || {};
    Object.assign(s.hypoxia, { state: comp.hypoxia || 'normoxic', severity: hyp.severity ?? 0.0, penetrationModifier: hyp.penetration_modifier ?? 1.0, drugEffectivenessModifier: hyp.drug_effectiveness_modifier ?? 1.0, stressSusceptibility: hyp.stress_susceptibility ?? 0.0, predictionConfidence: hyp.prediction_confidence || 'MEDIUM' });
    const hypoxiaSeverity = clamp01(hyp.severity ?? 0.0);

    // combined penetration modifier.
    const cw = this.penReg.combination_weights || { ecm: 0.4, diffusion: 0.25, mechanical: 0.2, hypoxia: 0.15 };
    const floor = this.penReg.penetration_floor ?? 0.05;
    const combined = clamp01(cw.ecm * ecmResistance + cw.diffusion * diffusionResistance + cw.mechanical * mechanicalScore + cw.hypoxia * hypoxiaSeverity);
    const penetrationModifier = clamp(1 - combined, floor, 1);
    // hypoxia additionally scales effective availability (drug effectiveness modifier).
    const effectiveAvailability = clamp01(penetrationModifier * (s.hypoxia.drugEffectivenessModifier ?? 1.0));
    const meState = this._microenvironmentState(combined);
    Object.assign(s.penetration, { combinedRestriction: r3(combined), penetrationModifier: r3(penetrationModifier), effectiveAvailability: r3(effectiveAvailability), microenvironmentState: meState });
    s.microenvironmentState = meState;

    // deterministic evaluation timeline (passive field is computed once per context; the
    // events describe the passive evaluation order - no downstream biology).
    this.timeline = [
      { kind: 'milestone', event: 'microenvironment_loaded', detail: { tumourModel: this.tumourModel, evidenceLevel: this.profile.evidence_level } },
      { kind: 'milestone', event: 'ecm_evaluated', detail: { penetrationResistance: s.ecm.penetrationResistance, collagen: s.ecm.collagen.variant } },
      { kind: 'milestone', event: 'interstitial_resistance_calculated', detail: { resistance: s.diffusion.resistance } },
      { kind: 'milestone', event: 'hypoxia_evaluated', detail: { state: s.hypoxia.state, severity: s.hypoxia.severity } },
      { kind: 'milestone', event: 'oxygen_environment_updated', detail: { state: s.oxygen.state, availability: s.oxygen.availability } },
      { kind: 'milestone', event: 'penetration_modifier_applied', detail: { penetrationModifier: s.penetration.penetrationModifier, state: meState } },
      { kind: 'milestone', event: 'drug_transport_updated', detail: { effectiveAvailability: s.penetration.effectiveAvailability } },
      { kind: 'milestone', event: 'transport_continues', detail: {} },
    ];
  }

  _microenvironmentState(combined) {
    const t = this.penReg.state_thresholds || {};
    if (combined < (t.permissive ?? 0.15)) return 'permissive';
    if (combined < (t.slightly_restrictive ?? 0.35)) return 'slightly_restrictive';
    if (combined < (t.moderately_restrictive ?? 0.55)) return 'moderately_restrictive';
    if (combined < (t.highly_restrictive ?? 0.75)) return 'highly_restrictive';
    return 'extremely_restrictive';
  }

  /** Passive field is static per context; step() advances time (replay/animator compatible). */
  step(dtHours) { const dt = typeof dtHours === 'number' ? dtHours : 0.5; this.timeH += dt; this._stepCount += 1; this.state.updatedAt = this.timeH; return []; }
  run(steps, dtHours) { for (let i = 0; i < steps; i++) this.step(dtHours); return []; }

  // ---- advisory outputs (never mutate upstream) --------------------------

  /** The key modifier: effective drug penetration [floor,1] (advisory; does not alter upstream). */
  penetrationModifier() { return this.available ? this.state.penetration.penetrationModifier : 1; }
  effectiveAvailability() { return this.available ? this.state.penetration.effectiveAvailability : 1; }
  oxygenModifier() { return this.available ? this.state.oxygen.availability : 1; }
  diffusionModifier() { return this.available ? this.state.diffusion.mobilityModifier : 1; }
  stiffnessModifier() { return this.available ? this.state.ecm.stiffness : 0; }
  hypoxiaModifier() { return this.available ? this.state.hypoxia.severity : 0; }

  // ---- accessors ---------------------------------------------------------

  getTimeline() { return this.timeline.slice(); }

  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.evidence_level === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'MECHANISTIC_PREDICTION'); }
  summaryMessage() {
    if (this.isIdle()) return `Tumour microenvironment: Not Reported / Unavailable for ${this.species} (${this.tumourModel}).`;
    return `Microenvironment (${this.tumourModel}): ${this.profile.evidence_level} - ${this.state.microenvironmentState}; penetration modifier ${r3(this.state.penetration.penetrationModifier)} (schematic passive modulator; modifies penetration only).`;
  }

  stats() {
    return {
      available: this.available, species: this.species, tumourModel: this.tumourModel, formulation: this.formulation,
      microenvironmentState: this.state.microenvironmentState,
      penetrationModifier: r3(this.state.penetration.penetrationModifier), effectiveAvailability: r3(this.state.penetration.effectiveAvailability),
      combinedRestriction: r3(this.state.penetration.combinedRestriction),
      ecmPenetrationResistance: r3(this.state.ecm.penetrationResistance), diffusionResistance: r3(this.state.diffusion.resistance),
      mechanicalScore: r3(this.state.mechanical.score), oxygenAvailability: r3(this.state.oxygen.availability), hypoxiaSeverity: r3(this.state.hypoxia.severity),
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED', timeH: r2(this.timeH),
    };
  }

  frame() {
    const p = this.profile || {};
    const s = this.state;
    return {
      species: this.species, tumourModel: this.tumourModel, formulation: this.formulation, available: this.available,
      microenvironmentState: s.microenvironmentState,
      ecm: { density: s.ecm.density, porosity: s.ecm.porosity, stiffness: s.ecm.stiffness, penetrationResistance: s.ecm.penetrationResistance, collagen: s.ecm.collagen.variant, hyaluronicAcid: s.ecm.hyaluronicAcid.variant },
      diffusion: { resistance: s.diffusion.resistance, mobilityModifier: s.diffusion.mobilityModifier, interstitial: s.interstitial.variant },
      mechanical: { state: s.mechanical.state, score: s.mechanical.score },
      oxygen: { state: s.oxygen.state, availability: s.oxygen.availability },
      hypoxia: { state: s.hypoxia.state, severity: s.hypoxia.severity, penetrationModifier: s.hypoxia.penetrationModifier, drugEffectivenessModifier: s.hypoxia.drugEffectivenessModifier, stressSusceptibility: s.hypoxia.stressSusceptibility },
      penetration: { combinedRestriction: s.penetration.combinedRestriction, penetrationModifier: s.penetration.penetrationModifier, effectiveAvailability: s.penetration.effectiveAvailability },
      evidenceLevel: p.evidence_level || 'NOT_REPORTED', predictionLevel: p.prediction_level || 'NOT_REPORTED',
      predicted: p.evidence_level ? isMicroenvironmentPrediction(p.evidence_level) : false,
      contextTransfer: p.evidence_level ? isMicroenvironmentTransfer(p.evidence_level) : false,
      confidence: s.confidence, uncertainty: s.uncertainty,
      humanTranslationWarning: p.human_translation_warning || null,
      // STOP boundary: passive penetration modulation only.
      modifiesTransport: true, replacesTransport: false, modifiesSignalling: false,
      penetrationModifierEvidence: this.available ? 'PREDICTED' : 'NOT_EVALUATED',
      immuneEvidence: 'NOT_EVALUATED', vascularEvidence: 'NOT_EVALUATED', remodelingEvidence: 'NOT_EVALUATED',
      metastasisEvidence: 'NOT_EVALUATED',
      timeH: r2(this.timeH), summaryLevel: this.summaryLevel(),
    };
  }

  // ---- validation --------------------------------------------------------

  /** Registry + consistency integrity. STOP at penetration; no downstream biology fields. */
  validate() {
    const errors = []; const warnings = [];
    const FORBIDDEN = ['immune', 'macrophage', 'dendritic', 'nk_cell', 't_cell', 'b_cell', 'cytokine', 'chemokine', 'vegf', 'angiogen', 'fibrosis', 'remodel', 'collagen_synthesis', 'collagen_degradation', 'fibroblast', 'caf', 'mmp', 'metasta', 'invasion', 'lymphatic', 'vascular', 'systemic', 'checkpoint', 'clearance'];
    const oxyIdx = { normoxic: 0, mild_hypoxia: 1, moderate_hypoxia: 2, severe_hypoxia: 3 };
    const hypIdx = { normoxic: 0, mild: 1, moderate: 2, severe: 3 };
    const profs = this.ctxReg.profiles || {};
    const evRecs = this.evReg.evidence_records || {};
    const seen = new Set();
    for (const [pid, p] of Object.entries(profs)) {
      if (seen.has(pid)) errors.push(`duplicate microenvironment profile id: ${pid}`); seen.add(pid);
      if (p.profile_id && p.profile_id !== pid) errors.push(`profile ${pid} profile_id mismatch`);
      // required fields + species / tumour validity
      if (!KNOWN_SPECIES.has(p.species)) errors.push(`profile ${pid} invalid/unsupported species: ${p.species}`);
      if (!p.tumour_model) errors.push(`profile ${pid} missing tumour_model`);
      if (!isMicroenvironmentEvidenceLevel(p.evidence_level)) errors.push(`profile ${pid} invalid evidence_level`);
      if (!p.microenvironment_available) {
        if (p.evidence_level !== 'NOT_REPORTED' && p.evidence_level !== 'UNAVAILABLE') errors.push(`profile ${pid} unavailable but evidence_level ${p.evidence_level}`);
        continue;
      }
      // prediction labelling: an active microenvironment is NEVER experimental (only predictions exist here)
      if (!isMicroenvironmentPrediction(p.evidence_level)) errors.push(`profile ${pid} active microenvironment must be a labelled prediction (got ${p.evidence_level})`);
      // evidence completeness: available profile must reference existing evidence records
      const refs = (p.evidence_refs || []);
      if (!refs.length) errors.push(`profile ${pid} available but has no evidence_refs`);
      for (const rid of refs) if (!evRecs[rid]) errors.push(`profile ${pid} references missing evidence record ${rid}`);
      // component variants must exist in their registries (renderer compatibility)
      const c = p.components || {};
      if (c.collagen && !this._variant(this.ecmReg, 'collagen', c.collagen).density && !(this.ecmReg.collagen && this.ecmReg.collagen.variants && this.ecmReg.collagen.variants[c.collagen])) errors.push(`profile ${pid} unsupported collagen variant ${c.collagen}`);
      if (c.interstitial && !(this.diffReg.interstitial_space && this.diffReg.interstitial_space.variants && this.diffReg.interstitial_space.variants[c.interstitial])) errors.push(`profile ${pid} unsupported interstitial variant ${c.interstitial}`);
      if (c.mechanical && !(this.mechReg.barrier_states && this.mechReg.barrier_states[c.mechanical])) errors.push(`profile ${pid} unsupported mechanical variant ${c.mechanical}`);
      if (c.oxygen && !(this.oxyReg.oxygen_states && this.oxyReg.oxygen_states[c.oxygen])) errors.push(`profile ${pid} unsupported oxygen variant ${c.oxygen}`);
      if (c.hypoxia && !(this.hypReg.hypoxia_states && this.hypReg.hypoxia_states[c.hypoxia])) errors.push(`profile ${pid} unsupported hypoxia variant ${c.hypoxia}`);
      // consistency: oxygen state and hypoxia state must be coherent (reject e.g. normoxic + severe)
      if (c.oxygen != null && c.hypoxia != null && oxyIdx[c.oxygen] != null && hypIdx[c.hypoxia] != null) {
        if (Math.abs(oxyIdx[c.oxygen] - hypIdx[c.hypoxia]) >= 2) errors.push(`profile ${pid} inconsistent oxygen/hypoxia combination: ${c.oxygen} + ${c.hypoxia}`);
      }
      // consistency: a very dense ECM must not yield an unrestricted (permissive) microenvironment
      if (['dense', 'highly_dense'].includes(c.collagen) && (c.mechanical === 'highly_dense')) {
        const col = this._variant(this.ecmReg, 'collagen', c.collagen);
        if ((col.penetration_effect ?? 0) >= 0.7) { /* structurally dense - fine as long as not permissive; runtime state checked below when active */ }
      }
      // forbidden downstream biology must not be declared as a microenvironment field
      for (const bad of FORBIDDEN) if ((p.tumour_model || '').toLowerCase().includes(bad)) errors.push(`profile ${pid} references a forbidden downstream concept: ${bad}`);
    }
    // runtime consistency for the ACTIVE profile: dense ECM must not be permissive
    if (this.available) {
      const c = (this.profile.components || {});
      if (['dense', 'highly_dense'].includes(c.collagen) && this.state.microenvironmentState === 'permissive') errors.push('inconsistent runtime: dense ECM resolved to a permissive microenvironment');
      const pm = this.state.penetration.penetrationModifier;
      if (pm < 0 || pm > 1) errors.push('penetration modifier out of [0,1]');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default MicroenvironmentEngine;
