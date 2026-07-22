// Phase-7C Part 2 Section 2 Part 3 — ONE repository-wide biological validation FRAMEWORK.
// This is NOT a second test runner: it is a thin layer of shared scenario builders + directional /
// bounds / availability assertion helpers built ON TOP of the existing zero-dependency harness (its
// ok()/eq() feed the same global pass/fail counters). Every immune validation suite imports from here so
// there is a single place that knows how to load the immune registries, build engines/contexts, and
// express biological invariants (directionality + consistency) rather than exact numeric values.

import { ok } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { ImmuneAdaptiveEngine } from '../src/biology/immuneAdaptiveEngine.js';
import { buildAdaptiveContext } from '../src/biology/immuneAdaptiveContext.js';
import { ImmuneInnateRuntime } from '../src/biology/immuneInnate.js';
import { ImmuneCd8Runtime } from '../src/biology/immuneCd8.js';
import { ImmuneCd4Runtime } from '../src/biology/immuneCd4.js';
import { ImmuneTregRuntime } from '../src/biology/immuneTreg.js';
import { ImmuneCheckpointRuntime } from '../src/biology/immuneCheckpoint.js';
import { ImmuneSuppressionRuntime } from '../src/biology/immuneSuppressionRuntime.js';
import { ImmuneEscapeRuntime } from '../src/biology/immuneEscapeRuntime.js';
import { ImmuneAggregator } from '../src/biology/immuneAggregation.js';
import { ImmuneConfidence } from '../src/biology/immuneConfidence.js';

export const TOL = 1e-6;
export const AVAILABILITIES = ['AVAILABLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NOT_APPLICABLE'];

// metric builders (availability-gated; a missing input is UNAVAILABLE with value:null, never zero)
export const A = (v) => ({ value: v, availability: 'AVAILABLE' });
export const PA = (v) => ({ value: v, availability: 'PARTIALLY_AVAILABLE' });
export const U = { value: null, availability: 'UNAVAILABLE' };

// a fully-available baseline adaptive input vector (every INPUT_FIELD present)
export const GOOD = Object.freeze({
  tumor_immune_visibility: A(0.6), antigen_availability: A(0.55), immune_accessibility: A(0.6),
  dendritic_contribution: A(0.6), antigen_presentation_potential: A(0.6), adaptive_priming_potential: A(0.65),
  innate_immune_readiness: A(0.55), innate_tumor_pressure: A(0.4), nk_contribution: A(0.4),
  macrophage_contribution: A(0.35), vascular_access: A(0.6), vascular_functionality: A(0.6),
});
// raw Section-3 innate inputs (independent of the adaptive input fields)
export const GOOD_INNATE = Object.freeze({ tumor_immune_visibility: A(0.6), antigen_availability: A(0.55), immune_accessibility: A(0.6), vascular_access: A(0.6), damage: A(0.2) });

export const withInput = (base, patch) => ({ ...base, ...patch });

export async function loadImmuneRegistries(fetcher) {
  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher });
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await loader.load(f, 'generic');
  return R;
}

export const makeEngine = (R) => new ImmuneAdaptiveEngine({ registries: R });
// one fresh single frame (prior=null) -> a pure function of the inputs (clean for metamorphic checks)
export const frame1 = (R, inputs, extra = {}) => makeEngine(R).evaluate({ explicitInputs: inputs, frameIndex: 0, ...extra });
// run n frames on ONE engine (temporal behaviour: persistence / exhaustion / recovery / recurrence)
export function runFrames(R, inputsPerFrame, extraPerFrame = () => ({})) {
  const eng = makeEngine(R); const out = [];
  for (let i = 0; i < inputsPerFrame.length; i++) out.push(eng.evaluate({ explicitInputs: inputsPerFrame[i], frameIndex: i, ...extraPerFrame(i) }));
  return out;
}

// direct-runtime helpers (public runtime classes; still biological behaviour, not internal order)
export const shared = (R) => ({ registries: R, aggregator: new ImmuneAggregator(R.aggregation), confidence: new ImmuneConfidence(R.confidence) });
export const ctxOf = (R, inputs, innateContribution = null) => buildAdaptiveContext({ explicitInputs: inputs, registries: R, innateContribution }).context;
export const mkInnate = (R) => new ImmuneInnateRuntime(shared(R));
export const mkCd8 = (R) => new ImmuneCd8Runtime(shared(R));
export const mkCd4 = (R) => new ImmuneCd4Runtime(shared(R));
export const mkTreg = (R) => new ImmuneTregRuntime(shared(R));
export const mkCheckpoint = (R) => new ImmuneCheckpointRuntime(shared(R));
export const mkSuppression = (R) => new ImmuneSuppressionRuntime(shared(R));
export const mkEscape = (R) => new ImmuneEscapeRuntime(shared(R));

const num = (m) => (m && typeof m === 'object' && 'value' in m ? m.value : m);

// ---- biological-invariant assertion helpers (directionality + consistency, never exact numbers) ----
export function bounded01(m, msg) { const v = num(m); ok(v === null || (typeof v === 'number' && v >= -TOL && v <= 1 + TOL), `${msg} [bounded 0..1 or null; got ${v}]`); }
export function boundedRange(v, lo, hi, msg) { ok(v === null || (typeof v === 'number' && v >= lo - TOL && v <= hi + TOL), `${msg} [bounded ${lo}..${hi}; got ${v}]`); }
export function nonDecreasing(after, before, msg) { const a = num(after), b = num(before); ok(a != null && b != null && a >= b - TOL, `${msg} [expected non-decreasing: ${a} >= ${b}]`); }
export function nonIncreasing(after, before, msg) { const a = num(after), b = num(before); ok(a != null && b != null && a <= b + TOL, `${msg} [expected non-increasing: ${a} <= ${b}]`); }
export function unavailableNotZero(m, msg) { ok(m && m.availability === 'UNAVAILABLE' && (m.value === null || m.value === undefined), `${msg} [UNAVAILABLE with value:null, not zero; got value=${m && m.value} avail=${m && m.availability}]`); }
export function availableValue(m, msg) { const v = num(m); ok(m && m.availability !== 'UNAVAILABLE' && v != null, `${msg} [available with a value; got value=${v} avail=${m && m.availability}]`); }
export function validAvailability(a, msg) { ok(AVAILABILITIES.includes(a), `${msg} [availability in enum; got ${a}]`); }
export function inStates(state, states, msg) { ok(state == null || states.includes(state), `${msg} [state in {${states.join(',')}}; got ${state}]`); }

export default { loadImmuneRegistries, makeEngine, frame1, runFrames };
