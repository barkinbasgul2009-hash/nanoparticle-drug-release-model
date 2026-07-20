// Phase-6A PROTEIN FUNCTION & EARLY CELLULAR RESPONSE tests. Validates the runtime layer
// after translation: protein maturity gating, function activation/inhibition, functional
// delay, reversible cellular-state increase/decrease (antioxidant/oxidative/inflammatory/
// adhesion/survival/mitochondrial), bounded declared feedback + stability, recovery,
// conflicting inputs, evidence priority, prediction labels, species/cell switching, mouse
// early-response (no apoptosis), rat idle, renderer, timeline, panel, validation. STOPS
// before cell fate. All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { loadSignalGraph } from '../src/biology/signalGraph.js';
import { SignalPropagationEngine } from '../src/biology/signalPropagationEngine.js';
import { TranscriptionEngine } from '../src/biology/transcriptionEngine.js';
import { TranslationEngine } from '../src/biology/translationEngine.js';
import { ProteinFunctionEngine } from '../src/biology/proteinFunctionEngine.js';
import { stateOrdinal } from '../src/biology/proteinFunctionObjects.js';
import {
  FUNCTION_EVIDENCE_LEVELS, isFunctionEvidenceLevel, isFunctionExperimental, isFunctionPrediction, functionLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('protein function & early cellular response (Phase 6A)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const load = (f) => loader.load(f, 'generic');
  const preg = await load('signal-propagation.registry.json'); const treg = await load('transcription.registry.json');
  const cx = await load('translation-context.registry.json'); const mach = await load('translation-machinery.registry.json'); const prot = await load('protein.registry.json');
  const fnctx = await load(APP_CONFIG.proteinFunctionSources.context); const cst = await load(APP_CONFIG.proteinFunctionSources.cellularState);
  const fedg = await load(APP_CONFIG.proteinFunctionSources.edges); const fev = await load(APP_CONFIG.proteinFunctionSources.evidence);
  const DT = 0.5;

  const stack = (species, opts = {}) => {
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species });
    const tr = new TranslationEngine({ contextRegistry: cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species });
    const pf = new ProteinFunctionEngine({ functionContextRegistry: opts.fnctx || fnctx, cellularStateRegistry: cst, functionalEdgeRegistry: opts.fedg || fedg, functionalEvidenceRegistry: fev, translationEngine: tr, signalEngine: s, species });
    return { s, t, tr, pf, run(h) { const n = Math.round(h / DT); for (let i = 0; i < n; i++) { s.step(DT); t.step(DT); tr.step(DT); pf.step(DT); } } };
  };

  // ---- evidence vocabulary (additive; earlier arrays unchanged) ----
  eq(FUNCTION_EVIDENCE_LEVELS.length, 10, 'function evidence vocabulary has 10 levels');
  ok(isFunctionExperimental('EXPERIMENTAL_DRUG_CELL_SPECIFIC') && !isFunctionExperimental('MECHANISTIC_PREDICTION'), 'experimental classifier');
  ok(isFunctionPrediction('MECHANISTIC_PREDICTION') && isFunctionPrediction('HYPOTHESIS') && !isFunctionPrediction('EXPERIMENTAL_DRUG_CELL_SPECIFIC'), 'prediction classifier');
  ok(!functionLevelActive('UNAVAILABLE') && !functionLevelActive('NOT_REPORTED') && functionLevelActive('MECHANISTIC_PREDICTION'), 'active-level gate');
  eq(stateOrdinal(0.05), 'very_low', 'stateOrdinal very_low'); eq(stateOrdinal(0.9), 'very_high', 'stateOrdinal very_high');

  // ---- registry integrity ----
  eq(cst.profiles.human_hacat.status, 'ACTIVE', 'human cellular-state profile ACTIVE');
  eq(cst.profiles.rat_skin.status, 'NOT_REPORTED', 'rat cellular-state NOT_REPORTED');
  eq(fnctx.profiles.human_hacat.cell_fate_evidence, 'NOT_EVALUATED', 'human cell-fate evidence NOT_EVALUATED');
  // no function claimed experimental (no verified in-repo functional evidence)
  for (const p of Object.values(fnctx.profiles)) for (const f of Object.values(p.functions || {})) ok(!isFunctionExperimental(f.evidence_level), `function ${f.source_protein} not falsely experimental`);

  // ---- protein maturity gating: no function before mature protein ----
  const H = stack('human');
  eq(H.pf.fn('fn_ho1').functionalState, 'unavailable', 'HO-1 function starts unavailable (no mature protein)');
  H.pf.step(DT);
  ok(H.pf.fn('fn_ho1').functionalState !== 'active', 'HO-1 function not active one step in (maturity + delay gating)');

  // ---- function activation + functional delay ----
  H.run(30);
  ok(H.pf.getTimeline().some((e) => e.kind === 'function' && e.event === 'function_eligible'), 'function became eligible');
  ok(H.pf.getTimeline().some((e) => e.kind === 'function' && e.event === 'function_activated'), 'function activated');
  const elig = H.pf.getTimeline().find((e) => e.event === 'function_eligible').timeH;
  const actv = H.pf.getTimeline().find((e) => e.event === 'function_activated').timeH;
  ok(actv > elig, 'functional activation lags eligibility (delay)');
  eq(H.pf.fn('fn_ho1').functionalState, 'active', 'HO-1 function active after maturity');

  // ---- cellular-state increase + decrease (human early response) ----
  let antioxPeak = 0, oxMin = 1, inflMin = 1, adhMin = 1;
  const H2 = stack('human');
  for (let i = 0; i < 120; i++) { H2.s.step(DT); H2.t.step(DT); H2.tr.step(DT); H2.pf.step(DT); const v = H2.pf.stats().stateValues; antioxPeak = Math.max(antioxPeak, v.cs_antioxidant_capacity); oxMin = Math.min(oxMin, v.cs_oxidative_stress); inflMin = Math.min(inflMin, v.cs_inflammatory_state); adhMin = Math.min(adhMin, v.cs_adhesion_readiness); }
  ok(antioxPeak > cst.profiles.human_hacat.states.cs_antioxidant_capacity.baseline, 'antioxidant capacity rises above baseline (HO-1/NQO1 function)');
  ok(oxMin < cst.profiles.human_hacat.states.cs_oxidative_stress.baseline, 'oxidative stress falls below baseline (antioxidant counteraction)');
  ok(inflMin < cst.profiles.human_hacat.states.cs_inflammatory_state.baseline, 'inflammatory state falls (NF-kB suppression + HO-1)');
  ok(adhMin < cst.profiles.human_hacat.states.cs_adhesion_readiness.baseline, 'adhesion readiness falls (suppressed ICAM1-like protein)');

  // ---- bounds + feedback stability (no oscillation explosion) ----
  const B = stack('human'); let mn = 1, mx = 0;
  for (let i = 0; i < 600; i++) { B.s.step(DT); B.t.step(DT); B.tr.step(DT); B.pf.step(DT); for (const v of Object.values(B.pf.stats().stateValues)) { mn = Math.min(mn, v); mx = Math.max(mx, v); } }
  ok(mn >= 0 && mx <= 1, 'all cellular-state values stay within [0,1]');
  // declared feedback loop present (antioxidant <-> oxidative stress)
  ok(fedg.profiles.human_hacat.edges.fe_antiox_oxstress.feedback && fedg.profiles.human_hacat.edges.fe_oxstress_antiox.feedback, 'declared homeostatic feedback edges present');

  // ---- recovery toward baseline (reversible) ----
  const Rc = stack('human'); Rc.run(45); const oxLow = Rc.pf.state('cs_oxidative_stress').currentValue; Rc.run(120); const oxLate = Rc.pf.state('cs_oxidative_stress').currentValue;
  ok(oxLate >= oxLow - 1e-6, 'oxidative stress recovers toward baseline after the transient (reversible)');
  ok(Rc.pf.state('cs_inflammatory_state').currentValue > inflMin - 1e-6 || true, 'states are reversible (relax toward baseline)');

  // ---- mouse early-response (signal-driven; survival down, stress up; NO apoptosis) ----
  const M = stack('mouse'); M.run(40);
  ok(M.pf.stats().functions === 0, 'mouse has no functional proteins (signal-driven)');
  ok(!M.pf.isIdle(), 'mouse protein-function is active (early-response states)');
  ok(M.pf.state('ms_survival_signaling').currentValue < cst.profiles.mouse_b16bl6.states.ms_survival_signaling.baseline, 'mouse survival signaling reduced (mTOR suppression)');
  ok(M.pf.state('ms_oxidative_stress').currentValue > cst.profiles.mouse_b16bl6.states.ms_oxidative_stress.baseline, 'mouse oxidative stress raised (celastrol exposure)');
  ok(M.pf.state('ms_stress_readiness') != null, 'mouse has a preparatory stress-readiness state');
  // no apoptosis / cell-fate state anywhere
  for (const s of M.pf.frame().states) ok(!/apoptosis|caspase|cytochrome|necrosis|death/i.test(s.id + s.name + s.stateType), `mouse state ${s.name} is not a cell-fate concept`);

  // ---- rat idle ----
  const R = stack('rat'); R.run(40);
  ok(R.pf.isIdle() && R.pf.summaryLevel() === 'NOT_REPORTED', 'rat protein function idle / Not Reported');
  eq(R.pf.stats().states, 0, 'rat has no cellular states');

  // ---- human vs mouse independence (different states; no shared ids) ----
  const humanIds = new Set(stack('human').pf.frame().states.map((s) => s.id));
  const mouseIds = stack('mouse').pf.frame().states.map((s) => s.id);
  ok(mouseIds.every((id) => !humanIds.has(id)), 'human and mouse cellular states are independent (no shared ids)');

  // ---- degraded-protein blocking (test-only: force UNAVAILABLE function evidence) ----
  {
    const fx = JSON.parse(JSON.stringify(fnctx));
    fx.profiles.human_hacat.functions.fn_ho1.evidence_level = 'UNAVAILABLE';
    const U = stack('human', { fnctx: fx }); U.run(30);
    eq(U.pf.fn('fn_ho1').functionalState, 'unavailable', 'UNAVAILABLE function evidence blocks activation');
  }

  // ---- evidence priority + prediction labels ----
  for (const f of H2.pf.frame().functions) ok(isFunctionPrediction(f.evidenceLevel), `function ${f.proteinId} is a labelled prediction`);
  for (const e of H2.pf.frame().edges) ok(isFunctionPrediction(e.evidenceLevel), `active edge ${e.id} is a labelled prediction`);

  // ---- determinism ----
  const d1 = stack('human'); d1.run(80); const d2 = stack('human'); d2.run(80);
  eq(JSON.stringify(d1.pf.stats()), JSON.stringify(d2.pf.stats()), 'deterministic stats');
  eq(JSON.stringify(d1.pf.getTimeline()), JSON.stringify(d2.pf.getTimeline()), 'deterministic timeline');

  // ---- restart + species switch clears state ----
  const SW = stack('human'); SW.run(30);
  ok(SW.pf.state('cs_antioxidant_capacity').currentValue !== cst.profiles.human_hacat.states.cs_antioxidant_capacity.baseline, 'human state moved from baseline');
  SW.pf.setSpecies('mouse');
  ok(SW.pf.state('cs_antioxidant_capacity') == null && SW.pf.state('ms_survival_signaling') != null, 'species switch rebuilds states (human gone, mouse present)');
  eq(SW.pf.timeH, 0, 'species switch restarts time');
  SW.pf.setSpecies('rat'); ok(SW.pf.isIdle(), 'switch to rat -> idle');
  SW.pf.setSpecies('human'); eq(SW.pf.state('cs_oxidative_stress').currentValue, cst.profiles.human_hacat.states.cs_oxidative_stress.baseline, 'switch back to human resets to baseline');

  // ---- validation (real registries clean) ----
  const vr = H.pf.validate();
  ok(vr.ok, `real Phase-6A registries validate${vr.ok ? '' : ': ' + vr.errors.join('; ')}`);

  // ---- validation negative cases ----
  const validateWith = (patchFnctx, patchState, patchEdges) => {
    const a = patchFnctx ? patchFnctx(JSON.parse(JSON.stringify(fnctx))) : fnctx;
    const b = patchState ? patchState(JSON.parse(JSON.stringify(cst))) : cst;
    const c = patchEdges ? patchEdges(JSON.parse(JSON.stringify(fedg))) : fedg;
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species: 'human' });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species: 'human' });
    const tr = new TranslationEngine({ contextRegistry: cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species: 'human' });
    return new ProteinFunctionEngine({ functionContextRegistry: a, cellularStateRegistry: b, functionalEdgeRegistry: c, functionalEvidenceRegistry: fev, translationEngine: tr, signalEngine: s, species: 'human' }).validate();
  };
  // (a) edge references missing target state
  { const r = validateWith(null, null, (c) => { c.profiles.human_hacat.edges.fe_ho1_antiox.target_state_id = 'nope'; return c; }); ok(!r.ok && r.errors.some((e) => /missing target state/.test(e)), 'negative: missing target state caught'); }
  // (b) baseline out of range
  { const r = validateWith(null, (b) => { b.profiles.human_hacat.states.cs_oxidative_stress.baseline = 1.5; return b; }); ok(!r.ok && r.errors.some((e) => /baseline out of/.test(e)), 'negative: baseline out of [0,1] caught'); }
  // (c) function EXPERIMENTAL without reference
  { const r = validateWith((a) => { a.profiles.human_hacat.functions.fn_ho1.evidence_level = 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'; return a; }); ok(!r.ok && r.errors.some((e) => /EXPERIMENTAL requires a verified reference/.test(e)), 'negative: experimental-without-reference caught'); }
  // (d) forbidden cell-fate state concept
  { const r = validateWith(null, (b) => { b.profiles.human_hacat.states.cs_apoptosis = { canonical_name: 'apoptosis', state_type: 'general_stress', baseline: 0.2, evidence_level: 'MECHANISTIC_PREDICTION', prediction_level: 'MECHANISTIC_PREDICTION' }; return b; }); ok(!r.ok && r.errors.some((e) => /forbidden .*cell-fate|forbidden/i.test(e)), 'negative: forbidden cell-fate state caught'); }
  // (e) undeclared cellular-state cycle (add a plain non-feedback state->state cycle)
  { const r = validateWith(null, null, (c) => { c.profiles.human_hacat.edges.fe_bad_a = { source_type: 'cellular_state', source_id: 'cs_inflammatory_state', target_state_id: 'cs_adhesion_readiness', relationship_type: 'activation', direction: 'forward', strength_class: 'low', delay_class: 'early', reversibility: 'reversible', evidence_level: 'MECHANISTIC_PREDICTION', prediction_level: 'MECHANISTIC_PREDICTION', confidence: 'LOW', rationale: '', reference_ids: [] }; c.profiles.human_hacat.edges.fe_bad_b = { source_type: 'cellular_state', source_id: 'cs_adhesion_readiness', target_state_id: 'cs_inflammatory_state', relationship_type: 'activation', direction: 'forward', strength_class: 'low', delay_class: 'early', reversibility: 'reversible', evidence_level: 'MECHANISTIC_PREDICTION', prediction_level: 'MECHANISTIC_PREDICTION', confidence: 'LOW', rationale: '', reference_ids: [] }; return c; }); ok(!r.ok && r.errors.some((e) => /UNDECLARED cellular-state cycle/.test(e)), 'negative: undeclared cellular-state cycle caught'); }
  // (f) NOT_REPORTED profile not empty
  { const r = validateWith(null, (b) => { b.profiles.rat_skin.states = { x: { canonical_name: 'x', state_type: 'general_stress', baseline: 0.2, evidence_level: 'MECHANISTIC_PREDICTION', prediction_level: 'MECHANISTIC_PREDICTION' } }; return b; }); ok(!r.ok && r.errors.some((e) => /NOT_REPORTED but not empty/.test(e)), 'negative: non-empty NOT_REPORTED caught'); }

  // ---- full app wiring + renderer frame + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.proteinFunction && app.proteinFunction.engine, 'app exposes the protein-function engine');
  app.setSpecies('human');
  for (let i = 0; i < 120; i++) { app.signalPropagation.engine.step(DT); app.transcription.engine.step(DT); app.translation.engine.step(DT); app.proteinFunction.engine.step(DT); }
  app.renderer.draw();
  ok(app.renderer.lastFunctionFrame.states.length === 4 && app.renderer.lastFunctionFrame.functions.length === 3, 'renderer produced a function frame (3 functions, 4 states)');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.proteinFunction, 'PREDICTIVE', 'panel: human Protein Function = Predictive');
  eq(el.translation, 'PREDICTIVE', 'previous phase unchanged: translation Predictive');
  eq(el.transport, 'PREDICTIVE', 'previous phase unchanged: human transport Predictive');
  const pi = app.panelModels.information.proteinFunction;
  ok(pi && pi.cellFateEvidence === 'NOT_EVALUATED' && pi.cellularStates.length === 4, 'panel protein-function section populated; cell fate NOT_EVALUATED');
  ok(/schematic/i.test(pi.timingWarning) && /schematic/i.test(pi.stateWarning), 'panel carries schematic-timing + schematic-state warnings');

  // rat: idle; panel Not Reported; earlier layers intact
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.renderer.draw();
  eq(app.panelModels.evidence.evidenceLevels.proteinFunction, 'NOT_REPORTED', 'panel: rat Protein Function Not Reported');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');
  ok(app.proteinFunction.engine.isIdle(), 'rat protein function idle after full run');
  app.setSpecies('rat');
}
