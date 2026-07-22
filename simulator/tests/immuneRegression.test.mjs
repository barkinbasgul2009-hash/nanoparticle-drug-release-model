// Phase-7C Part 2 Section 2 Part 3 — PERMANENT REGRESSION SUITE (Part H). Every verified defect repaired
// in Part 2 gets a permanent guard here so future refactoring cannot silently reintroduce it. Each test
// is labelled with the defect it protects against. These assert PUBLIC behaviour (not internal order).

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { loadImmuneRegistries, GOOD, withInput, A, frame1, runFrames, makeEngine } from './bioValidation.mjs';
import { buildImmuneFrame, CanonicalImmuneFrameBuilder, CANONICAL_FRAME_SCHEMA_VERSION } from '../src/biology/immuneFrameBuilder.js';
import { buildExtendedImmuneResistanceContext } from '../src/biology/immuneResistanceAdapter.js';
import { contentId, stableStringify, validateSerializable } from '../src/biology/immuneSerialization.js';

function isDeepFrozen(v, seen = new Set()) {
  if (v == null || typeof v !== 'object' || seen.has(v)) return true;
  seen.add(v); if (!Object.isFrozen(v)) return false;
  for (const k of Object.keys(v)) if (!isDeepFrozen(v[k], seen)) return false;
  return true;
}

export default async function run() {
  section('immune PERMANENT REGRESSION suite (Phase 7C - Part 2 Section 2 Part 3)');
  const R = await loadImmuneRegistries(nodeFetcher());

  // REGRESSION (Missing Section 3 wiring): the engine computes a REAL innate contribution and the
  // adaptive context is sourced from it (not from a synthetic fixture, not left permanently UNAVAILABLE).
  // Feed RAW inputs only (no innate-derived overrides) so the innate-sourced value is observable.
  const fed = frame1(R, { tumor_immune_visibility: A(0.6), antigen_availability: A(0.55), immune_accessibility: A(0.6), vascular_access: A(0.6) });
  ok(fed.innate && fed.innate.runtimeType === 'innate' && fed.frame.metadata.innateAvailable === true, 'REGRESSION[section3-wiring]: engine produces a real, available Section-3 innate contribution');
  eq(fed.context.inputs.macrophage_contribution.value, fed.innate.macrophage.value, 'REGRESSION[section3-wiring]: adaptive macrophage input is sourced from the real innate contribution');

  // REGRESSION (Unavailable-to-zero): innate-derived inputs stay UNAVAILABLE with value:null (never zero).
  const bare = frame1(R, {});
  ok(bare.context.inputs.macrophage_contribution.value === null && bare.context.inputs.macrophage_contribution.availability === 'UNAVAILABLE', 'REGRESSION[unavailable-not-zero]: unfed innate input is UNAVAILABLE with value:null (NOT zero)');
  ok(bare.frame.availability === 'UNAVAILABLE', 'REGRESSION[unavailable-not-zero]: an all-unavailable frame is UNAVAILABLE, not a zero-valued frame');

  // REGRESSION (Missing transition publication): real transition records appear in the frame as states cross.
  const crossing = Array.from({ length: 8 }, (_, i) => withInput(GOOD, { tumor_immune_visibility: A(Math.min(0.95, 0.2 + i * 0.1)), antigen_availability: A(Math.min(0.95, 0.2 + i * 0.1)) }));
  const seq = runFrames(R, crossing);
  eq(seq[0].frame.transitionRecords.length, 0, 'REGRESSION[transition-publication]: first frame emits NO transition records (no false initial transition)');
  ok(seq.reduce((n, r) => n + r.frame.transitionRecords.length, 0) > 0, 'REGRESSION[transition-publication]: production frames emit real transition records as states cross');

  // REGRESSION (Transition serialization loss): transition records survive round-trip serialization.
  const withTrans = seq.find((r) => r.frame.transitionRecords.length > 0).frame;
  eq(JSON.parse(stableStringify(withTrans)).transitionRecords.length, withTrans.transitionRecords.length, 'REGRESSION[transition-serialization]: transition records survive round-trip serialization');
  eq(contentId(JSON.parse(stableStringify(withTrans))), contentId(withTrans), 'REGRESSION[transition-serialization]: a frame with transitions is round-trip content-stable');

  // REGRESSION (Determinism / transition-id counter): transition ids are content-derived, reproducible
  // across independent runs (guards against reintroducing a process-global mutable counter).
  const a = runFrames(R, crossing); const b = runFrames(R, crossing);
  for (let i = 0; i < crossing.length; i++) eq(a[i].frame.transitionRecords.map((t) => t.transitionId), b[i].frame.transitionRecords.map((t) => t.transitionId), `REGRESSION[determinism-transition-id]: reproducible transition ids at frame ${i}`);

  // REGRESSION (Canonical builder): single publication boundary — duplicate-id rejection + deep immutability
  // + performs NO biology (idempotent) + stable schema version + structural summary.
  const dupT = buildImmuneFrame({ frameId: 'imf_reg_dupT', snapshot: {}, transitionRecords: [{ transitionId: 't', machine: 'm', frameIndex: 0 }, { transitionId: 't', machine: 'm', frameIndex: 0 }] });
  ok(dupT.errors.some((e) => /duplicate transition id/.test(e.message)), 'REGRESSION[canonical-builder]: duplicate transition ids rejected');
  const dupE = buildImmuneFrame({ frameId: 'imf_reg_dupE', snapshot: {}, evidenceRecords: [{ id: 'e' }, { id: 'e' }] });
  ok(dupE.errors.some((e) => /duplicate evidence id/.test(e.message)), 'REGRESSION[canonical-builder]: duplicate evidence ids rejected');
  const cdef = { frameId: 'imf_reg_canon', snapshot: { availabilitySummary: {} }, availability: 'AVAILABLE', status: 'AVAILABLE', evidenceRecords: [{ id: 'im_b16bl6_posture' }], predictionRecords: [{ prediction_id: 'pred_im_b16bl6' }] };
  const c1 = CanonicalImmuneFrameBuilder.build(cdef); const c2 = CanonicalImmuneFrameBuilder.build(cdef);
  ok(isDeepFrozen(c1), 'REGRESSION[canonical-builder]: canonical frame is deep-frozen');
  eq(contentId(c1), contentId(c2), 'REGRESSION[canonical-builder]: canonical builder performs no biology (identical def -> identical frame)');
  eq(CanonicalImmuneFrameBuilder.schemaVersion(), CANONICAL_FRAME_SCHEMA_VERSION, 'REGRESSION[canonical-builder]: canonical schema version stable');
  ok(c1.metadata.summary && typeof c1.metadata.summary.transitionCount === 'number', 'REGRESSION[canonical-builder]: canonical frame carries a structural summary');

  // REGRESSION (Prediction loss): the canonical frame preserves prediction + evidence references.
  const g = frame1(R, GOOD).frame;
  ok(g.predictionRecords.length >= 1 && g.evidenceRecords.length >= 1, 'REGRESSION[prediction-loss]: frame retains prediction + evidence records');
  ok(R.prediction.prediction_records[g.predictionRecords[0].prediction_id] && R.evidence.evidence_records[g.evidenceRecords[0].id], 'REGRESSION[prediction-loss]: retained references still resolve in the registries');
  ok(validateSerializable(g).ok, 'REGRESSION[prediction-loss]: frame with predictions serializes cleanly');

  // REGRESSION (Phase 8A adapter): available with biology; preserves fallback without; tolerates null.
  const readiness = makeEngine(R).evaluate({ explicitInputs: GOOD, frameIndex: 0 }).resistanceReadiness;
  ok(buildExtendedImmuneResistanceContext(readiness).available === true, 'REGRESSION[phase8a-adapter]: 8A context available when immune biology present');
  ok(buildExtendedImmuneResistanceContext(makeEngine(R).evaluate({ frameIndex: 0 }).resistanceReadiness).available === false, 'REGRESSION[phase8a-adapter]: 8A fallback preserved when immune biology unavailable');
  ok(buildExtendedImmuneResistanceContext(null).available === false, 'REGRESSION[phase8a-adapter]: 8A adapter tolerates a null readiness (non-immune behaviour unchanged)');
}
