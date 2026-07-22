// Phase-7C shared evidence + prediction frameworks (Part 1 - Section 2). Evidence explains WHY
// something is believed; prediction explains WHAT the model expects - they are separate schemas.
// Both are structured (not free text), attach to transitions / aggregates / registry entries /
// predictions / warnings / frame outputs, and survive aggregation (never dropped). Predictions have a
// lifecycle (AVAILABLE -> SUPERSEDED / EXPIRED). Deterministic; frame-indexed (no wall-clock).

export const EVIDENCE_CATEGORIES = Object.freeze([
  'Experimental', 'Clinical', 'Mechanistic', 'Computational', 'LiteratureDerived',
  'RepositoryAssumption', 'ModelAssumption', 'Calibration', 'ExpertRule',
]);
export const PREDICTION_CATEGORIES = Object.freeze([
  'ExpectedIncrease', 'ExpectedDecrease', 'ExpectedStability', 'PotentialSuppression', 'PotentialActivation',
  'PotentialEscape', 'PotentialExhaustion', 'PotentialRecovery', 'PotentialRecruitment', 'PotentialInfiltration',
  'PotentialFunctionalLoss', 'PotentialFunctionalGain',
]);
export const PREDICTION_STATUS = Object.freeze({ AVAILABLE: 'AVAILABLE', SUPERSEDED: 'SUPERSEDED', EXPIRED: 'EXPIRED', UNAVAILABLE: 'UNAVAILABLE' });

let _ev = 0; let _pr = 0;

/** Structured evidence record - why a calculation is believed. */
export class ImmuneEvidenceRecord {
  constructor(def = {}) {
    this.evidenceId = def.evidenceId || `imev_${++_ev}`;
    this.title = def.title || '';
    this.description = def.description || '';
    this.interpretation = def.interpretation || '';
    this.category = EVIDENCE_CATEGORIES.includes(def.category) ? def.category : 'ModelAssumption';
    this.sourceReference = def.sourceReference || 'NOT_REPORTED';
    this.strength = def.strength || 'LOW';
    this.version = def.version || '7C.1.0';
    this.applicability = def.applicability || '';
    this.confidenceModifier = typeof def.confidenceModifier === 'number' ? def.confidenceModifier : 0;
    this.metadata = def.metadata || {};
  }
  toSerializable() { return { ...this, metadata: { ...this.metadata } }; }
}

/** Structured prediction record - what the model expects (separate from evidence). */
export class ImmunePredictionRecord {
  constructor(def = {}) {
    this.predictionId = def.predictionId || `impr_${++_pr}`;
    this.description = def.description || '';
    this.targetMetric = def.targetMetric || null;
    this.category = PREDICTION_CATEGORIES.includes(def.category) ? def.category : 'ExpectedStability';
    this.confidence = def.confidence ?? null;
    this.supportingEvidenceIds = def.supportingEvidenceIds || [];
    this.affectedObjects = def.affectedObjects || [];
    this.dependencies = def.dependencies || [];
    this.availability = def.availability || 'UNAVAILABLE';
    this.version = def.version || '7C.1.0';
    this.status = def.status || PREDICTION_STATUS.AVAILABLE;
    this.createdFrame = Number.isInteger(def.createdFrame) ? def.createdFrame : 0;
    this.metadata = def.metadata || {};
  }
  toSerializable() { return { ...this, supportingEvidenceIds: this.supportingEvidenceIds.slice(), affectedObjects: this.affectedObjects.slice(), dependencies: this.dependencies.slice(), metadata: { ...this.metadata } }; }
}

/** Convenience builders + prediction lifecycle transitions (return new records; inputs untouched). */
export function makeEvidence(def) { return new ImmuneEvidenceRecord(def); }
export function makePrediction(def) { return new ImmunePredictionRecord(def); }
export function supersede(prediction, byId) { return new ImmunePredictionRecord({ ...prediction, status: PREDICTION_STATUS.SUPERSEDED, metadata: { ...prediction.metadata, supersededBy: byId || null } }); }
export function expire(prediction) { return new ImmunePredictionRecord({ ...prediction, status: PREDICTION_STATUS.EXPIRED }); }
export function isEvidenceCategory(c) { return EVIDENCE_CATEGORIES.includes(c); }
export function isPredictionCategory(c) { return PREDICTION_CATEGORIES.includes(c); }

export default ImmuneEvidenceRecord;
