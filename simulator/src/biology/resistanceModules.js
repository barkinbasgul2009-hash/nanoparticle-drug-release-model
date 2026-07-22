// Phase-8A resistance sub-evaluators (deterministic, pure, registry-driven). Each function reads
// validated inputs + registry coefficients and returns an immutable resistance sub-state. NONE of
// these mutate an upstream (frozen) engine - they consume validated outputs only. Ordering follows
// the approved temporal model (baseline -> exposure -> pressure -> survivor -> tolerance ->
// adaptive -> selection -> enrichment -> persistence -> acquired -> burden -> modifier).
//
// CRITICAL invariants enforced here: resistance is never inferred from survival alone; a
// delivery-limited response is never promoted to acquired resistance; tolerance stays distinct from
// persistent resistance; selection redistributes composition without inventing a mechanism; acquired
// resistance needs temporal support; every value is bounded. No fabricated quantities.

import {
  clamp01, r3,
  BaselineResistanceState, IntrinsicSensitivityState, TreatmentExposure, TreatmentPressureState,
  SurvivorState, DrugToleranceState, AdaptiveResistanceState, AcquiredResistanceState,
  PersistentResistanceState, ResistanceMechanismState, MicroenvironmentProtectionState,
  ImmuneAssociatedResistanceState, MixedPopulationState, SelectionPressureState,
  PopulationEnrichmentState, ReSensitizationState, ResistanceBurden,
  FRACTION_KEYS, conserveFractions, aggregateBurden, burdenCategory,
} from './resistanceObjects.js';

// ---- small registry helpers -----------------------------------------------
function stateVal(reg, group, name, field, dflt) {
  const g = (reg && reg[group]) || {}; const s = g[name] || {};
  const v = s[field]; return v == null ? dflt : v;
}
function ordinalFromThresholds(value, thresholds, ordered) {
  // ordered = ['absent','negligible','low','moderate','high','very_high']; thresholds keyed by upper names
  let out = ordered[0];
  for (let i = 1; i < ordered.length; i++) { const t = thresholds[ordered[i]]; if (t != null && value >= t) out = ordered[i]; }
  return out;
}

// ---- baseline / intrinsic -------------------------------------------------

export function resolveBaseline(profile, intrinsicReg) {
  const baseline = new BaselineResistanceState(profile || {});
  const iName = (profile && profile.baseline_sensitivity) || 'unknown';
  const iFactor = stateVal(intrinsicReg, 'states', iName, 'initial_response_factor', null);
  const iEv = iName === 'unknown' ? 'NOT_REPORTED' : 'MECHANISTIC_PREDICTION';
  const intrinsic = new IntrinsicSensitivityState(iName, iFactor, iEv);
  const base = (profile && profile.baseline_fractions) || null;
  const population = base ? new MixedPopulationState(base) : new MixedPopulationState({ sensitive: 1 });
  return { baseline, intrinsic, population };
}

// ---- exposure + history ---------------------------------------------------

export function evaluateExposure(ctx, exposureReg) {
  const intensityMap = (exposureReg && exposureReg.relative_exposure_intensity) || {};
  const intensity = clamp01(ctx.effectiveExposure ?? 0);
  // effective intracellular exposure is capped by upstream delivery/uptake sufficiency (never applied dose)
  const effective = clamp01(intensity * (ctx.deliveryFactor ?? 1) * (ctx.uptakeFactor ?? 1));
  return new TreatmentExposure({
    exposureStatus: ctx.exposureStatus || 'untreated',
    exposureStage: ctx.exposureStage || 'none',
    relativeExposureIntensity: r3(intensity),
    effectiveIntracellularExposure: r3(effective),
    exposureConfidence: 'LOW',
    evidenceLevel: 'MECHANISTIC_PREDICTION',
  });
}

export function updateHistory(prev, exposure, netPressure) {
  const h = Object.assign(Object.create(Object.getPrototypeOf(prev)), prev); // shallow copy (deterministic)
  h.stageIndex = (prev.stageIndex || 0) + 1;
  if (h.firstExposureStage == null && exposure.exposureStatus !== 'untreated') h.firstExposureStage = h.stageIndex;
  // bounded cumulative accumulator (never unbounded)
  h.cumulativeExposure = clamp01((prev.cumulativeExposure || 0) + 0.15 * (exposure.effectiveIntracellularExposure || 0));
  h.previousMaximalPressure = Math.max(prev.previousMaximalPressure || 0, clamp01(netPressure || 0));
  h.interrupted = exposure.exposureStatus === 'interrupted' || exposure.exposureStatus === 'washout';
  if (exposure.exposureStatus === 'repeated_exposure' || exposure.exposureStatus === 'rechallenge') h.repeatedEpisodes = (prev.repeatedEpisodes || 0) + (prev.interrupted ? 1 : 0);
  return h;
}

// ---- treatment pressure (delivery-gated) ----------------------------------

export function evaluatePressure(exposure, ctx, pressureReg) {
  const w = (pressureReg && pressureReg.combination_weights) || {};
  const eff = exposure.effectiveIntracellularExposure || 0;
  // component pressures derive from EFFECTIVE exposure + validated upstream biological effect.
  const comp = {
    exposure_pressure: eff,
    cytotoxic_pressure: clamp01(eff * (ctx.observedResponse ?? 0)),
    stress_pressure: clamp01(ctx.stressInduced ?? 0),
    apoptosis_pressure: clamp01(ctx.apoptosisPressure ?? 0),
    pathway_pressure: clamp01(ctx.pathwayPressure ?? 0),
    duration_pressure: clamp01(ctx.durationPressure ?? 0),
    cumulative_pressure: clamp01(ctx.cumulativeExposure ?? 0),
  };
  let net = 0; for (const [k, val] of Object.entries(comp)) net += (w[k] ?? 0) * val;
  // delivery gate: negligible effective exposure -> negligible pressure regardless of applied amount
  net = clamp01(net * (eff <= 0.02 ? 0 : 1));
  const th = (pressureReg && pressureReg.state_thresholds) || {};
  const ordered = ['absent', 'negligible', 'low', 'moderate', 'high', 'very_high'];
  const state = ordinalFromThresholds(net, th, ordered);
  return new TreatmentPressureState({
    exposurePressure: r3(comp.exposure_pressure), cytotoxicPressure: r3(comp.cytotoxic_pressure),
    stressPressure: r3(comp.stress_pressure), apoptosisPressure: r3(comp.apoptosis_pressure),
    pathwayPressure: r3(comp.pathway_pressure), durationPressure: r3(comp.duration_pressure),
    cumulativePressure: r3(comp.cumulative_pressure), netTreatmentPressure: r3(net), state,
    confidence: 'LOW', uncertainty: 'Schematic; net pressure gated by effective exposure.',
  });
}

// ---- apparent-resistance hierarchy (delivery vs true resistance) ----------

export function classifyApparentResistance(ctx, mechReg) {
  // first failing gate explains a weak response as a LIMITATION, not resistance.
  const g = mechReg && mechReg.apparent_resistance_hierarchy;
  if (!(ctx.deliverySufficient ?? true)) return 'delivery_limited_response';
  if (!(ctx.uptakeSufficient ?? true)) return 'uptake_limited_response';
  if (!(ctx.targetEngaged ?? true)) return 'target_engagement_limited_response';
  if (!(ctx.stressCompetent ?? true)) return 'insufficient_evidence';
  if (!(ctx.apoptosisCompetent ?? true)) return 'apoptosis_limited_response';
  if ((ctx.microProtection ?? 0) >= 0.5) return 'microenvironment_protected_response';
  // survived DESPITE validated pressure:
  if ((ctx.survivedDespitePressure ?? false) && (ctx.survivorPersistedOrExpanded ?? false)) {
    return (ctx.temporalSupport ?? false) ? 'acquired_resistance_consistent' : 'adaptive_resistance_consistent';
  }
  return g ? 'insufficient_evidence' : 'insufficient_evidence';
}

// ---- survivor state (never resistance from survival alone) -----------------

export function evaluateSurvivor(pressure, apparentCause, ctx) {
  let category = 'no_meaningful_selection';
  const net = pressure.netTreatmentPressure;
  if (net < 0.05) category = 'no_meaningful_selection';
  else if (apparentCause === 'delivery_limited_response' || apparentCause === 'uptake_limited_response' || apparentCause === 'target_engagement_limited_response') category = 'predominantly_sensitive_survivors';
  else if (apparentCause === 'microenvironment_protected_response') category = 'mixed_survivors';
  else if (apparentCause === 'adaptive_resistance_consistent') category = (ctx.priorTolerant ? 'tolerant_survivors_enriched' : 'adaptive_survivors_enriched');
  else if (apparentCause === 'acquired_resistance_consistent') category = 'persistent_resistant_survivors_enriched';
  else category = net >= 0.45 ? 'mixed_survivors' : 'predominantly_sensitive_survivors';
  return new SurvivorState(category, apparentCause, 'MECHANISTIC_PREDICTION');
}

// ---- drug tolerance (reversible; state-machine guarded) --------------------

export function evaluateTolerance(pressure, survivor, prevState, sm, tolReg, supported) {
  const from = (prevState && prevState.state) || 'absent';
  const net = pressure.netTreatmentPressure;
  const viableSurvivors = survivor.category !== 'no_meaningful_selection';
  let proposed = from;
  if (net >= 0.2 && viableSurvivors) {
    if (from === 'absent') proposed = 'emerging';
    else if (from === 'emerging') proposed = 'established';
    else if (from === 'established') proposed = 'maintained';
    else proposed = from;
  } else if (net < 0.1) {
    if (from === 'maintained' || from === 'established' || from === 'emerging') proposed = 'resolving';
    else if (from === 'resolving') proposed = 'resolved';
  }
  const to = sm.step('drug_tolerance', from, proposed);
  const mod = stateVal(tolReg, 'states', to, 'tolerance_survival_modifier', 0);
  const rev = stateVal(tolReg, 'states', to, 'reversibility', 'not_applicable');
  const st = new DrugToleranceState(to, supported === false && to !== 'absent' ? 0 : mod, rev);
  return st;
}

// ---- adaptive resistance (reversible; documented mechanism) ----------------

export function evaluateAdaptive(pressure, tolerance, prevState, sm, adaptReg, supportedMechanisms) {
  const from = (prevState && prevState.state) || 'absent';
  const net = pressure.netTreatmentPressure;
  let proposed = from;
  if (net >= 0.45 && (tolerance.state !== 'absent')) {
    if (from === 'absent') proposed = 'initiating';
    else if (from === 'initiating') proposed = 'developing';
    else if (from === 'developing') proposed = 'established';
    else if (from === 'established') proposed = 'maintained';
    else proposed = from;
  } else if (net < 0.2) {
    if (['initiating', 'developing', 'established', 'maintained'].includes(from)) proposed = 'declining';
    else if (from === 'declining') proposed = 'resolved';
  }
  const to = sm.step('adaptive_resistance', from, proposed);
  const mod = stateVal(adaptReg, 'states', to, 'adaptive_sensitivity_reduction', 0);
  const rev = stateVal(adaptReg, 'states', to, 'reversibility', 'not_applicable');
  // mechanism category: prefer the profile's first supported adaptive-capable mechanism
  const cats = (adaptReg && adaptReg.mechanism_categories) || [];
  const mech = to === 'absent' ? null : ((supportedMechanisms || []).find((m) => cats.includes(m)) || cats[0] || 'stress_response_adaptation');
  return new AdaptiveResistanceState(to, mod, mech, rev);
}

// ---- acquired resistance (temporal support required) -----------------------

export function evaluateAcquired(adaptive, history, prevState, sm, acqReg, persistReg, ctx) {
  const from = (prevState && prevState.state) || 'absent';
  const minStages = (persistReg && persistReg.persistence_requirements && persistReg.persistence_requirements.minimum_exposure_stages) || 2;
  const temporalSupport = (history.repeatedEpisodes || 0) >= 1 || (history.stageIndex || 0) >= minStages;
  const persistenceEligible = (adaptive.state === 'established' || adaptive.state === 'maintained');
  const deliveryLimited = ctx && (ctx.apparentCause === 'delivery_limited_response' || ctx.apparentCause === 'uptake_limited_response');
  let proposed = from;
  if (deliveryLimited) {
    proposed = from === 'suspected' ? 'absent' : from;        // never promote a delivery-limited response
  } else if (persistenceEligible && temporalSupport) {
    if (from === 'absent') proposed = 'suspected';
    else if (from === 'suspected') proposed = 'emerging';
    else if (from === 'emerging') proposed = 'established';
    else proposed = from;
  } else if (from === 'suspected' && !temporalSupport) {
    proposed = 'absent';
  }
  const to = sm.step('acquired_resistance', from, proposed);
  const mod = stateVal(acqReg, 'states', to, 'acquired_sensitivity_reduction', 0);
  return new AcquiredResistanceState(to, mod);
}

// ---- persistence (washout gate) -------------------------------------------

export function evaluatePersistence(acquired, washout, sm, persistReg, prevState) {
  const req = (persistReg && persistReg.persistence_requirements) || {};
  const from = (prevState && prevState.state) || 'not_evaluated';
  const extended = washout && (washout.stage === 'extended_washout' || washout.stage === 'intermediate_washout');
  let proposed = from;
  let result = 'NOT_REPORTED';
  if (acquired.state === 'established' || acquired.state === 'persistent') {
    if (from === 'not_evaluated') proposed = 'persistence_pending';
    else if (from === 'persistence_pending') {
      if (req.washout_persistence_required && extended) { proposed = 'persistent'; result = 'PERSISTENT'; }
      else if (!req.washout_persistence_required) { proposed = 'persistent'; result = 'PERSISTENT'; }
      else { proposed = 'not_evaluated'; result = 'NOT_REPORTED'; }   // resolved during washout -> not persistent
    }
  } else if (from === 'persistent' && acquired.state === 'partially_reversible') {
    proposed = 'partially_reversible'; result = 'PARTIALLY_REVERSIBLE';
  }
  const to = sm.step('persistent_resistance', from, proposed);
  return new PersistentResistanceState(to, result);
}

// ---- mechanism abstractions -----------------------------------------------

export function evaluateMechanisms(states, regs, supportedMechanisms) {
  const out = [];
  const sup = new Set(supportedMechanisms || []);
  // stress adaptation (driven by adaptive/tolerance)
  if (sup.has('stress_response_adaptation')) {
    const lvl = states.adaptive.state === 'maintained' ? 'established' : states.adaptive.state === 'established' ? 'elevated' : states.tolerance.state !== 'absent' ? 'primed' : 'baseline';
    out.push(new ResistanceMechanismState('stress_response_adaptation', lvl, stateVal(regs.stress, 'states', lvl, 'stress_to_apoptosis_reduction', 0)));
  }
  if (sup.has('apoptosis_evasion')) {
    const lvl = states.adaptive.state === 'maintained' ? 'high' : states.adaptive.state === 'established' ? 'moderate' : states.tolerance.state !== 'absent' ? 'low' : 'absent';
    out.push(new ResistanceMechanismState('apoptosis_evasion', lvl, stateVal(regs.apoptosisEvasion, 'states', lvl, 'apoptosis_threshold_increase', 0)));
  }
  if (sup.has('compensatory_survival_signaling')) {
    const lvl = states.adaptive.state === 'maintained' ? 'strong' : states.adaptive.state === 'established' ? 'moderate' : states.adaptive.state !== 'absent' ? 'weak' : 'absent';
    out.push(new ResistanceMechanismState('compensatory_survival_signaling', lvl, stateVal(regs.survivalSignaling, 'states', lvl, 'apoptosis_susceptibility_reduction', 0)));
  }
  if (sup.has('reduced_effective_intracellular_availability') || sup.has('reduced_uptake_tendency')) {
    const lvl = states.tolerance.state === 'maintained' ? 'moderate_reduction' : states.tolerance.state !== 'absent' ? 'low_reduction' : 'no_reduction';
    out.push(new ResistanceMechanismState('reduced_uptake_tendency', lvl, stateVal(regs.uptake, 'states', lvl, 'availability_reduction', 0)));
  }
  if (sup.has('slow_cycling_or_tolerant_phenotype')) {
    const lvl = states.tolerance.state === 'maintained' ? 'slow_cycling_tolerant' : states.tolerance.state !== 'absent' ? 'stress_adapted' : 'proliferative_sensitive';
    out.push(new ResistanceMechanismState('slow_cycling_or_tolerant_phenotype', lvl, stateVal(regs.cellState, 'states', lvl, 'phenotype_tolerance', 0)));
  }
  return out;
}

// ---- microenvironment protection (read-only 7A/7B) -------------------------

export function evaluateMicroenvProtection(ctx, protReg) {
  // ctx.microProtection is derived READ-ONLY from Phase-7A penetration + Phase-7B delivery (1 - effectiveDeliveryPenetration)
  const p = clamp01(ctx.microProtection ?? 0);
  let level = 'none';
  if (p >= 0.55) level = 'high'; else if (p >= 0.35) level = 'moderate'; else if (p >= 0.15) level = 'low';
  const mods = (protReg && protReg.protection_levels && protReg.protection_levels[level]) || {};
  return new MicroenvironmentProtectionState(level, mods, 'MECHANISTIC_PREDICTION');
}

// ---- immune-associated (UNAVAILABLE without Phase 7C) ----------------------

export function evaluateImmune(immuneContext /* Phase 7C output, or null */) {
  // Phase 7C is not implemented in this build -> immune context is UNAVAILABLE (never a fabricated zero).
  const available = !!(immuneContext && immuneContext.available);
  return new ImmuneAssociatedResistanceState(available);
}

// ---- selection pressure ----------------------------------------------------

export function evaluateSelection(pressure, population, selReg, sm, prevState) {
  const differential = FRACTION_KEYS.some((k) => k !== 'sensitive' && population.fractions[k] > 0) && population.fractions.sensitive < 1;
  const from = (prevState && prevState.state) || 'absent';
  const th = (selReg && selReg.state_thresholds) || {};
  const ordered = ['absent', 'negligible', 'low', 'moderate', 'high', 'very_high'];
  // selection pressure = net treatment pressure only WHERE differential sensitivity exists
  const value = differential ? pressure.netTreatmentPressure : 0;
  const target = ordinalFromThresholds(value, th, ordered);
  const to = sm.ordinalToward('selection_pressure', from, target);
  const v = stateVal(selReg, 'states', to, 'selection_pressure_value', value);
  return new SelectionPressureState(to, v, differential);
}

// ---- population enrichment (conserved redistribution) ----------------------

export function evaluateEnrichment(selection, population, enrichReg, sm, prevEnrichState) {
  const step = (enrichReg && enrichReg.enrichment_step) || 0.08;
  const maxStep = (enrichReg && enrichReg.max_enrichment_per_frame) || 0.15;
  const strength = clamp01(selection.selectionPressureValue);
  const move = Math.min(step * strength, maxStep);
  const f = { ...population.fractions };
  const changes = { sensitive: 0, tolerant: 0, adaptive_resistant: 0, persistent_resistant: 0, unclassified: 0 };
  if (selection.hasDifferentialSensitivity && move > 0) {
    // move sensitive fraction toward tolerant/adaptive (conserved: what leaves sensitive is gained elsewhere)
    const leaving = Math.min(f.sensitive, move);
    f.sensitive -= leaving; changes.sensitive = -leaving;
    const toTolerant = leaving * 0.6, toAdaptive = leaving * 0.4;
    f.tolerant += toTolerant; changes.tolerant = toTolerant;
    f.adaptive_resistant += toAdaptive; changes.adaptive_resistant = toAdaptive;
  }
  const conserved = conserveFractions(f);
  const newPop = new MixedPopulationState(conserved);
  const fromEnr = (prevEnrichState && prevEnrichState.state) || 'none';
  const strengthState = strength < 0.05 ? 'none' : strength < 0.35 ? 'weak' : strength < 0.7 ? 'moderate' : 'strong';
  const enrState = sm.ordinalToward('population_enrichment', fromEnr, strengthState);
  const enrichment = new PopulationEnrichmentState({
    state: enrState, enrichmentStrength: r3(strength),
    changes: { sensitive: r3(changes.sensitive), tolerant: r3(changes.tolerant), adaptive_resistant: r3(changes.adaptive_resistant), persistent_resistant: r3(changes.persistent_resistant), unclassified: r3(changes.unclassified) },
    dominantSubpopulation: newPop.dominant(),
    originClassification: selection.hasDifferentialSensitivity ? 'PRE_EXISTING_SELECTION' : 'UNKNOWN_OR_MIXED',
    confidence: 'LOW', uncertainty: 'Relative composition only; decoupled from absolute tumour burden.',
  });
  return { enrichment, population: newPop };
}

// ---- re-sensitization (explicit transition; requires prior resistance) -----

export function evaluateReSensitization(washout, priorResistant, sm, resenReg, prevState) {
  const from = (prevState && prevState.state) || 'not_applicable';
  if (!priorResistant) return new ReSensitizationState('not_applicable', 0);
  const recovery = washout ? washout.relativeRecovery : 0;
  let proposed = from === 'not_applicable' ? 'not_observed' : from;
  if (recovery >= 0.85) proposed = 'substantial';
  else if (recovery >= 0.5) proposed = 'partial';
  else if (recovery >= 0.25) proposed = 'possible';
  const to = sm.step('re_sensitization', from, proposed);
  const rec = stateVal(resenReg, 'states', to, 'sensitivity_recovery', 0);
  return new ReSensitizationState(to, rec);
}

// ---- burden aggregation ----------------------------------------------------

export function computeBurden(states, intrinsic, burdenReg) {
  const agg = (burdenReg && burdenReg.aggregation) || {};
  const weights = agg.weights || {};
  const discount = agg.correlation_discount || null;
  const intrinsicBurden = intrinsic.initialResponseFactor == null ? 0 : clamp01(1 - intrinsic.initialResponseFactor);
  const components = {
    intrinsic_resistance_burden: intrinsicBurden,
    tolerance_burden: states.tolerance.toleranceSurvivalModifier,
    adaptive_resistance_burden: states.adaptive.adaptiveSensitivityReduction,
    persistent_resistance_burden: states.persistence.persistenceResult === 'PERSISTENT' ? states.acquired.acquiredSensitivityReduction : (states.acquired.state === 'established' ? states.acquired.acquiredSensitivityReduction * 0.5 : 0),
    microenvironment_protection_burden: states.microenvironmentProtection.deliveryProtection,
    immune_escape_burden: states.immune.available ? 0 : 0,   // UNAVAILABLE -> contributes nothing (not fabricated)
  };
  const mapped = {
    intrinsic: components.intrinsic_resistance_burden, tolerance: components.tolerance_burden,
    adaptive: components.adaptive_resistance_burden, persistent: components.persistent_resistance_burden,
    microenvironmentProtection: components.microenvironment_protection_burden, immuneEscape: components.immune_escape_burden,
  };
  const total = aggregateBurden(
    { intrinsic_resistance_burden: mapped.intrinsic, tolerance: mapped.tolerance, adaptive: mapped.adaptive, persistent_resistance_burden: mapped.persistent, microenvironment_protection_burden: mapped.microenvironmentProtection, immune_escape_burden: mapped.immuneEscape },
    weights, discount,
  );
  // dominant mechanism = largest weighted component (deterministic tie-break by fixed order)
  const order = ['persistent_resistance_burden', 'adaptive_resistance_burden', 'intrinsic_resistance_burden', 'tolerance_burden', 'microenvironment_protection_burden', 'immune_escape_burden'];
  const labelMap = { persistent_resistance_burden: 'acquired_persistent', adaptive_resistance_burden: 'adaptive', intrinsic_resistance_burden: 'intrinsic', tolerance_burden: 'drug_tolerance', microenvironment_protection_burden: 'microenvironment_mediated_protection', immune_escape_burden: 'immune_associated_escape_pressure' };
  let dominant = 'unknown_mechanism', bestW = -1;
  for (const k of order) { const wv = (weights[k] ?? 0) * (components[k] ?? 0); if (wv > bestW) { bestW = wv; dominant = wv > 0 ? labelMap[k] : dominant; } }
  return new ResistanceBurden({
    intrinsic: r3(mapped.intrinsic), tolerance: r3(mapped.tolerance), adaptive: r3(mapped.adaptive),
    persistent: r3(mapped.persistent), microenvironmentProtection: r3(mapped.microenvironmentProtection),
    immuneEscape: r3(mapped.immuneEscape), total: r3(total), category: burdenCategory(total),
    dominantMechanism: dominant, dominantSubpopulation: states.population.dominant(),
    confidence: 'LOW', uncertainty: 'Bounded saturating aggregation; correlated tolerance/adaptive discounted.',
  });
}
