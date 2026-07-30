// Phase-7C CANONICAL immune frame builder + sole publication boundary (Part 2 Section 2). Assembles the
// immutable ImmuneFrame from already-computed immutable biological outputs + transition records +
// evidence/prediction references + contribution ledger; validates identity / duplicate ids / serializ-
// ability; generates non-biological structural summaries; enforces deterministic transition ordering;
// then DEEP-FREEZES the frame. It performs NO biological calculation and NEVER mutates input
// contributions. Every production frame producer publishes through this one builder. Deterministic.

import {
  ImmuneFrame, ImmuneContributionLedger, ISSUE_SEVERITY, AVAILABILITY, deepFreeze,
} from './immuneObjects.js';
import { validateSerializable } from './immuneSerialization.js';

export const CANONICAL_FRAME_SCHEMA_VERSION = '7C.2.0';

/** Split issues into warnings (INFO/WARNING) and errors (ERROR/FATAL) as plain data. */
function partitionIssues(issues) {
  const warnings = [], errors = [];
  for (const i of issues || []) {
    const rec = { code: i.code, severity: i.severity, category: i.category, module: i.module, message: i.message, affectedField: i.affectedField, recoverable: i.recoverable };
    if (i.severity === ISSUE_SEVERITY.ERROR || i.severity === ISSUE_SEVERITY.FATAL) errors.push(rec); else warnings.push(rec);
  }
  return { warnings, errors };
}

/**
 * @param {{
 *   frameId:string, simulationId?:string, simulationTime?:number, frameIndex?:number,
 *   species?:string, tumourModel?:string, formulation?:string,
 *   snapshot:object, sourceRefs?:object[], domainStates?:object, ledger?:ImmuneContributionLedger,
 *   evidenceRecords?:object[], predictionRecords?:object[], transitionRecords?:object[],
 *   issues?:object[], availability?:string, status?:string, registryBundleVersion?:string, stateMachineVersion?:string
 * }} def
 * @returns {ImmuneFrame} a deep-frozen immutable frame
 */
export function buildImmuneFrame(def = {}) {
  const domain = def.domainStates || {};
  const { warnings, errors } = partitionIssues(def.issues);
  const ledger = def.ledger instanceof ImmuneContributionLedger ? def.ledger.toArray() : (Array.isArray(def.ledger) ? def.ledger : []);

  const inputSummary = def.snapshot ? {
    availability: def.snapshot.availabilitySummary || {},
    temporal: def.snapshot.temporalContext ? {
      frameIndex: def.snapshot.temporalContext.frameIndex, deltaTime: def.snapshot.temporalContext.deltaTime,
      initializationStatus: def.snapshot.temporalContext.initializationStatus, priorFrameAvailable: def.snapshot.temporalContext.priorFrameAvailable,
    } : null,
  } : {};

  // Deterministic transition ordering (frame index, then machine, then id).
  const transitionRecords = (def.transitionRecords || []).slice().sort((a, b) =>
    (a.frameIndex ?? 0) - (b.frameIndex ?? 0) || String(a.machine).localeCompare(String(b.machine)) || String(a.transitionId).localeCompare(String(b.transitionId)));
  const evidenceRecords = def.evidenceRecords || []; const predictionRecords = def.predictionRecords || [];

  // Canonical validation: reject duplicate ids (contribution / transition / evidence / prediction).
  const dupErrors = [];
  const dedup = (rows, key, label) => { const seen = new Set(); for (const r of rows) { const id = r && r[key]; if (id != null) { if (seen.has(id)) dupErrors.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', severity: ISSUE_SEVERITY.ERROR, module: 'canonicalFrameBuilder', message: `duplicate ${label} id ${id}` }); seen.add(id); } } };
  dedup(ledger, 'contributionId', 'contribution'); dedup(transitionRecords, 'transitionId', 'transition');
  dedup(evidenceRecords.map((e) => ({ id: e.id || e.evidence_id || e.evidenceId })), 'id', 'evidence');
  dedup(predictionRecords.map((p) => ({ id: p.prediction_id || p.predictionId })), 'id', 'prediction');

  // Structural (non-biological) summaries.
  const summary = {
    warningCount: warnings.length, errorCount: errors.length + dupErrors.length, transitionCount: transitionRecords.length,
    evidenceCount: evidenceRecords.length, predictionCount: predictionRecords.length, contributionCount: ledger.length,
    appliedContributions: ledger.filter((c) => c.applied).length,
  };

  const frame = new ImmuneFrame({
    registryBundleVersion: def.registryBundleVersion, stateMachineVersion: def.stateMachineVersion,
    frameId: def.frameId, simulationId: def.simulationId, simulationTime: def.simulationTime, frameIndex: def.frameIndex,
    species: def.species, tumourModel: def.tumourModel, formulation: def.formulation,
    availability: def.availability || AVAILABILITY.UNAVAILABLE, status: def.status || 'FOUNDATIONAL',
    sourceFrameReferences: (def.sourceRefs || []).map((r) => ({ ...r })),
    inputSummary,
    tumorVisibility: domain.tumorVisibility, innateImmunity: domain.innateImmunity, antigenPresentation: domain.antigenPresentation,
    adaptiveImmunity: domain.adaptiveImmunity, checkpointState: domain.checkpointState, immuneSuppression: domain.immuneSuppression,
    immuneEscape: domain.immuneEscape, immuneEffect: domain.immuneEffect, resistanceReadiness: domain.resistanceReadiness,
    contributionLedger: ledger, evidenceRecords, predictionRecords,
    transitionRecords, warnings, errors: errors.concat(dupErrors),
    metadata: { canonicalSchemaVersion: CANONICAL_FRAME_SCHEMA_VERSION, summary, ...(def.metadata || {}) },
  });

  // Publication-boundary validation: serialization safety (records an error, does not throw for
  // ordinary content). Structural failures are surfaced as frame errors.
  const ser = validateSerializable(frame);
  if (!ser.ok) for (const i of ser.issues) frame.errors.push({ code: i.code, severity: i.severity, module: i.module, message: i.message });

  // Immutability: deep-freeze at the publication boundary so no downstream engine can mutate it.
  return deepFreeze(frame);
}

/**
 * The Canonical ImmuneFrame Builder - a thin authoritative wrapper over buildImmuneFrame (the sole
 * publication path). Production frame producers assemble already-computed immutable outputs and call
 * this; it performs NO biology and never mutates inputs.
 */
export class CanonicalImmuneFrameBuilder {
  static build(def) { return buildImmuneFrame(def); }
  static schemaVersion() { return CANONICAL_FRAME_SCHEMA_VERSION; }
}

export default buildImmuneFrame;
