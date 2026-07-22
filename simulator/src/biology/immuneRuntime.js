// Phase-7C shared runtime object model (Part 1 - Section 2). Every immune biological object (later
// sections: macrophages, DC, NK, CD8, CD4, Treg, checkpoint components, suppression, escape) derives
// from BaseImmuneRuntimeObject so they all speak one language: identical identity, lifecycle,
// availability, confidence, validation, evidence/prediction/contribution references, warnings, and
// immutable publication. No biological object invents its own lifecycle. Reuses Section-1 primitives
// (availability enum, deepFreeze). Deterministic; no wall-clock time (frames are simulation-indexed).

import { AVAILABILITY, isAvailability, deepFreeze, IMMUNE_FRAME_SCHEMA_VERSION } from './immuneObjects.js';

/** Shared lifecycle status for every runtime object. */
export const LIFECYCLE_STATUS = Object.freeze({
  CREATED: 'CREATED', INITIALIZED: 'INITIALIZED', READY: 'READY', RUNNING: 'RUNNING',
  PARTIALLY_AVAILABLE: 'PARTIALLY_AVAILABLE', UNAVAILABLE: 'UNAVAILABLE',
  PUBLISHED: 'PUBLISHED', FROZEN: 'FROZEN', ARCHIVED: 'ARCHIVED',
});
export const LIFECYCLE_VALUES = Object.freeze(Object.values(LIFECYCLE_STATUS));

/**
 * Base runtime object. Lifecycle: CREATED -> INITIALIZED -> READY -> RUNNING -> (availability) ->
 * PUBLISHED -> FROZEN -> ARCHIVED. Once published the object is deep-frozen and cannot be mutated.
 */
export class BaseImmuneRuntimeObject {
  /** @param {{ id:string, runtimeType:string, owner:string, creationFrame?:number, metadata?:object }} def */
  constructor(def = {}) {
    if (!def.id) throw new Error('BaseImmuneRuntimeObject requires an id');
    if (!def.runtimeType) throw new Error('BaseImmuneRuntimeObject requires a runtimeType');
    if (!def.owner) throw new Error('BaseImmuneRuntimeObject requires exactly one owner');
    this.id = def.id;
    this.runtimeType = def.runtimeType;
    this.owner = def.owner;                    // exactly one owning engine (never shared)
    this.schemaVersion = def.schemaVersion || IMMUNE_FRAME_SCHEMA_VERSION;
    this.creationFrame = Number.isInteger(def.creationFrame) ? def.creationFrame : 0;
    this.status = LIFECYCLE_STATUS.CREATED;
    this.availability = AVAILABILITY.UNAVAILABLE;
    this.confidence = { score: null, category: null };
    this.validationStatus = 'UNVALIDATED';
    this.evidenceRefs = [];
    this.predictionRefs = [];
    this.contributionRefs = [];
    this.transitionRefs = [];
    this.warnings = [];
    this.metadata = def.metadata || {};
    this._published = null;                    // frozen published snapshot
  }

  _assertMutable() { if (this.status === LIFECYCLE_STATUS.FROZEN || this.status === LIFECYCLE_STATUS.ARCHIVED || Object.isFrozen(this)) throw new Error(`runtime object ${this.id} is ${this.status}; cannot mutate published state`); }

  initialize() { this._assertMutable(); this.status = LIFECYCLE_STATUS.INITIALIZED; return this; }
  markReady() { this._assertMutable(); this.status = LIFECYCLE_STATUS.READY; return this; }
  markRunning() { this._assertMutable(); this.status = LIFECYCLE_STATUS.RUNNING; return this; }

  setAvailability(a) { this._assertMutable(); if (!isAvailability(a)) throw new Error(`invalid availability ${a}`); this.availability = a; if (a === AVAILABILITY.UNAVAILABLE) this.status = LIFECYCLE_STATUS.UNAVAILABLE; else if (a === AVAILABILITY.PARTIALLY_AVAILABLE) this.status = LIFECYCLE_STATUS.PARTIALLY_AVAILABLE; return this; }
  setConfidence(score, category) { this._assertMutable(); this.confidence = { score: score ?? null, category: category ?? null }; return this; }
  setValidationStatus(s) { this._assertMutable(); this.validationStatus = s; return this; }

  addEvidenceRef(id) { this._assertMutable(); if (id != null && !this.evidenceRefs.includes(id)) this.evidenceRefs.push(id); return this; }
  addPredictionRef(id) { this._assertMutable(); if (id != null && !this.predictionRefs.includes(id)) this.predictionRefs.push(id); return this; }
  addContributionRef(id) { this._assertMutable(); if (id != null && !this.contributionRefs.includes(id)) this.contributionRefs.push(id); return this; }
  recordTransition(id) { this._assertMutable(); if (id != null) this.transitionRefs.push(id); return this; }
  addWarning(w) { this._assertMutable(); if (w != null) this.warnings.push(w); return this; }

  /** Plain-data snapshot suitable for embedding in a frame (no methods). */
  toSerializable() {
    return {
      id: this.id, runtimeType: this.runtimeType, owner: this.owner, schemaVersion: this.schemaVersion,
      creationFrame: this.creationFrame, status: this.status, availability: this.availability,
      confidence: { ...this.confidence }, validationStatus: this.validationStatus,
      evidenceRefs: this.evidenceRefs.slice(), predictionRefs: this.predictionRefs.slice(),
      contributionRefs: this.contributionRefs.slice(), transitionRefs: this.transitionRefs.slice(),
      warnings: this.warnings.slice(), metadata: { ...this.metadata },
    };
  }

  /** Publish + freeze. Returns a deep-frozen plain snapshot; the object becomes immutable. */
  publish() {
    this._assertMutable();
    this.status = LIFECYCLE_STATUS.PUBLISHED;
    const snap = deepFreeze(this.toSerializable());
    this._published = snap;
    this.status = LIFECYCLE_STATUS.FROZEN;
    Object.freeze(this.evidenceRefs); Object.freeze(this.predictionRefs); Object.freeze(this.contributionRefs);
    Object.freeze(this.transitionRefs); Object.freeze(this.warnings); Object.freeze(this);
    return snap;
  }
  getPublished() { return this._published; }

  /** Archive marker: returns a derived frozen archived snapshot (the object is already immutable). */
  archive() { return this._published ? deepFreeze({ ...this._published, status: LIFECYCLE_STATUS.ARCHIVED, archived: true }) : null; }
}

export default BaseImmuneRuntimeObject;
