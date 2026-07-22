// Phase-8A adaptive & acquired drug-resistance engine. The primary orchestrator of the resistance
// runtime: it evaluates how a surviving tumour population may enter reversible drug-tolerant states,
// adapt to sustained treatment pressure, recover after withdrawal, or acquire persistent resistance,
// and it produces a single ADVISORY resistance-response modifier consumed on the NEXT frame.
//
// It consumes VALIDATED outputs from previous engines (population / tumour response / passive
// microenvironment / vasculature) READ-ONLY and modifies NOTHING upstream. It does NOT calculate
// drug release, diffusion, penetration, vascular flow, immune activation, signalling, transcription,
// translation, apoptosis commitment, or raw tumour burden. Deterministic (pure arithmetic + enumerated
// state machines; no RNG, no wall-clock time, no unordered iteration), registry-driven, evidence- and
// prediction-aware, species / tumour-model / formulation / exposure-history / population aware.
//
// The frozen package has NO direct resistance dataset for this context, so every active resistance
// value is a LABELLED prediction (MECHANISTIC_PREDICTION) or NOT_REPORTED - there is NO experimental
// tier. Immune-associated resistance is UNAVAILABLE (Phase 7C is not implemented in this build).
// STOP boundary: resistance state + advisory modifier only. No combination therapy (8B), no
// resistance forecasting (8C), no mutation/genome/epigenome simulation, no clinical outcome.

import ResistanceState, {
  clamp01, r3, ResistanceEvent, ResistanceTransition,
} from './resistanceObjects.js';
import { ResistanceStateMachines } from './resistanceStateMachines.js';
import * as M from './resistanceModules.js';
import { buildResponseModifier } from './resistanceAdapters.js';
import { isResistanceEvidenceLevel, isResistancePrediction } from '../evidence/evidenceEngine.js';

const KNOWN_SPECIES = new Set(['mouse', 'human', 'rat']);
const REQUIRED = ['context', 'baseline', 'intrinsic', 'exposure', 'pressure', 'survivor', 'tolerance', 'adaptive', 'acquired', 'persistent', 'mechanism', 'uptake', 'efflux', 'target', 'survivalSignaling', 'stress', 'apoptosisEvasion', 'cellState', 'microenvProtection', 'immune', 'subpopulation', 'selection', 'enrichment', 'resensitization', 'washout', 'rechallenge', 'burden', 'modifier', 'transition', 'evidence', 'prediction', 'validation'];

export class ResistanceEngine {
  /**
   * @param {{
   *   registries: Record<string, any>,
   *   populationEngine?: object, tumorEngine?: object, microenvironmentEngine?: object,
   *   vascularEngine?: object, immuneEngine?: object,
   *   species?: string, tumourModel?: string, formulation?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registries) throw new Error('ResistanceEngine requires the Phase-8A registries');
    const reg = deps.registries;
    const missing = REQUIRED.filter((k) => !reg[k]);
    if (missing.length) throw new Error(`ResistanceEngine missing registries: ${missing.join(', ')}`);
    this.reg = reg;
    this.population = deps.populationEngine || null;     // read-only upstream (optional)
    this.tumor = deps.tumorEngine || null;              // read-only upstream (optional)
    this.micro = deps.microenvironmentEngine || null;   // read-only Phase-7A (optional)
    this.vascular = deps.vascularEngine || null;        // read-only Phase-7B (optional)
    this.immune = deps.immuneEngine || null;            // Phase 7C - NOT implemented -> null
    this.logger = deps.logger || null;
    this.sm = new ResistanceStateMachines(reg.transition);
    this.species = deps.species || 'human';
    this.tumourModel = deps.tumourModel || this._canonicalTumourModel(this.species);
    this._formulationOverride = deps.formulation || null;
    this._build();
  }

  _canonicalTumourModel(species) { return species === 'mouse' ? 'B16BL6' : species === 'human' ? 'human_skin_melanoma_predictive' : species === 'rat' ? 'none' : null; }

  _profile() {
    return Object.values(this.reg.context.profiles || {}).find((p) => p.species === this.species && p.tumour_model === this.tumourModel) || null;
  }

  _build() {
    const p = this._profile();
    this.profile = p;
    this.timeH = 0; this._stepCount = 0; this.timeline = []; this._eventSeq = 0;
    this.available = !!(p && p.resistance_available);
    this.formulation = this._formulationOverride && p && (p.supported_formulations || []).includes(this._formulationOverride)
      ? this._formulationOverride : (p ? p.formulation : null);
    this.state = new ResistanceState('resist_0', {
      species: this.species, tumour_model: this.tumourModel, formulation: this.formulation,
      evidence_level: p ? p.evidence_level : 'NOT_REPORTED', prediction_level: p ? p.prediction_level : 'NOT_REPORTED',
      confidence: p ? p.confidence : 'LOW', uncertainty: p ? p.uncertainty : '',
      baseline_sensitivity: p ? p.baseline_sensitivity : 'unknown',
      baseline_resistant_fraction: p ? p.baseline_resistant_fraction : null,
      baseline_tolerant_fraction: p ? p.baseline_tolerant_fraction : null,
      baseline_fractions: p ? p.baseline_fractions : null,
      baseline_pathway_dependence: p ? p.baseline_pathway_dependence : 'unknown',
      baseline_apoptosis_competence: p ? p.baseline_apoptosis_competence : 'unknown',
      baseline_uptake_competence: p ? p.baseline_uptake_competence : 'unknown',
      baseline_stress_tolerance: p ? p.baseline_stress_tolerance : 'unknown',
      baseline_microenvironment_protection: p ? p.baseline_microenvironment_protection : 'unknown',
    });
    // resolve fixed baseline (intrinsic sensitivity + starting composition)
    const { baseline, intrinsic, population } = M.resolveBaseline(p, this.reg.intrinsic);
    this.state.baseline = baseline; this.state.intrinsic = intrinsic; this.state.population = population;
    this._supportedMechanisms = (p && p.supported_mechanisms) || [];
    if (this.available) this._compute();
  }

  isIdle() { return !this.available; }

  // ---- controls (any context change fully rebuilds baseline) --------------
  setSpecies(speciesId) { this.species = speciesId; this.tumourModel = this._canonicalTumourModel(speciesId); this._formulationOverride = null; this._build(); this._log('info', 'resistance', `species -> ${speciesId} (${this.tumourModel}; available=${this.available})`); return this; }
  setTumourModel(model) { this.tumourModel = model; this._formulationOverride = null; this._build(); return this; }
  setFormulation(formulationId) { if (this.profile && (this.profile.supported_formulations || []).includes(formulationId)) { this._formulationOverride = formulationId; this._build(); } return this; }
  restart() { const fo = this._formulationOverride; this._build(); this._formulationOverride = fo; return this; }
  reset() { return this.restart(); }

  // ---- context derivation from profile + optional read-only upstream ------

  _readMicroProtection() {
    // Phase-7A penetration x Phase-7B delivery, READ-ONLY -> protection = 1 - effective arrival.
    let arrival = 1;
    if (this.vascular && !this.vascular.isIdle?.() && typeof this.vascular.effectiveDeliveryPenetration === 'function') arrival = this.vascular.effectiveDeliveryPenetration();
    else if (this.micro && !this.micro.isIdle?.() && typeof this.micro.penetrationModifier === 'function') arrival = this.micro.penetrationModifier();
    return clamp01(1 - clamp01(arrival));
  }

  _deriveContext(inputs = {}) {
    const p = this.profile || {};
    const treated = inputs.exposureStatus ? inputs.exposureStatus !== 'untreated' : true;
    // schematic effective exposure for a treated default context (sustained topical NLC prediction)
    const baseExposure = inputs.effectiveExposure != null ? inputs.effectiveExposure : (treated ? 0.6 : 0);
    const microProtection = inputs.microProtection != null ? inputs.microProtection : this._readMicroProtection();
    const competent = (v) => v === 'competent' || v === undefined;
    return {
      effectiveExposure: clamp01(baseExposure),
      deliveryFactor: clamp01(inputs.deliveryFactor ?? (1 - 0.5 * microProtection)),
      uptakeFactor: clamp01(inputs.uptakeFactor ?? 1),
      observedResponse: clamp01(inputs.observedResponse ?? 0.4),
      stressInduced: clamp01(inputs.stressInduced ?? 0.4),
      apoptosisPressure: clamp01(inputs.apoptosisPressure ?? 0.35),
      pathwayPressure: clamp01(inputs.pathwayPressure ?? 0.25),
      durationPressure: clamp01(inputs.durationPressure ?? Math.min(1, (this.state.history.stageIndex || 0) * 0.1)),
      cumulativeExposure: clamp01(inputs.cumulativeExposure ?? this.state.history.cumulativeExposure),
      microProtection,
      deliverySufficient: inputs.deliverySufficient ?? (microProtection < 0.7),
      uptakeSufficient: inputs.uptakeSufficient ?? competent(p.baseline_uptake_competence),
      targetEngaged: inputs.targetEngaged ?? true,
      stressCompetent: inputs.stressCompetent ?? true,
      apoptosisCompetent: inputs.apoptosisCompetent ?? competent(p.baseline_apoptosis_competence),
      survivedDespitePressure: inputs.survivedDespitePressure ?? true,
      survivorPersistedOrExpanded: inputs.survivorPersistedOrExpanded ?? (this.state.history.stageIndex >= 1),
      temporalSupport: inputs.temporalSupport ?? ((this.state.history.stageIndex || 0) >= 2),
      exposureStatus: inputs.exposureStatus || 'sustained_exposure',
      exposureStage: inputs.exposureStage || 'sustained',
      washoutStage: inputs.washoutStage || this.state.washout.stage,
      priorTolerant: this.state.tolerance.state !== 'absent',
    };
  }

  // ---- the primary interface: evaluate one resistance frame ---------------

  /**
   * Evaluate a single deterministic resistance frame in the approved temporal order. All inputs are
   * optional; missing upstream context resolves to schematic profile-driven defaults (never fabricated
   * measurements). Records transitions/events, advances the immutable sub-states, and prepares the
   * advisory response modifier for the next frame. Returns the assembled frame().
   */
  evaluateResistance(inputs = {}) {
    if (!this.available) return this.frame();
    const s = this.state;
    const ctx = this._deriveContext(inputs);
    ctx.cumulativeExposure = clamp01(s.history.cumulativeExposure);
    const prev = { tolerance: s.tolerance, adaptive: s.adaptive, acquired: s.acquired, persistence: s.persistence, selection: s.selection, enrichment: s.enrichment, reSensitization: s.reSensitization };

    // 1) exposure + pressure (delivery-gated)
    s.exposure = M.evaluateExposure(ctx, this.reg.exposure);
    s.pressure = M.evaluatePressure(s.exposure, ctx, this.reg.pressure);
    s.history = M.updateHistory(s.history, s.exposure, s.pressure.netTreatmentPressure);
    // 2) apparent-resistance hierarchy + survivor state
    const apparentCause = M.classifyApparentResistance(ctx, this.reg.mechanism);
    ctx.apparentCause = apparentCause;
    s.survivor = M.evaluateSurvivor(s.pressure, apparentCause, ctx);
    // 3) microenvironment protection (read-only) + immune (UNAVAILABLE)
    s.microenvironmentProtection = M.evaluateMicroenvProtection(ctx, this.reg.microenvProtection);
    s.immune = M.evaluateImmune(this._immuneContext());
    // 4) washout stage (from context) then tolerance/adaptive
    s.washout.stage = ctx.washoutStage;
    s.washout.relativeRecovery = clamp01(this._washoutRecovery(ctx.washoutStage));
    const tolerance = M.evaluateTolerance(s.pressure, s.survivor, prev.tolerance, this.sm, this.reg.tolerance, true);
    this._recordTransition('drug_tolerance', prev.tolerance.state, tolerance.state, 'TOLERANCE_TRANSITION', ctx);
    s.tolerance = tolerance;
    const adaptive = M.evaluateAdaptive(s.pressure, s.tolerance, prev.adaptive, this.sm, this.reg.adaptive, this._supportedMechanisms);
    this._recordTransition('adaptive_resistance', prev.adaptive.state, adaptive.state, 'TREATMENT_INDUCED_ADAPTATION', ctx);
    s.adaptive = adaptive;
    // 5) mechanisms
    s.mechanisms = M.evaluateMechanisms({ tolerance: s.tolerance, adaptive: s.adaptive }, { stress: this.reg.stress, apoptosisEvasion: this.reg.apoptosisEvasion, survivalSignaling: this.reg.survivalSignaling, uptake: this.reg.uptake, cellState: this.reg.cellState }, this._supportedMechanisms);
    // 6) selection + enrichment (conserved)
    s.selection = M.evaluateSelection(s.pressure, s.population, this.reg.selection, this.sm, prev.selection);
    const enr = M.evaluateEnrichment(s.selection, s.population, this.reg.enrichment, this.sm, prev.enrichment);
    s.enrichment = enr.enrichment; s.population = enr.population;
    // 7) persistence + acquired
    s.persistence = M.evaluatePersistence(s.acquired, s.washout, this.sm, this.reg.persistent, prev.persistence);
    const acquired = M.evaluateAcquired(s.adaptive, s.history, prev.acquired, this.sm, this.reg.acquired, this.reg.persistent, ctx);
    this._recordTransition('acquired_resistance', prev.acquired.state, acquired.state, 'PERSISTENCE_TRANSITION', ctx);
    s.acquired = acquired;
    // 8) re-sensitization (explicit; requires prior resistance)
    const priorResistant = prev.tolerance.state !== 'absent' || prev.adaptive.state !== 'absent' || prev.acquired.state !== 'absent';
    s.reSensitization = M.evaluateReSensitization(s.washout, priorResistant, this.sm, this.reg.resensitization, prev.reSensitization);
    // 9) burden + advisory modifier
    s.burden = M.computeBurden({ tolerance: s.tolerance, adaptive: s.adaptive, acquired: s.acquired, persistence: s.persistence, microenvironmentProtection: s.microenvironmentProtection, immune: s.immune, population: s.population }, s.intrinsic, this.reg.burden);
    s.modifier = buildResponseModifier(s, this.reg.modifier);

    s.updatedAt = this.timeH;
    this._buildTimeline();
    return this.frame();
  }

  _immuneContext() { return this.immune ? { available: true } : null; }   // Phase 7C absent -> null
  _washoutRecovery(stage) { const st = this.reg.washout && this.reg.washout.stages && this.reg.washout.stages[stage]; return st ? (st.relative_recovery || 0) : 0; }

  _recordTransition(machine, from, to, origin, ctx) {
    if (from === to) return;
    this.state.transitions.push(new ResistanceTransition(machine, from, to, origin));
    this.state.events.push(new ResistanceEvent({
      eventId: `re_evt_${++this._eventSeq}`, simulationFrame: this._stepCount, simulationStage: this.state.exposure.exposureStage,
      eventType: `${machine}_transition`, previousState: from, nextState: to, mechanismCategory: this.state.adaptive.mechanismCategory,
      causalInputs: ['net_treatment_pressure', 'survivor_state'], treatmentPressure: this.state.pressure.netTreatmentPressure,
      originClassification: origin, evidenceLevel: this.state.evidenceLevel, predictionLevel: this.state.predictionLevel,
      confidence: this.state.confidence, uncertainty: 'Schematic prediction; no measured resistance quantity.',
      limitations: 'Prediction-only layer; all quantitative resistance endpoints NOT_REPORTED.', sourceIds: (this.profile && this.profile.source_ids) || [],
    }));
  }

  /** Baseline resistance frame (computed once per context; then advanced by step/evaluateResistance). */
  _compute() { this.evaluateResistance({ exposureStatus: 'single_exposure', exposureStage: 'initial' }); }

  _buildTimeline() {
    const s = this.state;
    this.timeline = [
      { kind: 'milestone', event: 'baseline_resistance_loaded', detail: { tumourModel: this.tumourModel, intrinsic: s.intrinsic.state, evidenceLevel: this.profile.evidence_level } },
      { kind: 'milestone', event: 'treatment_exposure_evaluated', detail: { status: s.exposure.exposureStatus, effective: s.exposure.effectiveIntracellularExposure } },
      { kind: 'milestone', event: 'treatment_pressure_calculated', detail: { state: s.pressure.state, net: s.pressure.netTreatmentPressure } },
      { kind: 'milestone', event: 'survivor_state_evaluated', detail: { category: s.survivor.category, cause: s.survivor.apparentResistanceCause } },
      { kind: 'milestone', event: 'drug_tolerance_evaluated', detail: { state: s.tolerance.state } },
      { kind: 'milestone', event: 'adaptive_resistance_evaluated', detail: { state: s.adaptive.state, mechanism: s.adaptive.mechanismCategory } },
      { kind: 'milestone', event: 'selection_pressure_evaluated', detail: { state: s.selection.state } },
      { kind: 'milestone', event: 'population_enrichment_applied', detail: { dominant: s.enrichment.dominantSubpopulation, strength: s.enrichment.enrichmentStrength } },
      { kind: 'milestone', event: 'persistence_evaluated', detail: { state: s.persistence.state, result: s.persistence.persistenceResult } },
      { kind: 'milestone', event: 'acquired_resistance_updated', detail: { state: s.acquired.state } },
      { kind: 'milestone', event: 'resistance_burden_calculated', detail: { category: s.burden.category, total: s.burden.total } },
      { kind: 'milestone', event: 'resistance_modifier_prepared', detail: { net: s.modifier.netTreatmentSensitivity } },
    ];
  }

  /** Resistance field advances across deterministic frames; step() advances one evaluation stage. */
  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : 0.5;
    this.timeH += dt; this._stepCount += 1;
    if (this.available) this.evaluateResistance({ exposureStatus: 'sustained_exposure', exposureStage: 'sustained' });
    return [];
  }
  run(steps, dtHours) { for (let i = 0; i < steps; i++) this.step(dtHours); return []; }

  // ---- advisory outputs (never mutate upstream) --------------------------
  /** The headline advisory value consumed by the NEXT response stage (1 = unmodified sensitivity). */
  treatmentSensitivityModifier() { return this.available ? this.state.modifier.netTreatmentSensitivity : 1; }
  resistanceBurden() { return this.available ? this.state.burden.total : 0; }
  populationFractions() { return { ...this.state.population.fractions }; }

  // ---- accessors ---------------------------------------------------------
  getTimeline() { return this.timeline.slice(); }
  getEvents() { return this.state.events.slice(); }

  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.evidence_level === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'MECHANISTIC_PREDICTION'); }
  summaryMessage() {
    if (this.isIdle()) return `Resistance: Not Reported / Unavailable for ${this.species} (${this.tumourModel}).`;
    const s = this.state;
    return `Resistance (${this.tumourModel}): ${this.profile.evidence_level} - tolerance ${s.tolerance.state} / adaptive ${s.adaptive.state} / acquired ${s.acquired.state}; burden ${s.burden.category} (${r3(s.burden.total)}); net sensitivity modifier ${s.modifier.netTreatmentSensitivity} (schematic prediction; advisory only).`;
  }

  stats() {
    const s = this.state;
    return {
      available: this.available, species: this.species, tumourModel: this.tumourModel, formulation: this.formulation,
      intrinsicSensitivity: s.intrinsic.state, treatmentPressure: s.pressure.state, survivorState: s.survivor.category,
      tolerance: s.tolerance.state, adaptive: s.adaptive.state, acquired: s.acquired.state, persistence: s.persistence.state,
      selectionPressure: s.selection.state, dominantSubpopulation: s.population.dominant(),
      resistanceBurden: s.burden.category, totalBurden: r3(s.burden.total), netSensitivityModifier: s.modifier.netTreatmentSensitivity,
      immune: s.immune.available ? 'AVAILABLE' : 'UNAVAILABLE',
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED', timeH: r2(this.timeH),
    };
  }

  frame() {
    const p = this.profile || {};
    const s = this.state;
    return {
      species: this.species, tumourModel: this.tumourModel, formulation: this.formulation, available: this.available,
      baseline: { intrinsicSensitivity: s.intrinsic.state, initialResponseFactor: s.intrinsic.initialResponseFactor, resistantFraction: s.baseline.baselineResistantFraction, tolerantFraction: s.baseline.baselineTolerantFraction },
      exposure: { status: s.exposure.exposureStatus, stage: s.exposure.exposureStage, effective: s.exposure.effectiveIntracellularExposure },
      pressure: { state: s.pressure.state, net: s.pressure.netTreatmentPressure },
      survivor: { category: s.survivor.category, apparentResistanceCause: s.survivor.apparentResistanceCause },
      tolerance: { state: s.tolerance.state, modifier: s.tolerance.toleranceSurvivalModifier, reversibility: s.tolerance.reversibility },
      adaptive: { state: s.adaptive.state, modifier: s.adaptive.adaptiveSensitivityReduction, mechanism: s.adaptive.mechanismCategory, reversibility: s.adaptive.reversibility },
      acquired: { state: s.acquired.state, modifier: s.acquired.acquiredSensitivityReduction },
      persistence: { state: s.persistence.state, result: s.persistence.persistenceResult },
      mechanisms: s.mechanisms.map((m) => ({ category: m.category, state: m.state, modifier: m.modifier, evidenceLevel: m.evidenceLevel })),
      microenvironmentProtection: { level: s.microenvironmentProtection.state, deliveryProtection: s.microenvironmentProtection.deliveryProtection },
      immune: { available: s.immune.available, state: s.immune.state, evidence: s.immune.available ? 'MECHANISTIC_PREDICTION' : 'UNAVAILABLE' },
      population: { fractions: { ...s.population.fractions }, dominant: s.population.dominant(), normalized: s.population.isNormalized() },
      selection: { state: s.selection.state, value: s.selection.selectionPressureValue, differentialSensitivity: s.selection.hasDifferentialSensitivity },
      enrichment: { state: s.enrichment.state, strength: s.enrichment.enrichmentStrength, dominant: s.enrichment.dominantSubpopulation, origin: s.enrichment.originClassification },
      reSensitization: { state: s.reSensitization.state, recovery: s.reSensitization.sensitivityRecovery },
      washout: { stage: s.washout.stage }, rechallenge: { state: s.rechallenge.state },
      burden: { category: s.burden.category, total: s.burden.total, dominantMechanism: s.burden.dominantMechanism, components: { intrinsic: s.burden.intrinsic, tolerance: s.burden.tolerance, adaptive: s.burden.adaptive, persistent: s.burden.persistent, microenvironmentProtection: s.burden.microenvironmentProtection, immuneEscape: s.burden.immuneEscape } },
      modifier: {
        exposureEffectiveness: s.modifier.exposureEffectiveness, uptakeEffectiveness: s.modifier.uptakeEffectiveness, targetEffectiveness: s.modifier.targetEffectiveness,
        stressResponse: s.modifier.stressResponse, apoptosisSensitivity: s.modifier.apoptosisSensitivity, populationLoss: s.modifier.populationLoss,
        recoveryPressure: s.modifier.recoveryPressure, regrowthPressure: s.modifier.regrowthPressure, durability: s.modifier.durability,
        netTreatmentSensitivity: s.modifier.netTreatmentSensitivity,
      },
      evidenceLevel: p.evidence_level || 'NOT_REPORTED', predictionLevel: p.prediction_level || 'NOT_REPORTED',
      predicted: p.evidence_level ? isResistancePrediction(p.evidence_level) : false,
      confidence: s.confidence, uncertainty: s.uncertainty, humanTranslationWarning: p.human_translation_warning || null,
      eventCount: s.events.length,
      // STOP boundary: resistance evaluates resistance state + an advisory modifier only.
      modifiesResistanceStateOnly: true, calculatesUpstreamBiology: false, mutatesUpstream: false,
      combinationTherapyEvidence: 'NOT_EVALUATED', forecastingEvidence: 'NOT_EVALUATED',
      mutationEvidence: 'NOT_EVALUATED', clinicalOutcomeEvidence: 'NOT_EVALUATED', immuneResistanceEvidence: s.immune.available ? 'MECHANISTIC_PREDICTION' : 'UNAVAILABLE',
      quantitativeStatus: 'NOT_REPORTED',
      timeH: r2(this.timeH), summaryLevel: this.summaryLevel(),
    };
  }

  // ---- validation --------------------------------------------------------
  /** Registry + consistency integrity. STOP at resistance state + advisory modifier. */
  validate() {
    const errors = []; const warnings = [];
    const FORBIDDEN = ['mutation', 'genome', 'methylation', 'histone', 'phylogeny', 'combination_therapy', 'synergy', 'forecast', 'ic50_value', 'clinical_progression'];
    const profs = this.reg.context.profiles || {};
    const seen = new Set();
    for (const [pid, p] of Object.entries(profs)) {
      if (seen.has(pid)) errors.push(`duplicate resistance profile id: ${pid}`); seen.add(pid);
      if (p.profile_id && p.profile_id !== pid) errors.push(`profile ${pid} profile_id mismatch`);
      if (!KNOWN_SPECIES.has(p.species)) errors.push(`profile ${pid} invalid/unsupported species: ${p.species}`);
      if (!isResistanceEvidenceLevel(p.evidence_level)) errors.push(`profile ${pid} invalid evidence_level ${p.evidence_level}`);
      // no rat available resistance (no fallback from skin permeation)
      if (p.species === 'rat' && p.resistance_available) errors.push(`profile ${pid} rat must not have available resistance (no fallback)`);
      if (!p.resistance_available) {
        if (p.evidence_level !== 'NOT_REPORTED' && p.evidence_level !== 'UNAVAILABLE') errors.push(`profile ${pid} unavailable but evidence_level ${p.evidence_level}`);
        continue;
      }
      // prediction-only: an active resistance profile is NEVER experimental (there is no experimental tier)
      if (!isResistancePrediction(p.evidence_level)) errors.push(`profile ${pid} active resistance must be a labelled prediction (got ${p.evidence_level})`);
      // baseline must not default unknown -> fully sensitive
      if (p.baseline_sensitivity === 'very_high_sensitivity' && p.confidence === 'LOW' && !(p.source_ids || []).length) warnings.push(`profile ${pid} very_high_sensitivity with no source_ids`);
      // population fractions (if present) must satisfy the invariant
      if (p.baseline_fractions) {
        const sum = Object.values(p.baseline_fractions).reduce((a, v) => a + (v || 0), 0);
        if (Math.abs(sum - 1) > 0.0001) errors.push(`profile ${pid} baseline_fractions sum ${r3(sum)} != 1`);
        if (Object.values(p.baseline_fractions).some((v) => v < 0 || v > 1)) errors.push(`profile ${pid} baseline_fractions out of [0,1]`);
      }
      for (const bad of FORBIDDEN) if ((p.treatment_context || '').toLowerCase().includes(bad)) errors.push(`profile ${pid} references a forbidden concept: ${bad}`);
    }
    // state-machine structural integrity
    const smv = this.sm.validate(); if (!smv.ok) errors.push(...smv.errors);
    // runtime: population invariant + bounded modifiers + immune UNAVAILABLE
    if (this.available) {
      const s = this.state;
      if (!s.population.isNormalized()) errors.push(`runtime population fractions not normalized (sum=${r3(s.population.sum())})`);
      const mods = [s.modifier.netTreatmentSensitivity, s.modifier.exposureEffectiveness, s.modifier.uptakeEffectiveness, s.modifier.targetEffectiveness, s.modifier.apoptosisSensitivity, s.modifier.populationLoss, s.modifier.durability];
      if (mods.some((m) => m < 0 || m > 1)) errors.push('resistance modifier out of [0,1]');
      if (s.burden.total < 0 || s.burden.total > 1) errors.push('resistance burden out of [0,1]');
      if (s.immune.available) warnings.push('immune-associated resistance marked available but Phase 7C is not implemented');
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function r2(x) { return Math.round(x * 100) / 100; }

export default ResistanceEngine;
