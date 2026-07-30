// Phase-7C Part 2 Section 2 Part 2 INTEGRATION / REGRESSION tests: Runtime Wiring Repair, Transition
// Population, Canonical ImmuneFrame Integration. Verifies the real Section-3 innate runtime (immutable,
// availability-gated, never zero), the Section-3 -> Section-4 read-only contract, REAL transition-record
// creation through the shared state controllers (with no false initial transition + deterministic ids),
// the canonical frame builder (duplicate-id rejection, deep immutability, prediction/evidence
// preservation, performs NO biology), and that the Phase-8A adapter still resolves and preserves its
// fallback (Phase-8A non-immune behaviour unchanged). All prior tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { ImmuneAdaptiveEngine } from '../src/biology/immuneAdaptiveEngine.js';
import { ImmuneInnateRuntime } from '../src/biology/immuneInnate.js';
import { ImmuneAggregator } from '../src/biology/immuneAggregation.js';
import { ImmuneConfidence } from '../src/biology/immuneConfidence.js';
import { ImmuneStateMachines } from '../src/biology/immuneStateMachines.js';
import { populateTransitions } from '../src/biology/immuneTransitionPopulator.js';
import { buildImmuneFrame, CanonicalImmuneFrameBuilder, CANONICAL_FRAME_SCHEMA_VERSION } from '../src/biology/immuneFrameBuilder.js';
import { buildExtendedImmuneResistanceContext } from '../src/biology/immuneResistanceAdapter.js';
import { contentId, validateSerializable } from '../src/biology/immuneSerialization.js';

function isDeepFrozen(v, seen = new Set()) {
  if (v == null || typeof v !== 'object' || seen.has(v)) return true;
  seen.add(v);
  if (!Object.isFrozen(v)) return false;
  for (const k of Object.keys(v)) if (!isDeepFrozen(v[k], seen)) return false;
  return true;
}

export default async function run() {
  section('immune wiring / transitions / canonical frame (Phase 7C - Part 2 Section 2 Part 2)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await loader.load(f, 'generic');
  const A = (v) => ({ value: v, availability: 'AVAILABLE' });
  const U = { value: null, availability: 'UNAVAILABLE' };

  // ---- Section 3 innate runtime: real, immutable, availability-gated (never zero) ----
  const innateRt = new ImmuneInnateRuntime({ registries: R, aggregator: new ImmuneAggregator(R.aggregation), confidence: new ImmuneConfidence(R.confidence) });
  const innAvail = innateRt.evaluate({ tumor_immune_visibility: A(0.6), antigen_availability: A(0.55), immune_accessibility: A(0.6), vascular_access: A(0.6), damage: A(0.2) });
  ok(innAvail.runtimeType === 'innate' && innAvail.availability !== 'UNAVAILABLE', 'Section 3 innate runtime produces an available contribution from real inputs');
  ok(isDeepFrozen(innAvail), 'Section 3 innate contribution is DEEP-frozen (immutable)');
  ok(innAvail.macrophage.value != null && innAvail.readiness.value != null && innAvail.adaptivePrimingPotential.value != null, 'innate outputs (macrophage / readiness / adaptive priming) are computed, not null');
  ok(innAvail.states.macrophage_polarization && innAvail.states.nk_activation && innAvail.states.dc_maturation, 'innate emits categorical states for its machines');
  const innBare = innateRt.evaluate({ tumor_immune_visibility: U, antigen_availability: U, immune_accessibility: U, vascular_access: U, damage: U });
  ok(innBare.macrophage.value === null && innBare.availability === 'UNAVAILABLE', 'innate with no inputs is UNAVAILABLE with value:null (NOT zero)');
  ok(innBare.states.macrophage_polarization === null && innBare.states.nk_activation === null, 'innate emits null states (never a fabricated concrete state) when unavailable');

  // ---- Section 3 -> Section 4 contract: real innate feeds the adaptive context read-only ----
  const eng = new ImmuneAdaptiveEngine({ registries: R });
  const rawOnly = eng.evaluate({ explicitInputs: { tumor_immune_visibility: A(0.6), antigen_availability: A(0.55), immune_accessibility: A(0.6), vascular_access: A(0.6) }, frameIndex: 0 });
  ok(rawOnly.innate && rawOnly.innate.runtimeType === 'innate', 'engine computes a real Section-3 innate contribution');
  eq(rawOnly.context.inputs.macrophage_contribution.value, rawOnly.innate.macrophage.value, 'Section 3 -> 4 contract: adaptive macrophage input is sourced from the real innate contribution');
  ok(rawOnly.context.inputs.innate_immune_readiness.value === rawOnly.innate.readiness.value, 'Section 3 -> 4 contract: innate readiness flows into the adaptive context');

  // ---- No false initial transition: the first frame seeds controllers, emits 0 records ----
  eq(rawOnly.frame.transitionRecords.length, 0, 'first frame emits NO transition records (no false initial transition)');
  ok(rawOnly.frame.metadata.controllerStates && Object.keys(rawOnly.frame.metadata.controllerStates).length > 0, 'first frame seeds controller states (carried on frame metadata)');

  // ---- Real transition creation: state changes across frames yield real records via shared machines ----
  const sm = new ImmuneStateMachines(R.transition);
  const eng2 = new ImmuneAdaptiveEngine({ registries: R });
  let anyRecord = null; let total = 0;
  for (let i = 0; i < 8; i++) {
    const vis = Math.min(0.95, 0.2 + i * 0.1);
    const r = eng2.evaluate({ explicitInputs: { tumor_immune_visibility: A(vis), antigen_availability: A(vis), antigen_presentation_potential: A(vis), adaptive_priming_potential: A(vis), dendritic_contribution: A(vis), immune_accessibility: A(0.6), vascular_access: A(0.6) }, frameIndex: i });
    total += r.frame.transitionRecords.length;
    if (!anyRecord && r.frame.transitionRecords.length) anyRecord = r.frame.transitionRecords[0];
  }
  ok(total > 0 && anyRecord, `real transition records produced across frames (${total})`);
  ok(anyRecord.previousState !== anyRecord.newState, 'a transition record carries a genuine state change (previous != new)');
  ok(sm.isState(anyRecord.machine, anyRecord.previousState) && sm.isState(anyRecord.machine, anyRecord.newState), 'transition endpoints are legal states of the recorded machine');
  ok(sm.canTransition(anyRecord.machine, anyRecord.previousState, anyRecord.newState), 'the recorded transition is a legal edge of the shared state machine (no fabricated jumps)');

  // ---- Deterministic replay: identical input sequence -> byte-identical frames (no mutable seq) ----
  const runSeq = () => { const e = new ImmuneAdaptiveEngine({ registries: R }); let f; for (let i = 0; i < 4; i++) f = e.evaluate({ explicitInputs: { tumor_immune_visibility: A(0.2 + i * 0.15), antigen_availability: A(0.2 + i * 0.15), immune_accessibility: A(0.6), vascular_access: A(0.6) }, frameIndex: i }).frame; return f; };
  eq(contentId(runSeq()), contentId(runSeq()), 'deterministic replay: transition ids derive from frame content, not a mutable counter');

  // ---- Transition populator unit: no prior -> seed only; prior present -> single legal step ----
  const seed = populateTransitions(sm, { priorStates: null, currentStates: { cd8_priming: 'PARTIALLY_PRIMED' }, frameIndex: 0 });
  eq(seed.transitionRecords.length, 0, 'populator: first frame (no prior) records nothing, seeds the controller');
  eq(seed.controllerStates.cd8_priming, 'PARTIALLY_PRIMED', 'populator: controller seeded at the computed state on the first frame');
  const stepped = populateTransitions(sm, { priorStates: { cd8_priming: 'UNPRIMED' }, currentStates: { cd8_priming: 'STRONGLY_PRIMED' }, frameIndex: 1 });
  eq(stepped.transitionRecords.length, 1, 'populator: an ordinal machine steps exactly ONE legal step toward its target');
  eq(stepped.transitionRecords[0].newState, 'PRIMING_LIMITED', 'populator: one-step transition lands on the adjacent ordinal state (no multi-step jump)');

  // ---- Canonical frame builder: duplicate-id rejection (contribution / transition / evidence) ----
  const dupT = buildImmuneFrame({ frameId: 'imf_dupT', snapshot: {}, transitionRecords: [{ transitionId: 't1', machine: 'm', frameIndex: 0 }, { transitionId: 't1', machine: 'm', frameIndex: 0 }] });
  ok(dupT.errors.some((e) => /duplicate transition id t1/.test(e.message)), 'canonical builder rejects duplicate transition ids');
  const dupE = buildImmuneFrame({ frameId: 'imf_dupE', snapshot: {}, evidenceRecords: [{ id: 'e1' }, { id: 'e1' }] });
  ok(dupE.errors.some((e) => /duplicate evidence id e1/.test(e.message)), 'canonical builder rejects duplicate evidence ids');

  // ---- Canonical builder: deep immutability + performs NO biology (idempotent passthrough) ----
  const def = { frameId: 'imf_canon', simulationTime: 3, frameIndex: 3, snapshot: { availabilitySummary: {} }, availability: 'AVAILABLE', status: 'AVAILABLE', evidenceRecords: [{ id: 'im_b16bl6_posture' }], predictionRecords: [{ prediction_id: 'pred_im_b16bl6' }], domainStates: { immuneEffect: { availability: 'AVAILABLE', potential: A(0.5) } } };
  const cf1 = CanonicalImmuneFrameBuilder.build(def); const cf2 = CanonicalImmuneFrameBuilder.build(def);
  ok(isDeepFrozen(cf1), 'canonical frame is DEEP-frozen at the publication boundary');
  eq(contentId(cf1), contentId(cf2), 'canonical builder is deterministic and performs NO biology (identical def -> identical frame)');
  ok(validateSerializable(cf1).ok, 'canonical frame serializes cleanly');
  eq(CanonicalImmuneFrameBuilder.schemaVersion(), CANONICAL_FRAME_SCHEMA_VERSION, 'canonical builder exposes its schema version');
  ok(cf1.metadata.canonicalSchemaVersion === CANONICAL_FRAME_SCHEMA_VERSION && cf1.metadata.summary, 'canonical frame carries schema version + structural summary in metadata');

  // ---- Prediction / evidence references preserved verbatim through the canonical frame ----
  eq(cf1.evidenceRecords[0].id, 'im_b16bl6_posture', 'evidence reference preserved through the canonical frame');
  eq(cf1.predictionRecords[0].prediction_id, 'pred_im_b16bl6', 'prediction reference preserved through the canonical frame');
  ok(R.evidence.evidence_records['im_b16bl6_posture'] && R.prediction.prediction_records['pred_im_b16bl6'], 'preserved references resolve in the evidence + prediction registries');

  // ---- Phase 8A adapter: resolves with biology; preserves fallback without (non-immune unchanged) ----
  const ctxAvail = buildExtendedImmuneResistanceContext(eng2.getResistanceReadiness());
  ok(ctxAvail.available === true && ctxAvail.causalGroups, 'Phase 8A canonical adapter: available (+ causal groups) when immune biology present');
  const readinessBare = new ImmuneAdaptiveEngine({ registries: R }).evaluate({ frameIndex: 0 }).resistanceReadiness;
  const ctxBare = buildExtendedImmuneResistanceContext(readinessBare);
  ok(ctxBare.available === false, 'Phase 8A fallback preserved: adapter reports available=false when immune biology is unavailable');
  ok(buildExtendedImmuneResistanceContext(null).available === false, 'Phase 8A regression: adapter tolerates a null readiness (Phase 8A non-immune behaviour unchanged)');
}
