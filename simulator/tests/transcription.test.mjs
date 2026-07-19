// Phase-5C GENE REGULATION / TRANSCRIPTION tests. Validates the transcription runtime
// downstream of signal propagation: TF activation, nuclear import, DNA binding + release,
// multiple TFs / multiple genes, delay, prediction labels, species switching, NOT_REPORTED
// behaviour, competition/cooperation, occupancy, mRNA birth + degradation, renderer, UI,
// validation, and determinism. STOPS at mRNA. All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { loadSignalGraph } from '../src/biology/signalGraph.js';
import { SignalPropagationEngine } from '../src/biology/signalPropagationEngine.js';
import { TranscriptionEngine } from '../src/biology/transcriptionEngine.js';
import { snapExpression, copyState } from '../src/biology/transcriptionObjects.js';
import {
  GENE_EVIDENCE_LEVELS, isGeneEvidenceLevel, isGeneExperimental, isGenePrediction,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('gene regulation & transcription (Phase 5C)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const preg = await loader.load(APP_CONFIG.signalPropagationSources.propagation, 'generic');
  const treg = await loader.load(APP_CONFIG.transcriptionSources.transcription, 'generic');
  const DT = 0.5;

  // build a coupled signal+transcription stack for a species, stepped together
  const stack = (species) => {
    const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species });
    const t = new TranscriptionEngine({ registry: treg, signalEngine: s, species });
    return { s, t, run(hours) { const n = Math.round(hours / DT); for (let i = 0; i < n; i++) { s.step(DT); t.step(DT); } } };
  };

  // ---- evidence vocabulary (additive; earlier arrays unchanged) ----
  eq(GENE_EVIDENCE_LEVELS.length, 6, 'gene evidence vocabulary has 6 levels');
  for (const l of ['EXPERIMENTAL', 'HIGH_CONFIDENCE', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'HYPOTHESIS', 'NOT_REPORTED']) ok(GENE_EVIDENCE_LEVELS.includes(l), `gene evidence level present: ${l}`);
  ok(isGeneExperimental('EXPERIMENTAL') && !isGeneExperimental('MECHANISTIC_PREDICTION'), 'gene experimental classifier');
  ok(isGenePrediction('MECHANISTIC_PREDICTION') && isGenePrediction('HYPOTHESIS') && !isGenePrediction('EXPERIMENTAL') && !isGenePrediction('NOT_REPORTED'), 'gene prediction classifier');
  ok(isGeneEvidenceLevel('HYPOTHESIS') && !isGeneEvidenceLevel('BOGUS'), 'gene level validity');

  // ---- schematic helpers ----
  eq(snapExpression(0.40), 50, 'snapExpression snaps to nearest bucket (0.40 -> 50)');
  eq(snapExpression(0.30), 25, 'snapExpression 0.30 -> 25');
  eq(copyState(0.0), 'none', 'copyState 0 -> none');
  eq(copyState(0.9), 'high', 'copyState 0.9 -> high');

  // ---- registry integrity ----
  ok(treg.profiles.human_hacat.status === 'ACTIVE', 'human profile ACTIVE');
  ok(treg.profiles.mouse_b16bl6.status === 'NOT_REPORTED', 'mouse profile NOT_REPORTED');
  ok(treg.profiles.rat_skin.status === 'NOT_REPORTED', 'rat profile NOT_REPORTED');

  // ---- human: TF activation -> nuclear import -> DNA binding -> transcription -> mRNA ----
  const H = stack('human');
  const t = H.t;
  eq(t.tf('tf_nrf2').state, 'inactive', 'Nrf2 TF starts inactive');
  eq(t.gene('g_hmox1').expressionState, 25, 'HMOX1 starts at basal 25%');
  H.run(60);
  const tl = t.getTimeline();
  ok(tl.some((e) => e.kind === 'tf' && e.id === 'tf_nrf2' && e.event === 'activated'), 'Nrf2 activates at runtime');
  ok(tl.some((e) => e.kind === 'tf' && e.id === 'tf_nrf2' && e.event === 'nuclear'), 'Nrf2 undergoes nuclear import');
  ok(tl.some((e) => e.kind === 'tf' && e.id === 'tf_nrf2' && e.event === 'dna_bound'), 'Nrf2 binds DNA');
  ok(tl.some((e) => e.kind === 'tf' && e.id === 'tf_nrf2' && e.event === 'released'), 'Nrf2 releases from DNA when signal falls');

  // ordering: activation before nuclear before dna_bound (deterministic state machine)
  const at = tl.find((e) => e.id === 'tf_nrf2' && e.event === 'activated').timeH;
  const nt = tl.find((e) => e.id === 'tf_nrf2' && e.event === 'nuclear').timeH;
  const bt = tl.find((e) => e.id === 'tf_nrf2' && e.event === 'dna_bound').timeH;
  ok(at < nt && nt < bt, 'Nrf2 state order: activated < nuclear < dna_bound');

  // ---- transcription DELAY: gene induction lags TF binding (no instant mRNA) ----
  const induce = tl.find((e) => e.kind === 'mrna' && e.id === 'mrna_hmox1');
  ok(induce && induce.timeH > bt, 'HMOX1 mRNA induction lags DNA binding (transcription delay)');

  // ---- gene activation (HMOX1/NQO1 rise above basal) ----
  ok(tl.some((e) => e.kind === 'gene' && e.id === 'g_hmox1' && e.direction === 'up'), 'HMOX1 expression rises (Nrf2/ARE induction)');
  ok(tl.some((e) => e.kind === 'gene' && e.id === 'g_nqo1' && e.direction === 'up'), 'NQO1 expression rises (one TF -> multiple genes / branching)');

  // ---- mRNA birth + degradation ----
  ok(t.mrna('g_hmox1').birthTime != null, 'HMOX1 mRNA has a birth/induction time');
  const peakHmox = t.gene('g_hmox1').expressionState;
  H.run(120); // long tail: signal winds down, Nrf2 releases, mRNA degrades back toward basal
  ok(t.mrna('g_hmox1').degrading || t.gene('g_hmox1').expressionState <= peakHmox, 'HMOX1 mRNA degrades / expression relaxes after signal falls');

  // ---- multiple TFs on one promoter: competition/cooperation + suppression direction ----
  const H2 = stack('human'); H2.run(24);
  eq(H2.t.gene('g_infl').expressionState, 25, 'inflammatory gene suppressed below basal (NF-kB suppressed + Nrf2 cross-repression)');
  const inflPromoter = H2.t.promoter('p_nfkb_infl');
  eq(inflPromoter.bindingTfs.length, 2, 'inflammatory promoter receives two TFs (multiple TFs)');
  ok(inflPromoter.bindingTfs.some((b) => b.relationship === 'activation') && inflPromoter.bindingTfs.some((b) => b.relationship === 'suppression'), 'promoter mixes activation + suppression (competition)');

  // ---- occupancy ----
  ok(H2.t.promoter('p_are_hmox1').occupancy > 0, 'ARE promoter is occupied by Nrf2');
  ok(H2.t.promoter('p_are_hmox1').occupancy <= 1, 'occupancy never exceeds 1');

  // ---- prediction labels: nothing experimental; every gene/TF labelled prediction ----
  for (const g of H2.t.frame().genes) {
    ok(!isGeneExperimental(g.evidenceLevel), `gene ${g.symbol} is not (falsely) experimental`);
    ok(isGenePrediction(g.predictionLevel), `gene ${g.symbol} carries a labelled prediction level`);
  }
  for (const tf of H2.t.frame().tfs) ok(isGenePrediction(tf.predictionLevel), `TF ${tf.name} carries a labelled prediction level`);

  // ---- NOT_REPORTED behaviour (mouse + rat idle; no transfer) ----
  const M = stack('mouse'); M.run(40);
  ok(M.t.isIdle(), 'mouse transcription idle (no TF node / no evidence)');
  eq(M.t.stats().genes, 0, 'mouse has no genes');
  eq(M.t.summaryLevel(), 'NOT_REPORTED', 'mouse gene regulation Not Reported');
  const R = stack('rat'); R.run(40);
  ok(R.t.isIdle() && R.t.summaryLevel() === 'NOT_REPORTED', 'rat transcription idle / Not Reported');

  // ---- species switching clears runtime state ----
  const SW = stack('human'); SW.run(30);
  ok(SW.t.gene('g_hmox1') != null, 'human genes present before switch');
  SW.t.setSpecies('mouse');
  ok(SW.t.isIdle() && SW.t.gene('g_hmox1') == null, 'switch to mouse clears human genes (idle)');
  eq(SW.t.timeH, 0, 'species switch restarts transcription time');
  SW.t.setSpecies('human');
  ok(SW.t.gene('g_hmox1') != null && SW.t.gene('g_hmox1').expressionState === 25, 'switch back to human rebuilds at basal');

  // ---- determinism ----
  const d1 = stack('human'); d1.run(80); const d2 = stack('human'); d2.run(80);
  eq(JSON.stringify(d1.t.stats()), JSON.stringify(d2.t.stats()), 'deterministic stats');
  eq(JSON.stringify(d1.t.getTimeline()), JSON.stringify(d2.t.getTimeline()), 'deterministic timeline');

  // ---- restart clears state ----
  const rs = stack('human'); rs.run(40); rs.t.restart();
  eq(rs.t.timeH, 0, 'restart resets time');
  eq(rs.t.getTimeline().length, 0, 'restart clears timeline');
  eq(rs.t.tf('tf_nrf2').state, 'inactive', 'restart resets TF state');
  eq(rs.t.gene('g_hmox1').expressionState, 25, 'restart resets gene to basal');

  // ---- validation (real registry clean) ----
  const vr = H.t.validate();
  ok(vr.ok, `real transcription registry validates${vr.ok ? '' : ': ' + vr.errors.join('; ')}`);

  // ---- validation negative cases ----
  const clone = () => JSON.parse(JSON.stringify(treg));
  const validateWith = (reg) => { const s = new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species: 'human' }); return new TranscriptionEngine({ registry: reg, signalEngine: s, species: 'human' }).validate(); };
  // (a) gene references missing promoter
  { const c = clone(); c.profiles.human_hacat.genes.g_hmox1.promoter_id = 'nope'; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /missing promoter/.test(e)), 'negative: missing promoter caught'); }
  // (b) promoter references missing TF
  { const c = clone(); c.profiles.human_hacat.promoters.p_are_hmox1.binding_tfs[0].tf_id = 'nope'; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /missing TF/.test(e)), 'negative: missing TF caught'); }
  // (c) promoter references missing gene
  { const c = clone(); c.profiles.human_hacat.promoters.p_are_hmox1.gene_id = 'nope'; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /missing gene/.test(e)), 'negative: missing gene caught'); }
  // (d) duplicate gene symbol
  { const c = clone(); c.profiles.human_hacat.genes.g_nqo1.symbol = 'HMOX1'; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /duplicate gene symbol/.test(e)), 'negative: duplicate gene symbol caught'); }
  // (e) invalid evidence level
  { const c = clone(); c.profiles.human_hacat.genes.g_hmox1.evidence_level = 'BOGUS'; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /invalid evidence_level/.test(e)), 'negative: invalid evidence level caught'); }
  // (f) NOT_REPORTED profile not empty
  { const c = clone(); c.profiles.rat_skin.genes = { g_x: { symbol: 'X', promoter_id: 'p', basal_expression: 0, evidence_level: 'MECHANISTIC_PREDICTION', prediction_level: 'MECHANISTIC_PREDICTION' } }; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /NOT_REPORTED but not empty/.test(e)), 'negative: non-empty NOT_REPORTED caught'); }
  // (g) gene->TF cycle
  { const c = clone(); c.profiles.human_hacat.genes.g_hmox1.encodes_tf = 'tf_nrf2'; const r = validateWith(c); ok(!r.ok && r.errors.some((e) => /cycle/.test(e)), 'negative: gene->TF cycle caught'); }

  // ---- experimental takes priority (a real experimental gene warns to attach a reference) ----
  { const c = clone(); c.profiles.human_hacat.genes.g_hmox1.evidence_level = 'EXPERIMENTAL'; const r = validateWith(c); ok(r.warnings.some((w) => /EXPERIMENTAL/.test(w)), 'experimental claim flagged for a required reference'); }

  // ---- full app wiring + renderer frame + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.transcription && app.transcription.engine, 'app exposes the transcription engine');
  app.setSpecies('human');
  // step the whole stack via the animator (transport ... signal ... transcription)
  for (let i = 0; i < 160; i++) { app.signalPropagation.engine.step(DT); app.transcription.engine.step(DT); }
  app.renderer.draw();
  ok(Array.isArray(app.renderer.lastTranscriptionFrame.genes) && app.renderer.lastTranscriptionFrame.genes.length > 0, 'renderer produced a transcription gene frame');
  ok(app.renderer.lastTranscriptionFrame.tfs.some((tf) => tf.predicted), 'transcription frame includes predicted TFs (distinct)');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.geneRegulation, 'PREDICTIVE', 'panel: human Gene Regulation = Predictive');
  eq(el.signalTransduction, 'PREDICTIVE', 'previous phase unchanged: signal transduction Predictive');
  eq(el.targetEngagement, 'NOT_REPORTED', 'previous phase unchanged: target engagement Not Reported');
  ok(app.panelModels.information.geneRegulation && app.panelModels.information.geneRegulation.genes.length > 0, 'panel gene-regulation section populated');

  // rat: idle transcription; panel Not Reported; earlier layers intact
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.renderer.draw();
  eq(app.panelModels.evidence.evidenceLevels.geneRegulation, 'NOT_REPORTED', 'panel: rat Gene Regulation Not Reported');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');
  ok(app.transcription.engine.isIdle(), 'rat transcription idle after full run');
  app.setSpecies('rat');
}
