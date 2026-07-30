// Phase-8A adaptive & acquired drug-resistance runtime objects. Deterministic data carriers the
// ResistanceEngine drives. Resistance is a TIME-DEPENDENT biological process, never a binary flag
// and never an unexplained drop in efficacy. Every field is a schematic ordinal state or a
// normalized 0-1 value - never a real IC50, fold-resistance, mutation, resistant-cell count, or
// time-to-resistance. These objects hold STATE only; the engine/modules own the logic and the
// state machines own the legal transitions. Nothing here mutates an upstream (frozen) engine.
//
// The frozen package has NO direct resistance dataset for this context, so every active resistance
// value is a LABELLED prediction (MECHANISTIC_PREDICTION) or NOT_REPORTED. No experimental tier.

// ---- numeric helpers (deterministic) --------------------------------------
export function clamp01(x) { return typeof x !== 'number' || Number.isNaN(x) ? 0 : x < 0 ? 0 : x > 1 ? 1 : x; }
export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
export function r3(x) { return Math.round(x * 1000) / 1000; }

// ---- baseline / intrinsic -------------------------------------------------

/** Resolved baseline resistance profile snapshot (fixed per context; not changed by exposure). */
export class BaselineResistanceState {
  constructor(def = {}) {
    this.intrinsicSensitivity = def.baseline_sensitivity || 'unknown';
    this.baselineResistantFraction = def.baseline_resistant_fraction ?? null;
    this.baselineTolerantFraction = def.baseline_tolerant_fraction ?? null;
    this.pathwayDependence = def.baseline_pathway_dependence || 'unknown';
    this.apoptosisCompetence = def.baseline_apoptosis_competence || 'unknown';
    this.uptakeCompetence = def.baseline_uptake_competence || 'unknown';
    this.stressTolerance = def.baseline_stress_tolerance || 'unknown';
    this.microenvironmentProtection = def.baseline_microenvironment_protection || 'unknown';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
  }
}

/** Intrinsic (pre-existing) sensitivity - an ordinal state with a schematic initial-response factor. */
export class IntrinsicSensitivityState {
  constructor(state = 'unknown', initialResponseFactor = null, evidenceLevel = 'NOT_REPORTED') {
    this.state = state; this.initialResponseFactor = initialResponseFactor; this.evidenceLevel = evidenceLevel;
  }
}

// ---- exposure -------------------------------------------------------------

/** A single treatment-exposure abstraction (effective, not applied dose). */
export class TreatmentExposure {
  constructor(def = {}) {
    this.exposureStatus = def.exposureStatus || 'untreated';
    this.exposureStage = def.exposureStage || 'none';
    this.relativeExposureIntensity = def.relativeExposureIntensity ?? 0;   // 0-1 (effective)
    this.effectiveIntracellularExposure = def.effectiveIntracellularExposure ?? 0; // 0-1
    this.exposureConfidence = def.exposureConfidence || 'LOW';
    this.evidenceLevel = def.evidenceLevel || 'MECHANISTIC_PREDICTION';
  }
}

/** Deterministic, serializable treatment history (simulation-stage based; no wall-clock time). */
export class ExposureHistory {
  constructor() {
    this.firstExposureStage = null;
    this.currentEpisode = 0;
    this.cumulativeExposure = 0;          // bounded normalized accumulator [0,1]
    this.repeatedEpisodes = 0;
    this.interrupted = false;
    this.washoutStage = 'no_washout';
    this.rechallengeState = 'not_rechallenged';
    this.previousMaximalPressure = 0;     // 0-1
    this.priorTolerantState = 'absent';
    this.priorAdaptiveState = 'absent';
    this.priorPersistentResistance = 'not_evaluated';
    this.priorReSensitization = 'not_applicable';
    this.priorEnrichmentDominant = 'sensitive';
    this.stageIndex = 0;                   // ordered validated-stage counter
  }
}

// ---- pressure / survivor --------------------------------------------------

/** Treatment pressure (selective + adaptive) as component + net normalized values + ordinal state. */
export class TreatmentPressureState {
  constructor(def = {}) {
    this.exposurePressure = def.exposurePressure ?? 0;
    this.cytotoxicPressure = def.cytotoxicPressure ?? 0;
    this.stressPressure = def.stressPressure ?? 0;
    this.apoptosisPressure = def.apoptosisPressure ?? 0;
    this.pathwayPressure = def.pathwayPressure ?? 0;
    this.durationPressure = def.durationPressure ?? 0;
    this.cumulativePressure = def.cumulativePressure ?? 0;
    this.netTreatmentPressure = def.netTreatmentPressure ?? 0;  // 0-1
    this.state = def.state || 'absent';                          // ordinal
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
  }
}

/** Survivor-state classification (never inferred from survival alone). */
export class SurvivorState {
  constructor(category = 'no_meaningful_selection', apparentResistanceCause = 'insufficient_evidence', evidenceLevel = 'MECHANISTIC_PREDICTION') {
    this.category = category;
    this.apparentResistanceCause = apparentResistanceCause; // delivery/uptake/target/apoptosis/microenv/adaptive/acquired/insufficient
    this.evidenceLevel = evidenceLevel;
  }
}

// ---- reversible / persistent resistance states ----------------------------

/** Reversible drug-tolerance state (never automatically stable resistance). */
export class DrugToleranceState {
  constructor(state = 'absent', modifier = 0, reversibility = 'not_applicable') {
    this.state = state; this.toleranceSurvivalModifier = clamp01(modifier); this.reversibility = reversibility;
    this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}

/** Adaptive (treatment-induced, reversible) resistance state with a documented mechanism. */
export class AdaptiveResistanceState {
  constructor(state = 'absent', modifier = 0, mechanismCategory = null, reversibility = 'not_applicable') {
    this.state = state; this.adaptiveSensitivityReduction = clamp01(modifier);
    this.mechanismCategory = mechanismCategory; this.reversibility = reversibility;
    this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}

/** Acquired (persistent) resistance state - requires temporal evidence / labelled prediction. */
export class AcquiredResistanceState {
  constructor(state = 'absent', modifier = 0) {
    this.state = state; this.acquiredSensitivityReduction = clamp01(modifier);
    this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}

/** Persistence evaluation state (gates whether acquired resistance survives washout). */
export class PersistentResistanceState {
  constructor(state = 'not_evaluated', persistenceResult = 'NOT_REPORTED') {
    this.state = state; this.persistenceResult = persistenceResult; this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}

// ---- mechanism abstractions (bounded modifiers; upstream never mutated) ----

/** Generic resistance-mechanism sub-state (category + ordinal state + bounded modifier). */
export class ResistanceMechanismState {
  constructor(category, state, modifier, evidenceLevel = 'MECHANISTIC_PREDICTION') {
    this.category = category; this.state = state;
    this.modifier = modifier == null ? null : clamp01(modifier);
    this.evidenceLevel = evidenceLevel;
  }
}
// Named mechanism carriers (all extend the generic shape for typing clarity).
export class UptakeResistanceState extends ResistanceMechanismState { constructor(s, m, e) { super('reduced_uptake_tendency', s, m, e); } }
export class EffluxResistanceState extends ResistanceMechanismState { constructor(s, m, e) { super('increased_efflux_tendency', s, m, e); } }
export class TargetAvailabilityState extends ResistanceMechanismState { constructor(s, m, e) { super('reduced_target_availability', s, m, e); } }
export class SurvivalSignalingResistanceState extends ResistanceMechanismState { constructor(s, m, e) { super('compensatory_survival_signaling', s, m, e); } }
export class StressAdaptationState extends ResistanceMechanismState { constructor(s, m, e) { super('stress_response_adaptation', s, m, e); } }
export class ApoptosisEvasionState extends ResistanceMechanismState { constructor(s, m, e) { super('apoptosis_evasion', s, m, e); } }
export class CellStateResistance extends ResistanceMechanismState { constructor(s, m, e) { super('cell_state_adaptation', s, m, e); } }
export class MicroenvironmentProtectionState extends ResistanceMechanismState {
  constructor(level = 'none', mods = {}, e = 'MECHANISTIC_PREDICTION') {
    super('microenvironment_mediated_protection', level, mods.delivery_protection_modifier ?? 0, e);
    this.deliveryProtection = clamp01(mods.delivery_protection_modifier ?? 0);
    this.stressProtection = clamp01(mods.stress_protection_modifier ?? 0);
    this.apoptosisProtection = clamp01(mods.apoptosis_protection_modifier ?? 0);
    this.survivorEnrichment = clamp01(mods.survivor_enrichment_modifier ?? 0);
  }
}
/** Immune-associated resistance - UNAVAILABLE while Phase 7C is absent (never a fabricated zero). */
export class ImmuneAssociatedResistanceState extends ResistanceMechanismState {
  constructor(available = false) {
    super('immune_associated_escape_pressure', available ? 'none' : 'unavailable', available ? 0 : null, available ? 'MECHANISTIC_PREDICTION' : 'UNAVAILABLE');
    this.available = !!available;
    this.immuneEscapeProtection = null;      // only usable once Phase 7C exists
    this.treatmentDurabilityReduction = null;
  }
}

// ---- subpopulations + normalized composition ------------------------------

/** One tumour-response subpopulation (relative fraction + its states + response modifier). */
export class TumorSubpopulation {
  constructor(type, fraction, def = {}) {
    this.type = type; this.fraction = clamp01(fraction);
    this.sensitivityState = def.sensitivity_state || def.default_sensitivity_state || 'unknown';
    this.resistanceState = def.resistance_state || def.default_resistance_state || 'unknown';
    this.responseModifier = def.response_modifier ?? null;   // 0-1 (null = unclassified)
    this.evidenceLevel = def.evidence_level || 'MECHANISTIC_PREDICTION';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
  }
}
export class SensitiveSubpopulation extends TumorSubpopulation { constructor(f, d) { super('sensitive', f, d); } }
export class TolerantSubpopulation extends TumorSubpopulation { constructor(f, d) { super('tolerant', f, d); } }
export class AdaptiveResistantSubpopulation extends TumorSubpopulation { constructor(f, d) { super('adaptive_resistant', f, d); } }
export class PersistentResistantSubpopulation extends TumorSubpopulation { constructor(f, d) { super('persistent_resistant', f, d); } }
export class UnclassifiedSubpopulation extends TumorSubpopulation { constructor(f, d) { super('unclassified', f, d); } }

export const FRACTION_KEYS = Object.freeze(['sensitive', 'tolerant', 'adaptive_resistant', 'persistent_resistant', 'unclassified']);

/** Normalized population composition across the five subpopulations (invariant-checked). */
export class MixedPopulationState {
  constructor(fractions = {}) {
    this.fractions = {};
    for (const k of FRACTION_KEYS) this.fractions[k] = clamp01(fractions[k] ?? 0);
  }
  sum() { return FRACTION_KEYS.reduce((a, k) => a + this.fractions[k], 0); }
  isNormalized(tol = 0.0001) { return Math.abs(this.sum() - 1) <= tol && FRACTION_KEYS.every((k) => this.fractions[k] >= 0 && this.fractions[k] <= 1); }
  dominant() { let best = FRACTION_KEYS[0]; for (const k of FRACTION_KEYS) if (this.fractions[k] > this.fractions[best]) best = k; return best; }
  copy() { return new MixedPopulationState({ ...this.fractions }); }
}

// ---- selection / enrichment / reversal ------------------------------------

export class SelectionPressureState {
  constructor(state = 'absent', value = 0, hasDifferentialSensitivity = false) {
    this.state = state; this.selectionPressureValue = clamp01(value);
    this.hasDifferentialSensitivity = !!hasDifferentialSensitivity; this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}
export class PopulationEnrichmentState {
  constructor(def = {}) {
    this.state = def.state || 'none';
    this.enrichmentStrength = clamp01(def.enrichmentStrength ?? 0);
    this.changes = def.changes || { sensitive: 0, tolerant: 0, adaptive_resistant: 0, persistent_resistant: 0, unclassified: 0 };
    this.dominantSubpopulation = def.dominantSubpopulation || 'sensitive';
    this.originClassification = def.originClassification || 'UNKNOWN_OR_MIXED';
    this.confidence = def.confidence || 'LOW'; this.uncertainty = def.uncertainty || '';
    this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}
export class ReSensitizationState {
  constructor(state = 'not_applicable', recovery = 0) {
    this.state = state; this.sensitivityRecovery = recovery == null ? null : clamp01(recovery); this.evidenceLevel = 'MECHANISTIC_PREDICTION';
  }
}
export class WashoutState { constructor(stage = 'no_washout', relativeRecovery = 0) { this.stage = stage; this.relativeRecovery = clamp01(relativeRecovery); } }
export class RechallengeState { constructor(state = 'not_rechallenged', retention = null) { this.state = state; this.responseRetention = retention == null ? null : clamp01(retention); } }

// ---- burden / modifier / events -------------------------------------------

/** Bounded resistance-burden aggregate (saturating combination; never a naive unbounded sum). */
export class ResistanceBurden {
  constructor(def = {}) {
    this.intrinsic = clamp01(def.intrinsic ?? 0);
    this.tolerance = clamp01(def.tolerance ?? 0);
    this.adaptive = clamp01(def.adaptive ?? 0);
    this.persistent = clamp01(def.persistent ?? 0);
    this.microenvironmentProtection = clamp01(def.microenvironmentProtection ?? 0);
    this.immuneEscape = clamp01(def.immuneEscape ?? 0);
    this.total = clamp01(def.total ?? 0);
    this.category = def.category || 'none';
    this.dominantMechanism = def.dominantMechanism || 'unknown_mechanism';
    this.dominantSubpopulation = def.dominantSubpopulation || 'sensitive';
    this.confidence = def.confidence || 'LOW'; this.uncertainty = def.uncertainty || '';
  }
}

/** Advisory resistance-response modifier (bounded; consumed additively next frame). */
export class ResistanceResponseModifier {
  constructor(def = {}) {
    this.exposureEffectiveness = clamp01(def.exposureEffectiveness ?? 1);
    this.uptakeEffectiveness = clamp01(def.uptakeEffectiveness ?? 1);
    this.targetEffectiveness = clamp01(def.targetEffectiveness ?? 1);
    this.stressResponse = clamp01(def.stressResponse ?? 1);
    this.apoptosisSensitivity = clamp01(def.apoptosisSensitivity ?? 1);
    this.populationLoss = clamp01(def.populationLoss ?? 1);
    this.recoveryPressure = clamp01(def.recoveryPressure ?? 0);
    this.regrowthPressure = clamp01(def.regrowthPressure ?? 0);
    this.durability = clamp01(def.durability ?? 1);
    this.netTreatmentSensitivity = clamp01(def.netTreatmentSensitivity ?? 1);
    this.evidenceLevel = def.evidenceLevel || 'MECHANISTIC_PREDICTION';
    this.predictionLevel = def.predictionLevel || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'LOW'; this.uncertainty = def.uncertainty || ''; this.limitations = def.limitations || '';
  }
}

/** An enumerated resistance transition (recorded whenever population identity/state changes). */
export class ResistanceTransition {
  constructor(machine, from, to, originClassification = 'UNKNOWN_OR_MIXED') {
    this.machine = machine; this.from = from; this.to = to; this.originClassification = originClassification;
  }
}

/** A deterministic, serializable resistance event (one per significant transition). */
export class ResistanceEvent {
  constructor(def = {}) {
    this.eventId = def.eventId;
    this.simulationFrame = def.simulationFrame ?? 0;
    this.simulationStage = def.simulationStage || 'none';
    this.eventType = def.eventType || 'state_change';
    this.previousState = def.previousState ?? null;
    this.nextState = def.nextState ?? null;
    this.affectedSubpopulation = def.affectedSubpopulation ?? null;
    this.mechanismCategory = def.mechanismCategory ?? null;
    this.causalInputs = def.causalInputs || [];
    this.treatmentPressure = def.treatmentPressure ?? 0;
    this.originClassification = def.originClassification || 'UNKNOWN_OR_MIXED';
    this.evidenceLevel = def.evidenceLevel || 'MECHANISTIC_PREDICTION';
    this.predictionLevel = def.predictionLevel || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
    this.limitations = def.limitations || '';
    this.sourceIds = def.sourceIds || [];
  }
}

// ---- top-level runtime state ----------------------------------------------

/** Aggregate resistance runtime state (all sub-states) the engine assembles into a frame. */
export class ResistanceState {
  constructor(id, def = {}) {
    this.id = id;
    this.species = def.species; this.tumourModel = def.tumour_model; this.formulation = def.formulation || null;
    this.baseline = new BaselineResistanceState(def);
    this.intrinsic = new IntrinsicSensitivityState(def.baseline_sensitivity || 'unknown');
    this.exposure = new TreatmentExposure();
    this.history = new ExposureHistory();
    this.pressure = new TreatmentPressureState();
    this.survivor = new SurvivorState();
    this.tolerance = new DrugToleranceState();
    this.adaptive = new AdaptiveResistanceState();
    this.acquired = new AcquiredResistanceState();
    this.persistence = new PersistentResistanceState();
    this.mechanisms = [];                    // ResistanceMechanismState[]
    this.microenvironmentProtection = new MicroenvironmentProtectionState();
    this.immune = new ImmuneAssociatedResistanceState(false);
    this.population = new MixedPopulationState();
    this.selection = new SelectionPressureState();
    this.enrichment = new PopulationEnrichmentState();
    this.reSensitization = new ReSensitizationState();
    this.washout = new WashoutState();
    this.rechallenge = new RechallengeState();
    this.burden = new ResistanceBurden();
    this.modifier = new ResistanceResponseModifier();
    this.events = [];                        // ResistanceEvent[]
    this.transitions = [];                   // ResistanceTransition[]
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
    this.updatedAt = 0;
  }
}

// ---- fraction + burden helpers --------------------------------------------

/**
 * Conserve a fraction map after an internally-computed, sum-conserving operation. Clamps tiny
 * negative drift to 0 and rescales to sum 1 ONLY when total deviation is within tolerance;
 * a larger deviation throws (no silent renormalization of biologically invalid composition).
 */
export function conserveFractions(fractions, tol = 0.01) {
  const f = {}; let sum = 0;
  for (const k of FRACTION_KEYS) { const v = fractions[k] ?? 0; f[k] = v < 0 && v > -tol ? 0 : v; sum += f[k]; }
  if (FRACTION_KEYS.some((k) => f[k] < 0)) throw new Error('negative subpopulation fraction');
  if (Math.abs(sum - 1) > tol) throw new Error(`non-normalized population fractions (sum=${r3(sum)})`);
  if (sum > 0) for (const k of FRACTION_KEYS) f[k] = f[k] / sum;   // rescale small float drift
  return f;
}

/** Saturating, bounded burden aggregation: total = 1 - PROD(1 - w_i*b_i). Never a naive sum. */
export function aggregateBurden(components, weights, correlationDiscount = null) {
  const c = { ...components };
  if (correlationDiscount && correlationDiscount.tolerance_adaptive_overlap != null) {
    // discount the smaller of tolerance/adaptive to avoid double counting a shared survival phenotype
    const d = correlationDiscount.tolerance_adaptive_overlap;
    if (c.tolerance != null && c.adaptive != null) {
      if (c.tolerance <= c.adaptive) c.tolerance = c.tolerance * (1 - d); else c.adaptive = c.adaptive * (1 - d);
    }
  }
  let prod = 1;
  for (const [k, w] of Object.entries(weights)) prod *= (1 - clamp01((w ?? 0) * clamp01(c[k] ?? 0)));
  return clamp01(1 - prod);
}

/** Map a normalized burden to its ordinal category. */
export function burdenCategory(total) {
  if (total < 0.05) return 'none';
  if (total < 0.25) return 'low';
  if (total < 0.5) return 'moderate';
  if (total < 0.75) return 'high';
  return 'very_high';
}

export default ResistanceState;
