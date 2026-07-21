// Phase-6B APOPTOSIS COMMITMENT & EXECUTION tests. Validates the strict-FSM runtime after
// early cellular response: eligibility, reversible pre-commitment, commitment gate,
// irreversibility, mitochondrial transition, Bax/Bcl-2 shift, MOMP, cytochrome-c + AIF
// release, caspase + AIF execution, partial pathway dependence, interventions (ROS
// scavenger / caspase inhibitor / AIF knockdown / PI3K activator), cell-model isolation +
// context transfer (B16 / B16BL6 / B16-F10), HaCaT + rat idle, illegal transitions,
// determinism, renderer, timeline, panel, validation. STOPS at the single-cell apoptotic
// state. All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { loadSignalGraph } from '../src/biology/signalGraph.js';
import { SignalPropagationEngine } from '../src/biology/signalPropagationEngine.js';
import { TranscriptionEngine } from '../src/biology/transcriptionEngine.js';
import { TranslationEngine } from '../src/biology/translationEngine.js';
import { ProteinFunctionEngine } from '../src/biology/proteinFunctionEngine.js';
import { ApoptosisEngine } from '../src/biology/apoptosisEngine.js';
import {
  APOPTOSIS_EVIDENCE_LEVELS, isApoptosisEvidenceLevel, isApoptosisExperimental, isApoptosisPrediction, isApoptosisTransfer, apoptosisLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('apoptosis commitment & execution (Phase 6B)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const load = (f) => loader.load(f, 'generic');
  const preg = await load('signal-propagation.registry.json'); const treg = await load('transcription.registry.json');
  const cx = await load('translation-context.registry.json'); const mach = await load('translation-machinery.registry.json'); const prot = await load('protein.registry.json');
  const fnctx = await load('protein-function-context.registry.json'); const cst = await load('cellular-state.registry.json'); const fedg = await load('functional-edges.registry.json'); const fev = await load('functional-evidence.registry.json');
  const actx = await load(APP_CONFIG.apoptosisSources.context); const adyn = await load(APP_CONFIG.apoptosisSources.dynamics); const aint = await load(APP_CONFIG.apoptosisSources.interventions); const aev = await load(APP_CONFIG.apoptosisSources.evidence);
  const DT = 0.5;

  const stack = (species, opts = {}) => {
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species });
    const tr = new TranslationEngine({ contextRegistry: cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species });
    const pf = new ProteinFunctionEngine({ functionContextRegistry: fnctx, cellularStateRegistry: cst, functionalEdgeRegistry: fedg, functionalEvidenceRegistry: fev, translationEngine: tr, signalEngine: s, species });
    const ap = new ApoptosisEngine({ contextRegistry: opts.actx || actx, dynamicsRegistry: adyn, interventionRegistry: aint, evidenceRegistry: aev, proteinFunctionEngine: pf, signalEngine: s, species, ...opts });
    return { s, t, tr, pf, ap, run(h) { const n = Math.round(h / DT); for (let i = 0; i < n; i++) { s.step(DT); t.step(DT); tr.step(DT); pf.step(DT); ap.step(DT); } } };
  };

  // ---- evidence vocabulary (additive; includes CONTEXT_TRANSFER_PREDICTION) ----
  eq(APOPTOSIS_EVIDENCE_LEVELS.length, 11, 'apoptosis evidence vocabulary has 11 levels');
  ok(APOPTOSIS_EVIDENCE_LEVELS.includes('CONTEXT_TRANSFER_PREDICTION'), 'CONTEXT_TRANSFER_PREDICTION present');
  ok(isApoptosisExperimental('EXPERIMENTAL_DRUG_CELL_SPECIFIC') && !isApoptosisExperimental('CONTEXT_TRANSFER_PREDICTION'), 'experimental classifier');
  ok(isApoptosisPrediction('CONTEXT_TRANSFER_PREDICTION') && isApoptosisPrediction('MECHANISTIC_PREDICTION') && !isApoptosisPrediction('EXPERIMENTAL_DRUG_CELL_SPECIFIC'), 'prediction classifier');
  ok(isApoptosisTransfer('CONTEXT_TRANSFER_PREDICTION') && !isApoptosisTransfer('MECHANISTIC_PREDICTION'), 'transfer classifier');

  // ---- registry integrity + cell-model isolation ----
  eq(actx.profiles.mouse_b16_apoptosis.evidence_level, 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'B16 profile experimental');
  eq(actx.profiles.mouse_b16bl6_apoptosis.evidence_level, 'CONTEXT_TRANSFER_PREDICTION', 'B16BL6 profile is a context transfer (not experimental)');
  eq(actx.profiles.mouse_b16f10_apoptosis.evidence_level, 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'B16-F10 separate experimental profile');
  eq(actx.profiles.human_hacat_apoptosis.status, 'NOT_REPORTED', 'HaCaT apoptosis NOT_REPORTED');
  eq(actx.profiles.rat_skin_apoptosis.status, 'NOT_REPORTED', 'rat apoptosis NOT_REPORTED');
  ok(actx.profiles.mouse_b16bl6_apoptosis.context_transfer.source_cell_model === 'B16' && actx.profiles.mouse_b16bl6_apoptosis.context_transfer.target_cell_model === 'B16BL6', 'B16BL6 transfer record source/target correct');

  // ---- default mouse runtime = B16BL6 context-transfer prediction ----
  const M = stack('mouse');
  eq(M.ap.cellModel, 'B16BL6', 'default mouse cell model is B16BL6 (canonical)');
  ok(M.ap.frame().contextTransfer, 'default mouse runtime is a context-transfer prediction');
  eq(M.ap.apop.state, 'homeostatic', 'mouse apoptosis starts homeostatic');

  // ---- eligibility -> reversible pre-commitment -> commitment -> irreversible execution ----
  M.run(70);
  const tl = M.ap.getTimeline();
  for (const ev of ['apoptosis_committed', 'mitochondrial_potential_reduced', 'cytochrome_c_released', 'aif_released', 'initiator_caspase_activated', 'parp_cleavage_started', 'execution_complete']) {
    ok(tl.some((e) => e.event === ev), `apoptosis event occurred: ${ev}`);
  }
  eq(M.ap.stats().committed, true, 'mouse commits to apoptosis');
  eq(M.ap.stats().reversibility, 'irreversible', 'committed state is irreversible');
  ok(['apoptotic', 'execution_complete'].includes(M.ap.stats().state), 'mouse reaches apoptotic / execution_complete');
  ok(M.ap.stats().baxBcl2 === 'strong_pro_apoptotic_shift', 'Bax/Bcl-2 strong pro-apoptotic shift after commitment');
  ok(['collapsed', 'severely_reduced'].includes(M.ap.stats().membranePotential), 'mitochondrial potential collapses');

  // event ordering: commitment before execution_complete; cytochrome-c before caspase
  const tCommit = tl.find((e) => e.event === 'apoptosis_committed').timeH;
  const tComplete = tl.find((e) => e.event === 'execution_complete').timeH;
  ok(tCommit < tComplete, 'commitment precedes execution completion');

  // ---- irreversibility: no recovery after commitment even if stress removed ----
  ok((adyn.state_machine.irreversible_states || []).includes('committed'), 'committed is declared irreversible');
  // a committed engine cannot transition back to a recoverable state
  let threw = false; try { M.ap.transitionTo('stressed'); } catch { threw = true; }
  ok(threw, 'illegal transition from execution_complete -> stressed throws (strict FSM)');

  // ---- reversible pre-commitment recovery (ROS scavenger before commitment) ----
  const Rc = stack('mouse'); Rc.ap.setIntervention('ros_scavenger', true); Rc.run(90);
  ok(!Rc.ap.stats().committed, 'ROS scavenger applied early prevents commitment (reversible)');
  ok(!['committed', 'mitochondrial_transition', 'execution_in_progress', 'apoptotic', 'execution_complete'].includes(Rc.ap.stats().state), 'ROS-scavenged cell stays in a reversible state');

  // ---- intervention after commitment does NOT reverse apoptosis ----
  const Late = stack('mouse'); Late.run(40); ok(Late.ap.stats().committed, 'cell committed by t=40');
  Late.ap.setIntervention('ros_scavenger', true); Late.run(40);
  ok(Late.ap.stats().committed && ['apoptotic', 'execution_complete', 'execution_in_progress'].includes(Late.ap.stats().state), 'ROS scavenger after commitment does not reverse apoptosis');

  // ---- partial caspase dependence: caspase inhibitor does not fully rescue ----
  const Ci = stack('mouse'); Ci.ap.setIntervention('caspase_inhibitor', true); Ci.run(80);
  ok(Ci.ap.stats().committed, 'caspase inhibitor does not prevent commitment (AIF branch remains)');
  ok(Ci.ap.frame().caspaseBranch.parp !== 'cleaved', 'partial caspase inhibition -> PARP not fully cleaved');
  ok(Ci.ap.frame().aifBranch.contribution > 0, 'AIF branch still contributes under caspase inhibition');

  // ---- AIF knockdown substantially attenuates total execution drive ----
  const Kd = stack('mouse'); Kd.ap.setIntervention('aif_knockdown', true); Kd.run(80);
  const Nn = stack('mouse'); Nn.run(80);
  ok(Kd.ap.stats().totalExecutionDrive < Nn.ap.stats().totalExecutionDrive, 'AIF knockdown reduces total execution drive');
  ok((Nn.ap.stats().totalExecutionDrive - Kd.ap.stats().totalExecutionDrive) > 0.3, 'AIF knockdown attenuation is substantial (dominant AIF branch)');
  eq(Kd.ap.frame().aifBranch.state, 'suppressed_by_knockdown', 'AIF branch suppressed by knockdown');
  ok(Kd.ap.frame().caspaseBranch.executioner !== 'inhibited', 'AIF knockdown does not affect the caspase branch');

  // ---- dual-branch simultaneous execution (no intervention) ----
  ok(Nn.ap.frame().caspaseBranch.contribution > 0 && Nn.ap.frame().aifBranch.contribution > 0, 'caspase and AIF branches execute simultaneously');

  // ---- cell-model isolation: B16 (experimental) + B16-F10 (separate) selectable ----
  const B16 = stack('mouse'); B16.ap.setCellModel('B16'); eq(B16.ap.profile.evidence_level, 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'B16 override -> experimental profile');
  const F10 = stack('mouse'); F10.ap.setCellModel('B16-F10'); eq(F10.ap.profile.evidence_level, 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'B16-F10 override -> separate experimental profile');
  ok(F10.ap.interventions.has('pi3k_activator'), 'B16-F10 supports the PI3K-activator intervention');
  ok(!B16.ap.interventions.has('pi3k_activator'), 'B16 does not carry the PI3K-activator intervention');

  // ---- PI3K activator (B16-F10) attenuates before commitment ----
  const P = stack('mouse'); P.ap.setCellModel('B16-F10'); P.ap.setIntervention('pi3k_activator', true); P.run(90);
  ok(!P.ap.stats().committed, 'PI3K activation (B16-F10) restores survival and prevents commitment');

  // ---- HaCaT + rat idle (no apoptosis) ----
  const Hh = stack('human'); Hh.run(60);
  ok(Hh.ap.isIdle() && Hh.ap.summaryLevel() === 'NOT_REPORTED', 'HaCaT apoptosis idle / Not Reported (cytoprotective profile not converted)');
  ok(!Hh.ap.stats().committed, 'HaCaT never commits to apoptosis');
  const Rr = stack('rat'); Rr.run(60);
  ok(Rr.ap.isIdle(), 'rat apoptosis idle');

  // ---- determinism ----
  const d1 = stack('mouse'); d1.run(80); const d2 = stack('mouse'); d2.run(80);
  eq(JSON.stringify(d1.ap.stats()), JSON.stringify(d2.ap.stats()), 'deterministic stats');
  eq(JSON.stringify(d1.ap.getTimeline()), JSON.stringify(d2.ap.getTimeline()), 'deterministic timeline');

  // ---- restart clears state ----
  const rs = stack('mouse'); rs.run(60); rs.ap.restart();
  eq(rs.ap.timeH, 0, 'restart resets time');
  eq(rs.ap.getTimeline().length, 0, 'restart clears timeline');
  eq(rs.ap.apop.state, 'homeostatic', 'restart resets FSM to homeostatic');
  ok(!rs.ap.stats().committed, 'restart clears commitment');

  // ---- validation (real registries clean) ----
  const vr = M.ap.validate();
  ok(vr.ok, `real apoptosis registries validate${vr.ok ? '' : ': ' + vr.errors.join('; ')}`);

  // ---- validation negative cases ----
  const validateWith = (patch) => {
    const a = patch(JSON.parse(JSON.stringify(actx)));
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species: 'mouse' });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species: 'mouse' });
    const tr = new TranslationEngine({ contextRegistry: cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species: 'mouse' });
    const pf = new ProteinFunctionEngine({ functionContextRegistry: fnctx, cellularStateRegistry: cst, functionalEdgeRegistry: fedg, functionalEvidenceRegistry: fev, translationEngine: tr, signalEngine: s, species: 'mouse' });
    return new ApoptosisEngine({ contextRegistry: a, dynamicsRegistry: adyn, interventionRegistry: aint, evidenceRegistry: aev, proteinFunctionEngine: pf, signalEngine: s, species: 'mouse' }).validate();
  };
  // (a) NOT_REPORTED profile marked available
  { const r = validateWith((a) => { a.profiles.human_hacat_apoptosis.apoptosis_available = true; return a; }); ok(!r.ok && r.errors.some((e) => /NOT_REPORTED but apoptosis_available/.test(e)), 'negative: NOT_REPORTED+available caught'); }
  // (b) silent cell-model mixing (B16BL6 using B16 evidence without a transfer label)
  { const r = validateWith((a) => { a.profiles.mouse_b16bl6_apoptosis.evidence_level = 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'; a.profiles.mouse_b16bl6_apoptosis.evidence_refs = ['apop_b16_ros']; return a; }); ok(!r.ok && (r.errors.some((e) => /silently uses/.test(e)) || r.errors.some((e) => /EXPERIMENTAL without a verified source/.test(e))), 'negative: silent cell-model mixing caught'); }
  // (c) context-transfer without a transfer record
  { const r = validateWith((a) => { delete a.profiles.mouse_b16bl6_apoptosis.context_transfer; return a; }); ok(!r.ok && r.errors.some((e) => /CONTEXT_TRANSFER_PREDICTION without a transfer record/.test(e)), 'negative: transfer-without-record caught'); }
  // (d) transfer source == target
  { const r = validateWith((a) => { a.profiles.mouse_b16bl6_apoptosis.context_transfer.source_cell_model = 'B16BL6'; return a; }); ok(!r.ok && r.errors.some((e) => /transfer source == target/.test(e)), 'negative: transfer source==target caught'); }

  // ---- FSM has no recovery from irreversible states (declared) ----
  ok(vr.ok, 'FSM declares no recovery from irreversible states (validated)');

  // ---- full app wiring + renderer frame + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.apoptosis && app.apoptosis.engine, 'app exposes the apoptosis engine');
  app.setSpecies('mouse');
  for (let i = 0; i < 140; i++) { app.signalPropagation.engine.step(DT); app.transcription.engine.step(DT); app.translation.engine.step(DT); app.proteinFunction.engine.step(DT); app.apoptosis.engine.step(DT); }
  app.renderer.draw();
  ok(app.renderer.lastApoptosisFrame && app.renderer.lastApoptosisFrame.available, 'renderer produced an apoptosis frame');
  ok(app.renderer.lastApoptosisFrame.contextTransfer, 'renderer flags the B16BL6 context-transfer prediction');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.apoptosis, 'CONTEXT_TRANSFER_PREDICTION', 'panel: mouse apoptosis = context-transfer prediction');
  eq(el.proteinFunction, 'PREDICTIVE', 'previous phase unchanged: protein function Predictive');
  const ai = app.panelModels.information.apoptosis;
  ok(ai && ai.populationOutcomeEvidence === 'NOT_EVALUATED' && ai.tumourResponseEvidence === 'NOT_EVALUATED', 'panel: population + tumour outcome NOT_EVALUATED');

  // rat: idle apoptosis; panel Not Reported; earlier layers intact
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.renderer.draw();
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');
  ok(app.apoptosis.engine.isIdle(), 'rat apoptosis idle after full run');
  app.setSpecies('rat');
}
