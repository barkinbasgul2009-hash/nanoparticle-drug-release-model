import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { AnatomyModel } from '../src/anatomy/anatomyModel.js';
import { TransportModel } from '../src/biology/transportModel.js';
import { BiologicalStateMachine } from '../src/biology/transportStates.js';
import { TransportEngine } from '../src/biology/transportEngine.js';
import { ReleaseModel } from '../src/biology/releaseModel.js';
import { ReleaseEngine } from '../src/biology/releaseEngine.js';
import { CellField } from '../src/biology/cellField.js';
import { UptakeEngine } from '../src/biology/uptakeEngine.js';
import { EndocytosisFSM } from '../src/biology/endocytosisStates.js';
import { EndocytosisEngine } from '../src/biology/endocytosisEngine.js';
import { IntracellularReleaseModel } from '../src/biology/intracellularReleaseModel.js';
import { IntracellularReleaseEngine } from '../src/biology/intracellularReleaseEngine.js';
import { TargetEngagementEngine } from '../src/biology/targetEngagementEngine.js';
import { EvidenceEngine, labelAnimates, isPrediction, PREDICTION_LABELS } from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('target engagement (Phase 5A)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const areg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const treg = await loader.load(APP_CONFIG.transportSources.transport, 'generic');
  const rreg = await loader.load(APP_CONFIG.releaseSources.release, 'generic');
  const mreg = await loader.load(APP_CONFIG.microenvironmentSources.microenvironment, 'generic');
  const ereg = await loader.load(APP_CONFIG.endocytosisSources.endocytosis, 'generic');
  const ireg = await loader.load(APP_CONFIG.intracellularSources.intracellular, 'generic');
  const tgreg = await loader.load(APP_CONFIG.targetEngagementSources.targetEngagement, 'generic');
  const evidence = new EvidenceEngine();
  const cf = new CellField(mreg);

  // --- prediction-label vocabulary ---
  for (const l of ['EXPERIMENTAL', 'HIGH_CONFIDENCE_PREDICTION', 'MECHANISTIC_PREDICTION', 'LITERATURE_PREDICTION', 'UNAVAILABLE', 'NOT_REPORTED']) ok(PREDICTION_LABELS.includes(l), `prediction label present: ${l}`);
  ok(labelAnimates('EXPERIMENTAL') && labelAnimates('MECHANISTIC_PREDICTION') && labelAnimates('LITERATURE_PREDICTION') && labelAnimates('HIGH_CONFIDENCE_PREDICTION'), 'experimental + predictions animate');
  ok(!labelAnimates('NOT_REPORTED') && !labelAnimates('UNAVAILABLE'), 'not-reported / unavailable do not animate');
  ok(isPrediction('MECHANISTIC_PREDICTION') && !isPrediction('EXPERIMENTAL') && !isPrediction('NOT_REPORTED'), 'isPrediction distinguishes predictions from facts');

  // --- registry: generic targets, binding models, forbidden downstream ---
  for (const t of ['enzyme', 'receptor', 'cytoplasmic_protein', 'transport_protein', 'dna_associated_protein', 'nuclear_protein']) ok(tgreg.target_types[t], `target type present: ${t}`);
  ok(tgreg.binding_models.reversible.dissociates === true && tgreg.binding_models.irreversible.dissociates === false, 'reversible dissociates; irreversible does not');
  for (const m of ['Kd', 'Ki', 'IC50']) ok(tgreg.affinity_metrics[m], `affinity metric present: ${m}`);
  for (const f of ['signalling', 'MAPK', 'PI3K', 'AKT', 'mTOR', 'NF_kB', 'transcription', 'translation', 'apoptosis', 'proliferation', 'immune_response', 'tumour_response', 'pharmacodynamics_downstream']) {
    ok(tgreg.integrity.forbidden.includes(f), `registry forbids ${f}`);
  }

  // helper: full stack with optional patched profiles
  const build = (species, opts = {}) => {
    const er = JSON.parse(JSON.stringify(ereg)); const ir = JSON.parse(JSON.stringify(ireg)); const tg = JSON.parse(JSON.stringify(tgreg));
    if (opts.escape) er.formulations.B1_nlc.escape = { state: 'efficient', escape_probability: 1.0, evidence_level: 'PREDICTIVE' };
    if (opts.intra) ir.formulations.B1_nlc.intracellular_release = opts.intra;
    if (opts.targeting) ir.formulations.B1_nlc.nucleus_targeting = opts.targeting;
    if (opts.targets) tg.formulations.B1_nlc.targets = opts.targets;
    if (opts.binding) tg.formulations.B1_nlc.binding = opts.binding;
    const eng = new TransportEngine({ transportModel: new TransportModel(treg), anatomyModel: new AnatomyModel(areg, { species }), stateMachine: new BiologicalStateMachine(treg), evidenceEngine: evidence, species, seed: 3 });
    const rel = new ReleaseEngine({ releaseModel: new ReleaseModel(rreg), transportEngine: eng, evidenceEngine: evidence });
    const up = new UptakeEngine({ registry: mreg, cellField: new CellField(mreg), transportEngine: eng, releaseEngine: rel, evidenceEngine: evidence, species, seed: 5 });
    const endo = new EndocytosisEngine({ registry: er, fsm: new EndocytosisFSM(er), uptakeEngine: up, evidenceEngine: evidence, species, seed: 7 });
    const intra = new IntracellularReleaseEngine({ registry: ir, releaseModel: new IntracellularReleaseModel(ir), endocytosisEngine: endo, uptakeEngine: up, evidenceEngine: evidence, species, seed: 11 });
    const tgt = new TargetEngagementEngine({ registry: tg, intracellularEngine: intra, uptakeEngine: up, evidenceEngine: evidence, species, seed: 13 });
    return { eng, rel, up, endo, intra, tgt };
  };
  const cytoTargets = (sites) => cf.cells.flatMap((c) => [{ type: 'enzyme', cellId: c.id, availableSites: sites, angle: 0.6 }, { type: 'receptor', cellId: c.id, availableSites: sites, angle: 3.5 }]);

  // --- B1 (real registry): NOT REPORTED -> idle ---
  const b1 = build('rat');
  eq(b1.tgt.evidenceLevelName(), 'NOT_REPORTED', 'B1 target engagement is Not Reported');
  ok(b1.tgt.isBlocked(), 'B1 target engine blocked (idle)');
  eq(b1.tgt.targets.length, 0, 'B1 places no targets');

  // --- reversible binding pipeline ---
  const rev = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targets: cytoTargets(2), binding: { model: 'reversible', kon: 0.5, koff: 0.02, evidence_level: 'MECHANISTIC_PREDICTION' } });
  ok(!rev.tgt.isBlocked(), 'patched target engagement supported (Predictive)');
  eq(rev.tgt.evidenceLevelName(), 'MECHANISTIC_PREDICTION', 'evidence label is a Mechanistic Prediction');
  ok(rev.tgt.isPredicted(), 'predicted behaviour is flagged as a prediction');
  ok(rev.tgt.targets.length > 0, 'targets placed when supported');
  // Kd = koff/kon; residence = 1/koff
  ok(Math.abs(rev.tgt.kd() - 0.02 / 0.5) < 1e-9, 'Kd = koff/kon');
  ok(Math.abs(rev.tgt.residenceTime() - 1 / 0.02) < 1e-6, 'residence time = 1/koff');

  // no binding before intracellular localization
  rev.eng.spawn(8); rev.eng.run(1200); rev.rel.run(300); rev.up.run(400);
  rev.tgt.step(); rev.tgt.step();
  eq(rev.tgt.stats().bound, 0, 'no target binding before a carrier localizes intracellularly');
  rev.endo.run(600); rev.intra.run(200);
  rev.tgt.step(); rev.tgt.step();
  // molecules exist now; binding may need encounters
  const revRun = rev.tgt.run(2500);
  const rs = rev.tgt.stats();
  ok(rs.bound > 0, 'reversible binding occurs after encounter');
  ok(rs.byTarget.every((t) => t.occupied <= t.available), 'occupancy never exceeds capacity');
  ok([0, 25, 50, 75, 100].includes(rev.tgt.saturationBucket()), 'saturation reported in buckets');
  ok(revRun.events.some((e) => e.type === 'encounter'), 'encounter events emitted');
  ok(revRun.events.some((e) => e.type === 'binding'), 'binding events emitted');
  ok(revRun.events.some((e) => e.type === 'dissociation'), 'reversible binding may dissociate');
  // bound drugs are held at a real target (no phantom bindings)
  for (const [, b] of rev.tgt.bindings) ok(rev.tgt.targets.some((t) => t.id === b.targetId), 'every binding references a real target');

  // --- irreversible binding never dissociates; occupancy non-decreasing ---
  const irr = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targets: cytoTargets(2), binding: { model: 'irreversible', kon: 0.5, koff: 0, evidence_level: 'HIGH_CONFIDENCE_PREDICTION' } });
  irr.eng.spawn(8); irr.eng.run(1200); irr.rel.run(300); irr.up.run(400); irr.endo.run(600); irr.intra.run(200);
  const irrRun = irr.tgt.run(1500);
  const occA = irr.tgt.stats().occupied;
  const irrRun2 = irr.tgt.run(1500);
  const occB = irr.tgt.stats().occupied;
  ok(!irrRun.events.some((e) => e.type === 'dissociation') && !irrRun2.events.some((e) => e.type === 'dissociation'), 'irreversible binding never dissociates');
  ok(occB >= occA, 'irreversible occupancy is non-decreasing');

  // --- competition: a single-site target holds at most one drug ---
  const comp = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targets: cf.cells.map((c) => ({ type: 'enzyme', cellId: c.id, availableSites: 1, angle: 1.0 })), binding: { model: 'reversible', kon: 0.6, koff: 0.0, evidence_level: 'MECHANISTIC_PREDICTION' } });
  comp.eng.spawn(8); comp.eng.run(1200); comp.rel.run(300); comp.up.run(400); comp.endo.run(600); comp.intra.run(200); comp.tgt.run(2000);
  ok(comp.tgt.targets.every((t) => t.occupiedSites <= 1), 'single-site targets never exceed one bound drug (competition)');
  ok(comp.tgt.bindings.size <= comp.tgt.targets.length, 'no more bindings than target sites');

  // --- nuclear gate: nuclear target unbound without Phase-4D targeting; bindable with it ---
  const nucTargets = cf.cells.map((c) => ({ type: 'nuclear_protein', cellId: c.id, compartment: 'nucleus', availableSites: 2, angle: 0.3 }));
  const noTarget = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targeting: { mode: 'none', evidence_level: 'NOT_REPORTED' }, targets: nucTargets, binding: { model: 'reversible', kon: 0.6, koff: 0.0, evidence_level: 'MECHANISTIC_PREDICTION' } });
  noTarget.eng.spawn(8); noTarget.eng.run(1200); noTarget.rel.run(300); noTarget.up.run(400); noTarget.endo.run(600); noTarget.intra.run(400); noTarget.tgt.run(2000);
  eq(noTarget.tgt.stats().occupied, 0, 'nuclear targets stay unbound without Phase-4D nucleus targeting');
  const withNuc = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targeting: { mode: 'evidence_supported', evidence_level: 'PREDICTIVE' }, targets: nucTargets, binding: { model: 'reversible', kon: 0.6, koff: 0.0, evidence_level: 'MECHANISTIC_PREDICTION' } });
  withNuc.eng.spawn(8); withNuc.eng.run(1200); withNuc.rel.run(300); withNuc.up.run(400); withNuc.endo.run(600); withNuc.intra.run(600); withNuc.tgt.run(2500);
  ok(withNuc.tgt.stats().occupied > 0, 'nuclear targets bindable once nucleus targeting has occurred');

  // --- evidence labels correct per species (real registry NOT REPORTED) ---
  for (const sp of ['rat', 'human', 'mouse']) {
    const e = build(sp).tgt;
    eq(e.evidenceLevelName(), 'NOT_REPORTED', `${sp} target engagement Not Reported (no data)`);
    ok(/Not Reported/.test(e.message()), `${sp} message clearly labelled Not Reported`);
  }

  // --- species switching clears binding state ---
  rev.eng.setSpecies('human'); rev.intra.setSpecies('human'); rev.tgt.setSpecies('human');
  eq(rev.tgt.bindings.size, 0, 'species switch clears bindings');

  // --- full app: idle for B1; six->seven-section evidence panel; previous phases unchanged ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.targetEngagement && app.targetEngagement.engine, 'app exposes the target-engagement engine');
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.uptake.engine.run(800); app.endocytosis.engine.run(600); app.intracellular.engine.run(300); app.targetEngagement.engine.run(300);
  app.renderer.draw();
  eq(app.targetEngagement.engine.evidenceLevelName(), 'NOT_REPORTED', 'app B1 target engagement = Not Reported (idle)');
  eq(app.targetEngagement.engine.stats().bound, 0, 'app B1 has no target binding (honest)');
  ok(Array.isArray(app.renderer.lastTargetFrame), 'renderer produced a target frame array');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.targetEngagement, 'NOT_REPORTED', 'panel shows Target Engagement = Not Reported');
  eq(el.transport, 'EXPERIMENTAL', 'panel: transport still Experimental (previous phases unchanged)');
  eq(el.intracellularRelease, 'NOT_REPORTED', 'panel: intracellular release still Not Reported (unchanged)');
  app.setSpecies('rat');
}
