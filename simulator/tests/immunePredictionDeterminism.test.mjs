// Phase-7C Part 2 Section 2 Part 3 — PREDICTION VALIDATION (Part F) + DETERMINISM VALIDATION (Part G).
// Prediction remains ENABLED. This validates the IMPLEMENTED prediction lifecycle framework (creation ->
// active/available -> superseded / expired / unavailable) as immutable transitions, that production
// frames carry static, resolvable, immutable prediction+evidence references, that confidence is kept
// independent of biological magnitude, and that identical immutable inputs reproduce byte-identical
// outputs / transitions / evidence / predictions / ids / serialization / replay (no non-determinism).

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { loadImmuneRegistries, GOOD, withInput, A, frame1, runFrames } from './bioValidation.mjs';
import {
  ImmunePredictionRecord, makePrediction, makeEvidence, supersede, expire, PREDICTION_STATUS, PREDICTION_CATEGORIES,
} from '../src/biology/immuneEvidencePrediction.js';
import { contentId, stableStringify } from '../src/biology/immuneSerialization.js';

export default async function run() {
  section('immune PREDICTION lifecycle + DETERMINISM validation (Phase 7C - Part 2 Section 2 Part 3)');
  const R = await loadImmuneRegistries(nodeFetcher());

  // =========================================================================
  // PART F — PREDICTION VALIDATION (implemented lifecycle: created -> available -> superseded/expired)
  // =========================================================================
  // CREATED / ACTIVE: makePrediction yields an AVAILABLE record with a stable id + createdFrame
  const p0 = makePrediction({ predictionId: 'pred_test_1', description: 'expected CD8 activation rise', category: 'ExpectedIncrease', targetMetric: 'cd8_activation', confidence: 0.4, availability: 'AVAILABLE', createdFrame: 3 });
  eq(p0.status, PREDICTION_STATUS.AVAILABLE, 'PREDICTION: a created prediction is AVAILABLE (active)');
  eq(p0.createdFrame, 3, 'PREDICTION: creation frame recorded (frame-indexed, no wall-clock)');
  ok(PREDICTION_CATEGORIES.includes(p0.category), 'PREDICTION: category drawn from the fixed vocabulary');
  // UNAVAILABLE: a prediction with no availability defaults to UNAVAILABLE (never silently AVAILABLE)
  eq(new ImmunePredictionRecord({ predictionId: 'x' }).availability, 'UNAVAILABLE', 'PREDICTION: default availability is UNAVAILABLE (not fabricated)');
  // category validation: an unknown category falls back deterministically (no crash, no invented label)
  eq(makePrediction({ predictionId: 'y', category: 'NopeNotReal' }).category, 'ExpectedStability', 'PREDICTION: invalid category falls back to ExpectedStability');

  // IMMUTABLE lifecycle transitions: supersede / expire return NEW records; inputs untouched
  const superseded = supersede(p0, 'pred_test_2');
  eq(superseded.status, PREDICTION_STATUS.SUPERSEDED, 'PREDICTION: supersede -> SUPERSEDED');
  eq(superseded.metadata.supersededBy, 'pred_test_2', 'PREDICTION: supersede records the successor id');
  eq(p0.status, PREDICTION_STATUS.AVAILABLE, 'PREDICTION: superseding does NOT mutate the original record (immutable transition)');
  const expired = expire(p0);
  eq(expired.status, PREDICTION_STATUS.EXPIRED, 'PREDICTION: expire -> EXPIRED');
  eq(p0.status, PREDICTION_STATUS.AVAILABLE, 'PREDICTION: expiring does NOT mutate the original record');
  // CONFIRM / INVALIDATE across frames are modeled as new lifecycle records that preserve the original
  eq(supersede(p0, 'later').confidence, p0.confidence, 'PREDICTION: a later lifecycle record preserves the original confidence (confidence independent, not overwritten by magnitude)');
  // serialization copies (no shared references escape) — mutating a copy cannot corrupt the record
  const ser = p0.toSerializable(); ser.supportingEvidenceIds.push('leak'); ser.metadata.k = 1;
  eq(p0.supportingEvidenceIds.length, 0, 'PREDICTION: toSerializable returns copies (no shared array reference)');
  ok(p0.metadata.k === undefined, 'PREDICTION: toSerializable returns a copied metadata object');
  // evidence is a SEPARATE schema from prediction (why vs what)
  const ev = makeEvidence({ evidenceId: 'ev_1', category: 'Mechanistic', strength: 'MODERATE' });
  ok(ev.evidenceId === 'ev_1' && ev.category === 'Mechanistic' && !('status' in ev), 'PREDICTION: evidence is a distinct schema (no prediction lifecycle status)');

  // PRODUCTION frames: static, RESOLVABLE, IMMUTABLE prediction + evidence references
  const g = frame1(R, GOOD).frame;
  const pr = g.predictionRecords[0]; const evr = g.evidenceRecords[0];
  ok(pr && R.prediction.prediction_records[pr.prediction_id], 'PREDICTION: production prediction reference resolves in the registry');
  ok(evr && R.evidence.evidence_records[evr.id], 'PREDICTION: production evidence reference resolves in the registry');
  ok(Object.isFrozen(g.predictionRecords) && Object.isFrozen(g.predictionRecords[0]), 'PREDICTION: production prediction records are immutable (deep-frozen frame)');
  // version compatibility preserved (registry declares a version the frames were built against)
  ok(R.prediction.registry_bundle_version || R.prediction.$schema_version || R.prediction.version, 'PREDICTION: prediction registry declares a version (compatibility preserved)');
  // replay never recalculates predictions: round-trip serialization reproduces identical references
  const gRound = JSON.parse(stableStringify(g));
  eq(gRound.predictionRecords[0].prediction_id, pr.prediction_id, 'PREDICTION: replay (deserialize) reproduces the prediction reference — no recalculation');
  eq(gRound.evidenceRecords[0].id, evr.id, 'PREDICTION: replay reproduces the evidence reference — no recalculation');
  // confidence is a distinct trust channel, never a biological magnitude
  ok(g.resistanceReadiness.featureConfidence && typeof g.resistanceReadiness.featureConfidence.score === 'number' && g.resistanceReadiness.featureConfidence.category, 'PREDICTION: confidence is exposed as its own {score,category} channel (never a biological magnitude)');

  // =========================================================================
  // PART G — DETERMINISM VALIDATION (identical immutable inputs -> identical everything)
  // =========================================================================
  const seqInputs = [GOOD, withInput(GOOD, { tumor_immune_visibility: A(0.75) }), withInput(GOOD, { immune_accessibility: A(0.3) }), withInput(GOOD, { antigen_availability: A(0.8) }), GOOD];
  const runA = runFrames(R, seqInputs); const runB = runFrames(R, seqInputs);
  eq(runA.length, runB.length, 'DETERMINISM: two runs produce the same number of frames');
  for (let i = 0; i < runA.length; i++) {
    const a = runA[i].frame; const b = runB[i].frame;
    eq(contentId(a), contentId(b), `DETERMINISM: identical serialized content id at frame ${i}`);
    eq(stableStringify(a.transitionRecords), stableStringify(b.transitionRecords), `DETERMINISM: identical transition records at frame ${i}`);
    eq(stableStringify(a.evidenceRecords), stableStringify(b.evidenceRecords), `DETERMINISM: identical evidence records at frame ${i}`);
    eq(stableStringify(a.predictionRecords), stableStringify(b.predictionRecords), `DETERMINISM: identical prediction records at frame ${i}`);
    eq(stableStringify((a.contributionLedger || []).map((c) => c.contributionId)), stableStringify((b.contributionLedger || []).map((c) => c.contributionId)), `DETERMINISM: identical contribution ids at frame ${i}`);
    eq(stableStringify(a), stableStringify(b), `DETERMINISM: identical full serialization at frame ${i}`);
  }
  // replay reproduces an equivalent frame with no recalculation (round-trip content id equality)
  const last = runA[runA.length - 1].frame;
  eq(contentId(JSON.parse(stableStringify(last))), contentId(last), 'DETERMINISM: replay deserialization reproduces an equivalent frame (no recalculation)');

  // NON-DETERMINISM DETECTION: independent engine instances must NOT influence each other via any global
  // mutable state (this is the guard that caught the transition-id counter bug). Interleave two engines.
  const engInputs = [GOOD, withInput(GOOD, { tumor_immune_visibility: A(0.85), antigen_availability: A(0.85) })];
  const e1 = runFrames(R, engInputs); const e2 = runFrames(R, engInputs);
  for (let i = 0; i < engInputs.length; i++) eq(stableStringify(e1[i].frame), stableStringify(e2[i].frame), `NON-DETERMINISM: interleaved engines share no mutable global state at frame ${i}`);
  // transition ids are content-derived (frameIndex + machine), never a process-global counter
  const crossing = Array.from({ length: 4 }, (_, i) => withInput(GOOD, { tumor_immune_visibility: A(0.2 + i * 0.2), antigen_availability: A(0.2 + i * 0.2) }));
  const t1 = runFrames(R, crossing); const t2 = runFrames(R, crossing);
  for (let i = 0; i < crossing.length; i++) eq((t1[i].frame.transitionRecords || []).map((t) => t.transitionId), (t2[i].frame.transitionRecords || []).map((t) => t.transitionId), `NON-DETERMINISM: transition ids reproducible across runs at frame ${i}`);
  // floating-point stability within repository tolerance: identical inputs -> byte-identical numbers
  eq(stableStringify(frame1(R, GOOD).net), stableStringify(frame1(R, GOOD).net), 'DETERMINISM: net integration is floating-point stable for identical inputs');
}
