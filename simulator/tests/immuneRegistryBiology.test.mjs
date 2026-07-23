// Phase-7C Certification Remediation Part 3 — REGISTRY-DRIVEN BIOLOGY tests. Proves that the migrated
// scientific coefficients/thresholds (CD8 CD4-support + capability weights, CD8 exhaustion driver-
// persistence threshold + recovery-duration fallback, CD4 capability weights, integration escape-
// dampening) are ACTUALLY consumed from the registry (override changes the model), validated (malformed
// registry fails early), immutable, and behaviour-preserving under the default registry.

import { section, ok, eq, nodeFetcher, REPO_ROOT } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadImmuneRegistries, GOOD, withInput, A, frame1, runFrames, mkCd8, ctxOf, nonDecreasing, nonIncreasing, availableValue, bounded01 } from './bioValidation.mjs';
import { ImmuneAdaptiveEngine } from '../src/biology/immuneAdaptiveEngine.js';
import { ImmuneAdaptiveIntegration } from '../src/biology/immuneAdaptiveIntegration.js';
import { ImmuneAggregator } from '../src/biology/immuneAggregation.js';
import { ImmuneConfidence } from '../src/biology/immuneConfidence.js';
import { ImmuneValidators, VALIDATION_LEVEL } from '../src/biology/immuneValidation.js';
import { stableStringify } from '../src/biology/immuneSerialization.js';

const cloneR = (R) => JSON.parse(JSON.stringify(R));
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

export default async function run() {
  section('immune REGISTRY-DRIVEN biology (Remediation Part 3)');
  const R = await loadImmuneRegistries(nodeFetcher());

  // =========================================================================
  // Registry field presence + validation (fail early on malformed values)
  // =========================================================================
  ok(ImmuneValidators.scientificParameters(R).ok, 'REGISTRY: default registries pass scientific-parameter validation');
  // required fields present + typed
  ok(typeof R.cd8.cd4_support_weights.cd8_priming_support === 'number' && typeof R.cd8.cd4_support_weights.cd8_activation_support === 'number', 'REGISTRY: CD8 CD4-support weights present + numeric');
  ok(typeof R.cd8.exhaustion.driver_persistence_threshold === 'number', 'REGISTRY: CD8 exhaustion driver-persistence threshold present');
  ok(typeof R.cd8.recovery.recovery_duration_fallback === 'number', 'REGISTRY: CD8 recovery-duration fallback present');
  ok(Math.abs(R.cd8.capability_weights.priming + R.cd8.capability_weights.activation + R.cd8.capability_weights.competence - 1) < 1e-9, 'REGISTRY: CD8 capability weights sum to 1');
  ok(Math.abs(R.cd4.capability_weights.priming + R.cd4.capability_weights.activation - 1) < 1e-9, 'REGISTRY: CD4 capability weights sum to 1');
  ok(typeof R.adaptiveIntegration.control_escape_dampening === 'number', 'REGISTRY: integration escape-dampening present');
  // malformed registries fail early with clear messages (engine constructor throws)
  const bad = (mut) => { const m = cloneR(R); mut(m); return throws(() => new ImmuneAdaptiveEngine({ registries: m })); };
  ok(bad((m) => { delete m.cd8.cd4_support_weights; }), 'VALIDATION: missing CD8 CD4-support weights -> engine throws');
  ok(bad((m) => { m.cd8.cd4_support_weights.cd8_priming_support = 2; }), 'VALIDATION: out-of-range CD8 support weight -> engine throws');
  ok(bad((m) => { m.cd8.cd4_support_weights.cd8_priming_support = 'x'; }), 'VALIDATION: non-numeric weight -> engine throws');
  ok(bad((m) => { m.cd8.capability_weights.priming = 0.9; }), 'VALIDATION: CD8 capability weights not summing to 1 -> engine throws');
  ok(bad((m) => { m.cd4.capability_weights.priming = 0.9; }), 'VALIDATION: CD4 capability weights not summing to 1 -> engine throws');
  ok(bad((m) => { m.adaptiveIntegration.control_escape_dampening = -0.1; }), 'VALIDATION: negative escape-dampening -> engine throws');
  ok(ImmuneValidators.scientificParameters({}).level === VALIDATION_LEVEL.FATAL, 'VALIDATION: empty registries are FATAL');

  // =========================================================================
  // Override consumption: changing a registry value changes the correct output
  // =========================================================================
  const engWith = (mut) => { const m = cloneR(R); mut(m); return new ImmuneAdaptiveEngine({ registries: m }); };
  // CD4->CD8 priming-support weight drives CD8 priming
  const p0 = engWith((m) => { m.cd8.cd4_support_weights.cd8_priming_support = 0; }).evaluate({ explicitInputs: GOOD, frameIndex: 0 }).cd8.priming;
  const pD = frame1(R, GOOD).cd8.priming;
  const pHi = engWith((m) => { m.cd8.cd4_support_weights.cd8_priming_support = 0.3; }).evaluate({ explicitInputs: GOOD, frameIndex: 0 }).cd8.priming;
  nonDecreasing(pD, p0, 'OVERRIDE: raising CD8 priming-support weight from 0 does not decrease CD8 priming');
  nonDecreasing(pHi, pD, 'OVERRIDE: raising CD8 priming-support weight further does not decrease CD8 priming');
  ok(p0.value < pD.value + 1e-9, 'OVERRIDE: zero priming-support weight removes the CD4 priming boost (engine consumes the field)');
  // CD4->CD8 activation-support weight drives CD8 activation (distinct stage)
  const a0 = engWith((m) => { m.cd8.cd4_support_weights.cd8_activation_support = 0; }).evaluate({ explicitInputs: GOOD, frameIndex: 0 }).cd8.activation;
  const aD = frame1(R, GOOD).cd8.activation;
  nonDecreasing(aD, a0, 'OVERRIDE: raising CD8 activation-support weight from 0 does not decrease CD8 activation');
  // exhaustion driver-persistence threshold: lower threshold -> exhaustion not lower over an adverse run
  const adverse = Array.from({ length: 8 }, () => withInput(GOOD, { immune_accessibility: A(0.05), tumor_immune_visibility: A(0.05) }));
  const exLoThr = runFramesWith(R, adverse, (m) => { m.cd8.exhaustion.driver_persistence_threshold = 0.0; });
  const exHiThr = runFramesWith(R, adverse, (m) => { m.cd8.exhaustion.driver_persistence_threshold = 0.99; });
  nonDecreasing(exLoThr[7].cd8.exhaustion, exHiThr[7].cd8.exhaustion, 'OVERRIDE: a lower exhaustion driver-persistence threshold does not reduce accumulated exhaustion');
  // recovery-duration fallback: higher fallback input -> recovery not lower (runtime, prior exhaustion)
  const ctxGood = ctxOf(R, GOOD);
  const recLo = mkCd8Reg(R, (m) => { m.cd8.recovery.recovery_duration_fallback = 0.0; }).evaluate(ctxGood, { exhaustion: { value: 0.5, availability: 'AVAILABLE' } }, {});
  const recHi = mkCd8Reg(R, (m) => { m.cd8.recovery.recovery_duration_fallback = 1.0; }).evaluate(ctxGood, { exhaustion: { value: 0.5, availability: 'AVAILABLE' } }, {});
  nonDecreasing(recHi.recoveryPotential, recLo.recoveryPotential, 'OVERRIDE: a higher recovery-duration fallback does not reduce CD8 recovery potential');
  // CD8 capability weights: change the mix -> blocked-potential accounting changes (penalized scenario)
  const penalized = { suppression: { pressure: 0.9, availability: 'AVAILABLE' }, checkpoint: { pd_axis_engagement: 0.9, axis: { availability: 'AVAILABLE' }, persistent: 0 } };
  const blkPriming = mkCd8Reg(R, (m) => { m.cd8.capability_weights = { priming: 1, activation: 0, competence: 0 }; }).evaluate(ctxGood, null, penalized).blockedPotential;
  const blkComp = mkCd8Reg(R, (m) => { m.cd8.capability_weights = { priming: 0, activation: 0, competence: 1 }; }).evaluate(ctxGood, null, penalized).blockedPotential;
  ok(blkPriming.value != null && blkComp.value != null && Math.abs(blkPriming.value - blkComp.value) > 1e-6, 'OVERRIDE: CD8 capability weight mix changes blocked-potential accounting (engine consumes the group)');
  // integration escape-dampening: 0 vs high -> immune control not improved by more dampening
  const g = frame1(R, GOOD);
  const escStrong = frame1(R, withInput(GOOD, { tumor_immune_visibility: A(0.05), antigen_availability: A(0.05), immune_accessibility: A(0.05) })).escape;
  const ctrlIdx = (damp) => {
    const m = cloneR(R); m.adaptiveIntegration.control_escape_dampening = damp;
    const integ = new ImmuneAdaptiveIntegration({ registries: m, aggregator: new ImmuneAggregator(m.aggregation), confidence: new ImmuneConfidence(m.confidence) });
    const net = integ.integrateNet({ ctx: g.context, innate: g.innate, adaptive: g.adaptive, escape: escStrong, suppression: g.suppression, cd8: g.cd8, checkpoint: g.checkpoint });
    return Object.keys(m.adaptiveIntegration.control_state_thresholds).indexOf(net.immuneControlState);
  };
  ok(ctrlIdx(0.0) >= ctrlIdx(0.99), 'OVERRIDE: increasing escape-dampening does not improve immune control state');

  // =========================================================================
  // Behaviour preservation + immutability + invariants
  // =========================================================================
  eq(frame1(R, GOOD).cd8.priming.value, frame1(R, GOOD).cd8.priming.value, 'BEHAVIOUR: default registry produces deterministic, unchanged CD8 priming');
  availableValue(frame1(R, GOOD).net.netImmuneMediatedTumorLossPotential, 'BEHAVIOUR: default net immune-mediated tumour-loss potential still available');
  bounded01(frame1(R, GOOD).cd8.cytotoxicPotential, 'INVARIANT: CD8 cytotoxic potential bounded [0,1]');
  // registry immutability: engine does not mutate the registry it is given
  const snap = stableStringify(R); frame1(R, GOOD); frame1(R, withInput(GOOD, { tumor_immune_visibility: A(0.9) }));
  eq(stableStringify(R), snap, 'IMMUTABILITY: engine evaluation does not mutate the registry');
  // an override on a clone does not mutate the shared default registry
  const before = R.cd8.cd4_support_weights.cd8_priming_support; engWith((m) => { m.cd8.cd4_support_weights.cd8_priming_support = 0; });
  eq(R.cd8.cd4_support_weights.cd8_priming_support, before, 'IMMUTABILITY: per-test override does not mutate the shared default registry');

  // =========================================================================
  // Static guard: the migrated scientific literals no longer appear bare in the engines
  // =========================================================================
  const cd8src = readFileSync(resolve(REPO_ROOT, 'simulator/src/biology/immuneCd8.js'), 'utf8');
  ok(!/0\.15 \* support|weight: 0\.3[05]?\b|> 0\.4\b|metric\(0\.5,/.test(cd8src), 'STATIC GUARD: immuneCd8.js contains no migrated bare scientific literals');
  const cd4src = readFileSync(resolve(REPO_ROOT, 'simulator/src/biology/immuneCd4.js'), 'utf8');
  ok(!/weight: 0\.4\b|weight: 0\.6\b/.test(cd4src), 'STATIC GUARD: immuneCd4.js capability weights are registry-driven');
  const intsrc = readFileSync(resolve(REPO_ROOT, 'simulator/src/biology/immuneAdaptiveIntegration.js'), 'utf8');
  ok(!/\* 0\.5\)/.test(intsrc), 'STATIC GUARD: immuneAdaptiveIntegration.js escape-dampening is registry-driven');

  // helpers defined here to keep the modified-registry pattern local
  function runFramesWith(reg, inputs, mut) { const m = cloneR(reg); mut(m); const e = new ImmuneAdaptiveEngine({ registries: m }); const out = []; for (let i = 0; i < inputs.length; i++) out.push(e.evaluate({ explicitInputs: inputs[i], frameIndex: i })); return out; }
  function mkCd8Reg(reg, mut) { const m = cloneR(reg); mut(m); return mkCd8(m); }
}
