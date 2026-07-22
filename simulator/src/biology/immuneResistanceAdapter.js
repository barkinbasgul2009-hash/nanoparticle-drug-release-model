// Phase-7C -> Phase-8A read-only compatibility adapter. Maps a published, immutable ImmuneFrame into
// an ImmuneResistanceContext shaped for Phase 8A's immune-associated resistance logic, WITHOUT
// mutating the frame and WITHOUT inventing any resistance interpretation (Phase 8A owns that).
//
// Compatibility rules (Section 8): Phase 7C owns immune state; Phase 8A owns resistance interpretation;
// Phase 7C never labels ordinary suppression as acquired resistance; Phase 8A may read but not modify;
// Phase 8A must retain its fallback when immune outputs are unavailable; the contract is versioned and
// wiring fails SAFELY on version mismatch. In Part 1 - Section 1 the immune biology is UNAVAILABLE, so
// this adapter reports available=false and Phase 8A's existing UNAVAILABLE fallback is preserved.
//
// The returned object matches the shape Phase 8A already expects: an `available` boolean gate plus the
// enumerated immune inputs (immune_suppression / immune_escape / checkpoint_pressure / tumor_visibility
// / exhausted_adaptive_response / immune_mediated_tumor_loss_modifier) as {value, availability} pairs.

import { AVAILABILITY, IMMUNE_RESISTANCE_CONTRACT_VERSION } from './immuneObjects.js';

function metric(m) { return m && typeof m === 'object' ? { value: m.value ?? null, availability: m.availability || AVAILABILITY.UNAVAILABLE } : { value: null, availability: AVAILABILITY.UNAVAILABLE }; }
function isUsable(a) { return a === AVAILABILITY.AVAILABLE || a === AVAILABILITY.PARTIALLY_AVAILABLE; }

/** An UNAVAILABLE compatibility record - Phase 8A keeps its own fallback when it sees available=false. */
function unavailableContext(reason, extra = {}) {
  return {
    available: false,
    status: AVAILABILITY.UNAVAILABLE,
    compatible: extra.compatible !== false,
    contractVersion: IMMUNE_RESISTANCE_CONTRACT_VERSION,
    schemaVersion: extra.schemaVersion || null,
    engineVersion: extra.engineVersion || null,
    reason,
    immuneSuppression: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    immuneEscape: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    persistentImmuneEscape: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    checkpointPressure: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    tumorVisibility: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    exhaustedAdaptiveResponse: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    immuneMediatedTumorLossModifier: { value: null, availability: AVAILABILITY.UNAVAILABLE },
    warnings: extra.warnings || [],
  };
}

/**
 * Build the read-only Phase-8A immune-resistance context from a published ImmuneFrame.
 * @param {object|null} immuneFrame a frozen ImmuneFrame (or null)
 * @param {{ expectedContractVersion?: string }} [opts]
 * @returns {object} ImmuneResistanceContext (never mutates the frame)
 */
export function buildImmuneResistanceContext(immuneFrame, opts = {}) {
  const expected = opts.expectedContractVersion || IMMUNE_RESISTANCE_CONTRACT_VERSION;
  if (!immuneFrame) return unavailableContext('no immune frame available', { warnings: [{ code: 'IMMUNE_RESISTANCE_ADAPTER_UNAVAILABLE', message: 'no published immune frame' }] });

  // Version validation - fail SAFELY on mismatch (do not silently map fields).
  if (immuneFrame.resistanceContractVersion !== expected) {
    return unavailableContext('immune contract version mismatch', {
      compatible: false, schemaVersion: immuneFrame.schemaVersion, engineVersion: immuneFrame.engineVersion,
      warnings: [{ code: 'IMMUNE_FRAME_VERSION_MISMATCH', message: `expected ${expected}, got ${immuneFrame.resistanceContractVersion}` }],
    });
  }

  const rr = immuneFrame.resistanceReadiness || null;
  if (!rr || !isUsable(rr.availability)) {
    // Section 1 (and any unavailable-biology frame): report UNAVAILABLE -> Phase 8A fallback preserved.
    return unavailableContext('immune biology unavailable (foundational / not yet computed)', { schemaVersion: immuneFrame.schemaVersion, engineVersion: immuneFrame.engineVersion });
  }

  // Biology available (later sections): map the readiness metrics read-only.
  const immuneSuppression = metric(rr.immuneSuppression);
  const immuneEscape = metric(rr.immuneEscape);
  const persistentImmuneEscape = metric(rr.persistentImmuneEscape);
  const checkpointPressure = metric(rr.checkpointPressure);
  const tumorVisibility = metric(rr.tumorVisibility);
  const exhaustedAdaptiveResponse = metric(rr.exhaustedAdaptiveResponse);
  const immuneMediatedTumorLossModifier = metric(rr.immuneMediatedTumorLossModifier);
  const anyUsable = [immuneSuppression, immuneEscape, checkpointPressure, tumorVisibility].some((m) => isUsable(m.availability));
  return {
    available: anyUsable,
    status: rr.availability,
    compatible: true,
    contractVersion: immuneFrame.resistanceContractVersion,
    schemaVersion: immuneFrame.schemaVersion,
    engineVersion: immuneFrame.engineVersion,
    reason: null,
    immuneSuppression, immuneEscape, persistentImmuneEscape, checkpointPressure, tumorVisibility,
    exhaustedAdaptiveResponse, immuneMediatedTumorLossModifier,
    warnings: [],
  };
}

/**
 * Section 4: map the RICH resistance-readiness (from the adaptive engine) to an extended, versioned
 * Phase-8A context. Additive over the Section-1 fields (same contract version): it adds current/
 * persistent immune features and causal-group metadata so Phase 8A can DEDUPLICATE summarised
 * mechanisms (e.g. checkpoint burden vs suppression burden). Read-only; never mutates; fails safely to
 * an unavailable context when readiness is missing/unavailable so Phase 8A keeps its fallback.
 */
export function buildExtendedImmuneResistanceContext(readiness, opts = {}) {
  const expected = opts.expectedContractVersion || IMMUNE_RESISTANCE_CONTRACT_VERSION;
  if (!readiness) return unavailableContext('no immune resistance-readiness available', { warnings: [{ code: 'IMMUNE_RESISTANCE_ADAPTER_UNAVAILABLE', message: 'no readiness' }] });
  if (readiness.contractVersion && readiness.contractVersion !== expected) return unavailableContext('immune contract version mismatch', { compatible: false, warnings: [{ code: 'IMMUNE_FRAME_VERSION_MISMATCH', message: `expected ${expected}, got ${readiness.contractVersion}` }] });
  if (!isUsable(readiness.availability)) return unavailableContext('immune biology unavailable', {});
  const base = {
    available: true, status: readiness.availability, compatible: true, contractVersion: readiness.contractVersion || expected,
    schemaVersion: '7C.1.0', engineVersion: 'immuneAdaptiveEngine', reason: null,
    // Section-1 fields
    immuneSuppression: metric(readiness.immuneSuppression), immuneEscape: metric(readiness.immuneEscape),
    persistentImmuneEscape: metric(readiness.immuneEscapePersistent || readiness.persistentImmuneEscape),
    checkpointPressure: metric(readiness.checkpointPressure), tumorVisibility: metric(readiness.tumorVisibility),
    exhaustedAdaptiveResponse: metric(readiness.exhaustedAdaptiveResponse), immuneMediatedTumorLossModifier: metric(readiness.immuneMediatedTumorLossModifier),
    // Section-4 extended features
    immunePressureCurrent: metric(readiness.immunePressureCurrent), immunePressurePersistent: metric(readiness.immunePressurePersistent),
    immuneSuppressionCurrent: metric(readiness.immuneSuppressionCurrent), immuneSuppressionPersistent: metric(readiness.immuneSuppressionPersistent),
    checkpointBurdenCurrent: metric(readiness.checkpointBurdenCurrent), checkpointBurdenPersistent: metric(readiness.checkpointBurdenPersistent),
    immuneEscapeCurrent: metric(readiness.immuneEscapeCurrent), immuneEscapePersistent: metric(readiness.immuneEscapePersistent),
    cd8DysfunctionBurden: metric(readiness.cd8DysfunctionBurden), cd8ExhaustionBurden: metric(readiness.cd8ExhaustionBurden),
    ineffectiveEngagementBurden: metric(readiness.ineffectiveEngagementBurden), blockedImmunePotential: metric(readiness.blockedImmunePotential),
    adaptiveRecoveryPotential: metric(readiness.adaptiveRecoveryPotential),
    immuneControlState: readiness.immuneControlState || null, immuneFailureState: readiness.immuneFailureState || null,
    // cross-phase double-counting metadata
    causalGroups: readiness.causalGroups || {}, warnings: [],
  };
  return base;
}

/** Thin class wrapper (holds the expected contract version) for engine-style consumption. */
export class ImmuneResistanceAdapter {
  constructor(opts = {}) { this.expectedContractVersion = opts.expectedContractVersion || IMMUNE_RESISTANCE_CONTRACT_VERSION; }
  /** @param {object} immuneEngine an ImmuneMicroenvironmentEngine (read-only) */
  fromEngine(immuneEngine) { return buildImmuneResistanceContext(immuneEngine ? immuneEngine.getPublishedFrame() : null, { expectedContractVersion: this.expectedContractVersion }); }
  fromFrame(immuneFrame) { return buildImmuneResistanceContext(immuneFrame, { expectedContractVersion: this.expectedContractVersion }); }
  /** Section 4: from the adaptive engine's rich readiness (extended, versioned). */
  fromAdaptiveEngine(adaptiveEngine) { return buildExtendedImmuneResistanceContext(adaptiveEngine ? adaptiveEngine.getResistanceReadiness() : null, { expectedContractVersion: this.expectedContractVersion }); }
  fromReadiness(readiness) { return buildExtendedImmuneResistanceContext(readiness, { expectedContractVersion: this.expectedContractVersion }); }
}

export default buildImmuneResistanceContext;
