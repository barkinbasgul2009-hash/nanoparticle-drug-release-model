// Phase-5D TRANSLATION & PROTEIN SYNTHESIS tests. Validates the runtime layer after
// transcription: mRNA gating, ribosome recruitment, initiation (delayed / suppressed /
// unavailable), elongation, pause/resume, termination, nascent creation, schematic
// folding + maturation, mature-protein abundance, turnover + conservation, multiple mRNAs
// / genes, global capacity, gene-specific efficiency, signal-linked capacity (only where
// permitted, test-only), evidence priority, species switching, renderer, timeline, panel,
// validation. STOPS at protein. All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { loadSignalGraph } from '../src/biology/signalGraph.js';
import { SignalPropagationEngine } from '../src/biology/signalPropagationEngine.js';
import { TranscriptionEngine } from '../src/biology/transcriptionEngine.js';
import { TranslationEngine } from '../src/biology/translationEngine.js';
import { snapAbundance, abundanceOrdinal } from '../src/biology/translationObjects.js';
import {
  TRANSLATION_EVIDENCE_LEVELS, isTranslationEvidenceLevel, isTranslationExperimental,
  isTranslationPrediction, translationLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('translation & protein synthesis (Phase 5D)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const preg = await loader.load(APP_CONFIG.signalPropagationSources.propagation, 'generic');
  const treg = await loader.load(APP_CONFIG.transcriptionSources.transcription, 'generic');
  const cx = await loader.load(APP_CONFIG.translationSources.context, 'generic');
  const mach = await loader.load(APP_CONFIG.translationSources.machinery, 'generic');
  const prot = await loader.load(APP_CONFIG.translationSources.protein, 'generic');
  const DT = 0.5;

  const stack = (species, opts = {}) => {
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species });
    const tr = new TranslationEngine({ contextRegistry: opts.cx || cx, machineryRegistry: mach, proteinRegistry: prot, transcriptionEngine: t, signalEngine: s, species });
    return { s, t, tr, run(hours) { const n = Math.round(hours / DT); for (let i = 0; i < n; i++) { s.step(DT); t.step(DT); tr.step(DT); } } };
  };

  // ---- evidence vocabulary (additive; earlier arrays unchanged) ----
  eq(TRANSLATION_EVIDENCE_LEVELS.length, 10, 'translation evidence vocabulary has 10 levels');
  for (const l of ['EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_PATHWAY_SPECIFIC', 'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'HYPOTHESIS', 'NOT_REPORTED', 'UNAVAILABLE', 'CONTRADICTORY_EVIDENCE']) ok(TRANSLATION_EVIDENCE_LEVELS.includes(l), `translation evidence level present: ${l}`);
  ok(isTranslationExperimental('EXPERIMENTAL_DRUG_CELL_SPECIFIC') && !isTranslationExperimental('MECHANISTIC_PREDICTION'), 'experimental classifier');
  ok(isTranslationPrediction('MECHANISTIC_PREDICTION') && isTranslationPrediction('HYPOTHESIS') && !isTranslationPrediction('EXPERIMENTAL_DRUG_CELL_SPECIFIC'), 'prediction classifier');
  ok(!translationLevelActive('UNAVAILABLE') && !translationLevelActive('NOT_REPORTED') && translationLevelActive('MECHANISTIC_PREDICTION'), 'active-level gate');

  // ---- schematic helpers ----
  eq(snapAbundance(0.46), 50, 'snapAbundance snaps to nearest bucket');
  eq(abundanceOrdinal(0.0), 'none', 'abundanceOrdinal 0 -> none');
  eq(abundanceOrdinal(0.9), 'high', 'abundanceOrdinal 0.9 -> high');

  // ---- registry integrity ----
  eq(cx.profiles.human_hacat.status, 'ACTIVE', 'human translation profile ACTIVE');
  eq(cx.profiles.mouse_b16bl6.status, 'NOT_REPORTED', 'mouse translation NOT_REPORTED');
  eq(cx.profiles.rat_skin.status, 'NOT_REPORTED', 'rat translation NOT_REPORTED');
  // integrity: no HO-1 protein claimed experimental (no verified in-repo source)
  ok(!isTranslationExperimental(prot.proteins.prot_ho1.evidence_level), 'HO-1 protein is not (falsely) experimental (no verified in-repo source)');
  eq(prot.proteins.prot_ho1.turnover.half_life_h, 'NOT_REPORTED', 'HO-1 biological half-life NOT_REPORTED');
  for (const p of Object.values(prot.proteins)) eq(p.functional_state, 'not_evaluated', `protein ${p.canonical_name} functional_state not_evaluated`);

  // ---- mRNA gating: no translation before mRNA exists / eligible ----
  const H = stack('human');
  eq(H.tr.protein('prot_ho1').producedUnits, 0, 'no protein before stepping');
  H.tr.step(DT); // one step, but no transcription mRNA induced yet at basal -> may still translate basal mRNA
  // proteins are gated on eligibility; ribosomes should not be elongating instantly at t=0.5
  ok(H.tr.protein('prot_ho1').matureUnits === 0, 'no mature protein one step in (translation delay)');

  // ---- full human run: recruitment -> initiation -> elongation -> termination -> mature ----
  H.run(30);
  const tl = H.tr.getTimeline();
  for (const ev of ['recruited', 'initiation_complete', 'nascent_protein_released', 'maturation_started', 'mature_protein_produced']) {
    ok(tl.some((e) => e.event === ev), `translation event occurred: ${ev}`);
  }
  // elongation milestones ordered
  ok(tl.some((e) => e.event === 'translation_25') && tl.some((e) => e.event === 'translation_75'), 'elongation milestones recorded');
  const tInit = tl.find((e) => e.event === 'initiation_complete').timeH;
  const tMature = tl.find((e) => e.event === 'mature_protein_produced').timeH;
  ok(tInit < tMature, 'maturation follows initiation (no instant protein)');

  // ---- mature protein abundance (induced HO-1 rises above suppressed inflammatory protein) ----
  let ho1Peak = 0, inflPeak = 0;
  const H2 = stack('human');
  for (let i = 0; i < 240; i++) { H2.s.step(DT); H2.t.step(DT); H2.tr.step(DT); ho1Peak = Math.max(ho1Peak, H2.tr.protein('prot_ho1').abundanceState); inflPeak = Math.max(inflPeak, H2.tr.protein('prot_infl').abundanceState); }
  ok(ho1Peak >= 50, 'HO-1 protein abundance rises (induced)');
  ok(ho1Peak > inflPeak, 'induced HO-1 exceeds suppressed inflammatory protein');
  ok(H2.tr.protein('prot_infl').abundanceState <= 25, 'inflammatory protein stays low (suppressed mRNA)');

  // ---- protein turnover + conservation (produced = folding+mature+degrading+degraded) ----
  ok(H2.tr.getTimeline().some((e) => e.event === 'degradation_started'), 'protein turnover occurs (degradation)');
  for (const o of H2.tr.outputs.values()) {
    const p = o.protein;
    eq(p.producedUnits, p.foldingUnits + p.matureUnits + p.degradingUnits + p.degradedUnits, `protein ${p.canonicalName} units conserved`);
  }

  // ---- multiple mRNAs / multiple genes / one profile many proteins ----
  eq(H2.tr.outputs.size, 3, 'human profile translates three protein outputs');
  ok(H2.tr.protein('prot_ho1') && H2.tr.protein('prot_nqo1') && H2.tr.protein('prot_infl'), 'HO-1, NQO1, inflammatory proteins present');

  // ---- gene-specific efficiency + global capacity ----
  eq(H.tr.capacityOrdinal, 'high', 'human global capacity high (constitutive)');
  ok(cx.profiles.human_hacat.outputs.out_ho1.gene_efficiency !== cx.profiles.human_hacat.outputs.out_infl.gene_efficiency, 'gene-specific efficiencies differ');

  // ---- elongation bounds: progress never <0 or >1 ----
  const B = stack('human');
  let boundsOk = true; for (let i = 0; i < 120; i++) { B.s.step(DT); B.t.step(DT); B.tr.step(DT); for (const o of B.tr.outputs.values()) for (const r of o.ribosomes) if (r.translationProgress < -1e-9 || r.translationProgress > 1 + 1e-9) boundsOk = false; }
  ok(boundsOk, 'translation progress stays within [0,1]');

  // ---- signal-linked global-capacity prediction (TEST-ONLY patched profile; mTOR suppression) ----
  // Architecture: capacity may follow a signal node ONLY where a profile declares it. We
  // exercise it with a patched context registry (never a committed real profile).
  {
    const cxTest = JSON.parse(JSON.stringify(cx));
    // mouse would be idle; instead patch a human variant tying capacity to a (suppressed) node.
    cxTest.profiles.human_hacat.global_capacity = { source: 'signal_node_linked', signal_node: 'h1_nrf2', relationship: 'suppression', baseline: 0.3, level: 0.1, evidence_level: 'MECHANISTIC_PREDICTION', rationale: 'test-only' };
    const T = stack('human', { cx: cxTest });
    T.run(2);
    ok(typeof T.tr.globalCapacity === 'number' && T.tr.globalCapacity >= 0 && T.tr.globalCapacity <= 1, 'signal-linked capacity resolves to a bounded value');
  }

  // ---- suppressed / unavailable translation (test-only patched evidence) ----
  {
    const cxU = JSON.parse(JSON.stringify(cx));
    cxU.profiles.human_hacat.outputs.out_ho1.evidence_level = 'UNAVAILABLE';
    const U = stack('human', { cx: cxU });
    U.run(30);
    eq(U.tr.protein('prot_ho1').producedUnits, 0, 'UNAVAILABLE translation produces no protein');
  }

  // ---- evidence priority: predicted proteins are labelled, never experimental ----
  for (const o of H2.tr.frame().outputs) {
    ok(!isTranslationExperimental(o.evidenceLevel), `output ${o.proteinName} not falsely experimental`);
    ok(isTranslationPrediction(o.evidenceLevel), `output ${o.proteinName} carries a labelled prediction level`);
    eq(o.functionalState, 'not_evaluated', `output ${o.proteinName} function not evaluated`);
  }

  // ---- NOT_REPORTED behaviour (mouse + rat idle; no transfer) ----
  const M = stack('mouse'); M.run(40);
  ok(M.tr.isIdle() && M.tr.stats().outputs === 0, 'mouse translation idle (no mRNA)');
  eq(M.tr.summaryLevel(), 'NOT_REPORTED', 'mouse translation Not Reported');
  const R = stack('rat'); R.run(40);
  ok(R.tr.isIdle() && R.tr.summaryLevel() === 'NOT_REPORTED', 'rat translation idle / Not Reported');

  // ---- species switching clears state ----
  const SW = stack('human'); SW.run(30);
  ok(SW.tr.protein('prot_ho1').producedUnits > 0, 'human produced protein before switch');
  SW.tr.setSpecies('mouse');
  ok(SW.tr.isIdle() && SW.tr.protein('prot_ho1') == null, 'switch to mouse clears human proteins');
  eq(SW.tr.timeH, 0, 'species switch restarts time');
  SW.tr.setSpecies('human');
  eq(SW.tr.protein('prot_ho1').producedUnits, 0, 'switch back to human rebuilds at zero produced');

  // ---- determinism ----
  const d1 = stack('human'); d1.run(80); const d2 = stack('human'); d2.run(80);
  eq(JSON.stringify(d1.tr.stats()), JSON.stringify(d2.tr.stats()), 'deterministic stats');
  eq(JSON.stringify(d1.tr.getTimeline()), JSON.stringify(d2.tr.getTimeline()), 'deterministic timeline');

  // ---- restart clears state ----
  const rs = stack('human'); rs.run(40); rs.tr.restart();
  eq(rs.tr.timeH, 0, 'restart resets time');
  eq(rs.tr.getTimeline().length, 0, 'restart clears timeline');
  eq(rs.tr.protein('prot_ho1').producedUnits, 0, 'restart resets produced units');

  // ---- validation (real registries clean) ----
  const vr = H.tr.validate();
  ok(vr.ok, `real translation registries validate${vr.ok ? '' : ': ' + vr.errors.join('; ')}`);

  // ---- validation negative cases ----
  const validateWith = (patchProt, patchCx) => {
    const p = patchProt ? patchProt(JSON.parse(JSON.stringify(prot))) : prot;
    const c = patchCx ? patchCx(JSON.parse(JSON.stringify(cx))) : cx;
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species: 'human' });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species: 'human' });
    return new TranslationEngine({ contextRegistry: c, machineryRegistry: mach, proteinRegistry: p, transcriptionEngine: t, signalEngine: s, species: 'human' }).validate();
  };
  // (a) output references missing protein
  { const r = validateWith(null, (c) => { c.profiles.human_hacat.outputs.out_ho1.protein_id = 'nope'; return c; }); ok(!r.ok && r.errors.some((e) => /missing protein/.test(e)), 'negative: missing protein caught'); }
  // (b) experimental without a reference
  { const r = validateWith((p) => { p.proteins.prot_ho1.evidence_level = 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'; p.proteins.prot_ho1.reference_ids = []; return p; }); ok(!r.ok && r.errors.some((e) => /EXPERIMENTAL without a reference/.test(e)), 'negative: experimental-without-reference caught'); }
  // (c) experimental with an unverified reference
  { const r = validateWith((p) => { p.proteins.prot_ho1.evidence_level = 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'; return p; }); ok(!r.ok && r.errors.some((e) => /not verified in repo/.test(e)), 'negative: experimental-with-unverified-reference caught'); }
  // (d) cross-species protein
  { const r = validateWith((p) => { p.proteins.prot_ho1.species = 'mouse'; return p; }); ok(!r.ok && r.errors.some((e) => /cross-species/.test(e)), 'negative: cross-species protein caught'); }
  // (e) functional_state not not_evaluated
  { const r = validateWith((p) => { p.proteins.prot_ho1.functional_state = 'active'; return p; }); ok(!r.ok && r.errors.some((e) => /functional_state must be not_evaluated/.test(e)), 'negative: protein function caught'); }
  // (f) numeric half-life warns
  { const r = validateWith((p) => { p.proteins.prot_ho1.turnover.half_life_h = 12; return p; }); ok(r.warnings.some((w) => /numeric half-life/.test(w)), 'numeric half-life flagged'); }
  // (g) NOT_REPORTED profile not empty
  { const r = validateWith(null, (c) => { c.profiles.rat_skin.outputs = { o: { protein_id: 'prot_ho1', gene_id: 'g_hmox1', evidence_level: 'MECHANISTIC_PREDICTION' } }; return c; }); ok(!r.ok && r.errors.some((e) => /NOT_REPORTED but not empty/.test(e)), 'negative: non-empty NOT_REPORTED caught'); }

  // ---- full app wiring + renderer frame + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.translation && app.translation.engine, 'app exposes the translation engine');
  app.setSpecies('human');
  for (let i = 0; i < 240; i++) { app.signalPropagation.engine.step(DT); app.transcription.engine.step(DT); app.translation.engine.step(DT); }
  app.renderer.draw();
  ok(Array.isArray(app.renderer.lastTranslationFrame.outputs) && app.renderer.lastTranslationFrame.outputs.length === 3, 'renderer produced a translation frame with three outputs');
  ok(app.renderer.lastTranslationFrame.outputs.some((o) => o.predicted), 'translation frame flags predicted outputs');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.translation, 'PREDICTIVE', 'panel: human Translation = Predictive');
  eq(el.geneRegulation, 'PREDICTIVE', 'previous phase unchanged: gene regulation Predictive');
  eq(el.transport, 'PREDICTIVE', 'previous phase unchanged: human transport Predictive');
  const ti = app.panelModels.information.translation;
  ok(ti && ti.outputs.length === 3 && ti.proteinFunctionEvidence === 'NOT_EVALUATED', 'panel translation section populated; protein function NOT_EVALUATED');
  ok(/schematic/i.test(ti.timingWarning), 'panel carries the schematic-timing warning');

  // rat: idle translation; panel Not Reported; earlier layers intact
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.renderer.draw();
  eq(app.panelModels.evidence.evidenceLevels.translation, 'NOT_REPORTED', 'panel: rat Translation Not Reported');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');
  ok(app.translation.engine.isIdle(), 'rat translation idle after full run');
  app.setSpecies('rat');
}
