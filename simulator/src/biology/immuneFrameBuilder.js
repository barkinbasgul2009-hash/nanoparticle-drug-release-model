// Phase-7C immune frame builder + publication boundary. Assembles the immutable ImmuneFrame from the
// validated input snapshot, the domain states, the contribution ledger, and the issue list; validates
// bounds/availability/serializability; then DEEP-FREEZES the frame so no consumer (including Phase 8A)
// can mutate published immune state. Deterministic; plain data only at the boundary.

import {
  ImmuneFrame, ImmuneContributionLedger, ISSUE_SEVERITY, AVAILABILITY, deepFreeze,
} from './immuneObjects.js';
import { validateSerializable } from './immuneSerialization.js';

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
    contributionLedger: ledger, evidenceRecords: def.evidenceRecords || [], predictionRecords: def.predictionRecords || [],
    transitionRecords: def.transitionRecords || [], warnings, errors, metadata: def.metadata || {},
  });

  // Publication-boundary validation: serialization safety (records an error, does not throw for
  // ordinary content). Structural failures are surfaced as frame errors.
  const ser = validateSerializable(frame);
  if (!ser.ok) for (const i of ser.issues) frame.errors.push({ code: i.code, severity: i.severity, module: i.module, message: i.message });

  // Immutability: deep-freeze at the publication boundary so no downstream engine can mutate it.
  return deepFreeze(frame);
}

export default buildImmuneFrame;
