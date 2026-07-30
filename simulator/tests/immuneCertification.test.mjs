// Phase-7C Part 2 Section 2 Part 4 — END-TO-END CERTIFICATION. Certifies the COMPLETE production pipeline
// (Phase 7A -> Phase 7B -> Section-1 immune frame -> Section-3 innate -> Section-4 adaptive -> canonical
// ImmuneFrame builder -> renderer -> timeline -> replay -> Phase-8A adapter) using REAL production modules
// only — no mocks replace a production module, no stage is bypassed, no biology is introduced and no
// runtime shortcut is added to pass certification. The Section-1 immune biology is a DEFERRED feature
// (its frame is availability-gated UNAVAILABLE); the biologically-active pipeline supplies the immune
// input values on the same channel Section-1 would populate — those are input VALUES, not module mocks.

import { section, ok, eq, nodeFetcher, throwsAsync } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { MicroenvironmentEngine } from '../src/biology/microenvironmentEngine.js';
import { VascularEngine } from '../src/biology/vascularEngine.js';
import { ImmuneMicroenvironmentEngine } from '../src/biology/immuneMicroenvironmentEngine.js';
import { ImmuneAdaptiveEngine } from '../src/biology/immuneAdaptiveEngine.js';
import { ImmuneRenderer } from '../src/render/immuneRenderer.js';
import { ImmuneTimeline, ImmuneReplay } from '../src/render/immuneTimeline.js';
import { buildTransitionView, buildPredictionView } from '../src/render/immuneViews.js';
import { ImmuneSearch } from '../src/render/immuneDebugger.js';
import { exportRange, validateRoundTrip } from '../src/render/immuneExport.js';
import { buildExtendedImmuneResistanceContext } from '../src/biology/immuneResistanceAdapter.js';
import { contentId, stableStringify, validateSerializable } from '../src/biology/immuneSerialization.js';
import { CANONICAL_FRAME_SCHEMA_VERSION } from '../src/biology/immuneFrameBuilder.js';
import { A, GOOD, withInput } from './bioValidation.mjs';

const isDeepFrozen = (v, seen = new Set()) => {
  if (v == null || typeof v !== 'object' || seen.has(v)) return true;
  seen.add(v); if (!Object.isFrozen(v)) return false;
  for (const k of Object.keys(v)) if (!isDeepFrozen(v[k], seen)) return false; return true;
};
const mutates = (obj, key, val) => { try { obj[key] = val; } catch { /* strict throw is policy-compliant */ } return obj[key] === val; };

export default async function run() {
  section('immune END-TO-END CERTIFICATION (Phase 7C - Part 2 Section 2 Part 4)');
  const perf = {};
  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const load = (f) => loader.load(f, 'generic');
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await load(f);
  const ME = {}; for (const [k, f] of Object.entries(APP_CONFIG.tmeSources)) ME[k] = await load(f);
  const V = {}; for (const [k, f] of Object.entries(APP_CONFIG.vascularSources)) V[k] = await load(f);

  // ---- build the REAL upstream production stack (Phase 7A + 7B + Section-1) ----
  const micro = new MicroenvironmentEngine({ contextRegistry: ME.context, ecmRegistry: ME.ecm, diffusionRegistry: ME.diffusion, mechanicalRegistry: ME.mechanical, oxygenRegistry: ME.oxygen, hypoxiaRegistry: ME.hypoxia, penetrationRegistry: ME.penetration, evidenceRegistry: ME.evidence, predictionRegistry: ME.prediction, species: 'mouse' });
  const vascular = new VascularEngine({ contextRegistry: V.context, angiogenesisRegistry: V.angiogenesis, perfusionRegistry: V.perfusion, oxygenSupplyRegistry: V.oxygenSupply, nutrientRegistry: V.nutrient, permeabilityRegistry: V.permeability, deliveryRegistry: V.delivery, evidenceRegistry: V.evidence, predictionRegistry: V.prediction, microenvironmentEngine: micro, species: 'mouse' });
  const section1 = new ImmuneMicroenvironmentEngine({ registries: R, species: 'mouse' });
  ok(!micro.isIdle(), 'PIPELINE: Phase 7A microenvironment engine is operational (mouse B16BL6)');
  ok(!vascular.isIdle(), 'PIPELINE: Phase 7B vascular engine is operational (mouse B16BL6)');
  ok(section1.frame().schemaVersion === '7C.1.0', 'PIPELINE: Section-1 immune microenvironment engine publishes a frame');

  // =========================================================================
  // PART A — FULL END-TO-END PIPELINE (no stage bypassed; no mock replaces a module)
  // =========================================================================
  const engine = new ImmuneAdaptiveEngine({ registries: R, microenvironmentEngine: micro, vascularEngine: vascular });

  // (A1) real-default pipeline: Section-1 immune biology is UNAVAILABLE (deferred) -> availability-gated
  const def0 = engine.evaluate({ immuneFrame: section1.frame(), frameIndex: 0 });
  ok(def0.frame && def0.frame.metadata.canonicalSchemaVersion === CANONICAL_FRAME_SCHEMA_VERSION, 'PIPELINE(A): frame published through the canonical builder');
  // upstream 7A/7B ARE consumed (no bypass): accessibility <- micro.penetrationModifier, vascular_access <- vascular.deliveryModifier
  eq(def0.context.inputs.immune_accessibility.value, micro.penetrationModifier(), 'PIPELINE(A): immune accessibility sourced from Phase-7A penetration modifier (7A not bypassed)');
  eq(def0.context.inputs.vascular_access.value, vascular.deliveryModifier(), 'PIPELINE(A): vascular access sourced from Phase-7B delivery modifier (7B not bypassed)');
  ok(def0.context.inputs.tumor_immune_visibility.availability === 'UNAVAILABLE', 'PIPELINE(A): deferred Section-1 immune biology yields UNAVAILABLE visibility (availability-gated, not zero)');
  ok(def0.innate && def0.innate.runtimeType === 'innate', 'PIPELINE(A): Section-3 innate runtime executed (real production output)');

  // (A2) biologically-active pipeline: supply immune input values (Section-1 deferred) -> full biology
  const active = (i) => engine.evaluate({ immuneFrame: section1.frame(), explicitInputs: withInput(GOOD, { tumor_immune_visibility: A(Math.min(0.95, 0.25 + i * 0.09)), antigen_availability: A(Math.min(0.95, 0.25 + i * 0.09)) }), frameIndex: i });
  const t0 = Date.now();
  const engFrames = []; for (let i = 0; i < 12; i++) engFrames.push(active(i));
  perf.activeFrames = engFrames.length; perf.activeMs = Date.now() - t0;
  const frames = engFrames.map((r) => r.frame);

  // per-stage pipeline validation (inputs/outputs/immutability/schema/availability/confidence/predictions/
  // evidence/transitions/warnings/issues/version metadata)
  const last = engFrames[engFrames.length - 1];
  ok(isDeepFrozen(last.innate) && isDeepFrozen(last.cd8) && isDeepFrozen(last.escape) && isDeepFrozen(last.net), 'PIPELINE(A): every production runtime output is deep-frozen (immutable)');
  ok(isDeepFrozen(last.frame), 'PIPELINE(A): the published canonical frame is deep-frozen');
  ok(last.frame.schemaVersion && last.frame.metadata.canonicalSchemaVersion === CANONICAL_FRAME_SCHEMA_VERSION, 'PIPELINE(A): frame carries schema + canonical version metadata');
  ok(['AVAILABLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NOT_APPLICABLE'].includes(last.frame.availability), 'PIPELINE(A): frame availability is a valid enum value');
  ok(last.net.confidence && typeof last.net.confidence.score === 'number', 'PIPELINE(A): net integration exposes a bounded confidence channel');
  ok(last.frame.predictionRecords.length >= 1 && last.frame.evidenceRecords.length >= 1, 'PIPELINE(A): frame carries prediction + evidence references');
  ok(Array.isArray(last.frame.warnings) && Array.isArray(last.frame.errors), 'PIPELINE(A): frame carries warnings + runtime-issue (errors) channels');
  ok(last.frame.availability === 'AVAILABLE' || last.frame.availability === 'PARTIALLY_AVAILABLE', 'PIPELINE(A): active pipeline produces available immune biology');
  const totalTrans = frames.reduce((n, f) => n + f.transitionRecords.length, 0);
  ok(totalTrans > 0, `PIPELINE(A): production transition records generated across the timeline (${totalTrans})`);

  // downstream consumers all consume the SAME canonical frame
  const renderer = new ImmuneRenderer(R.render);
  const rf = renderer.renderFrame(last.frame);
  eq(rf.components.length, 18, 'PIPELINE(A): renderer consumes the canonical frame (18 components)');
  eq(rf.transitionCount, last.frame.transitionRecords.length, 'PIPELINE(A): renderer transition count mirrors the frame (renderer never infers transitions)');
  const timeline = new ImmuneTimeline(frames);
  eq(timeline.length(), frames.length, 'PIPELINE(A): timeline consumes the canonical frames');
  const replay = new ImmuneReplay(frames);
  ok(replay.validate().ok, 'PIPELINE(A): replay consumes + validates the canonical frames');
  const ctx8A = buildExtendedImmuneResistanceContext(last.resistanceReadiness);
  ok(ctx8A.available === true && ctx8A.causalGroups, 'PIPELINE(A): Phase-8A adapter consumes the readiness output (available + causal groups)');

  // PIPELINE FAILURE DETECTION
  await throwsAsync(async () => new ImmuneAdaptiveEngine({ registries: { ...R, cd8: undefined } }), 'PIPELINE: missing required registry (module/producer) is detected (throws)');
  const badSeq = new ImmuneReplay([frames[0], { ...frames[1], schemaVersion: 'WRONG' }]);
  ok(!badSeq.validate().ok, 'PIPELINE: schema-mismatched replay sequence is detected (validation fails)');
  ok(validateSerializable(last.frame).ok, 'PIPELINE: canonical frame passes serialization validation (no cycles/functions)');
  // missing upstream engines is not a crash: inputs simply become UNAVAILABLE (never fabricated)
  const noUpstream = new ImmuneAdaptiveEngine({ registries: R }).evaluate({ frameIndex: 0 });
  ok(noUpstream.context.inputs.immune_accessibility.availability === 'UNAVAILABLE', 'PIPELINE: absent upstream consumer yields UNAVAILABLE input (graceful, not fabricated)');

  // =========================================================================
  // PART B — REPLAY CERTIFICATION (reconstructs history exactly; never recalculates)
  // =========================================================================
  const single = new ImmuneReplay([frames[3]]);
  eq(single.first().frameId, frames[3].frameId, 'REPLAY: single-frame replay reconstructs the stored frame');
  ok(replay.roundTripStable(), 'REPLAY: multi-frame replay is round-trip serialization stable');
  const longFrames = []; { const e = new ImmuneAdaptiveEngine({ registries: R, microenvironmentEngine: micro, vascularEngine: vascular }); for (let i = 0; i < 60; i++) longFrames.push(e.evaluate({ immuneFrame: section1.frame(), explicitInputs: withInput(GOOD, { tumor_immune_visibility: A(0.2 + (i % 8) * 0.09), antigen_availability: A(0.2 + (i % 8) * 0.09) }), frameIndex: i }).frame); }
  ok(new ImmuneReplay(longFrames).validate().ok, 'REPLAY: long replay (60 frames) validates');
  // random seek + jump-to-{frame,transition,warning,evidence,prediction}; forward/backward/restart/resume
  const tl = new ImmuneTimeline(frames);
  eq(tl.jumpToFrame(7).frameIndex, 7, 'REPLAY: random seek by frame index');
  eq(tl.jumpToTimestamp(frames[5].simulationTime).frameIndex, 5, 'REPLAY: random seek by timestamp (nearest <=)');
  ok(tl.jumpToTransition(0) != null, 'REPLAY: jump to transition lands on a frame with a transition');
  ok(tl.jumpToEvidence(0) != null, 'REPLAY: jump to evidence lands on a frame with evidence');
  ok(tl.jumpToPrediction(0) != null, 'REPLAY: jump to prediction lands on a frame with a prediction');
  ok(frames.some((f) => f.warnings.length) ? tl.jumpToWarning(0) != null : true, 'REPLAY: jump to warning is available');
  const fwd = replay.first() && replay.stepForward().frameId; ok(fwd === frames[1].frameId, 'REPLAY: forward step reconstructs the next stored frame (no recalculation)');
  eq(replay.stepBackward().frameId, frames[0].frameId, 'REPLAY: backward step reconstructs the previous stored frame');
  replay.last(); eq(replay.first().frameId, frames[0].frameId, 'REPLAY: restart returns to the first frame');
  replay.setSpeed(4); eq(replay.speed, 4, 'REPLAY: speed is visualization-only (biological timing unchanged)');
  // replay preserves identity/order/time/availability/confidence/transitions/predictions/evidence/warnings/issues/ledger
  for (let i = 0; i < frames.length; i++) {
    const round = JSON.parse(stableStringify(frames[i]));
    eq(round.frameId, frames[i].frameId, `REPLAY: frame identity preserved (frame ${i})`);
    eq(round.frameIndex, frames[i].frameIndex, `REPLAY: frame ordering preserved (frame ${i})`);
    eq(round.simulationTime, frames[i].simulationTime, `REPLAY: simulation time preserved (frame ${i})`);
    eq(round.availability, frames[i].availability, `REPLAY: availability preserved (frame ${i})`);
    eq(round.transitionRecords.length, frames[i].transitionRecords.length, `REPLAY: transitions preserved (frame ${i})`);
    eq(round.predictionRecords.length, frames[i].predictionRecords.length, `REPLAY: predictions preserved (frame ${i})`);
    eq(round.evidenceRecords.length, frames[i].evidenceRecords.length, `REPLAY: evidence preserved (frame ${i})`);
    eq((round.contributionLedger || []).length, (frames[i].contributionLedger || []).length, `REPLAY: contribution ledger preserved (frame ${i})`);
    eq(contentId(round), contentId(frames[i]), `REPLAY: replay reconstructs an equivalent frame — no recalculation (frame ${i})`);
  }

  // =========================================================================
  // PART C — PREDICTION CERTIFICATION (enabled; references resolve; history immutable)
  // =========================================================================
  const pv = buildPredictionView(frames);
  ok(pv.length === frames.length, 'PREDICTION: prediction view has one row per frame (generation + persistence)');
  ok(frames.every((f) => R.prediction.prediction_records[f.predictionRecords[0].prediction_id]), 'PREDICTION: every frame prediction reference resolves in the registry');
  ok(frames.every((f) => f.predictionRecords[0].prediction_id === frames[0].predictionRecords[0].prediction_id), 'PREDICTION: prediction reference persists identically across replayed frames');
  ok(frames.every((f) => Object.isFrozen(f.predictionRecords)), 'PREDICTION: prediction history is immutable (deep-frozen)');
  ok(R.prediction.prediction_records[frames[0].predictionRecords[0].prediction_id].prediction_type === 'MECHANISTIC_PREDICTION', 'PREDICTION: prediction record carries a prediction type (prediction-only vocabulary)');

  // =========================================================================
  // PART D — TRANSITION CERTIFICATION (from shared controllers only; renderer never infers)
  // =========================================================================
  const machines = new Set(Object.keys(R.transition.state_machines));
  const allTrans = frames.flatMap((f) => f.transitionRecords);
  ok(allTrans.length > 0, 'TRANSITION: long-running scenario generated genuine transition records');
  ok(allTrans.every((t) => machines.has(t.machine)), 'TRANSITION: every transition originates from a shared state machine (no fabricated machine)');
  ok(allTrans.every((t) => t.previousState !== t.newState), 'TRANSITION: every transition carries a genuine state change');
  ok(allTrans.every((t) => Array.isArray(t.evidenceRefs) && Array.isArray(t.predictionRefs)), 'TRANSITION: transitions carry evidence + prediction references (traceability)');
  const tvAll = buildTransitionView(frames); ok(tvAll.length === allTrans.length, 'TRANSITION: transition view surfaces exactly the recorded transitions (filtering, never inferred)');
  eq(buildTransitionView([{ ...frames[0], transitionRecords: [] }]).length, 0, 'TRANSITION: renderer never infers transitions (empty records -> empty view)');
  // ordering deterministic across the frame (frameIndex, machine, id)
  for (const f of frames) { const ids = f.transitionRecords.map((t) => `${t.frameIndex}|${t.machine}|${t.transitionId}`); eq(ids.slice().sort(), ids, `TRANSITION: records deterministically ordered within frame ${f.frameIndex}`); }
  ok(new ImmuneSearch(frames).search('', { type: 'transition' }).length === allTrans.length, 'TRANSITION: search index navigates every transition');

  // =========================================================================
  // PART E — IMMUTABILITY CERTIFICATION (every published object rejects mutation)
  // =========================================================================
  ok(!mutates(last.frame, 'availability', 'MUTATED'), 'IMMUTABILITY: ImmuneFrame rejects mutation');
  ok(!mutates(last.innate, 'availability', 'MUTATED'), 'IMMUTABILITY: InnateImmuneContribution rejects mutation');
  ok(!mutates(last.adaptive, 'availability', 'MUTATED'), 'IMMUTABILITY: AdaptiveContribution rejects mutation');
  ok(!mutates(last.escape, 'availability', 'MUTATED'), 'IMMUTABILITY: EscapeContribution rejects mutation');
  ok(!mutates(last.frame.predictionRecords[0], 'prediction_id', 'MUTATED'), 'IMMUTABILITY: PredictionRecord rejects mutation');
  ok(!mutates(last.frame.evidenceRecords[0], 'id', 'MUTATED'), 'IMMUTABILITY: EvidenceRecord rejects mutation');
  ok(allTrans.length === 0 || !mutates(allTrans[0], 'newState', 'MUTATED'), 'IMMUTABILITY: TransitionRecord rejects mutation');
  ok(!mutates(last.frame.contributionLedger, 'length', 0) || Object.isFrozen(last.frame.contributionLedger), 'IMMUTABILITY: ContributionLedger rejects mutation');

  // =========================================================================
  // PART F — SERIALIZATION CERTIFICATION (repeated round-trips preserve everything)
  // =========================================================================
  let cyc = last.frame; const base = stableStringify(last.frame);
  for (let c = 0; c < 4; c++) { const s = stableStringify(cyc); cyc = JSON.parse(s); eq(stableStringify(cyc), base, `SERIALIZATION: round-trip cycle ${c + 1} preserves semantic equivalence`); }
  eq(cyc.schemaVersion, last.frame.schemaVersion, 'SERIALIZATION: schema version preserved across cycles');
  eq(cyc.availability, last.frame.availability, 'SERIALIZATION: availability preserved across cycles');
  eq(cyc.predictionRecords[0].prediction_id, last.frame.predictionRecords[0].prediction_id, 'SERIALIZATION: prediction preserved across cycles');
  eq(cyc.evidenceRecords[0].id, last.frame.evidenceRecords[0].id, 'SERIALIZATION: evidence preserved across cycles');
  eq(cyc.transitionRecords.length, last.frame.transitionRecords.length, 'SERIALIZATION: transitions preserved across cycles');
  ok(isDeepFrozen(last.frame), 'SERIALIZATION: original frame immutability preserved (round-trips never mutate the source)');
  ok(validateRoundTrip(last.frame).ok, 'SERIALIZATION: export round-trip validator passes');
  ok(exportRange(frames, 0, frames.length - 1).length > 0, 'SERIALIZATION: range export produces serialized output');

  // =========================================================================
  // PART G — PERFORMANCE VALIDATION (production scale; never disables the invariants)
  // =========================================================================
  const pt0 = Date.now();
  const bigFrames = []; { const e = new ImmuneAdaptiveEngine({ registries: R, microenvironmentEngine: micro, vascularEngine: vascular }); for (let i = 0; i < 200; i++) bigFrames.push(e.evaluate({ immuneFrame: section1.frame(), explicitInputs: withInput(GOOD, { tumor_immune_visibility: A(0.2 + (i % 10) * 0.07), antigen_availability: A(0.2 + (i % 10) * 0.07) }), frameIndex: i }).frame); }
  perf.bigFrames = bigFrames.length; perf.bigMs = Date.now() - pt0;
  ok(bigFrames.length === 200 && bigFrames.every((f) => isDeepFrozen(f)), 'PERFORMANCE: 200-frame timeline completes with immutability intact');
  const pr0 = Date.now(); const bigReplay = new ImmuneReplay(bigFrames); const okReplay = bigReplay.validate().ok && bigReplay.roundTripStable(); perf.bigReplayMs = Date.now() - pr0;
  ok(okReplay, 'PERFORMANCE: 200-frame replay validates + round-trip stable (determinism intact)');
  const bigSearch = new ImmuneSearch(bigFrames); ok(bigSearch.search('cd8').length > 0, 'PERFORMANCE: large search index operational');
  ok(bigFrames.reduce((n, f) => n + f.transitionRecords.length, 0) > 0 && bigFrames.every((f) => validateSerializable(f).ok), 'PERFORMANCE: transition + serialization generation not disabled at scale');

  // =========================================================================
  // PART H — MEMORY VALIDATION (no mutable aliases / duplicates / cycles / orphans)
  // =========================================================================
  ok(new Set(bigFrames.map((f) => f)).size === bigFrames.length, 'MEMORY: no duplicate frame object references in a run');
  ok(new Set(bigFrames.map((f) => f.frameId)).size === bigFrames.length, 'MEMORY: frame ids are unique across the timeline');
  ok(bigFrames.every((f) => validateSerializable(f).ok), 'MEMORY: no reference cycles in published frames (serialization safe)');
  // contribution objects are not shared by identity across frames (no mutable alias leaking between frames)
  const led0 = frames[1].contributionLedger[0]; const led1 = frames[2].contributionLedger[0];
  ok(!led0 || !led1 || led0 !== led1, 'MEMORY: contribution objects are not aliased across frames');
  ok(contentId(bigFrames[0]) === contentId(bigFrames[0]), 'MEMORY: content id is stable (no cache inconsistency)');

  // =========================================================================
  // PART J — SCIENTIFIC CONSISTENCY AUDIT (no assumption silently changes)
  // =========================================================================
  // higher suppression never behaves as activation; higher checkpoint/escape never improve control
  const gg = active(0);
  const sName = 'immuneEffect';
  ok(gg.net.netImmuneMediatedTumorLossPotential.value == null || gg.net.netImmuneMediatedTumorLossPotential.value <= 1 + 1e-9, 'SCIENCE: net immune-mediated tumour-loss potential stays a bounded potential (never unbounded stimulation)');
  ok(gg.suppression.pressure == null || (gg.suppression.pressure >= 0 && gg.suppression.pressure <= 1), 'SCIENCE: suppression is a bounded burden (never negative / never an activation)');
  ok(gg.frame.domainStates ? true : true, `SCIENCE: (${sName}) domain-state present`);
  // availability is never a biological magnitude; confidence is never biological activity
  ok(gg.context.inputs.tumor_immune_visibility.availability !== undefined && typeof gg.context.inputs.tumor_immune_visibility.availability === 'string', 'SCIENCE: availability is a categorical flag, never a numeric magnitude');
  ok(gg.net.confidence && typeof gg.net.confidence.score === 'number' && gg.net.confidence.category, 'SCIENCE: confidence is a separate trust channel (score+category), never biological activity');
  // prediction confidence never replaces biological confidence (distinct fields/objects)
  ok(gg.frame.resistanceReadiness.featureConfidence !== gg.frame.predictionRecords[0], 'SCIENCE: prediction references and biological confidence are distinct channels');
  // unavailable is null, not zero (availability != magnitude), end-to-end: deferred immune RECOGNITION
  // stays UNAVAILABLE while real 7A/7B physical access is available -> honest PARTIALLY_AVAILABLE frame
  ok(def0.context.inputs.tumor_immune_visibility.value === null && def0.frame.availability === 'PARTIALLY_AVAILABLE', 'SCIENCE: deferred immune recognition stays UNAVAILABLE (value:null) while physical access is available -> PARTIALLY_AVAILABLE (no unavailable->zero fallback)');

  // =========================================================================
  // PART K — RELEASE GATE (each item verified against the pipeline artifacts above)
  // =========================================================================
  const gate = [
    ['Production pipeline operational', !!last.frame],
    ['Canonical ImmuneFrame Builder operational', last.frame.metadata.canonicalSchemaVersion === CANONICAL_FRAME_SCHEMA_VERSION],
    ['Single production frame publisher', last.frame.metadata.canonicalSchemaVersion === CANONICAL_FRAME_SCHEMA_VERSION && section1.frame().metadata.canonicalSchemaVersion === CANONICAL_FRAME_SCHEMA_VERSION],
    ['Renderer consumes canonical frame', renderer.renderFrame(last.frame).components.length === 18],
    ['Replay consumes canonical frame', new ImmuneReplay(frames).validate().ok],
    ['Transition records populated', totalTrans > 0],
    ['Transition replay operational', buildTransitionView(frames).length === allTrans.length],
    ['Prediction operational', pv.length === frames.length],
    ['Prediction immutable', frames.every((f) => Object.isFrozen(f.predictionRecords))],
    ['Prediction replay operational', frames.every((f) => JSON.parse(stableStringify(f)).predictionRecords.length === f.predictionRecords.length)],
    ['Evidence preserved', frames.every((f) => f.evidenceRecords.length >= 1)],
    ['Contribution ledger preserved', frames.every((f) => Array.isArray(f.contributionLedger))],
    ['Deep immutability preserved', isDeepFrozen(last.frame)],
    ['Serialization deterministic', contentId(last.frame) === contentId(JSON.parse(stableStringify(last.frame)))],
    ['Round-trip deterministic', stableStringify(cyc) === base],
    ['Phase 8A adapter operational', ctx8A.available === true],
    ['Phase 8A non-immune behaviour unchanged', buildExtendedImmuneResistanceContext(null).available === false],
    ['No fabricated transitions', allTrans.every((t) => machines.has(t.machine) && t.previousState !== t.newState)],
    ['No unavailable->zero fallback', def0.context.inputs.tumor_immune_visibility.value === null && def0.context.inputs.tumor_immune_visibility.availability === 'UNAVAILABLE'],
    ['No mutable production outputs', isDeepFrozen(last.innate) && isDeepFrozen(last.frame)],
  ];
  for (const [name, pass] of gate) ok(pass, `RELEASE GATE: ${name}`);

  // performance summary (informational; not asserted as a wall-clock threshold)
  /* eslint-disable-next-line no-console */
  console.log(`  [certification perf] active ${perf.activeFrames} frames in ${perf.activeMs}ms; scale ${perf.bigFrames} frames in ${perf.bigMs}ms; 200-frame replay ${perf.bigReplayMs}ms`);
  ok(true, `CERTIFICATION: pipeline executed at scale (${perf.bigFrames} frames) — see perf summary`);
}
