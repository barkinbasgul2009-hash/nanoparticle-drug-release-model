// Phase-7C SHARED RUNTIME SYSTEMS tests (Part 1 - Section 2). Validates the reusable infrastructure
// every later immune biological module will speak: base runtime-object lifecycle + immutability, the
// unified registry framework (loading + validation), the shared state-machine controller (transition
// recording, blocked transitions, minimum residence), the registry-driven aggregation framework
// (all methods + availability-aware + conflict resolution), the confidence framework (propagation,
// categorization, no inflation), the evidence + prediction frameworks (schemas + lifecycle), double-
// counting protection, the shared validators, serialization, and version compatibility. All prior
// tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { BaseImmuneRuntimeObject, LIFECYCLE_STATUS } from '../src/biology/immuneRuntime.js';
import { ImmuneRegistryProvider } from '../src/biology/immuneRegistryFramework.js';
import { ImmuneStateMachines } from '../src/biology/immuneStateMachines.js';
import { ImmuneStateController, TransitionHistory } from '../src/biology/immuneTransitions.js';
import { ImmuneAggregator } from '../src/biology/immuneAggregation.js';
import { ImmuneConfidence } from '../src/biology/immuneConfidence.js';
import { makeEvidence, makePrediction, supersede, expire, EVIDENCE_CATEGORIES, PREDICTION_CATEGORIES, PREDICTION_STATUS } from '../src/biology/immuneEvidencePrediction.js';
import { ImmuneContributionGuard } from '../src/biology/immuneDoubleCounting.js';
import { ImmuneValidators, VALIDATION_LEVEL } from '../src/biology/immuneValidation.js';
import { AVAILABILITY, ImmuneContributionLedger } from '../src/biology/immuneObjects.js';
import { validateSerializable } from '../src/biology/immuneSerialization.js';

export default async function run() {
  section('immune shared runtime systems (Phase 7C - Part 1 Section 2)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await loader.load(f, 'generic');

  // ---- Part A: base runtime object lifecycle + immutability ----
  const objThrows = (fn) => { let t = false; try { fn(); } catch { t = true; } return t; };
  ok(objThrows(() => new BaseImmuneRuntimeObject({ id: 'x', runtimeType: 'macrophage' })), 'runtime object requires an owner (exactly one)');
  const obj = new BaseImmuneRuntimeObject({ id: 'cd8_1', runtimeType: 'cd8', owner: 'adaptiveEngine' });
  eq(obj.status, LIFECYCLE_STATUS.CREATED, 'object starts CREATED');
  obj.initialize().markReady().markRunning().setAvailability(AVAILABILITY.PARTIALLY_AVAILABLE).setConfidence(0.5, 'MODERATE').addEvidenceRef('imev_1').addPredictionRef('impr_1');
  eq(obj.status, LIFECYCLE_STATUS.PARTIALLY_AVAILABLE, 'availability drives lifecycle status');
  const snap = obj.publish();
  eq(obj.status, LIFECYCLE_STATUS.FROZEN, 'object FROZEN after publish');
  ok(Object.isFrozen(snap), 'published snapshot is deep-frozen');
  ok(objThrows(() => obj.setConfidence(0.9)), 'mutation after publish throws (immutable)');
  ok(validateSerializable(snap).ok, 'published runtime object serializes');
  const arch = obj.archive(); eq(arch.status, LIFECYCLE_STATUS.ARCHIVED, 'archive produces an archived snapshot');

  // ---- Part B: registry framework (loading + validation) ----
  const provider = new ImmuneRegistryProvider(R);
  const rep = provider.validate();
  ok(rep.ok, `registry bundle validates (issues: ${rep.issues.slice(0, 3).map((i) => i.message).join('; ')})`);
  ok(provider.ok, 'provider.ok true after successful validation');
  eq(provider.getEntry('aggregation', ['targets', 'immune_suppression', 'method']), 'bounded_multiplicative', 'nested registry accessor works');
  // a corrupted bundle is detected (min > max), not silently accepted
  const badProvider = new ImmuneRegistryProvider({ ...R, confidence: { categories: { LOW: { min: 0.9, max: 0.1 } }, propagation: {} } });
  ok(!badProvider.validate().ok, 'registry validation rejects an inverted min/max range');

  // ---- Part C: state-machine controller (transition recording) ----
  const sm = new ImmuneStateMachines(R.transition);
  const history = new TransitionHistory();
  const ctrl = new ImmuneStateController(sm, 'cd8_functional_state', { history, minResidenceFrames: 2 });
  eq(ctrl.current(), 'quiescent', 'controller starts at registry initial state');
  ok(history.records[0].trigger === 'initialization', 'initialization transition explicitly recorded (no implicit transitions)');
  // minimum residence blocks leaving the initial state too early
  const early = ctrl.propose('primed', { frameIndex: 1 });
  ok(early.blocked && /minimum_residence/.test(early.blockingReason), 'minimum residence time enforced');
  // legal transition applies once residence is satisfied
  const t1 = ctrl.propose('primed', { trigger: 'priming', frameIndex: 2 });
  ok(!t1.blocked && ctrl.current() === 'primed', 'legal transition applied + recorded after residence');
  // illegal transition blocked (primed -> exhausted is not a legal edge)
  const tIllegal = ctrl.propose('exhausted', { frameIndex: 3 });
  ok(tIllegal.blocked && tIllegal.blockingReason === 'illegal_transition', 'illegal transition blocked with reason');
  // guard can block a legal, residence-satisfied transition
  const tGuard = ctrl.propose('activated', { frameIndex: 4, guard: () => ({ ok: false, reason: 'insufficient_signal' }) });
  ok(tGuard.blocked && tGuard.blockingReason === 'insufficient_signal', 'transition guard can block with a reason');
  const tOk = ctrl.propose('activated', { frameIndex: 5, trigger: 'activation' });
  ok(!tOk.blocked && ctrl.current() === 'activated', 'transition applies once residence + guard satisfied');
  ok(history.applied().length >= 3 && history.blocked().length >= 3, 'ordered history records both applied + blocked transitions');
  ok(validateSerializable(history.toArray()).ok, 'transition history is serializable');

  // ---- Part D: aggregation framework (registry-driven; all methods; availability-aware) ----
  const agg = new ImmuneAggregator(R.aggregation);
  const approx = (a, b, msg) => ok(isFinite(a) && Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);
  let _cid = 0; const A = (v, availability = AVAILABILITY.AVAILABLE, extra = {}) => ({ id: 'c' + (++_cid), value: v, weight: 1, availability, ...extra });
  const wa = agg.aggregate('tumor_visibility', [A(0.4), A(0.8)]);
  approx(wa.value, 0.6, 'availability-aware average of 0.4 and 0.8 is 0.6');
  eq(wa.availability, 'AVAILABLE', 'all-available aggregate is AVAILABLE');
  const partial = agg.aggregate('tumor_visibility', [A(0.4), A(0.9, AVAILABILITY.UNAVAILABLE)]);
  approx(partial.value, 0.4, 'unavailable input ignored (not treated as zero)');
  eq(partial.availability, 'PARTIALLY_AVAILABLE', 'partial availability reported');
  eq(partial.ignored.length, 1, 'ignored input is traced with a reason');
  const none = agg.aggregate('tumor_visibility', [A(0.4, AVAILABILITY.UNAVAILABLE)]);
  ok(none.value === null && none.availability === 'UNAVAILABLE', 'all-unavailable aggregate is null + UNAVAILABLE (not 0)');
  // method coverage
  eq(agg.aggregate('immune_suppression', []).method, 'bounded_multiplicative', 'target resolves its registry method');
  ok(agg.aggregate('checkpoint_pressure', [A(0.3), A(0.3)]).method === 'bounded_additive', 'checkpoint uses bounded_additive');
  approx(agg.aggregate('adaptive_immunity', [A(0.2), A(0.8)]).value, 0.5, 'weighted average correct');
  // explicit conflict resolution (competing signed contributions)
  const conflict = agg.aggregate('net_immune_effect', [A(0.8, AVAILABILITY.AVAILABLE, { signed: 0.8, confidence: 0.6 }), A(0.7, AVAILABILITY.AVAILABLE, { signed: -0.8, confidence: 0.6 })]);
  ok(conflict.conflicts.length === 1, 'competing contributions detected explicitly (no silent overwrite)');
  ok(conflict.warnings.some((w) => w.code === 'IMMUNE_CONTRIBUTION_CONFLICT'), 'conflict recorded as a warning');

  // ---- Part E: confidence framework ----
  const conf = new ImmuneConfidence(R.confidence);
  eq(conf.categorize(0.1), 'VERY_LOW', 'confidence categorization (very low)');
  eq(conf.categorize(0.7), 'HIGH', 'confidence categorization (high)');
  const full = conf.propagate({});
  const degraded = conf.propagate({ missingInputs: 1, unavailableDependencies: 1, conflictingSignals: 1 });
  ok(degraded.score < full.score, 'confidence decreases with missing inputs / unavailable deps / conflicts');
  ok(conf.propagate({}).score <= 0.95, 'confidence never exceeds the ceiling (no inflation; prediction-only)');
  ok(conf.propagate({ missingInputs: 100 }).score >= 0.02, 'confidence clamped at floor (never negative)');

  // ---- Part F/G: evidence + prediction frameworks ----
  const ev = makeEvidence({ title: 'B16BL6 immunosuppressive posture', category: 'Mechanistic', interpretation: 'predicted', sourceReference: 'NOT_REPORTED' });
  ok(ev.evidenceId && EVIDENCE_CATEGORIES.includes(ev.category), 'evidence record has id + valid category');
  ok(makeEvidence({ category: 'NonsenseCategory' }).category === 'ModelAssumption', 'unknown evidence category falls back to ModelAssumption');
  const pr = makePrediction({ description: 'CD8 exhaustion likely', category: 'PotentialExhaustion', targetMetric: 'cd8_exhaustion', supportingEvidenceIds: [ev.evidenceId], confidence: 0.4 });
  ok(pr.predictionId && PREDICTION_CATEGORIES.includes(pr.category) && pr.status === PREDICTION_STATUS.AVAILABLE, 'prediction record valid + AVAILABLE');
  eq(supersede(pr, 'impr_new').status, 'SUPERSEDED', 'prediction can be superseded');
  eq(expire(pr).status, 'EXPIRED', 'prediction can expire');
  ok(validateSerializable(pr.toSerializable()).ok && validateSerializable(ev.toSerializable()).ok, 'evidence + prediction serialize');

  // ---- Part J: double-counting protection ----
  const ledger = new ImmuneContributionLedger();
  const guard = new ImmuneContributionGuard(ledger);
  const r1 = guard.apply({ targetMetric: 'cd8_activity', sourceMetric: 'hypoxia', sourceModule: 'suppression', value: 0.3 });
  const r2 = guard.apply({ targetMetric: 'cd8_activity', sourceMetric: 'hypoxia', sourceModule: 'suppression', value: 0.3 });
  ok(r1.applied && !r2.applied, 'duplicate biological effect (hypoxia on CD8) excluded');
  ok(guard.getExclusions()[0].reason === 'duplicate_effect', 'exclusion records the reason');
  const r3 = guard.apply({ targetMetric: 'cd8_activity', sourceMetric: 'hypoxia', sourceModule: 'suppression', value: 0.5, priority: 5 });
  ok(r3.applied && r3.replaced, 'higher-priority contribution replaces the earlier one');
  const g1 = guard.apply({ targetMetric: 'escape', sourceMetric: 'checkpoint', sourceModule: 'escape', value: 0.4, mutuallyExclusiveGroup: 'checkpoint_effect' });
  const g2 = guard.apply({ targetMetric: 'escape', sourceMetric: 'checkpoint_alt', sourceModule: 'escape', value: 0.4, mutuallyExclusiveGroup: 'checkpoint_effect' });
  ok(g1.applied && !g2.applied && guard.getExclusions().some((e) => e.reason === 'mutually_exclusive_group'), 'mutually-exclusive group prevents a second member');

  // ---- Part I: shared validators (structured levels) ----
  ok(ImmuneValidators.runtimeObject(snap).ok, 'validator: published runtime object passes');
  eq(ImmuneValidators.runtimeObject({}).level, VALIDATION_LEVEL.FATAL, 'validator: missing id is FATAL');
  ok(ImmuneValidators.registryBundle(provider).ok, 'validator: registry bundle passes');
  ok(ImmuneValidators.stateMachines(sm).ok, 'validator: state machines pass');
  ok(!ImmuneValidators.confidence(1.7).ok, 'validator: out-of-range confidence is not ok');
  eq(ImmuneValidators.confidence(0.5).level, VALIDATION_LEVEL.PASSED, 'validator: valid confidence passes');
  ok(ImmuneValidators.contributions(ledger).ok, 'validator: contributions pass');

  // ---- version compatibility (frameworks are versioned) ----
  ok(R.aggregation.aggregation_framework_version && R.confidence.confidence_framework_version && R.transition.state_machine_version, 'shared frameworks carry version identifiers');
}
