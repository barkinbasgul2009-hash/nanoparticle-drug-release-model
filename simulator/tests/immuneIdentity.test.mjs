// Phase-7C Certification Remediation Part 2 — DETERMINISTIC IDENTITY + SERIALIZATION INTEGRITY tests.
// Proves that every production-reachable persistent record identity is a PURE function of canonical
// identity-bearing content + identity-algorithm version — never a module/process counter, wall-clock,
// random, or insertion order. Covers the identity utility, exclusion/evidence/prediction/transition/
// contribution records, duplicate + collision policy, cross-process + test-order independence, property
// tests, serialization integrity, immutability, behaviour preservation, and static regression guards.

import { section, ok, eq, nodeFetcher, REPO_ROOT } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { deterministicId, registerIdentity, IDENTITY_ALGORITHM_VERSION, contentId, stableStringify } from '../src/biology/immuneSerialization.js';
import { ImmuneContributionGuard, ExclusionRecord } from '../src/biology/immuneDoubleCounting.js';
import { ImmuneContributionLedger } from '../src/biology/immuneObjects.js';
import { makeEvidence, makePrediction, supersede, expire } from '../src/biology/immuneEvidencePrediction.js';
import { loadImmuneRegistries, GOOD, frame1, runFrames } from './bioValidation.mjs';

const clone = (o) => JSON.parse(JSON.stringify(o));

export default async function run() {
  section('immune DETERMINISTIC IDENTITY + serialization integrity (Remediation Part 2)');
  const R = await loadImmuneRegistries(nodeFetcher());

  // =========================================================================
  // Identity utility: pure function of canonical payload + algorithm version
  // =========================================================================
  const p = { recordType: 'exclusion', frameIndex: 2, reasonCode: 'duplicate_effect', excludedContributor: 'cd8_activation|suppression|suppression', aggregationTarget: 'cd8_activation' };
  eq(deterministicId('imx', p), deterministicId('imx', clone(p)), 'IDENTITY: id(payload) == id(deepClone(payload))');
  const reordered = { aggregationTarget: 'cd8_activation', excludedContributor: 'cd8_activation|suppression|suppression', reasonCode: 'duplicate_effect', frameIndex: 2, recordType: 'exclusion' };
  eq(deterministicId('imx', p), deterministicId('imx', reordered), 'IDENTITY: object key order does not change the id');
  ok(deterministicId('imx', p) !== deterministicId('imx', { ...p, reasonCode: 'mutually_exclusive_group' }), 'IDENTITY: changing an identity-bearing field changes the id');
  ok(deterministicId('imx', p).startsWith('imx_'), 'IDENTITY: id carries its record-type prefix');
  ok(deterministicId('imt', { a: 1 }, 'f7').startsWith('imt_f7_'), 'IDENTITY: optional semantic segment is included for debuggability');
  // non-finite / function payloads are rejected (non-portable digests forbidden)
  let threw = false; try { deterministicId('imx', { v: NaN }); } catch { threw = true; } ok(threw, 'IDENTITY: NaN in identity payload is rejected');
  threw = false; try { deterministicId('imx', { v: Infinity }); } catch { threw = true; } ok(threw, 'IDENTITY: Infinity in identity payload is rejected');
  ok(typeof IDENTITY_ALGORITHM_VERSION === 'string', 'IDENTITY: identity-algorithm version is explicit');
  // algorithm version participates in identity
  ok(deterministicId('imx', p) !== deterministicId('imx', { ...p, _idv: 'x' }), 'IDENTITY: identity-algorithm version participates in the digest');

  // registerIdentity: new / duplicate / collision
  const seen = new Map();
  eq(registerIdentity(seen, 'id1', p), 'new', 'REGISTER: first insertion is new');
  eq(registerIdentity(seen, 'id1', clone(p)), 'duplicate', 'REGISTER: identical payload under same id is a duplicate (dedup)');
  eq(registerIdentity(seen, 'id1', { ...p, reasonCode: 'other' }), 'collision', 'REGISTER: different payload under same id is a collision');

  // =========================================================================
  // Exclusion identity (the primary confirmed defect) — content-derived, order-independent
  // =========================================================================
  const forceExclusions = () => {
    const g = new ImmuneContributionGuard(new ImmuneContributionLedger());
    g.apply({ targetMetric: 'cd8_activation', sourceMetric: 'suppression', sourceModule: 'suppression', value: 0.3, frameIndex: 2 });
    g.apply({ targetMetric: 'cd8_activation', sourceMetric: 'suppression', sourceModule: 'suppression', value: 0.3, frameIndex: 2 });   // duplicate_effect -> exclusion
    g.apply({ targetMetric: 'cd8_priming', sourceMetric: 'ctla4', sourceModule: 'checkpoint', value: 0.2, mutuallyExclusiveGroup: 'grp', frameIndex: 2 });
    g.apply({ targetMetric: 'cd8_priming', sourceMetric: 'ctla4b', sourceModule: 'checkpoint', value: 0.2, mutuallyExclusiveGroup: 'grp', frameIndex: 2 });   // mutually_exclusive -> exclusion
    return g.getExclusions();
  };
  const ex1 = forceExclusions(); const ex2 = forceExclusions();
  ok(ex1.length >= 2, 'EXCLUSION: forced scenario produces real exclusion records');
  ok(ex1.every((e) => /^imx_f2_[0-9a-f]{8}$/.test(e.exclusionId)), 'EXCLUSION: ids are content-derived (imx_f<frame>_<digest>), not counters');
  eq(ex1.map((e) => e.exclusionId), ex2.map((e) => e.exclusionId), 'EXCLUSION: identical scenario -> identical exclusion ids (deterministic)');
  eq(stableStringify(ex1), stableStringify(ex2), 'EXCLUSION: full serialized exclusions are identical across runs');
  // dedup: a third identical duplicate does not create a new record
  const g3 = new ImmuneContributionGuard(new ImmuneContributionLedger());
  for (let i = 0; i < 3; i++) g3.apply({ targetMetric: 'cd8_activation', sourceMetric: 's', sourceModule: 'suppression', value: 0.3, frameIndex: 1 });
  eq(g3.getExclusions().length, 1, 'EXCLUSION: identical duplicate events deduplicate to one record');
  // same id / different payload -> collision throws
  const g4 = new ImmuneContributionGuard(new ImmuneContributionLedger());
  const a = new ExclusionRecord({ reason: 'duplicate_effect', excludedContributor: 'x', aggregationTarget: 't', frameIndex: 0 });
  const b = new ExclusionRecord({ reason: 'duplicate_effect', excludedContributor: 'x', aggregationTarget: 't', frameIndex: 0 });
  b.reason = 'mutated_after_construction';   // same id (built from original payload), different current payload
  g4.exclusions.push(a, b);
  let collided = false; try { g4.getExclusions(); } catch (e) { collided = /COLLISION/.test(e.message); } ok(collided, 'EXCLUSION: same id with a different payload is an integrity collision (throws, never overwrites)');

  // =========================================================================
  // Evidence / prediction default identity — content-derived; status excluded
  // =========================================================================
  const ev = makeEvidence({ category: 'Mechanistic', sourceReference: 'ref', strength: 'MODERATE' });
  eq(ev.evidenceId, makeEvidence({ category: 'Mechanistic', sourceReference: 'ref', strength: 'MODERATE' }).evidenceId, 'EVIDENCE: default id deterministic for identical identity fields');
  ok(ev.evidenceId.startsWith('imev_'), 'EVIDENCE: default id is content-derived (imev_ prefix, no counter)');
  ok(ev.evidenceId !== makeEvidence({ category: 'Clinical', sourceReference: 'ref', strength: 'MODERATE' }).evidenceId, 'EVIDENCE: changing an identity field changes the id');
  const pr = makePrediction({ category: 'ExpectedIncrease', targetMetric: 'cd8_activation', createdFrame: 3, supportingEvidenceIds: ['b', 'a'] });
  eq(pr.predictionId, makePrediction({ category: 'ExpectedIncrease', targetMetric: 'cd8_activation', createdFrame: 3, supportingEvidenceIds: ['a', 'b'] }).predictionId, 'PREDICTION: set-like supportingEvidenceIds order does not change the id');
  ok(pr.predictionId.startsWith('impr_'), 'PREDICTION: default id is content-derived (impr_ prefix, no counter)');
  // lifecycle status is NOT part of identity: a superseded/expired successor keeps the id
  eq(supersede(pr, 'next').predictionId, pr.predictionId, 'PREDICTION: superseding preserves identity (status excluded from id)');
  eq(expire(pr).predictionId, pr.predictionId, 'PREDICTION: expiring preserves identity (status excluded from id)');

  // =========================================================================
  // Contribution + transition + frame identity determinism (verify, not redesign)
  // =========================================================================
  const f1 = frame1(R, GOOD).frame; const f2 = frame1(R, GOOD).frame;
  eq((f1.contributionLedger || []).map((c) => c.contributionId), (f2.contributionLedger || []).map((c) => c.contributionId), 'CONTRIBUTION: ledger ids identical across identical runs (frame-local deterministic ordering)');
  const seq1 = runFrames(R, [GOOD, { ...GOOD, tumor_immune_visibility: { value: 0.9, availability: 'AVAILABLE' } }]);
  const seq2 = runFrames(R, [GOOD, { ...GOOD, tumor_immune_visibility: { value: 0.9, availability: 'AVAILABLE' } }]);
  for (let i = 0; i < seq1.length; i++) eq(seq1[i].frame.transitionRecords.map((t) => t.transitionId), seq2[i].frame.transitionRecords.map((t) => t.transitionId), `TRANSITION: ids reproducible across runs at frame ${i}`);
  eq(contentId(f1), contentId(f2), 'FRAME: content id is a pure function of canonical content');

  // =========================================================================
  // Serialization integrity: repeated round trips preserve ids + content
  // =========================================================================
  let cyc = f1; const base = stableStringify(f1);
  for (let c = 0; c < 4; c++) { cyc = JSON.parse(stableStringify(cyc)); eq(stableStringify(cyc), base, `SERIALIZATION: round-trip cycle ${c + 1} byte-identical`); }
  eq(contentId(JSON.parse(stableStringify(f1))), contentId(f1), 'SERIALIZATION: replay deserialization reproduces the content id (no recalculation)');

  // =========================================================================
  // Test-order independence: unrelated prior activity cannot affect later ids
  // =========================================================================
  // sequence A: target only
  const targetOnly = forceExclusions();
  // sequence B: unrelated activity, THEN the same target
  makePrediction({ category: 'ExpectedDecrease', targetMetric: 'x', createdFrame: 9 }); makeEvidence({ category: 'Clinical' });
  new ImmuneContributionGuard(new ImmuneContributionLedger()).apply({ targetMetric: 'z', sourceMetric: 'z', sourceModule: 'z', frameIndex: 5 });
  frame1(R, { ...GOOD, antigen_availability: { value: 0.1, availability: 'AVAILABLE' } });
  const targetAfterNoise = forceExclusions();
  eq(targetOnly.map((e) => e.exclusionId), targetAfterNoise.map((e) => e.exclusionId), 'TEST-ORDER: prior unrelated runtime activity does not affect later exclusion ids');

  // =========================================================================
  // Cross-process determinism (Part R): two fresh Node processes, identical output
  // =========================================================================
  const dcUrl = pathToFileURL(resolve(REPO_ROOT, 'simulator/src/biology/immuneDoubleCounting.js')).href;
  const objUrl = pathToFileURL(resolve(REPO_ROOT, 'simulator/src/biology/immuneObjects.js')).href;
  const bvUrl = pathToFileURL(resolve(REPO_ROOT, 'simulator/tests/bioValidation.mjs')).href;
  const serUrl = pathToFileURL(resolve(REPO_ROOT, 'simulator/src/biology/immuneSerialization.js')).href;
  // build a self-contained child script (loads registries via the same nodeFetcher used in-process)
  const harnessUrl = pathToFileURL(resolve(REPO_ROOT, 'simulator/tests/harness.mjs')).href;
  const childScript = `
    import { ImmuneContributionGuard } from '${dcUrl}';
    import { ImmuneContributionLedger } from '${objUrl}';
    import { loadImmuneRegistries, GOOD, frame1 } from '${bvUrl}';
    import { contentId } from '${serUrl}';
    import { nodeFetcher } from '${harnessUrl}';
    const R = await loadImmuneRegistries(nodeFetcher());
    const frame = frame1(R, GOOD).frame;
    const g = new ImmuneContributionGuard(new ImmuneContributionLedger());
    g.apply({ targetMetric:'cd8_activation', sourceMetric:'suppression', sourceModule:'suppression', value:0.3, frameIndex:2 });
    g.apply({ targetMetric:'cd8_activation', sourceMetric:'suppression', sourceModule:'suppression', value:0.3, frameIndex:2 });
    process.stdout.write(JSON.stringify({ frameContentId: contentId(frame), exclusions: g.getExclusions().map(e=>e.exclusionId) }));
  `;
  const runChild = () => execFileSync(process.execPath, ['--input-type=module', '-e', childScript], { encoding: 'utf8' });
  const outA = runChild(); const outB = runChild();
  eq(outA, outB, 'CROSS-PROCESS: two fresh Node processes produce identical frame content id + exclusion ids');
  ok(JSON.parse(outA).exclusions.every((id) => /^imx_f2_[0-9a-f]{8}$/.test(id)), 'CROSS-PROCESS: exclusion ids are content-derived in a clean process');

  // =========================================================================
  // Immutability: published frame ids/payloads cannot be mutated
  // =========================================================================
  ok(Object.isFrozen(f1) && Object.isFrozen(f1.metadata), 'IMMUTABILITY: published frame + metadata are frozen');
  const before = f1.frameId; try { f1.frameId = 'MUT'; } catch { /* strict throw ok */ } eq(f1.frameId, before, 'IMMUTABILITY: frame id cannot be mutated after publication');

  // =========================================================================
  // Behaviour preservation: identity repair did not change biology
  // =========================================================================
  eq(frame1(R, GOOD).frame.metadata.exclusionCount, 0, 'BEHAVIOUR: normal production runs still emit 0 exclusions (biology unchanged)');
  eq(stableStringify(frame1(R, GOOD).net), stableStringify(frame1(R, GOOD).net), 'BEHAVIOUR: net integration values are deterministic + unchanged');

  // =========================================================================
  // Static regression guards: no module-global ID counters / RNG / wall-clock in identity paths
  // =========================================================================
  const idFiles = ['immuneDoubleCounting.js', 'immuneEvidencePrediction.js', 'immuneTransitions.js', 'immuneTransitionPopulator.js', 'immuneSerialization.js', 'immuneObjects.js'];
  for (const f of idFiles) {
    const src = readFileSync(resolve(REPO_ROOT, 'simulator/src/biology', f), 'utf8');
    ok(!/^\s*let\s+_\w+\s*=\s*0\s*;/m.test(src), `STATIC GUARD: ${f} has no module-global mutable ID counter`);
    ok(!/Math\.random|Date\.now|performance\.now|randomUUID|process\.hrtime/.test(src), `STATIC GUARD: ${f} uses no RNG/wall-clock in identity code`);
  }
}
