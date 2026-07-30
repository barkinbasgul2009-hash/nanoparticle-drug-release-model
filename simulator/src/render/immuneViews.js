// Phase-7C Part 2 immune view builders (read-only, deterministic). Transition / evidence / prediction /
// contribution / warning visualization. Each builder consumes ONLY immutable published records (from
// frames) and returns frozen, filterable view-model lists with traceability links (frameId + related
// object ids). It NEVER regenerates biology, transitions, evidence, predictions, or warnings, and never
// mutates its inputs. Transitions derive EXCLUSIVELY from transition records (never inferred).

import { deepFreeze } from '../biology/immuneObjects.js';

function frameList(frames) { return Array.isArray(frames) ? frames : [frames]; }
function applyFilter(rows, filter) { if (!filter) return rows; return rows.filter((r) => Object.entries(filter).every(([k, v]) => v == null || r[k] === v)); }

/** Transition visualization: one row per transition record (from every frame), with traceability. */
export function buildTransitionView(frames, filter) {
  const rows = [];
  for (const f of frameList(frames)) for (const t of (f.transitionRecords || [])) rows.push({
    transitionId: t.transitionId, frameId: f.frameId, frameIndex: f.frameIndex, timestamp: t.simulationTime ?? f.simulationTime,
    component: t.machine, previousState: t.previousState, newState: t.newState, previousValue: t.previousValue ?? null, newValue: t.newValue ?? null,
    trigger: t.trigger, reason: t.reason, blocked: !!t.blocked, blockingReason: t.blockingReason ?? null,
    confidence: t.confidence ?? null, availability: t.availability ?? null,
    evidenceRefs: t.evidenceRefs || [], predictionRefs: t.predictionRefs || [],
    hasWarning: (t.warnings || []).length > 0, hasEvidence: (t.evidenceRefs || []).length > 0, hasPrediction: (t.predictionRefs || []).length > 0,
  });
  return deepFreeze(applyFilter(rows, filter));
}

/** Evidence visualization: one row per evidence record with the frame it appeared in. */
export function buildEvidenceView(frames) {
  const rows = [];
  for (const f of frameList(frames)) for (const e of (f.evidenceRecords || [])) rows.push({
    evidenceId: e.id || e.evidence_id || e.evidenceId, frameId: f.frameId, frameIndex: f.frameIndex, timestamp: f.simulationTime,
    module: e.kind || e.source_type || 'immune', referencedVariable: e.tumour_model || e.species || null,
    supportStrength: e.strength || e.verification_status || null, availability: f.availability,
    supports: e.supports || [], citation: e.citation || null,
    traceTo: { frame: f.frameId, predictions: (f.predictionRecords || []).map((p) => p.prediction_id || p.predictionId) },
  });
  return deepFreeze(rows);
}

/** Prediction visualization: one row per prediction record + lifecycle status (immutable history). */
export function buildPredictionView(frames) {
  const rows = [];
  for (const f of frameList(frames)) for (const p of (f.predictionRecords || [])) rows.push({
    predictionId: p.prediction_id || p.predictionId, frameId: f.frameId, generationFrame: f.frameIndex, timestamp: f.simulationTime,
    origin: p.source_context || p.origin || 'immune', target: p.target_context || p.targetMetric || null, category: p.prediction_type || p.category || null,
    confidence: p.confidence ?? null, availability: p.availability || f.availability, status: p.status || 'AVAILABLE',
    supportingEvidence: p.supporting_evidence_ids || p.supportingEvidenceIds || [],
  });
  return deepFreeze(rows);
}

/**
 * Contribution visualization (primary debugging interface): one row per ledger entry, plus the
 * double-counting exclusion records. Application status is derived from the immutable records.
 */
export function buildContributionView(frames, filter) {
  const rows = [];
  for (const f of frameList(frames)) {
    for (const c of (f.contributionLedger || [])) rows.push({
      contributionId: c.contributionId, frameId: f.frameId, sourceModule: c.sourceModule, targetMetric: c.targetMetric, sourceMetric: c.sourceMetric,
      rawValue: c.rawValue ?? null, weight: c.weight ?? null, availability: c.availability, applied: c.applied === true,
      applicationStatus: c.applied ? 'Applied' : (c.exclusionReason ? 'Rejected' : 'Unavailable'),
      exclusionReason: c.exclusionReason || null, registryEntryId: c.registryEntryId || null,
      evidenceId: c.evidenceId || null, predictionId: c.predictionId || null,
    });
    // double-counting exclusions (rejected / replaced / superseded) from frame metadata
    for (const x of ((f.metadata && f.metadata.exclusions) || [])) rows.push({
      contributionId: x.excludedContributor, frameId: f.frameId, sourceModule: 'guard', targetMetric: null, sourceMetric: null,
      applied: false, applicationStatus: x.reason === 'replaced_by_higher_priority' ? 'Superseded' : x.reason === 'mutually_exclusive_group' ? 'Rejected' : 'Rejected',
      exclusionReason: x.reason, replacementContributor: x.replacementContributor || null, registryRule: x.registryRule || null, doubleCounting: true,
    });
  }
  return deepFreeze(applyFilter(rows, filter));
}

/** Double-counting events specifically (subset of the contribution view). */
export function buildDoubleCountingView(frames) { return deepFreeze(buildContributionView(frames).filter((r) => r.doubleCounting)); }

/** Warning visualization: warnings + errors mapped to render severities (registry-driven). */
export function buildWarningView(frames, renderRegistry, filter) {
  const sevMap = (renderRegistry && renderRegistry.render_severity && renderRegistry.render_severity.issue_severity_map) || { INFO: 'INFO', WARNING: 'MINOR', ERROR: 'MAJOR', FATAL: 'CRITICAL' };
  const rows = [];
  for (const f of frameList(frames)) for (const w of [...(f.warnings || []), ...(f.errors || [])]) rows.push({
    warningId: w.code, code: w.code, severity: w.severity, renderSeverity: sevMap[w.severity] || 'INFO',
    module: w.module, frameId: f.frameId, frameIndex: f.frameIndex, timestamp: f.simulationTime,
    affectedField: w.affectedField ?? null, message: w.message, recoverable: w.recoverable !== false,
    traceTo: { frame: f.frameId },
  });
  return deepFreeze(applyFilter(rows, filter));
}

export default buildTransitionView;
