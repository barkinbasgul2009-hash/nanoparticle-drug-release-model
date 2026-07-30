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
import { EvidenceEngine } from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('cellular microenvironment + passive uptake (Phase 4B)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const areg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const treg = await loader.load(APP_CONFIG.transportSources.transport, 'generic');
  const rreg = await loader.load(APP_CONFIG.releaseSources.release, 'generic');
  const mreg = await loader.load(APP_CONFIG.microenvironmentSources.microenvironment, 'generic');
  const evidence = new EvidenceEngine();

  // build a species stack: transport -> release -> uptake
  const build = (species, n = 8, seed = 3) => {
    const anatomy = new AnatomyModel(areg, { species });
    const eng = new TransportEngine({ transportModel: new TransportModel(treg), anatomyModel: anatomy, stateMachine: new BiologicalStateMachine(treg), evidenceEngine: evidence, species, seed });
    const rel = new ReleaseEngine({ releaseModel: new ReleaseModel(rreg), transportEngine: eng, evidenceEngine: evidence });
    const up = new UptakeEngine({ registry: mreg, cellField: new CellField(mreg), transportEngine: eng, releaseEngine: rel, evidenceEngine: evidence, species, seed: 5 });
    return { eng, rel, up };
  };

  // --- cells are minimal: membrane + cytoplasm ONLY (no forbidden structures) ---
  const cf = new CellField(mreg);
  ok(cf.cells.length >= 2, 'schematic cells present');
  for (const c of cf.cells) {
    eq(Object.keys(c).sort().join(','), 'id,radius,u,x', `cell ${c.id} has only id/x/u/radius (no organelles)`);
  }
  const forbidden = mreg.integrity.forbidden;
  for (const f of ['nucleus', 'lysosome', 'endosome', 'endocytosis', 'clathrin', 'caveolae', 'receptors', 'mitochondria', 'exocytosis']) {
    ok(forbidden.includes(f), `registry forbids ${f}`);
  }
  eq(mreg.uptake_model.mechanism, 'PASSIVE', 'uptake mechanism is PASSIVE only');
  const cellDefs = JSON.stringify(mreg.cells.list).toLowerCase(); // the cell DEFINITIONS only
  for (const f of ['nucleus', 'mitochond', 'receptor', 'lysosome', 'golgi', 'endosome']) {
    ok(!cellDefs.includes(f), `cell definitions contain no ${f}`);
  }

  // --- no molecules before release; molecules appear ONLY after release ---
  const { eng, rel, up } = build('rat', 8);
  eng.spawn(8); eng.run(1200);
  eq(eng.stats().arrived, 8, 'carriers arrived (transport done)');
  up.step(); up.step(); // release has NOT been stepped yet
  eq(up.molecules.length, 0, 'no drug molecules before release');
  eq(up.expectedMoleculeCount(), 0, 'expected molecule count is zero before release');
  rel.run(4); up.step();
  ok(up.molecules.length > 0, 'drug molecules appear after release begins');

  // --- drug count equals released payload (quantised) ---
  eq(up.molecules.length, up.expectedMoleculeCount(), 'molecule count equals released payload (mid-release)');
  rel.run(300); up.step();
  eq(up.molecules.length, up.expectedMoleculeCount(), 'molecule count equals released payload (full release)');
  eq(up.molecules.length, 8 * up.params.moleculesPerCarrier, 'fully released -> moleculesPerCarrier per carrier');

  // --- molecules diffuse independently (distinct trajectories) ---
  const before = up.molecules.slice(0, 2).map((m) => ({ x: m.x, u: m.u }));
  up.step();
  const moved = up.molecules.slice(0, 2).map((m, i) => (m.x !== before[i].x || m.u !== before[i].u));
  ok(moved[0] && moved[1], 'molecules move each step');
  ok(up.molecules[0].x !== up.molecules[1].x || up.molecules[0].u !== up.molecules[1].u, 'molecules occupy independent positions');

  // --- passive uptake occurs only after contact; molecules never teleport ---
  let maxDisp = 0;
  for (let i = 0; i < 3000; i += 1) {
    const prev = up.molecules.map((m) => ({ x: m.x, u: m.u }));
    up.step();
    up.molecules.forEach((m, idx) => { const dd = Math.hypot(m.x - prev[idx].x, m.u - prev[idx].u); if (dd > maxDisp) maxDisp = dd; });
  }
  ok(maxDisp < 0.06, 'molecules never teleport (bounded per-step displacement)');
  ok(up.molecules.filter((m) => m.compartment === 'cytoplasm').every((m) => m.contacted), 'every internalised molecule contacted a membrane first');
  ok(up.molecules.filter((m) => m.compartment === 'cytoplasm').every((m) => cf.cytoplasmCell(m.x, m.u)), 'internalised molecules are inside a cell cytoplasm');
  ok(up.stats().cytoplasm > 0, 'passive uptake occurred (some molecules entered cytoplasm)');
  // molecules that never contacted remain extracellular
  ok(up.molecules.filter((m) => !m.contacted).every((m) => m.compartment === 'extracellular'), 'molecules remain outside until membrane contact');

  // --- molecule object shape (independent entity fields) ---
  const m0 = up.molecules[0];
  for (const key of ['id', 'x', 'u', 'vx', 'vu', 'diffusion', 'species', 'releaseTimeH', 'alive', 'evidenceTag', 'compartment']) {
    ok(key in m0, `molecule exposes ${key}`);
  }

  // --- evidence levels: transport (rat exp) vs uptake (predictive for all) ---
  eq(build('rat').eng.evidenceLevelName(), 'EXPERIMENTAL', 'rat transport = Experimental');
  eq(build('human').eng.evidenceLevelName(), 'PREDICTIVE', 'human transport = Predictive');
  eq(build('mouse').eng.evidenceLevelName(), 'PREDICTIVE', 'mouse transport = Predictive');
  for (const sp of ['rat', 'human', 'mouse']) {
    const u = build(sp).up;
    eq(u.evidenceLevelName(), 'PREDICTIVE', `${sp} uptake = Predictive (passive free-drug mechanism is a general principle)`);
    ok(evidence.canAnimate(u.speciesEvidence()), `${sp} uptake animates (predictive)`);
    ok(/Predictive/.test(u.message()), `${sp} uptake message is clearly labelled Predictive`);
    eq(u.evidenceForSpecies(sp).referenceIds.length, 0, `${sp} uptake carries no permeation citation (no fabricated evidence)`);
  }
  // an unknown species => uptake Unavailable (blocked)
  eq(build('rat').up.evidenceLevelFor('llama'), 'UNAVAILABLE', 'unknown species uptake = Unavailable');

  // --- predictive species animate uptake through their OWN cells (only selected species) ---
  const humanStack = build('human', 8);
  humanStack.eng.spawn(8); humanStack.eng.run(1200); humanStack.rel.run(300);
  humanStack.up.run(3000);
  ok(humanStack.up.stats().cytoplasm > 0, 'human (predictive) drug enters cytoplasm');
  ok(humanStack.up.molecules.every((m) => m.species === 'human'), 'only the selected species exists (all molecules human)');

  // --- full app: transport -> release -> free diffusion -> passive uptake ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.uptake && app.uptake.engine, 'app exposes the uptake engine');
  app.setSpecies('rat');
  app.transport.animator.runHeadless();       // transport + release (+ uptake stepping)
  app.uptake.engine.run(2000);                 // finish passive uptake
  app.renderer.draw();
  const upStats = app.uptake.engine.stats();
  eq(upStats.total, app.uptake.engine.expectedMoleculeCount(), 'app: molecule count equals released payload');
  ok(upStats.total === app.transport.animator.spawnCount * app.uptake.engine.params.moleculesPerCarrier, 'app: full payload became molecules');
  ok(upStats.cytoplasm > 0, 'app: passive uptake delivered drug into cytoplasm');
  ok(Array.isArray(app.renderer.lastMoleculeFrame) && app.renderer.lastMoleculeFrame.length === upStats.total, 'renderer produced a molecule frame');
  ok(Array.isArray(app.renderer.lastCellFrame) && app.renderer.lastCellFrame.length >= 2, 'renderer produced a cell frame');
  ok(app.renderer.lastMoleculeFrame.every((mo) => mo.x >= 0 && mo.x <= app.renderer.viewport.width && mo.y >= 0 && mo.y <= app.renderer.viewport.height), 'molecules map inside the viewport');

  // --- three independent evidence levels in the panel ---
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.transport, 'EXPERIMENTAL', 'panel: rat transport Experimental');
  eq(el.release, 'EXPERIMENTAL', 'panel: rat release Experimental (chain)');
  eq(el.passiveUptake, 'PREDICTIVE', 'panel: rat passive uptake Predictive');
  app.setSpecies('human');
  const el2 = app.panelModels.evidence.evidenceLevels;
  eq(el2.transport, 'PREDICTIVE', 'panel: human transport Predictive');
  eq(el2.release, 'PREDICTIVE', 'panel: human release Predictive (chain)');
  eq(el2.passiveUptake, 'PREDICTIVE', 'panel: human passive uptake Predictive');
  // switching species clears molecules (only the selected species exists)
  eq(app.uptake.engine.molecules.length, 0, 'species switch clears molecules (no leftover species)');
  app.setSpecies('rat');
}
