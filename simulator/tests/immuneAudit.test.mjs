// Phase-7C Part 2 Section 2 Part 1 DIAGNOSTIC tests (read-only audit). These assert the audit FINDINGS
// against the real production modules so the gap register is evidence-backed and stays true until Part 2
// repairs it. They change no biology and fabricate nothing: they document the current truth (e.g. that
// production frames contain 0 transition records even when states cross boundaries). Full validation
// expansion belongs to Parts 3 and 4.

import { section, ok, eq, nodeFetcher, REPO_ROOT } from './harness.mjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { ImmuneMicroenvironmentEngine } from '../src/biology/immuneMicroenvironmentEngine.js';
import { ImmuneAdaptiveEngine } from '../src/biology/immuneAdaptiveEngine.js';
import { buildExtendedImmuneResistanceContext } from '../src/biology/immuneResistanceAdapter.js';
import { validateSerializable, stableStringify, contentId } from '../src/biology/immuneSerialization.js';

export default async function run() {
  section('immune audit diagnostics (Phase 7C - Part 2 Section 2 Part 1)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await loader.load(f, 'generic');
  const A = (v) => ({ value: v, availability: 'AVAILABLE' });

  // --- Section 3 absence: innate-derived inputs are UNAVAILABLE (never zero) ---
  const bare = new ImmuneAdaptiveEngine({ registries: R }).evaluate({ explicitInputs: { tumor_immune_visibility: A(0.6) }, frameIndex: 0 });
  ok(bare.frame.metadata.innateAvailable === false, 'AUDIT: Section 3 innate absent in production (innateAvailable=false)');
  ok(bare.context.inputs.macrophage_contribution.value === null && bare.context.inputs.macrophage_contribution.availability === 'UNAVAILABLE', 'AUDIT: innate input UNAVAILABLE with value:null (NOT zero)');

  // --- TRANSITION TRUTH TEST: production states cross boundaries but 0 transition records (G2) ---
  const eng = new ImmuneAdaptiveEngine({ registries: R });
  const states = new Set(); let totalTransitions = 0;
  for (let i = 0; i < 8; i++) {
    const vis = Math.min(0.95, 0.2 + i * 0.1);
    const r = eng.evaluate({ explicitInputs: { tumor_immune_visibility: A(vis), antigen_availability: A(vis), antigen_presentation_potential: A(vis), adaptive_priming_potential: A(vis), dendritic_contribution: A(vis), immune_accessibility: A(0.6), vascular_access: A(0.6), vascular_functionality: A(0.6) }, innateContribution: { readiness: A(0.5), tumorPressure: A(0.4), nk: A(0.4), macrophage: A(0.35), adaptivePrimingPotential: A(vis) }, frameIndex: i });
    states.add(r.cd8.priming.state); totalTransitions += (r.frame.transitionRecords || []).length;
  }
  ok(states.size >= 3, `AUDIT: production CD8 priming crosses multiple states (${states.size} distinct)`);
  eq(totalTransitions, 0, 'AUDIT (G2): production runtime emits 0 transition records despite crossing states -> transitions IMPLEMENTED_BUT_UNWIRED');

  // --- Frame producers: single canonical builder, divergent nested domain-state shapes (G3) ---
  const f4 = eng.getPublishedFrame();
  const s1 = new ImmuneMicroenvironmentEngine({ registries: R, species: 'mouse' }); const f1 = s1.frame();
  eq(Object.keys(f1).length, Object.keys(f4).length, 'AUDIT: both engines produce same top-level frame key count (one canonical builder)');
  ok('escapePressure' in (f1.immuneEscape || {}) && 'magnitudeState' in (f4.immuneEscape || {}), 'AUDIT (G3): immuneEscape nested shape DIVERGES between S1 and S4 producers');
  ok(f1.schemaVersion === f4.schemaVersion, 'AUDIT: both producers share schema version');

  // --- serialization + replay no-recalculation ---
  ok(validateSerializable(f4).ok, 'AUDIT: production frame serializes');
  eq(stableStringify(f4), stableStringify(JSON.parse(stableStringify(f4))), 'AUDIT: production frame round-trip stable');
  const idA = contentId(f4); const idB = contentId(JSON.parse(stableStringify(f4)));
  eq(idA, idB, 'AUDIT: replay deserialization reproduces an equivalent frame (no recalculation)');

  // --- prediction / evidence references resolve; static (not lifecycle) ---
  const pr = (f4.predictionRecords || [])[0]; const ev = (f4.evidenceRecords || [])[0];
  ok(pr && R.prediction.prediction_records[pr.prediction_id], 'AUDIT: frame prediction reference resolves in registry');
  ok(ev && R.evidence.evidence_records[ev.id], 'AUDIT: frame evidence reference resolves in registry');

  // --- Phase 8A source mapping: available with biology, fallback-preserving without ---
  const ctxAvail = buildExtendedImmuneResistanceContext(eng.getResistanceReadiness());
  ok(ctxAvail.available === true && ctxAvail.causalGroups, 'AUDIT: 8A context available (+ causal groups) when biology present');
  const ctxBare = buildExtendedImmuneResistanceContext(new ImmuneAdaptiveEngine({ registries: R }).evaluate({ frameIndex: 0 }).resistanceReadiness);
  ok(ctxBare.available === false, 'AUDIT: 8A context available=false when biology unavailable (Phase 8A fallback preserved)');

  // --- audit artifacts exist + valid JSON ---
  const artifacts = ['phase7c-audit', 'phase7c-gap-register', 'phase7c-contract-matrix', 'phase7c-frame-producer-matrix', 'phase7c-test-reality-matrix'];
  for (const a of artifacts) {
    let parsed = null; try { parsed = JSON.parse(await readFile(resolve(REPO_ROOT, 'simulator', 'audit', `${a}.json`), 'utf8')); } catch { /* handled below */ }
    ok(parsed && parsed.artifact === a, `AUDIT: artifact ${a}.json present + valid JSON`);
  }
}
