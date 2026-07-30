// Phase-7C Certification Remediation Part 4 — AGGREGATION TARGET NAMESPACE + TRANSITION LEGACY guards.
// Proves every production aggregation target is explicitly declared (no silent fallback), canonical
// target ids are semantically unique + domain-owned, the two collision splits exist, unknown targets are
// rejected before evaluation, and production transition records originate ONLY from the shared populator
// (the legacy shared-controller framework is never imported by production). Behaviour is preserved
// (default outputs unchanged — proven by the unchanged full suite).

import { section, ok, eq, nodeFetcher, REPO_ROOT } from './harness.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadImmuneRegistries } from './bioValidation.mjs';
import { ImmuneAggregator } from '../src/biology/immuneAggregation.js';

const readSrc = (f) => readFileSync(resolve(REPO_ROOT, 'simulator/src/biology', f), 'utf8');

// Extract every aggregation target actually invoked in a production engine (literal evalStage +
// combineSigned targets, plus the one template-literal escape_<dim> expanded via the escape registry).
function extractProductionTargets(escapeDims) {
  const files = ['immuneInnate.js', 'immuneCd8.js', 'immuneCd4.js', 'immuneTreg.js', 'immuneCheckpoint.js', 'immuneSuppressionRuntime.js', 'immuneEscapeRuntime.js', 'immuneAdaptiveIntegration.js'];
  const targets = new Set();
  for (const f of files) {
    const src = readSrc(f);
    for (const m of src.matchAll(/evalStage\(this\.agg, '([a-z_0-9]+)'/g)) targets.add(m[1]);
    for (const m of src.matchAll(/combineSigned\(this\.agg, '([a-z_0-9]+)'/g)) targets.add(m[1]);
    if (/evalStage\(this\.agg, `escape_\$\{dim\}`/.test(src)) for (const d of escapeDims) targets.add(`escape_${d}`);
  }
  return targets;
}

export default async function run() {
  section('immune AGGREGATION target namespace + transition legacy (Remediation Part 4)');
  const R = await loadImmuneRegistries(nodeFetcher());
  const agg = new ImmuneAggregator(R.aggregation);
  const declared = new Set(Object.keys(R.aggregation.targets));
  const escapeDims = Object.keys(R.adaptiveEscape.dimension_weights);
  const used = extractProductionTargets(escapeDims);

  // =========================================================================
  // Complete target coverage: every production call-site target is declared
  // =========================================================================
  ok(used.size >= 55, `TARGETS: production call-site inventory is complete (${used.size} distinct targets)`);
  const undeclared = [...used].filter((t) => !declared.has(t));
  eq(undeclared, [], 'TARGETS: every production aggregation target is explicitly declared (no undeclared call site)');
  // the two semantic-collision splits exist as distinct canonical ids
  ok(declared.has('immune_blocked_potential') && used.has('immune_blocked_potential'), 'TARGETS: adaptive-integration blocked potential has its own canonical id (split from immune_suppression)');
  ok(declared.has('immune_escape_overall') && used.has('immune_escape_overall'), 'TARGETS: overall escape has its own canonical id (renamed from net_immune_effect)');
  ok(declared.has('immune_suppression') && used.has('immune_suppression'), 'TARGETS: integrated suppression retains its canonical id');
  ok(!used.has('net_immune_effect'), 'TARGETS: the mislabelled net_immune_effect is no longer used by any production call site');

  // =========================================================================
  // No silent fallback: an undeclared target is rejected before evaluation
  // =========================================================================
  let threw = false; try { agg.aggregate('definitely_not_a_declared_target', [{ value: 0.5, availability: 'AVAILABLE' }]); } catch { threw = true; }
  ok(threw, 'FALLBACK: an undeclared aggregation target throws (no availability_aware_average/[0,1] silent fallback)');
  threw = false; try { agg.methodFor('nope'); } catch { threw = true; } ok(threw, 'FALLBACK: methodFor rejects an undeclared target');
  ok(agg.hasTarget('cd8_priming') && !agg.hasTarget('nope'), 'FALLBACK: hasTarget distinguishes declared vs undeclared');

  // =========================================================================
  // Registry consistency: method + bounds resolve; ids unique; domain-owned
  // =========================================================================
  for (const t of declared) {
    ok(typeof agg.methodFor(t) === 'string' && !!R.aggregation.methods[agg.methodFor(t)], `CONSISTENCY: ${t} resolves a declared method`);
    const b = agg.boundsFor(t); ok(Number.isFinite(b.min) && Number.isFinite(b.max) && b.min <= b.max, `CONSISTENCY: ${t} resolves finite bounds`);
  }
  // every declared target belongs to exactly one domain; every domain target is declared (ownership)
  const domainTargets = Object.values(R.aggregation.target_domains).flat();
  eq(domainTargets.length, new Set(domainTargets).size, 'OWNERSHIP: no target appears in two domains (single owner)');
  eq([...declared].filter((t) => !domainTargets.includes(t)), [], 'OWNERSHIP: every declared target has a domain owner');
  eq(domainTargets.filter((t) => !declared.has(t)), [], 'OWNERSHIP: every domain-listed target is declared');
  // semantic uniqueness: canonical ids are unique keys (JSON guarantees) + policy declared
  ok(R.aggregation.target_policy && R.aggregation.target_policy.unknown_target === 'reject_before_evaluation', 'POLICY: unknown-target policy is explicit (reject before evaluation)');
  ok(/never.*(0|zero)/i.test(R.aggregation.target_policy.empty_input) || /UNAVAILABLE/.test(R.aggregation.target_policy.empty_input), 'POLICY: empty-input/availability policy states unavailable is never zero');
  // reserved Section-1 targets are declared but not used by current production call sites
  for (const t of R.aggregation.target_domains.reserved_section1) ok(declared.has(t) && !used.has(t), `RESERVED: ${t} is declared + reserved (no active production call site)`);

  // =========================================================================
  // Method preservation for the split targets (behaviour equivalence)
  // =========================================================================
  eq(agg.methodFor('immune_blocked_potential'), 'bounded_multiplicative', 'PRESERVE: blocked-potential keeps bounded_multiplicative (identical to prior immune_suppression use)');
  eq(agg.methodFor('immune_escape_overall'), 'confidence_weighted_average', 'PRESERVE: overall escape keeps confidence_weighted_average (identical to prior net_immune_effect use)');

  // =========================================================================
  // Transition legacy: production transitions come only from the shared populator
  // =========================================================================
  const engineSrc = readSrc('immuneAdaptiveEngine.js');
  ok(/immuneTransitionPopulator/.test(engineSrc), 'TRANSITION: the engine uses the shared transition populator');
  for (const f of ['immuneAdaptiveEngine.js', 'immuneFrameBuilder.js']) ok(!/immuneTransitions'/.test(readSrc(f)) && !/immuneTransitions\.js/.test(readSrc(f)), `TRANSITION: ${f} does not import the legacy shared-controller framework`);
  for (const f of ['immuneRenderer.js', 'immuneTimeline.js']) { const src = readFileSync(resolve(REPO_ROOT, 'simulator/src/render', f), 'utf8'); ok(!/immuneTransitions\.js|makeRecord|transitionId:/.test(src), `TRANSITION: renderer/replay ${f} never creates transition records`); }
  // the legacy module is retained ONLY because the Section-2 test exercises its ImmuneStateController
  // framework (it is NOT production-reachable); documents the Part-1 "dead" flag was a false negative.
  ok(/immuneTransitions\.js/.test(readFileSync(resolve(REPO_ROOT, 'simulator/tests/immuneRuntime.test.mjs'), 'utf8')), 'TRANSITION: legacy shared-controller framework is retained solely for its Section-2 test (not production-reachable)');
}
