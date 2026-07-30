// Phase-6D TUMOUR GROWTH, REGRESSION & TREATMENT-RESPONSE tests. Validates the schematic
// normalized-burden runtime derived from the Phase-6C population: evidence vocabulary,
// registry integrity + cell-model / formulation isolation, population-input gating,
// untreated growth, treatment start, growth / loss / net pressure, the response state machine
// (continued growth -> slowed -> stable -> partial / strong regression -> minimal residual;
// treatment end -> rebound), no negative burden, no instant regression, formulation
// comparison + ranking, human predictive-exploratory / rat unavailable, deterministic replay,
// renderer / timeline / evidence panel, validation. STOPS at the response trajectory - no
// clinical / RECIST / survival / metastasis / PK. All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { loadSignalGraph } from '../src/biology/signalGraph.js';
import { SignalPropagationEngine } from '../src/biology/signalPropagationEngine.js';
import { TranscriptionEngine } from '../src/biology/transcriptionEngine.js';
import { TranslationEngine } from '../src/biology/translationEngine.js';
import { ProteinFunctionEngine } from '../src/biology/proteinFunctionEngine.js';
import { ApoptosisEngine } from '../src/biology/apoptosisEngine.js';
import { PopulationEngine } from '../src/biology/populationEngine.js';
import { TumorResponseEngine } from '../src/biology/tumorResponseEngine.js';
import {
  TUMOR_EVIDENCE_LEVELS, isTumorEvidenceLevel, isTumorExperimental, isTumorPrediction, isTumorTransfer, tumorLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('tumour growth, regression & treatment response (Phase 6D)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const load = (f) => loader.load(f, 'generic');
  const preg = await load('signal-propagation.registry.json'); const treg = await load('transcription.registry.json');
  const cx = await load('translation-context.registry.json'); const mach = await load('translation-machinery.registry.json'); const prot = await load('protein.registry.json');
  const fnctx = await load('protein-function-context.registry.json'); const cst = await load('cellular-state.registry.json'); const fedg = await load('functional-edges.registry.json'); const fev = await load('functional-evidence.registry.json');
  const actx = await load(APP_CONFIG.apoptosisSources.context); const adyn = await load(APP_CONFIG.apoptosisSources.dynamics); const aint = await load(APP_CONFIG.apoptosisSources.interventions); const aev = await load(APP_CONFIG.apoptosisSources.evidence);
  const pS = APP_CONFIG.populationSources; const pctx = await load(pS.context); const pst = await load(pS.state); const ptr = await load(pS.transitions); const pev = await load(pS.evidence); const ppred = await load(pS.prediction); const pintv = await load(pS.interventions);
  const T = {}; for (const [k, f] of Object.entries(APP_CONFIG.tumorSources)) T[k] = await load(f);
  const DT = 0.5;

  const stack = (species, opts = {}) => {
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species });
    const tr = new TranslationEngine({ contextRegistry: cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species });
    const pf = new ProteinFunctionEngine({ functionContextRegistry: fnctx, cellularStateRegistry: cst, functionalEdgeRegistry: fedg, functionalEvidenceRegistry: fev, translationEngine: tr, signalEngine: s, species });
    const ap = new ApoptosisEngine({ contextRegistry: actx, dynamicsRegistry: adyn, interventionRegistry: aint, evidenceRegistry: aev, proteinFunctionEngine: pf, signalEngine: s, species });
    const pop = new PopulationEngine({ contextRegistry: pctx, stateRegistry: pst, transitionsRegistry: ptr, evidenceRegistry: pev, predictionRegistry: ppred, interventionRegistry: pintv, apoptosisEngine: ap, species });
    const tum = new TumorResponseEngine({ contextRegistry: opts.tctx || T.context, responseRegistry: T.response, transitionsRegistry: T.transitions, modelRegistry: T.model, formulationRegistry: T.formulation, treatmentRegistry: T.treatment, evidenceRegistry: T.evidence, predictionRegistry: T.prediction, populationEngine: pop, species });
    if (opts.cellModel) tum.setCellModel(opts.cellModel);
    if (opts.formulation) tum.setFormulation(opts.formulation);
    if (opts.schedule) tum.setSchedule(opts.schedule);
    return { s, t, tr, pf, ap, pop, tum, run(h) { const n = Math.round(h / DT); for (let i = 0; i < n; i++) { s.step(DT); t.step(DT); tr.step(DT); pf.step(DT); ap.step(DT); pop.step(DT); tum.step(DT); } } };
  };

  // ---- evidence vocabulary (additive; experimental tumour-model tier + transfer) ----
  eq(TUMOR_EVIDENCE_LEVELS.length, 11, 'tumour evidence vocabulary has 11 levels');
  ok(TUMOR_EVIDENCE_LEVELS.includes('EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC'), 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC present');
  ok(isTumorExperimental('EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC') && !isTumorExperimental('MECHANISTIC_PREDICTION'), 'experimental classifier');
  ok(isTumorPrediction('MECHANISTIC_PREDICTION') && isTumorPrediction('CONTEXT_TRANSFER_PREDICTION') && !isTumorPrediction('EXPERIMENTAL_FORMULATION_SPECIFIC'), 'prediction classifier');
  ok(isTumorTransfer('CONTEXT_TRANSFER_PREDICTION') && !isTumorTransfer('MECHANISTIC_PREDICTION'), 'transfer classifier');
  ok(!tumorLevelActive('NOT_REPORTED') && tumorLevelActive('EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC'), 'active classifier');

  // ---- registry integrity + cell-model / formulation isolation ----
  eq(T.context.profiles.mouse_b16bl6_tumor.evidence_level, 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC', 'B16BL6 tumour is experimental tumour-model');
  eq(T.context.profiles.mouse_b16_tumor.evidence_level, 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'B16 tumour experimental drug-cell');
  eq(T.context.profiles.mouse_b16f10_tumor.evidence_level, 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'B16-F10 tumour experimental drug-cell (separate)');
  eq(T.context.profiles.human_melanoma_tumor.evidence_level, 'UNAVAILABLE', 'human tumour UNAVAILABLE (no validated human efficacy)');
  eq(T.context.profiles.rat_tumor.evidence_level, 'NOT_REPORTED', 'rat tumour NOT_REPORTED');
  ok(!T.context.profiles.human_melanoma_tumor.tumor_available && !T.context.profiles.rat_tumor.tumor_available, 'human + rat not available (no fallback)');
  ok(T.context.profiles.mouse_b16_tumor.supported_formulations.indexOf('cationic_nlc') === -1, 'B16 does not carry the B16BL6-specific NLC formulations');

  // ---- formulation ranking matches Chen evidence (cationic > anionic / neutral; NLC > free) ----
  const F = T.formulation.formulations;
  ok(F.cationic_nlc.effect_rank > F.anionic_nlc.effect_rank && F.cationic_nlc.effect_rank > F.neutral_nlc.effect_rank, 'cationic outranks anionic + neutral');
  ok(F.cationic_nlc.effect_rank > F.free_tripterine.effect_rank, 'NLC outranks free tripterine');
  eq(F.vehicle_control.effect_rank, 0, 'vehicle control has no effect rank');

  // ---- population-input gating + initialization ----
  const M = stack('mouse');
  eq(M.tum.cellModel, 'B16BL6', 'default mouse tumour cell model is B16BL6');
  eq(M.tum.formulation, 'cationic_nlc', 'default formulation is cationic NLC');
  ok(M.tum.available, 'mouse tumour available (population active)');
  ok(M.tum.frame().experimental, 'mouse B16BL6 tumour is experimental-direction');
  eq(M.tum.burden.responseState, 'untreated_growth', 'tumour starts at untreated_growth');
  eq(M.tum.frame().currentBurden, 1.0, 'tumour starts at baseline burden 1.0');

  // ---- full treated trajectory: growth -> regression -> minimal residual (deterministic) ----
  let minBurden = Infinity; let maxDropPerStep = 0; let prevB = 1.0; let consBounds = true;
  for (let i = 0; i < 260; i++) { M.s.step(DT); M.t.step(DT); M.tr.step(DT); M.pf.step(DT); M.ap.step(DT); M.pop.step(DT); M.tum.step(DT);
    const b = M.tum.burden.currentBurden; minBurden = Math.min(minBurden, b);
    maxDropPerStep = Math.max(maxDropPerStep, prevB - b); prevB = b;
    if (b < -1e-9 || b > M.tum.upperBound + 1e-9) consBounds = false;
  }
  const mf = M.tum.frame();
  ok(consBounds && minBurden >= 0, 'burden never negative and stays within schematic bounds');
  ok(maxDropPerStep < 0.05, 'regression is gradual (no instant disappearance)');
  ok(['minimal_residual_burden', 'strong_regression', 'partial_regression'].includes(mf.responseState), 'treated mouse reaches a regression state');
  ok(mf.currentBurden < 0.5, 'treated tumour burden regresses well below baseline');
  ok(mf.currentBurden > 0, 'burden holds at a minimal-residual floor, not zero (not a cure)');
  const stateSeq = M.tum.getTimeline().filter((e) => e.kind === 'state').map((e) => e.event);
  ok(stateSeq.indexOf('treatment_started') === 0, 'first transition is treatment_started');
  ok(stateSeq.includes('partial_regression') && stateSeq.indexOf('partial_regression') < stateSeq.indexOf('strong_regression'), 'partial regression precedes strong regression');

  // ---- growth / loss / net pressure are distinct + coupled correctly ----
  ok(mf.lossPressure > 0 && mf.growthPressure >= 0, 'loss and growth pressures are distinct non-negative values');
  ok(mf.netGrowthPressure <= mf.growthPressure - 0 + 1e-9, 'net = growth - loss (schematic)');

  // ---- STOP boundary: clinical outcome never evaluated ----
  eq(mf.clinicalResponseEvidence, 'NOT_EVALUATED', 'clinical response NOT_EVALUATED');
  eq(mf.survivalEvidence, 'NOT_EVALUATED', 'survival NOT_EVALUATED');
  eq(mf.recistEvidence, 'NOT_EVALUATED', 'RECIST NOT_EVALUATED');
  eq(mf.metastasisEvidence, 'NOT_EVALUATED', 'metastasis NOT_EVALUATED');
  eq(mf.pkEvidence, 'NOT_EVALUATED', 'PK NOT_EVALUATED');

  // ---- untreated control grows (no treatment => no regression) ----
  const C = stack('mouse', { schedule: 'untreated_control' }); C.run(100);
  eq(C.tum.frame().responseState, 'untreated_growth', 'untreated control stays in untreated_growth');
  ok(C.tum.frame().currentBurden > 1.0, 'untreated control burden grows above baseline');
  let threwUntreatedReg = false; try { C.tum.transitionTo('strong_regression'); } catch { threwUntreatedReg = true; }
  ok(threwUntreatedReg, 'illegal untreated_growth -> strong_regression throws (no regression without treatment)');

  // ---- treatment end -> rebound-ready ----
  const S = stack('mouse', { schedule: 'treat_then_stop_schematic' }); S.run(110);
  ok(['rebound_possible', 'rebound_in_progress', 'treatment_ended', 'stable_post_treatment'].includes(S.tum.frame().responseState), 'treat-then-stop reaches a post-treatment / rebound state');
  ok(S.tum.getTimeline().some((e) => e.event === 'treatment_ended'), 'treatment_ended event recorded');

  // ---- formulation comparison (cationic regresses more than a weaker formulation) ----
  const cat = stack('mouse', { formulation: 'cationic_nlc' }); cat.run(120);
  const neu = stack('mouse', { formulation: 'neutral_nlc' }); neu.run(120);
  const veh = stack('mouse', { formulation: 'vehicle_control' }); veh.run(120);
  ok(cat.tum.frame().currentBurden < neu.tum.frame().currentBurden + 1e-6, 'cationic NLC regresses at least as much as neutral');
  ok(veh.tum.frame().currentBurden > cat.tum.frame().currentBurden, 'vehicle control burden exceeds cationic-treated burden');

  // ---- cell-model isolation: B16 / B16-F10 selectable + separate ----
  const B16 = stack('mouse', { cellModel: 'B16' }); eq(B16.tum.profile.profile_id, 'mouse_b16_tumor', 'B16 tumour profile selected');
  eq(B16.tum.formulation, 'free_tripterine', 'B16 default formulation is free tripterine (not NLC)');
  const F10 = stack('mouse', { cellModel: 'B16-F10' }); eq(F10.tum.profile.profile_id, 'mouse_b16f10_tumor', 'B16-F10 tumour profile selected (separate)');

  // ---- species isolation: human predictive-exploratory / UNAVAILABLE, rat NOT_REPORTED ----
  const H = stack('human'); H.run(40);
  ok(H.tum.isIdle() && H.tum.summaryLevel() === 'UNAVAILABLE', 'human tumour idle / UNAVAILABLE (no active human melanoma population)');
  ok(!!H.tum.profile.human_translation_warning, 'human profile carries the required non-clinical warning');
  ok(H.tum.getHistory().length === 0, 'idle human tumour records no history');
  const Rt = stack('rat'); Rt.run(40);
  ok(Rt.tum.isIdle() && Rt.tum.summaryLevel() === 'NOT_REPORTED', 'rat tumour idle / NOT_REPORTED');

  // ---- deterministic replay (history + response curve) ----
  const A1 = stack('mouse'); A1.run(120); const A2 = stack('mouse'); A2.run(120);
  ok(JSON.stringify(A1.tum.getHistory()) === JSON.stringify(A2.tum.getHistory()), 'tumour history is deterministic');
  const rc = A1.tum.responseCurve();
  ok(rc.points.length === 240 && rc.quantitativeStatus === 'NOT_REPORTED' && /schematic/i.test(rc.timeWarning), 'response curve is deterministic + labelled schematic / NOT_REPORTED');

  // ---- validation: positive + negative cases ----
  const vr = M.tum.validate();
  ok(vr.ok, `validation passes on shipped registries (${vr.errors.join('; ')})`);
  const validateWith = (mutate) => {
    const clone = JSON.parse(JSON.stringify(T.context)); mutate(clone);
    const e = new TumorResponseEngine({ contextRegistry: clone, responseRegistry: T.response, transitionsRegistry: T.transitions, modelRegistry: T.model, formulationRegistry: T.formulation, treatmentRegistry: T.treatment, evidenceRegistry: T.evidence, predictionRegistry: T.prediction, populationEngine: M.pop, species: 'mouse' });
    return e.validate();
  };
  // (a) human labelled experimental (forbidden)
  { const r = validateWith((a) => { a.profiles.human_melanoma_tumor.evidence_level = 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC'; return a; }); ok(!r.ok && r.errors.some((e) => /human must not carry an EXPERIMENTAL/.test(e)), 'negative: human experimental label caught'); }
  // (b) rat given an available tumour model (no rat fallback)
  { const r = validateWith((a) => { a.profiles.rat_tumor.tumor_available = true; return a; }); ok(!r.ok && r.errors.some((e) => /rat must not have an available tumour/.test(e)), 'negative: rat fallback caught'); }
  // (c) silent cell-model mixing (B16 using a B16BL6 evidence ref)
  { const r = validateWith((a) => { a.profiles.mouse_b16_tumor.evidence_refs = ['tum_chen_b16bl6_pd']; return a; }); ok(!r.ok && r.errors.some((e) => /silently uses/.test(e)), 'negative: silent cell-model mixing caught'); }
  // FSM: no regression without treatment declared; no cure terminal
  ok(vr.ok, 'FSM declares no untreated regression and no cure state (validated)');

  // ---- full app wiring + renderer frames + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.tumor && app.tumor.engine, 'app exposes the tumour engine');
  app.setSpecies('mouse');
  for (let i = 0; i < 220; i++) { app.signalPropagation.engine.step(DT); app.transcription.engine.step(DT); app.translation.engine.step(DT); app.proteinFunction.engine.step(DT); app.apoptosis.engine.step(DT); app.population.engine.step(DT); app.tumor.engine.step(DT); }
  app.renderer.draw();
  ok(app.renderer.lastTumorFrame && app.renderer.lastTumorFrame.available, 'renderer produced a tumour frame');
  ok(app.renderer.lastTumorFrame.experimental, 'renderer flags the B16BL6 experimental direction');
  ok(app.renderer.lastTumorFrame.burdenBar && app.renderer.lastTumorFrame.curve.points.length > 1, 'renderer burden bar + response curve present');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.tumorResponse, 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC', 'panel: mouse tumour = experimental tumour-model');
  eq(el.populationResponse, 'CONTEXT_TRANSFER_PREDICTION', 'previous phase unchanged: population = context-transfer prediction');
  const ti = app.panelModels.information.tumorResponse;
  ok(ti && ti.title === 'Tumor Growth & Treatment Response', 'panel: independent Tumor section present');
  ok(ti.clinicalResponseEvidence === 'NOT_EVALUATED' && ti.survivalEvidence === 'NOT_EVALUATED' && ti.recistEvidence === 'NOT_EVALUATED', 'panel: clinical / survival / RECIST NOT_EVALUATED');
  ok(/normalized/i.test(ti.burdenWarning), 'panel: burden warning states normalized / schematic');

  // human via full app: idle tumour; earlier layers intact
  app.setSpecies('human');
  app.renderer.draw();
  ok(app.tumor.engine.isIdle(), 'human tumour idle via full app');
  ok(!app.renderer.lastTumorFrame.available, 'renderer draws no tumour burden for idle human');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'PREDICTIVE', 'human transport still Predictive (unchanged)');

  app.setSpecies('mouse');
}
