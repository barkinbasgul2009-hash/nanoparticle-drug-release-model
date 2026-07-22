// Phase-7C Part 2 immune export interfaces + serialization validation (read-only, deterministic).
// Exports never alter runtime state; they preserve values / states / availability / confidence /
// transition + evidence + prediction references / warnings / runtime issues / version + schema metadata.
// Supported formats: json (deterministic string), snapshot (plain data), diagnostic (bundle). Includes
// round-trip serialization validation. Reuses Section-1 serialization utilities.

import { stableStringify, contentId, validateSerializable } from '../biology/immuneSerialization.js';
import { buildTransitionView, buildWarningView, buildContributionView, buildEvidenceView, buildPredictionView } from './immuneViews.js';

function emit(data, format) {
  if (format === 'json') return stableStringify(data);
  if (format === 'diagnostic') return { kind: 'immune_diagnostic_package', renderVersion: '7C.2.0', contentId: contentId(data), payload: data };
  return data;   // 'snapshot' (plain data)
}

export const IMMUNE_EXPORT_FORMATS = Object.freeze(['json', 'snapshot', 'diagnostic']);

/** Export a single frame. */
export function exportFrame(frame, format = 'json') { return emit(frame, format); }

/** Export a frame range [from,to] (inclusive by frameIndex). */
export function exportRange(frames, from, to, format = 'json') {
  const sel = (frames || []).filter((f) => (f.frameIndex ?? 0) >= from && (f.frameIndex ?? 0) <= to);
  return emit({ kind: 'frame_range', from, to, count: sel.length, frames: sel }, format);
}

/** Export the whole timeline (positions + frames). */
export function exportTimeline(frames, format = 'json') {
  const positions = (frames || []).map((f) => ({ frameId: f.frameId, frameIndex: f.frameIndex, simulationTime: f.simulationTime }));
  return emit({ kind: 'timeline', count: positions.length, positions, frames }, format);
}

export function exportTransitionHistory(frames, format = 'json') { return emit({ kind: 'transition_history', rows: buildTransitionView(frames) }, format); }
export function exportWarningHistory(frames, renderRegistry, format = 'json') { return emit({ kind: 'warning_history', rows: buildWarningView(frames, renderRegistry) }, format); }
export function exportEvidenceRegistry(frames, format = 'json') { return emit({ kind: 'evidence_registry', rows: buildEvidenceView(frames) }, format); }
export function exportPredictionRegistry(frames, format = 'json') { return emit({ kind: 'prediction_registry', rows: buildPredictionView(frames) }, format); }
export function exportContributionLedger(frames, format = 'json') { return emit({ kind: 'contribution_ledger', rows: buildContributionView(frames) }, format); }

/** Compact immune summary (headline states + burdens per frame). */
export function exportImmuneSummary(frames, format = 'json') {
  const rows = (Array.isArray(frames) ? frames : [frames]).map((f) => ({
    frameId: f.frameId, frameIndex: f.frameIndex, availability: f.availability, status: f.status,
    netTumorLoss: f.immuneEffect && f.immuneEffect.potential ? f.immuneEffect.potential.value : null,
    control: f.immuneEffect ? f.immuneEffect.controlState : null, failure: f.immuneEffect ? f.immuneEffect.failureState : null,
    suppression: f.immuneSuppression ? f.immuneSuppression.pressure : null, checkpoint: f.checkpointState && f.checkpointState.axis ? f.checkpointState.axis.engagement : null,
    escapeMagnitude: f.immuneEscape ? f.immuneEscape.magnitudeState : null, escapePersistence: f.immuneEscape ? f.immuneEscape.persistenceState : null,
  }));
  return emit({ kind: 'immune_summary', rows }, format);
}

/** Export the Phase-8A compatibility output (resistance readiness). */
export function exportPhase8AOutput(readiness, format = 'json') { return emit({ kind: 'phase8a_immune_output', contractVersion: readiness && readiness.contractVersion, readiness }, format); }

/** Round-trip validation: serialize -> deserialize -> serialize must be stable + integrity holds. */
export function validateRoundTrip(frame) {
  const issues = [];
  const ser = validateSerializable(frame); if (!ser.ok) issues.push(...ser.issues.map((i) => ({ code: i.code, message: i.message })));
  try {
    const s1 = stableStringify(frame); const round = stableStringify(JSON.parse(s1));
    if (s1 !== round) issues.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', message: 'round-trip not stable' });
    // integrity: identity + versions + unique contribution ids preserved
    const back = JSON.parse(s1);
    if (back.frameId !== frame.frameId || back.schemaVersion !== frame.schemaVersion) issues.push({ code: 'IMMUNE_FRAME_VERSION_MISMATCH', message: 'identity/version not preserved' });
    const ids = new Set(); for (const c of (back.contributionLedger || [])) { if (c.contributionId && ids.has(c.contributionId)) issues.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', message: `duplicate contribution id ${c.contributionId}` }); if (c.contributionId) ids.add(c.contributionId); }
  } catch (e) { issues.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', message: String(e && e.message || e) }); }
  return { ok: issues.length === 0, issues };
}

export default exportFrame;
