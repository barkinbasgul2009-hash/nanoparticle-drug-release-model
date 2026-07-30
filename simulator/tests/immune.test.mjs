// Phase-7C IMMUNE MICROENVIRONMENT foundational tests (Part 1 - Section 1). Validates the FOUNDATIONAL
// CONTRACTS only (biology is populated in later sections): additive evidence vocabulary, registry
// integrity, versioned immutable frame, availability model (input absence is NOT zero), temporal
// context, deterministic construction + replay, serialization round-trip, state-machine framework
// (illegal transitions rejected), and the read-only Phase-7C -> Phase-8A resistance contract
// (reports UNAVAILABLE in Section 1 so Phase 8A's fallback is preserved; version mismatch fails
// safely). No upstream engine is mutated; Phase 8A cannot mutate the immune frame. All previous
// tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { ImmuneMicroenvironmentEngine } from '../src/biology/immuneMicroenvironmentEngine.js';
import { ImmuneStateMachines } from '../src/biology/immuneStateMachines.js';
import { buildImmuneResistanceContext, ImmuneResistanceAdapter } from '../src/biology/immuneResistanceAdapter.js';
import { validateSerializable, contentId, stableStringify } from '../src/biology/immuneSerialization.js';
import {
  AVAILABILITY, availabilityAwareAggregate, unavailableMetric, deepFreeze, clampScore,
  IMMUNE_FRAME_SCHEMA_VERSION, IMMUNE_RESISTANCE_CONTRACT_VERSION,
} from '../src/biology/immuneObjects.js';
import {
  IMMUNE_EVIDENCE_LEVELS, isImmuneEvidenceLevel, isImmunePrediction, isImmuneTransfer, immuneLevelActive, isImmunePredictionLabel,
} from '../src/evidence/evidenceEngine.js';

export default async function run() {
  section('immune microenvironment (Phase 7C - Part 1 Section 1 foundational contracts)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const load = (f) => loader.load(f, 'generic');
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await load(f);
  const mk = (species) => new ImmuneMicroenvironmentEngine({ registries: R, species });

  // ---- evidence vocabulary (additive; prediction-only, no experimental tier) ----
  eq(IMMUNE_EVIDENCE_LEVELS.length, 8, 'immune evidence vocabulary has 8 levels');
  ok(!IMMUNE_EVIDENCE_LEVELS.some((l) => /EXPERIMENTAL/.test(l)), 'no EXPERIMENTAL immune tier');
  ok(isImmuneEvidenceLevel('MECHANISTIC_PREDICTION') && !isImmuneEvidenceLevel('EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC'), 'immune level validity');
  ok(isImmunePrediction('MECHANISTIC_PREDICTION') && !isImmunePrediction('NOT_REPORTED'), 'immune prediction classifier');
  ok(isImmuneTransfer('CROSS_SPECIES_PREDICTION') && !isImmuneTransfer('MECHANISTIC_PREDICTION'), 'immune transfer classifier');
  ok(!immuneLevelActive('NOT_REPORTED') && !immuneLevelActive('UNAVAILABLE') && immuneLevelActive('MECHANISTIC_PREDICTION'), 'immune active classifier');
  ok(isImmunePredictionLabel('IMMUNE_CONTEXT_PREDICTION') && !isImmunePredictionLabel('NONSENSE'), 'immune prediction-label validity');

  // ---- registry bundle integrity ----
  ok(Object.keys(APP_CONFIG.immuneSources).length >= 13, 'immune registry bundle has the Section-1 registries (>= 13; Section 2 adds more)');
  ok(R.context && R.context.profiles && R.transition && R.transition.state_machines, 'core immune registries present');

  // ---- utilities: availability-aware aggregation + clamp warnings + unavailable metric ----
  const aggNone = availabilityAwareAggregate([{ value: 0.5, weight: 1, availability: AVAILABILITY.UNAVAILABLE }]);
  eq(aggNone.availability, 'UNAVAILABLE', 'aggregate of all-unavailable is UNAVAILABLE (not zero)');
  ok(aggNone.value === null, 'unavailable aggregate value is null, not 0');
  const aggPartial = availabilityAwareAggregate([{ value: 0.6, weight: 1, availability: AVAILABILITY.AVAILABLE }, { value: 0.2, weight: 1, availability: AVAILABILITY.UNAVAILABLE }]);
  eq(aggPartial.availability, 'PARTIALLY_AVAILABLE', 'mixed availability -> PARTIALLY_AVAILABLE');
  eq(aggPartial.value, 0.6, 'partial aggregate uses only available contributions');
  const clampIssues = [];
  eq(clampScore(1.5, { field: 'x', issues: clampIssues }), 1, 'clampScore clamps to [0,1]');
  ok(clampIssues.some((i) => i.code === 'IMMUNE_VALUE_CLAMPED'), 'clamp emits a traceable warning (never silent)');
  ok(unavailableMetric().value === null && unavailableMetric().availability === 'UNAVAILABLE', 'unavailableMetric is null + UNAVAILABLE');

  // ---- deterministic construction + versioned frame ----
  const mouse = mk('mouse');
  const f = mouse.frame();
  ok(!!f, 'mouse publishes a frame');
  eq(f.schemaVersion, IMMUNE_FRAME_SCHEMA_VERSION, 'frame carries schema version');
  ok(f.engineVersion && f.registryBundleVersion && f.stateMachineVersion && f.resistanceContractVersion, 'frame carries all version identifiers');
  eq(f.resistanceContractVersion, IMMUNE_RESISTANCE_CONTRACT_VERSION, 'frame carries the 7C->8A contract version');

  // ---- availability model: Section 1 is FOUNDATIONAL / UNAVAILABLE (not zero) ----
  eq(f.status, 'FOUNDATIONAL', 'mouse context resolved but biology pending -> FOUNDATIONAL');
  eq(f.availability, 'UNAVAILABLE', 'component biology UNAVAILABLE in Section 1');
  eq(f.resistanceReadiness.availability, 'UNAVAILABLE', 'resistance readiness UNAVAILABLE in Section 1');
  ok(f.tumorVisibility.antigenAvailability.value === null, 'foundational metric value is null (not a hardcoded zero)');
  ok(f.tumorVisibility.antigenAvailability.availability === 'UNAVAILABLE', 'foundational metric explicitly UNAVAILABLE');
  ok(f.sourceFrameReferences.length >= 2, 'source frame references recorded for traceability');
  ok(f.sourceFrameReferences.every((r) => r.availability === 'UNAVAILABLE'), 'absent upstream -> UNAVAILABLE source refs (not assumed normal)');
  eq(f.evidenceRecords.length, 1, 'mouse frame attaches its evidence record');
  eq(f.predictionRecords.length, 1, 'mouse frame attaches its prediction record');

  // rat is idle / NOT_REPORTED (no fallback)
  const rat = mk('rat');
  ok(rat.isIdle(), 'rat immune context is idle (NOT_REPORTED, no fallback)');
  eq(rat.frame().status, 'UNAVAILABLE', 'rat frame status UNAVAILABLE');
  eq(rat.frame().evidenceRecords.length, 0, 'rat attaches no evidence records');

  // human is a distinct predictive-exploratory context (own values, not shown by default)
  const human = mk('human');
  ok(human.available && human.profile.predictive_exploratory && human.profile.default_shown === false, 'human is predictive-exploratory, not shown by default');
  ok(!!human.profile.human_translation_warning, 'human carries a mandated non-clinical warning');

  // ---- immutability: published frame is deep-frozen; consumers cannot mutate it ----
  ok(Object.isFrozen(f), 'published frame is frozen');
  ok(Object.isFrozen(f.tumorVisibility) && Object.isFrozen(f.resistanceReadiness), 'frame is DEEP frozen');
  const before = f.availability;
  try { f.availability = 'AVAILABLE'; } catch { /* strict-mode throw is fine */ }
  eq(f.availability, before, 'mutation of frozen frame does not take effect');

  // ---- serialization: round-trips deterministically; stable content id ----
  const ser = validateSerializable(f);
  ok(ser.ok, 'frame serialization validates (no functions / no cycles / round-trips)');
  ok(typeof contentId(f) === 'string' && contentId(f).startsWith('imf_'), 'stable content id computed');
  eq(contentId(f), contentId(f), 'content id is deterministic');
  ok(stableStringify({ b: 1, a: 2 }) === '{"a":2,"b":1}', 'stable stringify sorts keys deterministically');

  // ---- deterministic replay: same construction + steps -> identical content ----
  const a = mk('mouse'); a.step(0.5); a.step(0.5);
  const b = mk('mouse'); b.step(0.5); b.step(0.5);
  eq(contentId(a.frame()), contentId(b.frame()), 'deterministic replay: identical frames for identical input sequences');
  ok(a.frame().frameIndex === 2, 'frame index advances with steps');

  // ---- temporal validation: frame-order reversal is flagged, held safely (not fatal) ----
  const tmpn = mk('mouse');
  tmpn.step(1.0);
  const rev = tmpn.evaluateImmune({ currentTime: 0.1 });   // goes backwards in sim time
  ok(rev.warnings.some((w) => w.code === 'IMMUNE_INVALID_DELTA_TIME'), 'frame-order reversal flagged (IMMUNE_INVALID_DELTA_TIME)');
  ok(Object.isFrozen(rev), 'frame still published (immutable) despite temporal warning - not a fatal error');

  // ---- state-machine framework: enumerated, illegal transitions rejected ----
  const sm = new ImmuneStateMachines(R.transition);
  ok(sm.validate().ok, 'immune state machines are structurally valid');
  ok(sm.names().length >= 6, 'immune state-machine framework defines the required machines');
  ok(sm.canTransition('cd8_functional_state', 'quiescent', 'primed'), 'legal CD8 transition allowed');
  ok(!sm.canTransition('cd8_functional_state', 'quiescent', 'effector'), 'illegal CD8 transition rejected');
  ok(!sm.canTransition('immune_escape_state', 'none', 'persistent'), 'illegal escape transition rejected');
  let threw = false; try { sm.assertTransition('cd8_functional_state', 'quiescent', 'exhausted'); } catch { threw = true; }
  ok(threw, 'assertTransition throws on an illegal transition');

  // ---- Phase-7C -> Phase-8A read-only contract ----
  const ctx = new ImmuneResistanceAdapter().fromEngine(mouse);
  ok(ctx.available === false, 'Section 1: immune resistance context reports available=false (Phase 8A fallback preserved)');
  ok(ctx.compatible === true, 'contract version compatible');
  eq(ctx.immuneSuppression.availability, 'UNAVAILABLE', 'immune inputs UNAVAILABLE (not zero) in Section 1');
  ok(ctx.contractVersion === IMMUNE_RESISTANCE_CONTRACT_VERSION, 'context carries the contract version');
  // version mismatch fails SAFELY (does not silently map fields)
  const bad = buildImmuneResistanceContext({ ...f, resistanceContractVersion: 'WRONG-9.9.9' });
  ok(bad.available === false && bad.compatible === false, 'version mismatch -> unavailable + incompatible (safe fail)');
  ok(bad.warnings.some((w) => w.code === 'IMMUNE_FRAME_VERSION_MISMATCH'), 'version mismatch emits a structured warning');
  const none = buildImmuneResistanceContext(null);
  ok(none.available === false, 'null frame -> unavailable context (Phase 8A keeps fallback)');

  // ---- read-only boundary: reading the frame does not mutate upstream or the frame ----
  const idBefore = contentId(mouse.frame());
  new ImmuneResistanceAdapter().fromEngine(mouse);
  eq(contentId(mouse.frame()), idBefore, 'reading the 7C->8A context does not mutate the immune frame');

  // ---- engine validation + deep-freeze helper ----
  for (const sp of ['mouse', 'human', 'rat']) { const v = mk(sp).validate(); ok(v.ok, `${sp} immune engine validate() ok (errors: ${v.errors.slice(0, 3).join('; ')})`); }
  const frozen = deepFreeze({ a: { b: 1 } });
  ok(Object.isFrozen(frozen) && Object.isFrozen(frozen.a), 'deepFreeze freezes nested objects');
}
