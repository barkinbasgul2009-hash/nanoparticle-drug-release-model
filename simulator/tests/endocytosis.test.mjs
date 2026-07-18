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
import { EvidenceEngine } from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('endocytosis & intracellular trafficking (Phase 4C)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const areg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const treg = await loader.load(APP_CONFIG.transportSources.transport, 'generic');
  const rreg = await loader.load(APP_CONFIG.releaseSources.release, 'generic');
  const mreg = await loader.load(APP_CONFIG.microenvironmentSources.microenvironment, 'generic');
  const ereg = await loader.load(APP_CONFIG.endocytosisSources.endocytosis, 'generic');
  const evidence = new EvidenceEngine();

  // --- strict FSM: legal transitions accepted, illegal rejected ---
  const fsm = new EndocytosisFSM(ereg);
  ok(fsm.canTransition('EXTRACELLULAR', 'MEMBRANE_CONTACT'), 'legal: Extracellular -> Membrane Contact');
  ok(fsm.canTransition('LATE_ENDOSOME', 'LYSOSOME'), 'legal: Late Endosome -> Lysosome');
  ok(!fsm.canTransition('EXTRACELLULAR', 'LYSOSOME'), 'illegal: Extracellular -> Lysosome rejected');
  ok(!fsm.canTransition('WRAPPING', 'CYTOPLASM'), 'illegal: Wrapping -> Cytoplasm rejected');
  ok(!fsm.canTransition('LYSOSOME', 'EXTRACELLULAR'), 'illegal: Lysosome -> Extracellular rejected');
  let threw = false; try { fsm.assertTransition('EXTRACELLULAR', 'LYSOSOME'); } catch { threw = true; }
  ok(threw, 'assertTransition throws on an illegal transition');
  ok(fsm.isTerminal('LYSOSOME') && fsm.isTerminal('CYTOPLASM'), 'terminal states are lysosome + cytoplasm');

  // --- pathways: exactly the three allowed; forbidden routes absent ---
  for (const p of ['clathrin_mediated', 'caveolae_mediated', 'macropinocytosis']) ok(ereg.pathways[p], `pathway present: ${p}`);
  const pathKeys = Object.keys(ereg.pathways).filter((k) => k !== 'note');
  eq(pathKeys.sort().join(','), 'caveolae_mediated,clathrin_mediated,macropinocytosis', 'exactly the three allowed pathways (no phagocytosis/Fc/antibody/exocytosis)');
  for (const f of ['nucleus', 'apoptosis', 'pharmacodynamics', 'tumor_killing', 'ribosomes', 'mitochondria', 'exocytosis', 'transcription']) {
    ok(ereg.integrity.forbidden.includes(f), `registry forbids ${f}`);
  }
  // compartments are only early/late endosome + lysosome (no organelles)
  eq(Object.keys(ereg.compartments).filter((k) => k !== 'note').sort().join(','), 'early_endosome,late_endosome,lysosome', 'only endosome/lysosome compartments');

  const build = (species, seed = 3, er = ereg) => {
    const eng = new TransportEngine({ transportModel: new TransportModel(treg), anatomyModel: new AnatomyModel(areg, { species }), stateMachine: new BiologicalStateMachine(treg), evidenceEngine: evidence, species, seed });
    const rel = new ReleaseEngine({ releaseModel: new ReleaseModel(rreg), transportEngine: eng, evidenceEngine: evidence });
    const up = new UptakeEngine({ registry: mreg, cellField: new CellField(mreg), transportEngine: eng, releaseEngine: rel, evidenceEngine: evidence, species, seed: 5 });
    const endo = new EndocytosisEngine({ registry: er, fsm: new EndocytosisFSM(er), uptakeEngine: up, evidenceEngine: evidence, species, seed: 7 });
    return { eng, rel, up, endo };
  };

  // --- no endocytosis before carriers arrive (no uptake before contact) ---
  const s = build('rat');
  s.eng.spawn(8); s.eng.step(); s.eng.step(); // carriers moving, not arrived
  s.endo.step();
  eq(s.endo.states.size, 0, 'no endocytosis state before carriers arrive');
  s.eng.run(1200);
  s.endo.step();
  ok([...s.endo.states.values()].every((st) => st.state === 'EXTRACELLULAR' || st.state === 'MEMBRANE_CONTACT'), 'first endocytosis step: carriers are at most at Membrane Contact (no premature internalization)');

  // --- endocytosis NEVER applies to free drug molecules (carriers only) ---
  s.rel.run(300); s.up.run(400);
  ok(s.up.molecules.length > 0, 'free drug molecules exist');
  const carrierIds = new Set(s.eng.particles.map((p) => p.id));
  ok([...s.endo.states.keys()].every((id) => carrierIds.has(id)), 'endocytosis tracks only carriers, never free drug molecules');
  ok(s.up.molecules.every((m) => !s.endo.states.has(m.id)), 'no molecule id has an endocytosis state');

  // --- carriers progress through the correct compartment sequence to the lysosome ---
  s.endo.run(400);
  const st = s.endo.stats();
  ok((st.byState.LYSOSOME || 0) > 0, 'carriers reach the lysosome (B1: terminal, no escape)');
  ok(Object.keys(st.byPathway).every((p) => ['clathrin_mediated', 'caveolae_mediated', 'macropinocytosis'].includes(p)), 'only allowed pathways selected');
  // no escape / no cytoplasm for B1 (escape UNAVAILABLE)
  ok(!s.endo.escapeAllowed(), 'B1 escape not allowed (NOT REPORTED)');
  eq(st.byState.ESCAPED || 0, 0, 'no escape for B1');
  eq(st.byState.CYTOPLASM || 0, 0, 'no cytoplasmic release for B1 (escape unavailable)');

  // --- endosomal escape occurs ONLY when the formulation evidence allows it ---
  const erEscape = JSON.parse(JSON.stringify(ereg));
  erEscape.formulations.B1_nlc.escape = { state: 'efficient', escape_probability: 1.0, evidence_level: 'PREDICTIVE', basis: 'test' };
  const se = build('rat', 3, erEscape);
  se.eng.spawn(6); se.eng.run(1200); se.rel.run(300); se.up.run(400); se.endo.run(600);
  ok(se.endo.escapeAllowed(), 'escape allowed when the formulation supports it');
  ok((se.endo.stats().byState.CYTOPLASM || 0) > 0, 'escape -> cytoplasm occurs only when allowed');

  // --- evidence levels: endocytosis + trafficking Predictive for all species ---
  eq(build('rat').endo.evidenceLevelName(), 'PREDICTIVE', 'rat endocytosis Predictive');
  eq(build('human').endo.evidenceLevelName(), 'PREDICTIVE', 'human endocytosis Predictive');
  eq(build('mouse').endo.evidenceLevelName(), 'PREDICTIVE', 'mouse endocytosis Predictive');
  for (const sp of ['rat', 'human', 'mouse']) {
    const e = build(sp).endo;
    eq(e.traffickingLevelName(), 'PREDICTIVE', `${sp} trafficking Predictive`);
    ok(/Predictive/.test(e.message()) && /Predictive/.test(e.traffickingMessage()), `${sp} endocytosis + trafficking clearly labelled Predictive`);
    ok(e.endocytosisEvidence().referenceIds.length === 0, `${sp} endocytosis carries no fabricated citation`);
  }

  // --- species switching resets the layer (only the selected species exists) ---
  const sw = build('rat'); sw.eng.spawn(6); sw.eng.run(1200); sw.rel.run(200); sw.up.run(200); sw.endo.run(200);
  ok(sw.endo.states.size > 0, 'rat carriers tracked');
  sw.eng.setSpecies('human'); sw.endo.setSpecies('human');
  eq(sw.endo.states.size, 0, 'species switch clears endocytosis state');

  // --- full app: full chain transport -> release -> uptake -> endocytosis -> lysosome ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.endocytosis && app.endocytosis.engine, 'app exposes the endocytosis engine');
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.uptake.engine.run(1500);
  app.endocytosis.engine.run(600);
  app.renderer.draw();
  const es = app.endocytosis.engine.stats();
  ok((es.byState.LYSOSOME || 0) > 0, 'app: carriers reach the lysosome');
  ok(Array.isArray(app.renderer.lastEndocytosisFrame) && app.renderer.lastEndocytosisFrame.length > 0, 'renderer produced an endocytosis frame');
  ok(app.renderer.lastEndocytosisFrame.some((e) => e.compartment), 'endocytosis frame carries compartments (vesicle labels)');

  // --- five-section evidence panel ---
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.transport, 'EXPERIMENTAL', 'panel: rat transport Experimental');
  eq(el.release, 'EXPERIMENTAL', 'panel: rat release Experimental');
  eq(el.passiveUptake, 'PREDICTIVE', 'panel: rat passive uptake Predictive');
  eq(el.endocytosis, 'PREDICTIVE', 'panel: rat endocytosis Predictive');
  eq(el.intracellularTrafficking, 'PREDICTIVE', 'panel: rat intracellular trafficking Predictive');
  app.setSpecies('human');
  const el2 = app.panelModels.evidence.evidenceLevels;
  eq(el2.transport, 'PREDICTIVE', 'panel: human transport Predictive');
  eq(el2.endocytosis, 'PREDICTIVE', 'panel: human endocytosis Predictive');
  eq(el2.intracellularTrafficking, 'PREDICTIVE', 'panel: human trafficking Predictive');
  eq(app.endocytosis.engine.states.size, 0, 'species switch cleared carrier fates');
  app.setSpecies('rat');
}
