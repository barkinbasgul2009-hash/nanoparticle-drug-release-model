// Phase-6D tumour growth, regression & treatment-response engine. The first layer that
// represents a schematic TUMOUR-level treatment response - but NOT a clinical-response layer.
// It reads the Phase-6C PopulationEngine (composition + history) READ-ONLY and the Phase-6D
// registries, and modifies nothing upstream. Deterministic (pure arithmetic, no RNG - no
// uncontrolled random growth/regression).
//
// Hard boundaries:
//   * Tumour burden is a SCHEMATIC normalized value (baseline 1.0, bounds [lower, upper]) -
//     NEVER a real tumour volume/diameter/weight/cellularity/RECIST measurement.
//   * Two distinct treatment paths: growth suppression AND increased loss (never collapsed).
//     net_growth_pressure = growth_pressure - loss_pressure  (SCHEMATIC).
//   * No tumour response without population input (population-gated).
//   * Regression requires net loss; growth requires positive net growth; strong regression is
//     impossible without treatment. Burden never goes negative.
//   * STOP at the schematic treatment-response trajectory. No clinical / RECIST / survival /
//     metastasis / immune / PK / toxicity / patient outcome is ever represented.
//
// B16 / B16BL6 / B16-F10 are independent contexts (never merged); human is predictive-
// exploratory / UNAVAILABLE; rat is NOT_REPORTED.

import { TumorBurdenState, TumorGrowthPressure, TumorLossPressure, TumorTreatmentEvent } from './tumorObjects.js';
import { isTumorEvidenceLevel, isTumorExperimental, isTumorPrediction, isTumorTransfer, tumorLevelActive } from '../evidence/evidenceEngine.js';

const KNOWN_SPECIES = new Set(['mouse', 'human', 'rat']);

export class TumorResponseEngine {
  /**
   * @param {{
   *   contextRegistry:any, responseRegistry:any, transitionsRegistry:any, modelRegistry:any,
   *   formulationRegistry:any, treatmentRegistry:any, evidenceRegistry:any, predictionRegistry:any,
   *   populationEngine: object, species?: string, cellModel?: string, formulation?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    const req = ['contextRegistry', 'responseRegistry', 'transitionsRegistry', 'modelRegistry', 'formulationRegistry', 'treatmentRegistry', 'evidenceRegistry', 'predictionRegistry', 'populationEngine'];
    if (!deps || req.some((k) => !deps[k])) throw new Error('TumorResponseEngine requires the Phase-6D registries + populationEngine');
    this.ctxReg = deps.contextRegistry;
    this.respReg = deps.responseRegistry;
    this.transReg = deps.transitionsRegistry;
    this.modelReg = deps.modelRegistry;
    this.formReg = deps.formulationRegistry;
    this.treatReg = deps.treatmentRegistry;
    this.evReg = deps.evidenceRegistry;
    this.predReg = deps.predictionRegistry;
    this.pop = deps.populationEngine;                 // read-only population source
    this.logger = deps.logger || null;
    this.sm = this.transReg.state_machine || {};
    this.dyn = this.transReg.defaults || {};
    this.thr = this.respReg.response_thresholds || {};
    this.burdenSem = this.respReg.burden_semantics || {};
    this.species = deps.species || 'human';
    this.cellModel = deps.cellModel || this._canonicalCellModel(this.species);
    this._formulationOverride = deps.formulation || null;
    this._scheduleOverride = null;
    this._build();
  }

  _canonicalCellModel(species) { return species === 'mouse' ? 'B16BL6' : species === 'human' ? 'HaCaT' : species === 'rat' ? 'ex_vivo_skin' : null; }

  _profile() {
    return Object.values(this.ctxReg.profiles || {}).find((p) => p.species === this.species && p.cell_model === this.cellModel) || null;
  }

  _build() {
    const p = this._profile();
    this.profile = p;
    this.timeH = 0; this._stepCount = 0; this.timeline = []; this.history = [];
    this._initEmitted = false; this._milestones = new Set(); this._manualTreatment = null; this._treatmentEverStarted = false;
    // population-gated: no tumour response without an active population input.
    const popIdle = !this.pop || (this.pop.isIdle && this.pop.isIdle());
    this.available = !!(p && p.tumor_available && !popIdle);
    this.formulation = this._formulationOverride && p && (p.supported_formulations || []).includes(this._formulationOverride)
      ? this._formulationOverride : (p ? p.default_formulation : null);
    const scheduleId = this._scheduleOverride || (p ? p.default_treatment_schedule : null);
    this.schedule = scheduleId ? ((this.treatReg.schedules || {})[scheduleId] || null) : null;
    // treatment effect state (ramps/decays)
    this._treatmentSuppression = 0; this._treatmentLoss = 0;
    const bd = this.modelReg.burden_defaults || {};
    this.burden = new TumorBurdenState('tumor_0', {
      species: this.species, cell_model: this.cellModel, tumor_model: p ? p.tumor_model : 'none', formulation: this.formulation,
      baseline_burden: bd.baseline_burden ?? 1.0,
      evidence_level: p ? p.evidence_level : 'NOT_REPORTED', prediction_level: p ? p.prediction_level : 'NOT_REPORTED',
      confidence: p ? p.confidence : 'LOW', uncertainty: p ? p.uncertainty : '',
    });
    this.growth = new TumorGrowthPressure();
    this.loss = new TumorLossPressure();
    this.burden.responseState = this.available ? (this.sm.initial_state || 'untreated_growth') : (p && p.evidence_level === 'NOT_REPORTED' ? 'not_reported' : 'unavailable');
  }

  isIdle() { return !this.available; }
  get lowerBound() { return this.burdenSem.lower_bound ?? 0.0; }
  get upperBound() { return this.burdenSem.upper_bound ?? 1.5; }

  // ---- controls (any context change fully clears the trajectory) ----------

  setSpecies(speciesId) { this.species = speciesId; this.cellModel = this._canonicalCellModel(speciesId); this._formulationOverride = null; this._build(); this._log('info', 'tumor', `species -> ${speciesId} (${this.cellModel}; available=${this.available})`); return this; }
  setCellModel(cellModel) { this.cellModel = cellModel; this._formulationOverride = null; this._build(); this._log('info', 'tumor', `cell model -> ${cellModel} (available=${this.available})`); return this; }
  setFormulation(formulationId) { if (this.profile && (this.profile.supported_formulations || []).includes(formulationId)) { this._formulationOverride = formulationId; this._build(); } return this; }
  setSchedule(scheduleId) { if ((this.treatReg.schedules || {})[scheduleId]) { this._scheduleOverride = scheduleId; this._build(); } return this; }
  /** Manual treatment override: true=on, false=off, null=follow schedule. Clears trajectory. */
  setTreatment(active) { this._build(); this._manualTreatment = active; return this; }
  startTreatment() { return this.setTreatment(true); }
  stopTreatment() { this._manualTreatment = false; return this; }

  restart() { const fo = this._formulationOverride, mt = this._manualTreatment, so = this._scheduleOverride; this._build(); this._formulationOverride = fo; this._manualTreatment = mt; this._scheduleOverride = so; return this; }
  reset() { return this.restart(); }

  // ---- FSM ---------------------------------------------------------------

  _legal(from, to) { const t = (this.sm.legal_transitions || {})[from] || []; return from === to || t.includes(to); }
  transitionTo(next) {
    if (!this._legal(this.burden.responseState, next)) throw new Error(`illegal tumour transition: ${this.burden.responseState} -> ${next}`);
    if (this.burden.responseState !== next) { this.burden.responseState = next; this._push('state', next); this._milestone('response_state_changed', { state: next }); }
    return this.burden.responseState;
  }
  _push(kind, event, extra) { this.timeline.push({ timeH: r2(this.timeH), kind, event, ...(extra || {}) }); }
  _milestone(event, extra) { if (!this._milestones.has(event)) { this._milestones.add(event); this._push('milestone', event, extra); } }

  _emitInit() {
    if (this._initEmitted) return; this._initEmitted = true;
    this._milestone('tumour_model_initialized', { cellModel: this.cellModel, formulation: this.formulation, evidenceLevel: this.profile.evidence_level });
    if (isTumorTransfer(this.profile.evidence_level)) this._milestone('context_transfer_activated', { evidenceLevel: this.profile.evidence_level });
    else if (isTumorPrediction(this.profile.evidence_level)) this._milestone('prediction_activated', { evidenceLevel: this.profile.evidence_level });
    else if (isTumorExperimental(this.profile.evidence_level)) this._milestone('experimental_evidence_active', { evidenceLevel: this.profile.evidence_level });
  }

  // ---- treatment scheduling ----------------------------------------------

  _treatmentActive() {
    if (this._manualTreatment !== null) return !!this._manualTreatment;
    const evs = (this.schedule && this.schedule.events) || [];
    return evs.some((e) => this._stepCount >= (e.start_units ?? 0) && (e.end_units == null || this._stepCount < e.end_units));
  }

  _formulationEffect() {
    const f = (this.formReg.formulations || {})[this.formulation] || {};
    const v = this.formReg.effect_class_values || { none: 0, minimal: 0.15, low: 0.3, moderate: 0.5, high: 0.8 };
    return { suppression: v[f.growth_suppression_class] ?? 0, loss: v[f.loss_induction_class] ?? 0 };
  }

  // ---- step --------------------------------------------------------------

  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.dyn.dt_hours ?? 0.5);
    if (this.isIdle() || (this.pop.isIdle && this.pop.isIdle())) { this.timeH += dt; this._stepCount += 1; return []; }
    const events = [];
    this._emitInit();
    const d = this.dyn;
    const pf = this.pop.frame ? this.pop.frame() : {};
    const living = clamp01(pf.livingFraction ?? 1);
    const apoptotic = clamp01(pf.apoptoticFraction ?? 0);
    const popState = pf.populationState || 'healthy';

    const treated = this._treatmentActive();
    if (treated && !this._treatmentEverStarted) { this._treatmentEverStarted = true; this._milestone('treatment_started', { formulation: this.formulation }); this._push('treatment', 'formulation_applied', { formulation: this.formulation }); }
    if (!treated && this._treatmentEverStarted) this._milestone('treatment_ended', {});
    this.burden.treatmentState = treated ? 'on' : 'off';

    // treatment effect ramps up when on, decays when off (rebound-ready).
    const fx = this._formulationEffect();
    if (treated) { this._treatmentSuppression = fx.suppression; this._treatmentLoss = fx.loss; }
    else {
      this._treatmentSuppression = Math.max(0, this._treatmentSuppression - (d.treatment_suppression_decay_per_hour ?? 0.15) * dt);
      this._treatmentLoss = Math.max(0, this._treatmentLoss - (d.treatment_loss_decay_per_hour ?? 0.12) * dt);
    }

    // ---- growth pressure (proliferation drive; living fraction is a DISTINCT abstraction) ----
    // The untreated / vehicle control grows as a fully-viable reference (viability = 1); under
    // treatment the actual population living fraction drives proliferative capacity.
    const upper = this.upperBound;
    const viability = treated ? living : 1.0;
    const resourceLimitation = Math.max(0, (upper - this.burden.currentBurden) / upper);
    const cyclingCapacity = d.cycling_capacity_default ?? 1.0;
    const baseGrowth = d.baseline_growth_pressure ?? 0.1;
    const growthPressure = Math.max(0, baseGrowth * cyclingCapacity * (d.population_viability_weight ?? 1.0) * viability * (1 - this._treatmentSuppression) * resourceLimitation);
    this.growth.baselineProliferativePressure = baseGrowth; this.growth.populationViabilityInput = viability;
    this.growth.cellCycleInput = cyclingCapacity; this.growth.treatmentSuppression = this._treatmentSuppression;
    this.growth.resourceLimitation = resourceLimitation; this.growth.netGrowthPressure = growthPressure;
    this.growth.evidenceLevel = this.profile.evidence_level; this.growth.confidence = this.burden.confidence;

    // ---- loss pressure (reduced viable burden; NOT physical / immune clearance) ----
    // Population apoptosis couples to loss ONLY under treatment (the untreated/vehicle control
    // grows regardless of the in-vitro apoptosis signal). Two distinct treatment paths:
    // growth suppression (above) AND increased loss (here).
    const apoptoticLoss = treated ? (d.loss_apoptotic_coupling ?? 0.18) * apoptotic : 0;
    // the ordinal formulation loss class is scaled into the schematic pressure regime so
    // regression is gradual (never instant).
    const lossPressure = Math.max(0, apoptoticLoss + this._treatmentLoss * (d.loss_induction_scale ?? 0.12));
    this.loss.apoptoticFractionInput = apoptotic; this.loss.treatmentInducedLoss = this._treatmentLoss;
    this.loss.netLossPressure = lossPressure; this.loss.clearanceExcluded = true;
    this.loss.evidenceLevel = this.profile.evidence_level; this.loss.confidence = this.burden.confidence;

    // ---- net pressure + schematic burden update ----
    let net = growthPressure - lossPressure;
    // residual floor: once burden has regressed to the minimal-residual level, net loss holds
    // it there (a resistant residual population) - prefer minimal_residual_burden over zero.
    const minLevel = this.thr.minimal_residual_burden_level ?? 0.15;
    if (net < 0 && this.burden.currentBurden <= minLevel) net = 0;
    this.burden.growthPressure = r3(growthPressure); this.burden.lossPressure = r3(lossPressure); this.burden.netGrowthPressure = r3(net);
    this.burden.currentBurden = clamp(this.burden.currentBurden + net * (d.burden_step_scale ?? 0.12) * dt, this.lowerBound, upper);
    // burden partition (schematic): viable + apoptotic == current burden; terminal <= apoptotic.
    this.burden.normalizedViableBurden = r3(this.burden.currentBurden * living);
    this.burden.normalizedApoptoticBurden = r3(this.burden.currentBurden * apoptotic);
    this.burden.normalizedTerminalBurden = r3(this.burden.currentBurden * apoptotic * (['apoptosis_dominant', 'stable_terminal_state'].includes(popState) ? 1 : 0));

    // ---- response state machine ----
    this._advanceResponse(treated, net, events);

    // milestones for pressure changes (first occurrence).
    if (treated && this._treatmentSuppression > 0) this._milestone('growth_pressure_reduced', {});
    if (treated && lossPressure > (this.thr.net_growth_epsilon ?? 0.02)) this._milestone('loss_pressure_increased', {});

    // history (deterministic replay).
    this.history.push({
      timeH: r2(this.timeH), responseState: this.burden.responseState, currentBurden: r3(this.burden.currentBurden),
      normalizedViableBurden: this.burden.normalizedViableBurden, normalizedApoptoticBurden: this.burden.normalizedApoptoticBurden,
      growthPressure: this.burden.growthPressure, lossPressure: this.burden.lossPressure, netGrowthPressure: this.burden.netGrowthPressure,
      treatmentState: this.burden.treatmentState, formulation: this.formulation,
      evidenceLevel: this.profile.evidence_level, predictionLevel: this.profile.prediction_level, confidence: this.burden.confidence,
    });
    this.burden.updatedAt = this.timeH;
    this.timeH += dt; this._stepCount += 1;
    return events;
  }

  /** Deterministic response FSM: one legal step per tick from the current state + signals. */
  _advanceResponse(treated, net, events) {
    const cur = this.burden.responseState;
    const eps = this.thr.net_growth_epsilon ?? 0.02;
    const regT = this.thr.regression_net_loss ?? -0.04;
    const strongT = this.thr.strong_regression_net_loss ?? -0.09;
    const minLevel = this.thr.minimal_residual_burden_level ?? 0.15;
    const reboundT = this.thr.rebound_net_growth ?? 0.03;
    const burden = this.burden.currentBurden;
    const viableRemain = this.burden.normalizedViableBurden;
    const go = (next) => { if (this._legal(cur, next) && next !== cur) { this.transitionTo(next); this._responseEvent(next, events); return true; } return false; };

    switch (cur) {
      case 'untreated_growth': if (treated) go('treatment_started'); break;
      case 'treatment_started': net > eps ? go('growth_continues') : go('growth_slowed'); break;
      case 'growth_continues':
        if (!treated) go('treatment_ended');
        else if (net <= eps) go('growth_slowed');
        break;
      case 'growth_slowed':
        if (!treated) go('treatment_ended');
        else if (net <= regT) go('partial_regression');
        else if (net > eps) go('growth_continues');
        else if (Math.abs(net) < eps) go('stable_burden');
        break;
      case 'stable_burden':
        if (!treated) go('treatment_ended');
        else if (net <= regT) go('partial_regression');
        else if (net > eps) go('growth_continues');
        break;
      case 'partial_regression':
        if (net <= strongT) go('strong_regression');
        else if (net > eps) go('stable_burden');
        else if (!treated) go('treatment_ended');
        break;
      case 'strong_regression':
        if (burden <= minLevel) go('minimal_residual_burden');
        else if (net > eps) go('partial_regression');
        else if (!treated) go('treatment_ended');
        break;
      case 'minimal_residual_burden':
        if (!treated) go('treatment_ended');
        break;
      case 'treatment_ended':
        (viableRemain > minLevel) ? go('rebound_possible') : go('stable_post_treatment');
        break;
      case 'rebound_possible':
        net >= reboundT ? go('rebound_in_progress') : go('stable_post_treatment');
        break;
      case 'rebound_in_progress': break; // terminal-ish; may reach unresolved at window end
      case 'stable_post_treatment':
        if (viableRemain > minLevel && net >= reboundT) go('rebound_possible');
        break;
      default: break;
    }
    // book-keeping timestamps
    if (['partial_regression', 'strong_regression'].includes(this.burden.responseState) && this.burden.regressionStartedAt == null) this.burden.regressionStartedAt = this.timeH;
    if (this.burden.responseState === 'rebound_in_progress' && this.burden.reboundStartedAt == null) this.burden.reboundStartedAt = this.timeH;
    if (this.burden.responseState === 'stable_burden' && this.burden.stabilizedAt == null) this.burden.stabilizedAt = this.timeH;
  }

  _responseEvent(state, events) {
    const map = {
      growth_slowed: 'growth_slowed', stable_burden: 'stable_burden_reached', partial_regression: 'regression_started',
      strong_regression: 'strong_regression_state_entered', minimal_residual_burden: 'minimal_residual_burden_reached',
      treatment_ended: 'treatment_ended', rebound_possible: 'rebound_possible', rebound_in_progress: 'rebound_started',
      stable_post_treatment: 'post_treatment_state_stabilized',
    };
    if (map[state]) { this._milestone(map[state], {}); events.push({ type: `tumor:${map[state]}`, timeH: this.timeH }); }
  }

  run(steps, dtHours) { const ev = []; for (let i = 0; i < steps; i++) ev.push(...this.step(dtHours)); return ev; }

  // ---- accessors ---------------------------------------------------------

  getTimeline() { return this.timeline.slice(); }
  getHistory() { return this.history.slice(); }
  /** Deterministic normalized response curve (burden vs schematic time). */
  responseCurve() {
    return {
      cellModel: this.cellModel, formulation: this.formulation, evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED',
      predicted: this.profile ? isTumorPrediction(this.profile.evidence_level) : false, quantitativeStatus: 'NOT_REPORTED',
      timeWarning: 'Schematic simulation time; not a biological timescale.',
      points: this.history.map((h) => ({ timeH: h.timeH, burden: h.currentBurden })),
    };
  }
  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.evidence_level === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'MECHANISTIC_PREDICTION'); }
  summaryMessage() {
    if (this.isIdle()) return `Tumour response: Not Reported / Unavailable for ${this.species} (${this.cellModel}).`;
    return `Tumour response (${this.cellModel} / ${this.formulation}): ${this.profile.evidence_level} - state ${this.burden.responseState}; relative burden ${r3(this.burden.currentBurden)} (normalized schematic, not mm3); clinical / survival outcome NOT evaluated.`;
  }

  stats() {
    return {
      available: this.available, cellModel: this.cellModel, formulation: this.formulation, tumorModel: this.burden.tumorModel,
      responseState: this.burden.responseState, treatmentState: this.burden.treatmentState,
      currentBurden: r3(this.burden.currentBurden), normalizedViableBurden: this.burden.normalizedViableBurden,
      normalizedApoptoticBurden: this.burden.normalizedApoptoticBurden, growthPressure: this.burden.growthPressure,
      lossPressure: this.burden.lossPressure, netGrowthPressure: this.burden.netGrowthPressure,
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED', timeH: r2(this.timeH), steps: this._stepCount,
    };
  }

  frame() {
    const p = this.profile || {};
    return {
      cellModel: this.cellModel, species: this.species, formulation: this.formulation, tumorModel: this.burden.tumorModel,
      available: this.available, responseState: this.burden.responseState, treatmentState: this.burden.treatmentState,
      currentBurden: r3(this.burden.currentBurden), baselineBurden: r3(this.burden.baselineBurden),
      normalizedViableBurden: this.burden.normalizedViableBurden, normalizedApoptoticBurden: this.burden.normalizedApoptoticBurden,
      normalizedTerminalBurden: this.burden.normalizedTerminalBurden,
      growthPressure: this.burden.growthPressure, lossPressure: this.burden.lossPressure, netGrowthPressure: this.burden.netGrowthPressure,
      evidenceLevel: p.evidence_level || 'NOT_REPORTED', predictionLevel: p.prediction_level || 'NOT_REPORTED',
      predicted: p.evidence_level ? isTumorPrediction(p.evidence_level) : false,
      experimental: p.evidence_level ? isTumorExperimental(p.evidence_level) : false,
      contextTransfer: p.evidence_level ? isTumorTransfer(p.evidence_level) : false,
      confidence: this.burden.confidence, uncertainty: this.burden.uncertainty,
      humanTranslationWarning: p.human_translation_warning || null,
      burdenWarning: this.burdenSem.normalized || 'Relative tumour burden is normalized and schematic unless primary quantitative data are explicitly loaded.',
      quantitativeStatus: 'NOT_REPORTED',
      // STOP boundary: no clinical outcome ever evaluated.
      tumourResponseEvidence: this.available ? (isTumorExperimental(p.evidence_level) ? 'EXPERIMENTAL_DIRECTION' : 'PREDICTED') : 'NOT_EVALUATED',
      clinicalResponseEvidence: 'NOT_EVALUATED', survivalEvidence: 'NOT_EVALUATED', recistEvidence: 'NOT_EVALUATED',
      metastasisEvidence: 'NOT_EVALUATED', immuneEvidence: 'NOT_EVALUATED', pkEvidence: 'NOT_EVALUATED',
      timeH: r2(this.timeH), summaryLevel: this.summaryLevel(),
    };
  }

  // ---- validation --------------------------------------------------------

  validate() {
    const errors = []; const warnings = [];
    const CLINICAL_FORBIDDEN = ['clinical', 'recist', 'survival', 'cure', 'metasta', 'invasion', 'angiogen', 'immune', 'lymphatic', 'pharmacokinet', 'pbpk', 'toxicity', 'therapeutic_index', 'dose_recommendation', 'patient'];
    const profs = this.ctxReg.profiles || {};
    const evRecs = this.evReg.evidence_records || {};
    const forms = this.formReg.formulations || {};
    const seen = new Set();
    for (const [pid, p] of Object.entries(profs)) {
      if (seen.has(pid)) errors.push(`duplicate tumour profile id: ${pid}`); seen.add(pid);
      if (p.profile_id && p.profile_id !== pid) errors.push(`profile ${pid} profile_id mismatch`);
      if (!KNOWN_SPECIES.has(p.species)) errors.push(`profile ${pid} invalid species: ${p.species}`);
      if (!p.cell_model) errors.push(`profile ${pid} missing cell_model`);
      if (!isTumorEvidenceLevel(p.evidence_level)) errors.push(`profile ${pid} invalid evidence_level`);
      // no human EXPERIMENTAL label from mouse data
      if (p.species === 'human' && isTumorExperimental(p.evidence_level)) errors.push(`profile ${pid} human must not carry an EXPERIMENTAL tumour label`);
      // no rat default tumour model
      if (p.species === 'rat' && p.tumor_available) errors.push(`profile ${pid} rat must not have an available tumour model (no rat fallback)`);
      // unavailable / not-reported profiles must not be available
      if (!p.tumor_available && isTumorExperimental(p.evidence_level) && p.species !== 'mouse') errors.push(`profile ${pid} unavailable but experimental`);
      // experimental profiles need a verified evidence reference
      if (isTumorExperimental(p.evidence_level)) {
        const refs = (p.evidence_refs || []).map((r) => evRecs[r]).filter(Boolean);
        if (!refs.length || refs.every((r) => r.verification_status !== 'VERIFIED_PRIMARY_STUDY' && r.verification_status !== 'VERIFIED_IN_FROZEN_PACKAGE')) errors.push(`profile ${pid} EXPERIMENTAL without a verified source`);
      }
      // no silent cell-model mixing (a referenced record for another cell model needs a transfer)
      for (const rid of (p.evidence_refs || [])) {
        const rec = evRecs[rid];
        if (rec && rec.cell_model && rec.cell_model !== p.cell_model && !isTumorTransfer(p.evidence_level)) errors.push(`profile ${pid} (${p.cell_model}) silently uses ${rec.cell_model} evidence ${rid} without a transfer label`);
      }
      // no fabricated quantitative values (citations qualitative / NOT_REPORTED unless a real primary study is cited by DOI)
      for (const rid of (p.evidence_refs || [])) {
        const rec = evRecs[rid];
        if (rec && rec.quantitative_status && !/NOT_REPORTED|UNAVAILABLE/.test(rec.quantitative_status)) warnings.push(`profile ${pid} evidence ${rid} claims a quantitative status`);
      }
      // no forbidden clinical concepts in profile fields
      for (const bad of CLINICAL_FORBIDDEN) if ((p.tumor_model || '').toLowerCase().includes(bad) || (p.disease_context || '').toLowerCase().includes(bad + '_response')) errors.push(`profile ${pid} references a forbidden clinical concept: ${bad}`);
    }
    // formulation ranking matches evidence (cationic > anionic, cationic > neutral, NLC > free, vehicle none)
    const rank = (id) => (forms[id] ? forms[id].effect_rank : null);
    if (rank('cationic_nlc') != null) {
      if (!(rank('cationic_nlc') > rank('anionic_nlc'))) errors.push('formulation ranking: cationic must outrank anionic');
      if (!(rank('cationic_nlc') > rank('neutral_nlc'))) errors.push('formulation ranking: cationic must outrank neutral');
      if (!(rank('cationic_nlc') > rank('free_tripterine'))) errors.push('formulation ranking: NLC must outrank free tripterine');
      if (rank('vehicle_control') !== 0) errors.push('formulation ranking: vehicle control must have effect_rank 0');
    }
    // FSM: no illegal regression-without-treatment shortcut declared
    const lt = this.sm.legal_transitions || {};
    if ((lt.untreated_growth || []).some((s) => ['strong_regression', 'partial_regression'].includes(s))) errors.push('FSM allows regression directly from untreated_growth');
    if (Object.values(lt).some((arr) => arr.includes('cure') || arr.includes('complete_response'))) errors.push('FSM references a forbidden clinical terminal state');
    // runtime: no negative burden, within bounds; response requires population input
    if (this.burden.currentBurden < this.lowerBound - 1e-9 || this.burden.currentBurden > this.upperBound + 1e-9) errors.push('runtime burden out of schematic bounds');
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default TumorResponseEngine;
