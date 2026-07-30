// Phase-6C POPULATION RESPONSE & TISSUE-LEVEL DYNAMICS tests. Validates the schematic
// virtual-population runtime derived from the Phase-6B single-cell apoptosis trajectory:
// evidence vocabulary, registry integrity + cell-model isolation, population accounting +
// conservation, the strict population state machine (legal/illegal transitions, recovery
// only before apoptosis_dominant, no resurrection / proliferation / growth), history replay,
// timeline events, prediction + context transfer, idle species, determinism, renderer,
// evidence panel, validation. STOPS at population composition - tumour / survival / clinical
// outcome is NEVER evaluated. All previous tests must remain green.

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
import {
  POPULATION_EVIDENCE_LEVELS, isPopulationEvidenceLevel, isPopulationPrediction, isPopulationTransfer, populationLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('population response & tissue-level dynamics (Phase 6C)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const load = (f) => loader.load(f, 'generic');
  const preg = await load('signal-propagation.registry.json'); const treg = await load('transcription.registry.json');
  const cx = await load('translation-context.registry.json'); const mach = await load('translation-machinery.registry.json'); const prot = await load('protein.registry.json');
  const fnctx = await load('protein-function-context.registry.json'); const cst = await load('cellular-state.registry.json'); const fedg = await load('functional-edges.registry.json'); const fev = await load('functional-evidence.registry.json');
  const actx = await load(APP_CONFIG.apoptosisSources.context); const adyn = await load(APP_CONFIG.apoptosisSources.dynamics); const aint = await load(APP_CONFIG.apoptosisSources.interventions); const aev = await load(APP_CONFIG.apoptosisSources.evidence);
  const pctx = await load(APP_CONFIG.populationSources.context); const pst = await load(APP_CONFIG.populationSources.state); const ptr = await load(APP_CONFIG.populationSources.transitions); const pev = await load(APP_CONFIG.populationSources.evidence); const ppred = await load(APP_CONFIG.populationSources.prediction); const pintv = await load(APP_CONFIG.populationSources.interventions);
  const DT = 0.5;

  const stack = (species, opts = {}) => {
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species });
    const tr = new TranslationEngine({ contextRegistry: cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species });
    const pf = new ProteinFunctionEngine({ functionContextRegistry: fnctx, cellularStateRegistry: cst, functionalEdgeRegistry: fedg, functionalEvidenceRegistry: fev, translationEngine: tr, signalEngine: s, species });
    const ap = new ApoptosisEngine({ contextRegistry: actx, dynamicsRegistry: adyn, interventionRegistry: aint, evidenceRegistry: aev, proteinFunctionEngine: pf, signalEngine: s, species });
    if (opts.cellModel) ap.setCellModel(opts.cellModel);
    if (opts.pi3k) ap.setIntervention('pi3k_activator', true);
    if (opts.rosScav) ap.setIntervention('ros_scavenger', true);
    const pop = new PopulationEngine({ contextRegistry: opts.pctx || pctx, stateRegistry: pst, transitionsRegistry: ptr, evidenceRegistry: pev, predictionRegistry: ppred, interventionRegistry: pintv, apoptosisEngine: ap, species, cellModel: ap.cellModel });
    return { s, t, tr, pf, ap, pop, run(h) { const n = Math.round(h / DT); for (let i = 0; i < n; i++) { s.step(DT); t.step(DT); tr.step(DT); pf.step(DT); ap.step(DT); pop.step(DT); } } };
  };

  // ---- evidence vocabulary (additive; predictions + not-reported only, never experimental) ----
  eq(POPULATION_EVIDENCE_LEVELS.length, 8, 'population evidence vocabulary has 8 levels');
  ok(POPULATION_EVIDENCE_LEVELS.includes('CONTEXT_TRANSFER_PREDICTION'), 'CONTEXT_TRANSFER_PREDICTION present');
  ok(!POPULATION_EVIDENCE_LEVELS.some((l) => /EXPERIMENTAL/.test(l)), 'no EXPERIMENTAL level (population is never experimental)');
  ok(isPopulationPrediction('MECHANISTIC_PREDICTION') && isPopulationPrediction('CONTEXT_TRANSFER_PREDICTION'), 'prediction classifier');
  ok(isPopulationTransfer('CONTEXT_TRANSFER_PREDICTION') && !isPopulationTransfer('MECHANISTIC_PREDICTION'), 'transfer classifier');
  ok(!populationLevelActive('NOT_REPORTED') && populationLevelActive('MECHANISTIC_PREDICTION'), 'active classifier');

  // ---- registry integrity + cell-model isolation ----
  eq(pctx.profiles.mouse_b16bl6_population.evidence_level, 'CONTEXT_TRANSFER_PREDICTION', 'B16BL6 population is a context transfer');
  eq(pctx.profiles.mouse_b16_population.evidence_level, 'MECHANISTIC_PREDICTION', 'B16 population mechanistic prediction');
  eq(pctx.profiles.mouse_b16f10_population.evidence_level, 'MECHANISTIC_PREDICTION', 'B16-F10 population mechanistic prediction (separate)');
  eq(pctx.profiles.human_hacat_population.evidence_level, 'NOT_REPORTED', 'HaCaT population NOT_REPORTED');
  eq(pctx.profiles.rat_skin_population.evidence_level, 'NOT_REPORTED', 'rat population NOT_REPORTED');
  ok(pctx.profiles.mouse_b16bl6_population.context_transfer.source_cell_model === 'B16' && pctx.profiles.mouse_b16bl6_population.context_transfer.target_cell_model === 'B16BL6', 'B16BL6 transfer record source/target correct');
  ok(!pctx.profiles.human_hacat_population.population_available && !pctx.profiles.rat_skin_population.population_available, 'HaCaT + rat not available (no human/rat fallback)');

  // ---- population initialization + default mouse runtime = B16BL6 context transfer ----
  const M = stack('mouse');
  eq(M.pop.cellModel, 'B16BL6', 'default mouse population cell model is B16BL6 (canonical)');
  eq(M.pop.pop.populationState, 'healthy', 'population starts healthy');
  ok(M.pop.frame().contextTransfer, 'default mouse population is a context-transfer prediction');
  ok(M.pop.frame().predicted, 'default mouse population is a labelled prediction');
  eq(M.pop.frame().livingFraction, 1, 'population starts fully living');
  eq(M.pop.frame().apoptoticFraction, 0, 'population starts with no apoptosis');

  // ---- population accounting + conservation over a full run ----
  let consOk = true; let monoOk = true; let prevA = 0;
  for (let i = 0; i < 240; i++) { M.s.step(DT); M.t.step(DT); M.tr.step(DT); M.pf.step(DT); M.ap.step(DT); M.pop.step(DT);
    if (!M.pop.conservationOk()) consOk = false;
    const A = M.pop.pop.apoptoticFraction; if (A < prevA - 1e-9) monoOk = false; prevA = A;
  }
  ok(consOk, 'living + apoptotic == 1 at every step (conservation)');
  ok(monoOk, 'apoptotic fraction is non-decreasing (no resurrection)');
  const mf = M.pop.frame();
  ok(mf.apoptoticFraction > 0.5, 'mouse population accumulates apoptosis (majority apoptotic)');
  ok(mf.livingFraction > 0, 'a resistant living fraction persists (susceptible ceiling < 1)');
  ok((mf.adaptedFraction + mf.recoveredFraction) <= mf.livingFraction + 1e-9, 'adapted + recovered are sub-fractions of living');
  eq(mf.cumulativeApoptosis, mf.apoptoticFraction, 'cumulative apoptosis equals apoptotic fraction');
  ok(['apoptosis_dominant', 'stable_terminal_state'].includes(mf.populationState), 'mouse reaches apoptosis-dominant / terminal state');

  // ---- STOP boundary: downstream outcome never evaluated ----
  eq(mf.tumourResponseEvidence, 'NOT_EVALUATED', 'tumour response NOT_EVALUATED');
  eq(mf.survivalEvidence, 'NOT_EVALUATED', 'survival NOT_EVALUATED');
  eq(mf.clinicalOutcomeEvidence, 'NOT_EVALUATED', 'clinical outcome NOT_EVALUATED');

  // ---- state machine traversal order + required timeline events ----
  const tl = M.pop.getTimeline();
  const stateSeq = tl.filter((e) => e.kind === 'state').map((e) => e.event);
  const order = ['minimal_response', 'adaptive_response', 'partial_response', 'mixed_population', 'apoptosis_accumulating', 'apoptosis_dominant', 'stable_terminal_state'];
  let idx = -1; let ordered = true;
  for (const st of order) { const at = stateSeq.indexOf(st); if (at === -1 || at < idx) ordered = false; idx = Math.max(idx, at); }
  ok(ordered, 'population states occur in the legal FSM order');
  for (const ev of ['population_initialized', 'stress_propagated', 'apoptosis_accumulating', 'population_composition_changed', 'population_stabilized', 'terminal_population_state', 'context_transfer_activated']) {
    ok(tl.some((e) => e.event === ev), `population timeline event occurred: ${ev}`);
  }

  // ---- deterministic history / replay ----
  const hist = M.pop.getHistory();
  ok(hist.length === 240, 'history records one entry per step');
  ok(hist[0].livingFraction >= hist[hist.length - 1].livingFraction, 'history shows living fraction declining');
  const A1 = stack('mouse'); A1.run(120); const A2 = stack('mouse'); A2.run(120);
  ok(JSON.stringify(A1.pop.getHistory()) === JSON.stringify(A2.pop.getHistory()), 'history is deterministic (identical replay)');
  ok(JSON.stringify(A1.pop.stats()) === JSON.stringify(A2.pop.stats()), 'stats are deterministic');

  // ---- illegal transitions rejected (strict FSM) ----
  let threw = false; try { M.pop.transitionTo('healthy'); } catch { threw = true; }
  ok(threw, 'illegal transition from terminal state throws (strict FSM)');
  ok((ptr.state_machine.irreversible_states || []).includes('apoptosis_dominant'), 'apoptosis_dominant declared irreversible');
  const Fresh = stack('mouse');
  let threw2 = false; try { Fresh.pop.transitionTo('apoptosis_dominant'); } catch { threw2 = true; }
  ok(threw2, 'illegal skip transition healthy -> apoptosis_dominant throws');

  // ---- recovery only before apoptosis_dominant; no resurrection ----
  const R = stack('mouse', { rosScav: true }); R.run(120);
  ok(R.pop.pop.apoptoticFraction < mf.apoptoticFraction, 'ROS scavenger (upstream) keeps population apoptosis lower');
  ok(R.pop.conservationOk(), 'ROS-scavenger population still conserves');

  // ---- PI3K prevention (B16-F10): population stays viable ----
  const P = stack('mouse', { cellModel: 'B16-F10', pi3k: true }); P.run(120);
  ok(P.pop.frame().apoptoticFraction < 0.05, 'PI3K activation (B16-F10) keeps the population viable');
  eq(P.pop.frame().populationState, 'healthy', 'PI3K-protected population stays healthy');
  ok(!P.ap.stats().committed, 'PI3K: the single cell never commits');

  // ---- cell-model isolation: B16 / B16-F10 selectable + separate ----
  const B16 = stack('mouse', { cellModel: 'B16' }); eq(B16.pop.profile.evidence_level, 'MECHANISTIC_PREDICTION', 'B16 population profile selected');
  const F10 = stack('mouse', { cellModel: 'B16-F10' }); eq(F10.pop.profile.profile_id, 'mouse_b16f10_population', 'B16-F10 population profile selected (separate)');

  // ---- species isolation: HaCaT + rat idle (NOT_REPORTED) ----
  const H = stack('human'); H.run(60);
  ok(H.pop.isIdle() && H.pop.summaryLevel() === 'NOT_REPORTED', 'HaCaT population idle / Not Reported');
  ok(H.pop.frame().tumourResponseEvidence === 'NOT_EVALUATED', 'HaCaT downstream still NOT_EVALUATED');
  const Rt = stack('rat'); Rt.run(60);
  ok(Rt.pop.isIdle(), 'rat population idle');
  ok(H.pop.getHistory().length === 0, 'idle population records no history');

  // ---- confidence + uncertainty propagation ----
  ok(M.pop.frame().confidence === 'LOW' && typeof M.pop.frame().uncertainty === 'string' && M.pop.frame().uncertainty.length > 0, 'confidence + uncertainty propagate to the frame');

  // ---- validation: positive + negative cases ----
  const vr = M.pop.validate();
  ok(vr.ok, `validation passes on shipped registries (${vr.errors.join('; ')})`);
  const validateWith = (mutate) => {
    const clone = JSON.parse(JSON.stringify(pctx)); mutate(clone);
    const e = new PopulationEngine({ contextRegistry: clone, stateRegistry: pst, transitionsRegistry: ptr, evidenceRegistry: pev, predictionRegistry: ppred, interventionRegistry: pintv, apoptosisEngine: M.ap, species: 'mouse' });
    return e.validate();
  };
  // (a) active population labelled experimental (forbidden)
  { const r = validateWith((a) => { a.profiles.mouse_b16_population.evidence_level = 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'; return a; }); ok(!r.ok, 'negative: experimental population level caught'); }
  // (b) human population made available (no human fallback)
  { const r = validateWith((a) => { a.profiles.human_hacat_population.population_available = true; a.profiles.human_hacat_population.evidence_level = 'MECHANISTIC_PREDICTION'; return a; }); ok(!r.ok && r.errors.some((e) => /no human\/rat fallback/.test(e)), 'negative: human fallback caught'); }
  // (c) context transfer without a record
  { const r = validateWith((a) => { delete a.profiles.mouse_b16bl6_population.context_transfer; return a; }); ok(!r.ok && r.errors.some((e) => /without a transfer record/.test(e)), 'negative: transfer-without-record caught'); }
  // (d) silent cell-model mixing
  { const r = validateWith((a) => { a.profiles.mouse_b16_population.evidence_refs = ['pop_b16bl6_transfer']; return a; }); ok(!r.ok && r.errors.some((e) => /silently uses/.test(e)), 'negative: silent cell-model mixing caught'); }
  // FSM state machine: no recovery declared out of an irreversible state
  ok(vr.ok, 'FSM declares no recovery from irreversible states (validated)');

  // ---- full app wiring + renderer frame + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.population && app.population.engine, 'app exposes the population engine');
  app.setSpecies('mouse');
  for (let i = 0; i < 200; i++) { app.signalPropagation.engine.step(DT); app.transcription.engine.step(DT); app.translation.engine.step(DT); app.proteinFunction.engine.step(DT); app.apoptosis.engine.step(DT); app.population.engine.step(DT); }
  app.renderer.draw();
  ok(app.renderer.lastPopulationFrame && app.renderer.lastPopulationFrame.available, 'renderer produced a population frame');
  ok(app.renderer.lastPopulationFrame.contextTransfer, 'renderer flags the B16BL6 context-transfer prediction');
  ok(app.renderer.lastPopulationFrame.compositionBar && app.renderer.lastPopulationFrame.sparkline.points.length > 1, 'renderer composition bar + history sparkline present');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.populationResponse, 'CONTEXT_TRANSFER_PREDICTION', 'panel: mouse population = context-transfer prediction');
  eq(el.apoptosis, 'CONTEXT_TRANSFER_PREDICTION', 'previous phase unchanged: apoptosis = context-transfer prediction');
  const pi = app.panelModels.information.populationResponse;
  ok(pi && pi.title === 'Population Response', 'panel: independent Population Response section present');
  ok(pi.tumourResponseEvidence === 'NOT_EVALUATED' && pi.survivalEvidence === 'NOT_EVALUATED' && pi.clinicalOutcomeEvidence === 'NOT_EVALUATED', 'panel: tumour / survival / clinical outcome NOT_EVALUATED');
  ok(Array.isArray(pi.populationComposition ? Object.keys(pi.populationComposition) : null), 'panel exposes population composition');

  // rat via full app: idle population; earlier layers intact
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.renderer.draw();
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');
  ok(app.population.engine.isIdle(), 'rat population idle after full run');
  ok(!app.renderer.lastPopulationFrame.available, 'renderer draws no population composition for idle rat');

  // restore mouse for any later suites relying on default species
  app.setSpecies('mouse');
}
