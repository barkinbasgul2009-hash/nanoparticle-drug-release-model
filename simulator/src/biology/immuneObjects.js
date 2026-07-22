// Phase-7C immune-microenvironment runtime objects, versions, and numerical utilities.
// (Part 1 - Section 1: FOUNDATIONAL CONTRACTS.) This module defines the immutable, serializable,
// versioned data carriers the immune runtime publishes, plus the deterministic numerical helpers
// used everywhere. It contains NO biological calculation - the innate / adaptive / checkpoint /
// suppression / escape biology is implemented in later sections. Foundational domain states are
// therefore structurally valid but explicitly UNAVAILABLE (never hardcoded zeros): an unavailable
// output means "the model cannot determine this value", which is scientifically different from a
// modelled zero.
//
// Determinism: no RNG, no wall-clock time, no unordered iteration affecting results. Immutability:
// frames are deep-frozen at the publication boundary. Nothing here mutates an upstream engine.

// ---------------------------------------------------------------------------
// Versions (stable strings; NEVER derived from timestamps).
// ---------------------------------------------------------------------------
export const IMMUNE_FRAME_SCHEMA_VERSION = '7C.1.0';
export const IMMUNE_ENGINE_VERSION = '7C-part1-section1';
export const IMMUNE_REGISTRY_BUNDLE_VERSION = '7C.1.0';
export const IMMUNE_STATE_MACHINE_VERSION = '7C.1.0';
export const IMMUNE_RESISTANCE_CONTRACT_VERSION = '7C-8A.1.0';
export const IMMUNE_EVIDENCE_SCHEMA_VERSION = '1.0';
export const IMMUNE_PREDICTION_SCHEMA_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Availability + status enums. Unavailable input must never silently become zero.
// ---------------------------------------------------------------------------
export const AVAILABILITY = Object.freeze({ AVAILABLE: 'AVAILABLE', PARTIALLY_AVAILABLE: 'PARTIALLY_AVAILABLE', UNAVAILABLE: 'UNAVAILABLE', NOT_APPLICABLE: 'NOT_APPLICABLE' });
export const AVAILABILITY_VALUES = Object.freeze(['AVAILABLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NOT_APPLICABLE']);
export function isAvailability(a) { return AVAILABILITY_VALUES.includes(a); }

export const ISSUE_SEVERITY = Object.freeze({ INFO: 'INFO', WARNING: 'WARNING', ERROR: 'ERROR', FATAL: 'FATAL' });
export const ISSUE_CODES = Object.freeze([
  'IMMUNE_INPUT_MISSING', 'IMMUNE_INPUT_PARTIAL', 'IMMUNE_FRAME_VERSION_MISMATCH', 'IMMUNE_INVALID_DELTA_TIME',
  'IMMUNE_VALUE_OUT_OF_RANGE', 'IMMUNE_VALUE_CLAMPED', 'IMMUNE_STATE_TRANSITION_BLOCKED', 'IMMUNE_STATE_INITIALIZED',
  'IMMUNE_UPSTREAM_FRAME_UNAVAILABLE', 'IMMUNE_CONTRIBUTION_EXCLUDED_DOUBLE_COUNT', 'IMMUNE_CHECKPOINT_DATA_UNAVAILABLE',
  'IMMUNE_PRIOR_FRAME_UNAVAILABLE', 'IMMUNE_RESISTANCE_ADAPTER_UNAVAILABLE', 'IMMUNE_SERIALIZATION_VALIDATION_FAILED',
]);

// ---------------------------------------------------------------------------
// Deterministic numerical utilities (Section 15). Clamping emits a traceable
// warning when a value exceeds its expected pre-clamp range (never silent).
// ---------------------------------------------------------------------------
export function isFiniteNumber(x) { return typeof x === 'number' && Number.isFinite(x); }
export function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
export function clamp01(x) { return !isFiniteNumber(x) ? 0 : x < 0 ? 0 : x > 1 ? 1 : x; }
/** Safe divide: returns `fallback` (default 0) when the denominator is ~0 or inputs non-finite. */
export function safeDivide(n, d, fallback = 0) { return (!isFiniteNumber(n) || !isFiniteNumber(d) || Math.abs(d) < 1e-12) ? fallback : n / d; }
/** Deterministic rounding for stable serialization boundaries only (not internal calculation). */
export function deterministicRound(x, dp = 4) { if (!isFiniteNumber(x)) return x; const f = 10 ** dp; return Math.round(x * f) / f; }

/**
 * Clamp a normalized/signed score to [min,max], recording an IMMUNE_VALUE_CLAMPED (or
 * IMMUNE_VALUE_OUT_OF_RANGE for non-finite) issue into `issues` when the raw value was out of range.
 */
export function clampScore(value, { min = 0, max = 1, field = 'score', module = 'immune', issues = null } = {}) {
  if (!isFiniteNumber(value)) {
    if (issues) issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_VALUE_OUT_OF_RANGE', severity: ISSUE_SEVERITY.WARNING, module, message: `${field} non-finite; treated as unavailable`, affectedField: field }));
    return null;
  }
  if (value < min || value > max) {
    if (issues) issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_VALUE_CLAMPED', severity: ISSUE_SEVERITY.WARNING, module, message: `${field} ${value} clamped to [${min},${max}]`, affectedField: field }));
    return clamp(value, min, max);
  }
  return value;
}
export function validateNormalized(v) { return isFiniteNumber(v) && v >= 0 && v <= 1; }
export function validateSigned(v) { return isFiniteNumber(v) && v >= -1 && v <= 1; }

/**
 * Availability-aware weighted aggregation. `contribs` = [{ value, weight, availability }].
 * Only AVAILABLE/PARTIALLY_AVAILABLE contributions with finite values are combined. Result
 * availability is AVAILABLE if all present, PARTIALLY_AVAILABLE if some, UNAVAILABLE if none.
 */
export function availabilityAwareAggregate(contribs, { min = 0, max = 1 } = {}) {
  let wsum = 0, acc = 0, present = 0, total = 0;
  for (const c of contribs || []) {
    total += 1;
    const usable = (c.availability === AVAILABILITY.AVAILABLE || c.availability === AVAILABILITY.PARTIALLY_AVAILABLE) && isFiniteNumber(c.value) && isFiniteNumber(c.weight);
    if (!usable) continue;
    present += 1; wsum += c.weight; acc += c.weight * c.value;
  }
  if (present === 0 || wsum <= 0) return { value: null, availability: total === 0 ? AVAILABILITY.NOT_APPLICABLE : AVAILABILITY.UNAVAILABLE };
  const value = clamp(safeDivide(acc, wsum, 0), min, max);
  return { value, availability: present === total ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE };
}

/** Deep-freeze a plain-data object graph (publication boundary). Assumes no cycles / functions. */
export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const k of Object.keys(obj)) deepFreeze(obj[k]);
  }
  return obj;
}

/** A structurally valid, explicitly-labelled UNAVAILABLE metric (never a hardcoded zero). */
export function unavailableMetric(reason = 'not yet implemented (foundational)', availability = AVAILABILITY.UNAVAILABLE) {
  return { value: null, availability, reason };
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
export class ImmuneRuntimeIssue {
  constructor(def = {}) {
    this.code = def.code || 'IMMUNE_INPUT_MISSING';
    this.severity = def.severity || ISSUE_SEVERITY.WARNING;
    this.category = def.category || 'runtime';
    this.module = def.module || 'immune';
    this.message = def.message || '';
    this.affectedField = def.affectedField || null;
    this.sourceFrame = def.sourceFrame || null;
    this.recoverable = def.recoverable !== false;
    this.metadata = def.metadata || {};
  }
}

/** A single traceable contribution to an aggregated immune metric (contribution ledger entry). */
export class ImmuneContributionRecord {
  constructor(def = {}) {
    this.contributionId = def.contributionId;
    this.targetMetric = def.targetMetric;
    this.sourceModule = def.sourceModule;
    this.sourceMetric = def.sourceMetric;
    this.rawValue = def.rawValue ?? null;
    this.normalizedValue = def.normalizedValue ?? null;
    this.weight = def.weight ?? null;
    this.signedContribution = def.signedContribution ?? null;
    this.availability = def.availability || AVAILABILITY.UNAVAILABLE;
    this.evidenceId = def.evidenceId || null;
    this.predictionId = def.predictionId || null;
    this.registryEntryId = def.registryEntryId || null;
    this.applied = def.applied === true;
    this.exclusionReason = def.exclusionReason || null;
    this.warningCodes = def.warningCodes || [];
    this.metadata = def.metadata || {};
  }
}

/** Ordered, inspectable ledger of every contribution to every aggregated metric. */
export class ImmuneContributionLedger {
  constructor() { this.records = []; this._seq = 0; }
  add(def) { const id = def.contributionId || `imc_${++this._seq}`; const rec = new ImmuneContributionRecord({ ...def, contributionId: id }); this.records.push(rec); return rec; }
  forTarget(metric) { return this.records.filter((r) => r.targetMetric === metric); }
  toArray() { return this.records.map((r) => ({ ...r })); }
}

/** Reference to an upstream frame/snapshot used (traceability + replay; not an embedded copy). */
export class SourceFrameReference {
  constructor(def = {}) {
    this.engineName = def.engineName;
    this.frameId = def.frameId ?? null;
    this.schemaVersion = def.schemaVersion ?? null;
    this.simulationTime = def.simulationTime ?? null;
    this.availability = def.availability || AVAILABILITY.UNAVAILABLE;
    this.contentId = def.contentId ?? null;                 // stable content identifier / checksum
    this.compatibilityStatus = def.compatibilityStatus || 'UNKNOWN';
  }
}

/** Explicit temporal context (no hidden module-level memory; prior state comes from prior frame). */
export class TemporalImmuneContext {
  constructor(def = {}) {
    this.currentTime = isFiniteNumber(def.currentTime) ? def.currentTime : 0;
    this.previousTime = isFiniteNumber(def.previousTime) ? def.previousTime : null;
    this.deltaTime = isFiniteNumber(def.deltaTime) ? def.deltaTime : (this.previousTime == null ? 0 : this.currentTime - this.previousTime);
    this.frameIndex = Number.isInteger(def.frameIndex) ? def.frameIndex : 0;
    this.initializationStatus = def.initializationStatus || (this.previousTime == null ? 'INITIALIZED' : 'CONTINUED');
    this.priorFrameAvailable = def.priorFrameAvailable === true;
    this.discontinuity = def.discontinuity === true;
    this.treatmentStartMarker = def.treatmentStartMarker || null;
    this.treatmentStopMarker = def.treatmentStopMarker || null;
  }
}

/** A single normalized upstream input field with provenance + availability. */
export class ImmuneInputField {
  constructor(def = {}) {
    this.value = def.value ?? null;
    this.availability = def.availability || (def.value == null ? AVAILABILITY.UNAVAILABLE : AVAILABILITY.AVAILABLE);
    this.source = def.source || null;
    this.confidence = def.confidence || null;
    this.frameTime = def.frameTime ?? null;
    this.warnings = def.warnings || [];
  }
}

/** The validated, normalized snapshot the core engine consumes (never raw upstream shapes). */
export class ImmuneInputSnapshot {
  constructor(def = {}) {
    this.simulationContext = def.simulationContext || {};
    this.temporalContext = def.temporalContext || new TemporalImmuneContext();
    this.tumorContext = def.tumorContext || {};
    this.treatmentContext = def.treatmentContext || {};
    this.exposureContext = def.exposureContext || {};
    this.damageContext = def.damageContext || {};
    this.passiveMicroenvironmentContext = def.passiveMicroenvironmentContext || {};
    this.vascularContext = def.vascularContext || {};
    this.priorImmuneContext = def.priorImmuneContext || null;
    this.registryContext = def.registryContext || {};
    this.availabilitySummary = def.availabilitySummary || {};
    this.warnings = def.warnings || [];
  }
}

// ---------------------------------------------------------------------------
// Domain state carriers (FOUNDATIONAL: structurally valid, explicitly UNAVAILABLE).
// Each carries an `availability` and named metric slots that later sections populate.
// ---------------------------------------------------------------------------
function metricSlots(names) { const o = {}; for (const n of names) o[n] = unavailableMetric(); return o; }

export class TumorVisibilityState {
  constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.antigenAvailability = unavailableMetric(); this.detectability = unavailableMetric(); this.presentationPotential = unavailableMetric(); this.effectiveRecognition = unavailableMetric(); this.summary = unavailableMetric(); }
}
export class MacrophageState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.polarizationTendency = 'INDETERMINATE'; this.tumorOpposingTendency = unavailableMetric(); this.tumorSupportingTendency = unavailableMetric(); } }
export class NKState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['available', 'presence', 'activation', 'functionalCompetence', 'suppression', 'cytotoxicPotential'])); } }
export class DendriticCellState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['available', 'antigenUptakePotential', 'maturation', 'presentationPotential', 'suppression'])); } }
export class InnateImmunityState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.macrophage = new MacrophageState(); this.nk = new NKState(); this.dendritic = new DendriticCellState(); } }
export class AntigenPresentationState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['presentationCapacity', 'maturationSupport', 'effectivePresentation', 'suppression'])); } }
export class CD8State { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['available', 'infiltration', 'priming', 'activation', 'effectorCompetence', 'suppression', 'exhaustion', 'recoveryPotential', 'cytotoxicContribution'])); } }
export class CD4State { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['available', 'activation', 'adaptiveSupport', 'suppression', 'functionalContribution'])); } }
export class TregState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['available', 'enrichment', 'activation', 'suppressivePressure', 'escapeContribution'])); } }
export class AdaptiveImmunityState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.cd8 = new CD8State(); this.cd4 = new CD4State(); this.treg = new TregState(); } }
export class CheckpointComponentState { constructor(name) { this.name = name; this.availability = AVAILABILITY.UNAVAILABLE; Object.assign(this, metricSlots(['componentAvailability', 'expressionPressure', 'interactionPotential', 'functionalSuppression'])); this.uncertainty = ''; } }
export class CheckpointState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.pd1 = new CheckpointComponentState('PD1'); this.pdl1 = new CheckpointComponentState('PDL1'); this.ctla4 = new CheckpointComponentState('CTLA4'); this.pd1PdL1AxisPressure = unavailableMetric(); this.ctla4Pressure = unavailableMetric(); } }
export class ImmuneSuppressionState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.components = []; this.totalSuppressionPressure = unavailableMetric(); this.confidence = 'LOW'; } }
export class ImmuneEscapeState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.components = []; this.escapePressure = unavailableMetric(); this.persistentEscape = unavailableMetric(); this.confidence = 'LOW'; } }
export class ImmuneEffectState { constructor() { this.availability = AVAILABILITY.UNAVAILABLE; this.potential = unavailableMetric(); this.effectiveModifier = unavailableMetric(); this.blockedPotential = unavailableMetric(); this.uncertainty = ''; } }
/** The read-only handoff object Phase 8A consumes (foundational: UNAVAILABLE until biology exists). */
export class ResistanceReadinessState {
  constructor() {
    this.availability = AVAILABILITY.UNAVAILABLE;
    this.contractVersion = IMMUNE_RESISTANCE_CONTRACT_VERSION;
    this.immuneSuppression = unavailableMetric();
    this.immuneEscape = unavailableMetric();
    this.persistentImmuneEscape = unavailableMetric();
    this.checkpointPressure = unavailableMetric();
    this.tumorVisibility = unavailableMetric();
    this.exhaustedAdaptiveResponse = unavailableMetric();
    this.immuneMediatedTumorLossModifier = unavailableMetric();
  }
}

// ---------------------------------------------------------------------------
// Immutable ImmuneFrame (published output). Plain data only - no functions, no
// cycles, no live registries, no mutable Maps/Sets at the boundary.
// ---------------------------------------------------------------------------
export class ImmuneFrame {
  constructor(def = {}) {
    this.schemaVersion = IMMUNE_FRAME_SCHEMA_VERSION;
    this.engineVersion = IMMUNE_ENGINE_VERSION;
    this.registryBundleVersion = def.registryBundleVersion || IMMUNE_REGISTRY_BUNDLE_VERSION;
    this.stateMachineVersion = def.stateMachineVersion || IMMUNE_STATE_MACHINE_VERSION;
    this.resistanceContractVersion = IMMUNE_RESISTANCE_CONTRACT_VERSION;
    this.frameId = def.frameId;
    this.simulationId = def.simulationId ?? null;
    this.simulationTime = isFiniteNumber(def.simulationTime) ? def.simulationTime : 0;
    this.frameIndex = Number.isInteger(def.frameIndex) ? def.frameIndex : 0;
    this.species = def.species ?? null;
    this.tumourModel = def.tumourModel ?? null;
    this.formulation = def.formulation ?? null;
    this.availability = def.availability || AVAILABILITY.UNAVAILABLE;
    this.status = def.status || 'FOUNDATIONAL';
    this.sourceFrameReferences = def.sourceFrameReferences || [];
    this.inputSummary = def.inputSummary || {};
    this.tumorVisibility = def.tumorVisibility || new TumorVisibilityState();
    this.innateImmunity = def.innateImmunity || new InnateImmunityState();
    this.antigenPresentation = def.antigenPresentation || new AntigenPresentationState();
    this.adaptiveImmunity = def.adaptiveImmunity || new AdaptiveImmunityState();
    this.checkpointState = def.checkpointState || new CheckpointState();
    this.immuneSuppression = def.immuneSuppression || new ImmuneSuppressionState();
    this.immuneEscape = def.immuneEscape || new ImmuneEscapeState();
    this.immuneEffect = def.immuneEffect || new ImmuneEffectState();
    this.resistanceReadiness = def.resistanceReadiness || new ResistanceReadinessState();
    this.contributionLedger = def.contributionLedger || [];
    this.evidenceRecords = def.evidenceRecords || [];
    this.predictionRecords = def.predictionRecords || [];
    this.transitionRecords = def.transitionRecords || [];
    this.warnings = def.warnings || [];
    this.errors = def.errors || [];
    this.metadata = def.metadata || {};
  }
}

export default ImmuneFrame;
