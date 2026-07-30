// Phase-7C Part 2 Section 2 Part 3 — PROPERTY-BASED (Part D) + METAMORPHIC (Part E) validation.
// Property tests sweep a DETERMINISTIC grid of input vectors (no RNG) and assert model-wide properties:
// bounded normalization, bounded confidence, unique identifiers, valid availability, deterministic
// serialization. Metamorphic tests apply ONE controlled input transformation and assert a biologically
// consistent directional change. No biology is altered for testing.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import {
  loadImmuneRegistries, A, U, GOOD, withInput, frame1, runFrames, mkCd8, ctxOf,
  bounded01, nonDecreasing, nonIncreasing, validAvailability,
} from './bioValidation.mjs';
import { ImmuneAdaptiveIntegration } from '../src/biology/immuneAdaptiveIntegration.js';
import { ImmuneAggregator } from '../src/biology/immuneAggregation.js';
import { ImmuneConfidence } from '../src/biology/immuneConfidence.js';
import { contentId, validateSerializable } from '../src/biology/immuneSerialization.js';

const uniqueIds = (rows, key, msg) => { const ids = rows.map((x) => x && x[key]).filter((v) => v != null); ok(new Set(ids).size === ids.length, `${msg} [${ids.length} ids, ${new Set(ids).size} unique]`); };

export default async function run() {
  section('immune PROPERTY-BASED + METAMORPHIC validation (Phase 7C - Part 2 Section 2 Part 3)');
  const R = await loadImmuneRegistries(nodeFetcher());
  const floor = R.confidence.propagation.floor ?? 0.02; const ceiling = R.confidence.propagation.ceiling ?? 0.95;
  const CONF_CATS = ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'];

  // =========================================================================
  // PART D — PROPERTY-BASED VALIDATION (deterministic input grid)
  // =========================================================================
  const levels = [0.2, 0.5, 0.8];
  const vectors = [];
  for (const v of levels) for (const acc of levels) for (const pr of levels) {
    vectors.push(withInput(GOOD, { tumor_immune_visibility: A(v), immune_accessibility: A(acc), adaptive_priming_potential: A(pr) }));
  }
  // plus partial-availability vectors (unavailable inputs must never become zero)
  vectors.push(withInput(GOOD, { antigen_availability: U }), withInput(GOOD, { tumor_immune_visibility: U, immune_accessibility: U }), {});

  let checked = 0;
  for (const inputs of vectors) {
    const res = frame1(R, inputs); const f = res.frame;
    // bounded normalization across the produced biology
    for (const m of [res.cd8.priming, res.cd8.activation, res.cd8.cytotoxicPotential, res.cd8.exhaustion, res.treg.suppressiveCompetence, res.escape.overallEscapePressure, res.net.netImmuneMediatedTumorLossPotential, res.net.overallSuppressionBurden, res.net.overallCheckpointBurden]) bounded01(m, 'PROPERTY: normalized biology stays bounded [0,1] or null');
    // bounded confidence + valid category (confidence is trust, never biological magnitude)
    for (const c of [res.cd8.confidence, res.net.confidence, res.escape.confidence]) { ok(c && c.score >= floor - 1e-9 && c.score <= ceiling + 1e-9, `PROPERTY: confidence score within policy [${floor},${ceiling}] (got ${c && c.score})`); ok(CONF_CATS.includes(c.category), 'PROPERTY: confidence category is a valid band'); }
    // availability is a valid enum value
    validAvailability(f.availability, 'PROPERTY: frame availability is a valid enum value');
    // unique identifiers (contribution / evidence / prediction) within the frame
    uniqueIds(f.contributionLedger, 'contributionId', 'PROPERTY: contribution ids unique within a frame');
    uniqueIds(f.evidenceRecords, 'id', 'PROPERTY: evidence ids unique within a frame');
    uniqueIds(f.predictionRecords.map((p) => ({ id: p.prediction_id || p.predictionId })), 'id', 'PROPERTY: prediction ids unique within a frame');
    // serialization safety + determinism (identical construction -> identical content id)
    ok(validateSerializable(f).ok, 'PROPERTY: frame serialization validates (no functions / cycles)');
    eq(contentId(frame1(R, inputs).frame), contentId(f), 'PROPERTY: identical inputs -> identical serialized content (deterministic)');
    checked += 1;
  }
  ok(checked === vectors.length, `PROPERTY: swept ${checked} deterministic input vectors`);

  // transition ids unique within each frame of a multi-frame run (states cross -> real records)
  const cross = Array.from({ length: 6 }, (_, i) => withInput(GOOD, { tumor_immune_visibility: A(Math.min(0.9, 0.2 + i * 0.12)), antigen_availability: A(Math.min(0.9, 0.2 + i * 0.12)) }));
  for (const res of runFrames(R, cross)) uniqueIds(res.frame.transitionRecords, 'transitionId', 'PROPERTY: transition ids unique within a frame');

  // =========================================================================
  // PART E — METAMORPHIC VALIDATION (one controlled transformation -> consistent directional change)
  // =========================================================================
  const ctxGood = ctxOf(R, GOOD); const cd8 = mkCd8(R);
  const cd8With = (opts) => cd8.evaluate(ctxGood, null, opts);

  // increase suppression only -> CD8 cytotoxic non-increasing; decrease suppression only -> non-decreasing
  const supLo = cd8With({ suppression: { pressure: 0.15, availability: 'AVAILABLE' } });
  const supHi = cd8With({ suppression: { pressure: 0.85, availability: 'AVAILABLE' } });
  nonIncreasing(supHi.cytotoxicPotential, supLo.cytotoxicPotential, 'METAMORPHIC: increase suppression only -> CD8 cytotoxic potential does not increase');
  nonDecreasing(supLo.cytotoxicPotential, supHi.cytotoxicPotential, 'METAMORPHIC: decrease suppression only -> CD8 cytotoxic potential does not decrease');

  // increase checkpoint only -> CD8 activation + competence non-increasing
  const cpLo = cd8With({ checkpoint: { pd_axis_engagement: 0.1, axis: { availability: 'AVAILABLE' }, persistent: 0 } });
  const cpHi = cd8With({ checkpoint: { pd_axis_engagement: 0.85, axis: { availability: 'AVAILABLE' }, persistent: 0 } });
  nonIncreasing(cpHi.activation, cpLo.activation, 'METAMORPHIC: increase checkpoint only -> CD8 activation does not increase');
  nonIncreasing(cpHi.effectorCompetence, cpLo.effectorCompetence, 'METAMORPHIC: increase checkpoint only -> CD8 effector competence does not increase');

  // increase exhaustion only (prior) -> CD8 cytotoxic + recovery non-increasing
  const exLo = cd8.evaluate(ctxGood, { exhaustion: { value: 0.1, availability: 'AVAILABLE' } }, {});
  const exHi = cd8.evaluate(ctxGood, { exhaustion: { value: 0.85, availability: 'AVAILABLE' } }, {});
  nonIncreasing(exHi.cytotoxicPotential, exLo.cytotoxicPotential, 'METAMORPHIC: increase exhaustion only -> CD8 cytotoxic potential does not increase');
  nonIncreasing(exHi.recoveryPotential, exLo.recoveryPotential, 'METAMORPHIC: increase exhaustion only -> CD8 recovery potential does not increase (no free recovery)');

  // increase accessibility only (engine) -> CD8 infiltration non-decreasing
  const accLo = frame1(R, withInput(GOOD, { immune_accessibility: A(0.2) }));
  const accHi = frame1(R, withInput(GOOD, { immune_accessibility: A(0.9) }));
  nonDecreasing(accHi.cd8.infiltration, accLo.cd8.infiltration, 'METAMORPHIC: increase accessibility only -> CD8 infiltration does not decrease');

  // reduce antigen only (engine) -> CD8 priming non-increasing; recognition escape non-decreasing
  const agHi = frame1(R, withInput(GOOD, { antigen_availability: A(0.9) }));
  const agLo = frame1(R, withInput(GOOD, { antigen_availability: A(0.1) }));
  nonIncreasing(agLo.cd8.priming, agHi.cd8.priming, 'METAMORPHIC: reduce antigen only -> CD8 priming does not increase');
  nonDecreasing(agLo.escape.recognitionEscape, agHi.escape.recognitionEscape, 'METAMORPHIC: reduce antigen only -> recognition escape does not decrease');

  // reduce visibility only (engine) -> recognition escape non-decreasing
  const visHi = frame1(R, withInput(GOOD, { tumor_immune_visibility: A(0.9) }));
  const visLo = frame1(R, withInput(GOOD, { tumor_immune_visibility: A(0.1) }));
  nonDecreasing(visLo.escape.recognitionEscape, visHi.escape.recognitionEscape, 'METAMORPHIC: reduce visibility only -> recognition escape does not decrease');

  // increase checkpoint burden -> immune control (net tumour-loss potential) does not improve
  const g = frame1(R, GOOD); const integ = new ImmuneAdaptiveIntegration({ registries: R, aggregator: new ImmuneAggregator(R.aggregation), confidence: new ImmuneConfidence(R.confidence) });
  const netWith = (engagement) => integ.integrateNet({ ctx: g.context, innate: g.innate, adaptive: g.adaptive, escape: g.escape, suppression: g.suppression, cd8: g.cd8, checkpoint: { pd_axis_engagement: engagement, axis: { availability: 'AVAILABLE' }, persistent: engagement } });
  nonIncreasing(netWith(0.85).netImmuneMediatedTumorLossPotential, netWith(0.1).netImmuneMediatedTumorLossPotential, 'METAMORPHIC: increase checkpoint burden -> net immune-mediated tumour-loss potential (control) does not improve');

  // increase suppression burden -> immune failure signal does not decrease (consistency of the failure axis)
  const failWith = (pressure) => integ.integrateNet({ ctx: g.context, innate: g.innate, adaptive: g.adaptive, escape: g.escape, suppression: { pressure, availability: 'AVAILABLE', persistent: pressure }, cd8: g.cd8, checkpoint: g.checkpoint });
  nonIncreasing(failWith(0.85).netImmuneMediatedTumorLossPotential, failWith(0.1).netImmuneMediatedTumorLossPotential, 'METAMORPHIC: increase suppression burden -> net tumour-loss potential does not improve');
}
