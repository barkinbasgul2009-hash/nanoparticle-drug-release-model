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
  /**
   * Validate the registry-driven scientific parameters migrated in Remediation Part 3 (CD8 CD4-support +
   * capability weights, CD8 exhaustion driver-persistence threshold + recovery-duration fallback, CD4
   * capability weights, integration escape-dampening). Every field must be present, finite, and in [0,1];
   * capability-weight groups must sum to 1. FATAL on a missing/out-of-range/bad-sum value so the engine
   * fails EARLY with a clear message rather than silently substituting a default.
   */
  scientificParameters(registries) {
    const r = new ValidationReport('scientificParameters');
    const cd8 = registries && registries.cd8; const cd4 = registries && registries.cd4; const integ = registries && registries.adaptiveIntegration;
    const weight = (v, field) => { if (!isFiniteNumber(v)) r.add(VALIDATION_LEVEL.FATAL, `missing/non-finite ${field}`, field); else if (v < 0 || v > 1) r.add(VALIDATION_LEVEL.FATAL, `${field}=${v} out of [0,1]`, field); };
    const group = (obj, keys, field) => { if (!obj) { r.add(VALIDATION_LEVEL.FATAL, `missing ${field}`, field); return; } let s = 0; for (const k of keys) { weight(obj[k], `${field}.${k}`); s += isFiniteNumber(obj[k]) ? obj[k] : NaN; } if (isFiniteNumber(s) && Math.abs(s - 1) > 1e-9) r.add(VALIDATION_LEVEL.FATAL, `${field} weights must sum to 1 (got ${s})`, field); };
    if (!cd8) r.add(VALIDATION_LEVEL.FATAL, 'missing cd8 registry');
    else {
      weight(cd8.cd4_support_weights && cd8.cd4_support_weights.cd8_priming_support, 'cd8.cd4_support_weights.cd8_priming_support');
      weight(cd8.cd4_support_weights && cd8.cd4_support_weights.cd8_activation_support, 'cd8.cd4_support_weights.cd8_activation_support');
      weight(cd8.exhaustion && cd8.exhaustion.driver_persistence_threshold, 'cd8.exhaustion.driver_persistence_threshold');
      weight(cd8.recovery && cd8.recovery.recovery_duration_fallback, 'cd8.recovery.recovery_duration_fallback');
      group(cd8.capability_weights, ['priming', 'activation', 'competence'], 'cd8.capability_weights');
    }
    if (!cd4) r.add(VALIDATION_LEVEL.FATAL, 'missing cd4 registry');
    else group(cd4.capability_weights, ['priming', 'activation'], 'cd4.capability_weights');
    if (!integ) r.add(VALIDATION_LEVEL.FATAL, 'missing adaptiveIntegration registry');
    else weight(integ.control_escape_dampening, 'adaptiveIntegration.control_escape_dampening');
    return r;
  },
};

export default ImmuneValidators;
