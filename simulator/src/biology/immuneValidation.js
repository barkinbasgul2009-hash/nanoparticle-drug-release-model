// Phase-7C shared validation framework (Part 1 - Section 2). Reusable validators every immune module
// uses (no per-module validation logic). Each validator returns a structured ValidationReport that
// distinguishes PASSED / WARNING / RECOVERABLE / FATAL - validation never silently ignores failures.
// Reuses Section-1 utilities (serialization validator, availability enum, numeric validators) and the
// Section-2 registry provider / state machines. Deterministic.

import { isAvailability, validateNormalized, validateSigned, isFiniteNumber } from './immuneObjects.js';
import { validateSerializable } from './immuneSerialization.js';
import { LIFECYCLE_VALUES } from './immuneRuntime.js';

export const VALIDATION_LEVEL = Object.freeze({ PASSED: 'PASSED', WARNING: 'WARNING', RECOVERABLE: 'RECOVERABLE', FATAL: 'FATAL' });

/** Structured validation report. `ok` is true unless a RECOVERABLE/FATAL issue is present. */
export class ValidationReport {
  constructor(subject) { this.subject = subject; this.issues = []; }
  add(level, message, field) { this.issues.push({ level, message, field: field || null }); return this; }
  get level() {
    if (this.issues.some((i) => i.level === VALIDATION_LEVEL.FATAL)) return VALIDATION_LEVEL.FATAL;
    if (this.issues.some((i) => i.level === VALIDATION_LEVEL.RECOVERABLE)) return VALIDATION_LEVEL.RECOVERABLE;
    if (this.issues.some((i) => i.level === VALIDATION_LEVEL.WARNING)) return VALIDATION_LEVEL.WARNING;
    return VALIDATION_LEVEL.PASSED;
  }
  get ok() { const l = this.level; return l === VALIDATION_LEVEL.PASSED || l === VALIDATION_LEVEL.WARNING; }
}

export const ImmuneValidators = {
  runtimeObject(obj) {
    const r = new ValidationReport('runtimeObject');
    if (!obj || typeof obj !== 'object') return r.add(VALIDATION_LEVEL.FATAL, 'not an object');
    if (!obj.id) r.add(VALIDATION_LEVEL.FATAL, 'missing id');
    if (!obj.runtimeType) r.add(VALIDATION_LEVEL.RECOVERABLE, 'missing runtimeType');
    if (!obj.owner) r.add(VALIDATION_LEVEL.RECOVERABLE, 'missing owner (every object needs exactly one)');
    if (obj.status && !LIFECYCLE_VALUES.includes(obj.status)) r.add(VALIDATION_LEVEL.RECOVERABLE, `invalid lifecycle status ${obj.status}`);
    if (obj.availability && !isAvailability(obj.availability)) r.add(VALIDATION_LEVEL.RECOVERABLE, `invalid availability ${obj.availability}`);
    return r;
  },
  registryBundle(provider) {
    const r = new ValidationReport('registryBundle');
    if (!provider || typeof provider.validate !== 'function') return r.add(VALIDATION_LEVEL.FATAL, 'no registry provider');
    const rep = provider.validate();
    for (const i of rep.issues) r.add(i.severity === 'FATAL' ? VALIDATION_LEVEL.FATAL : i.severity === 'ERROR' ? VALIDATION_LEVEL.RECOVERABLE : VALIDATION_LEVEL.WARNING, i.message, i.affectedField);
    return r;
  },
  stateMachines(sm) {
    const r = new ValidationReport('stateMachines');
    if (!sm || typeof sm.validate !== 'function') return r.add(VALIDATION_LEVEL.FATAL, 'no state machines');
    const v = sm.validate(); for (const e of v.errors) r.add(VALIDATION_LEVEL.RECOVERABLE, e);
    return r;
  },
  frame(frame) {
    const r = new ValidationReport('frame');
    if (!frame) return r.add(VALIDATION_LEVEL.FATAL, 'no frame');
    if (!frame.schemaVersion || !frame.engineVersion || !frame.resistanceContractVersion) r.add(VALIDATION_LEVEL.RECOVERABLE, 'missing version identifiers');
    if (!isAvailability(frame.availability)) r.add(VALIDATION_LEVEL.RECOVERABLE, 'invalid frame availability');
    if (!Object.isFrozen(frame)) r.add(VALIDATION_LEVEL.RECOVERABLE, 'published frame is not frozen');
    return r;
  },
  serialization(frame) {
    const r = new ValidationReport('serialization');
    const s = validateSerializable(frame); if (!s.ok) for (const i of s.issues) r.add(VALIDATION_LEVEL.RECOVERABLE, i.message);
    return r;
  },
  availability(a) { const r = new ValidationReport('availability'); if (!isAvailability(a)) r.add(VALIDATION_LEVEL.RECOVERABLE, `invalid availability ${a}`); return r; },
  confidence(score) { const r = new ValidationReport('confidence'); if (score != null && !validateNormalized(score)) r.add(VALIDATION_LEVEL.RECOVERABLE, `confidence ${score} out of [0,1]`); return r; },
  contributions(ledger) {
    const r = new ValidationReport('contributions');
    const recs = ledger && typeof ledger.toArray === 'function' ? ledger.toArray() : Array.isArray(ledger) ? ledger : [];
    const seen = new Set();
    for (const c of recs) { if (c.contributionId && seen.has(c.contributionId)) r.add(VALIDATION_LEVEL.WARNING, `duplicate contribution id ${c.contributionId}`); if (c.contributionId) seen.add(c.contributionId); if (c.signedContribution != null && !validateSigned(c.signedContribution)) r.add(VALIDATION_LEVEL.WARNING, `signed contribution out of [-1,1]`); }
    return r;
  },
  predictions(records) {
    const r = new ValidationReport('predictions');
    for (const p of records || []) { if (!p.predictionId) r.add(VALIDATION_LEVEL.RECOVERABLE, 'prediction missing id'); if (p.confidence != null && !validateNormalized(p.confidence)) r.add(VALIDATION_LEVEL.WARNING, `prediction confidence out of [0,1]`); }
    return r;
  },
  evidence(records) {
    const r = new ValidationReport('evidence');
    for (const e of records || []) { if (!e.evidenceId) r.add(VALIDATION_LEVEL.RECOVERABLE, 'evidence missing id'); if (e.confidenceModifier != null && !isFiniteNumber(e.confidenceModifier)) r.add(VALIDATION_LEVEL.WARNING, 'evidence confidenceModifier non-finite'); }
    return r;
  },
};

export default ImmuneValidators;
