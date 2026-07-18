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
import { EvidenceEngine } from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('intracellular drug release (Phase 4D)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const areg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const treg = await loader.load(APP_CONFIG.transportSources.transport, 'generic');
  const rreg = await loader.load(APP_CONFIG.releaseSources.release, 'generic');
  const mreg = await loader.load(APP_CONFIG.microenvironmentSources.microenvironment, 'generic');
  const ereg = await loader.load(APP_CONFIG.endocytosisSources.endocytosis, 'generic');
  const ireg = await loader.load(APP_CONFIG.intracellularSources.intracellular, 'generic');
  const evidence = new EvidenceEngine();

  // --- release model math (all five models, evidence-gated) ---
  const rm = new IntracellularReleaseModel(ireg);
  for (const m of ['burst', 'first_order', 'zero_order', 'higuchi', 'korsmeyer_peppas']) ok(rm.supportedModels().includes(m), `model available: ${m}`);
  eq(rm.fractionReleased(null, {}, 10), 0, 'null model (NOT REPORTED) releases nothing');
  eq(rm.fractionReleased('first_order', {}, 10), 0, 'missing rate constant -> nothing released (never invented)');
  eq(rm.fractionReleased('burst', {}, 5), 1, 'burst releases fully');
  ok(rm.fractionReleased('first_order', { k: 0.1 }, 2) < rm.fractionReleased('first_order', { k: 0.1 }, 20), 'first-order rises with time');
  ok(rm.fractionReleased('zero_order', { k: 0.05 }, 10) <= 1 && rm.fractionReleased('zero_order', { k: 0.05 }, 100) === 1, 'zero-order capped at 1');
  ok(rm.fractionReleased('higuchi', { k: 0.1 }, 4) > 0, 'higuchi releases with sqrt(t)');
  ok(rm.fractionReleased('korsmeyer_peppas', { k: 0.1, n: 0.5 }, 9) > 0, 'korsmeyer-peppas releases');
  // each rate-based model must be monotonic non-decreasing and bounded in [0,1]
  for (const [mid, params] of [['first_order', { k: 0.1 }], ['zero_order', { k: 0.02 }], ['higuchi', { k: 0.08 }], ['korsmeyer_peppas', { k: 0.05, n: 0.6 }]]) {
    let prev = -1;
    for (let t = 0; t <= 60; t += 2) {
      const f = rm.fractionReleased(mid, params, t);
      ok(f >= prev - 1e-9 && f <= 1 + 1e-9, `${mid} F(${t}) monotonic non-decreasing and <=1`);
      prev = f;
    }
  }

  // --- schematic nucleus (membrane + interior + label only) ---
  ok(ireg.nucleus && ireg.nucleus.label && ireg.nucleus.radius_fraction, 'schematic nucleus geometry present');
  const nucGeom = { ...ireg.nucleus }; delete nucGeom.note; // geometry fields only (not the explanatory note)
  const nucKeys = JSON.stringify(nucGeom).toLowerCase();
  for (const f of ['dna', 'chromosome', 'nucleolus', 'histone', 'rna', 'transcription']) ok(!nucKeys.includes(f), `nucleus geometry defines no ${f}`);
  for (const f of ['DNA_binding', 'transcription', 'translation', 'receptor_signalling', 'apoptosis', 'pharmacodynamics', 'nuclear_pore', 'importin', 'cell_death']) {
    ok(ireg.integrity.forbidden.includes(f), `registry forbids ${f}`);
  }

  // helper: full stack with optional patched escape + intracellular profiles
  const build = (species, opts = {}) => {
    const er = JSON.parse(JSON.stringify(ereg));
    const ir = JSON.parse(JSON.stringify(ireg));
    if (opts.escape) er.formulations.B1_nlc.escape = { state: 'efficient', escape_probability: 1.0, evidence_level: 'PREDICTIVE', basis: 'test' };
    if (opts.intra) ir.formulations.B1_nlc.intracellular_release = opts.intra;
    if (opts.degradation) ir.formulations.B1_nlc.degradation = opts.degradation;
    if (opts.targeting) ir.formulations.B1_nlc.nucleus_targeting = opts.targeting;
    const eng = new TransportEngine({ transportModel: new TransportModel(treg), anatomyModel: new AnatomyModel(areg, { species }), stateMachine: new BiologicalStateMachine(treg), evidenceEngine: evidence, species, seed: 3 });
    const rel = new ReleaseEngine({ releaseModel: new ReleaseModel(rreg), transportEngine: eng, evidenceEngine: evidence });
    const up = new UptakeEngine({ registry: mreg, cellField: new CellField(mreg), transportEngine: eng, releaseEngine: rel, evidenceEngine: evidence, species, seed: 5 });
    const endo = new EndocytosisEngine({ registry: er, fsm: new EndocytosisFSM(er), uptakeEngine: up, evidenceEngine: evidence, species, seed: 7 });
    const intra = new IntracellularReleaseEngine({ registry: ir, releaseModel: new IntracellularReleaseModel(ir), endocytosisEngine: endo, uptakeEngine: up, evidenceEngine: evidence, species, seed: 11 });
    return { eng, rel, up, endo, intra };
  };

  // --- B1 (real registry): intracellular NOT REPORTED -> idle (honest) ---
  const b1 = build('rat');
  b1.eng.spawn(8); b1.eng.run(1200); b1.rel.run(300); b1.up.run(400); b1.endo.run(600); b1.intra.run(300);
  eq(b1.intra.evidenceLevelName(), 'NOT_REPORTED', 'B1 intracellular release is Not Reported');
  ok(b1.intra.isBlocked(), 'B1 intracellular engine is blocked (idle)');
  eq(b1.intra.molecules.length, 0, 'B1 produces no intracellular drug (no escape + NOT REPORTED)');

  // --- no intracellular release before intracellular localization ---
  const p = build('rat', { escape: true, intra: { model: 'first_order', params: { k: 0.15 }, evidence_level: 'PREDICTIVE' }, targeting: { mode: 'evidence_supported', evidence_level: 'PREDICTIVE' }, degradation: { mode: 'partial', params: { rate_per_step: 0.01, residual_fraction: 0.5 }, evidence_level: 'PREDICTIVE' } });
  p.eng.spawn(8); p.eng.run(1200); p.rel.run(300); p.up.run(400);
  ok(!p.intra.isBlocked(), 'patched intracellular release is supported (Predictive)');
  p.intra.step(); p.intra.step(); // carriers not yet in cytoplasm (endocytosis not run)
  eq(p.intra.molecules.length, 0, 'no intracellular release before a carrier reaches the cytoplasm');
  p.endo.run(600);
  const cytoCarriers = [...p.endo.states.values()].filter((s) => s.state === 'CYTOPLASM').length;
  ok(cytoCarriers > 0, 'carriers reach the cytoplasm (escape supported)');

  // --- release happens after localization (needs t>0); counts conserved ---
  p.intra.run(40);
  ok(p.intra.molecules.length > 0, 'intracellular drug released after localization');
  eq(p.intra.molecules.length, p.intra.expectedMoleculeCount(), 'molecule count equals released payload (quantised)');
  const carrierIdsBefore = new Set(p.eng.particles.map((c) => c.id));
  p.intra.run(400);
  // carrier conserved (transport particles untouched)
  eq(p.eng.particles.length, carrierIdsBefore.size, 'carriers conserved (transport untouched)');
  ok(p.eng.particles.every((c) => carrierIdsBefore.has(c.id)), 'no carrier created/destroyed by intracellular release');
  // molecule count conserved: alive + degraded == total
  const st = p.intra.stats();
  eq(st.alive + st.degraded, st.total, 'molecule count conserved (alive + degraded = total)');

  // --- degradation valid (partial keeps a residual) ---
  ok(st.degraded > 0, 'partial degradation degrades some molecules');
  ok(st.alive > 0, 'partial degradation keeps a residual alive');

  // --- diffusion inside cytoplasm only; never inside nucleus; no neighbour crossing ---
  let outsideCell = 0; let insideNucleus = 0;
  for (const m of p.intra.molecules) {
    const cell = p.up.cells.cells.find((c) => c.id === m.cellId);
    const nuc = p.intra.nucleusFor(cell);
    const dc = Math.hypot(m.x - cell.x, m.u - cell.u);
    const dn = Math.hypot(m.x - nuc.x, m.u - nuc.u);
    if (dc > cell.radius + 1e-6) outsideCell += 1;
    if (dn < nuc.radius - 1e-6) insideNucleus += 1;
  }
  eq(outsideCell, 0, 'intracellular drug never leaves its cell (no neighbour crossing)');
  eq(insideNucleus, 0, 'intracellular drug never enters the nucleus (no automatic nuclear entry)');

  // --- nucleus targeting only when enabled ---
  const noTarget = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targeting: { mode: 'none', evidence_level: 'NOT_REPORTED' } });
  noTarget.eng.spawn(6); noTarget.eng.run(1200); noTarget.rel.run(300); noTarget.up.run(400); noTarget.endo.run(600); noTarget.intra.run(400);
  eq(noTarget.intra.targetingMode(), 'none', 'targeting off when not enabled');
  eq(noTarget.intra.stats().nuclearMembrane, 0, 'no molecule reaches the nuclear membrane without targeting');
  ok(noTarget.intra.stats().cytoplasm > 0, 'untargeted drug stays in the cytoplasm');

  const withTarget = build('rat', { escape: true, intra: { model: 'burst', params: {}, evidence_level: 'PREDICTIVE' }, targeting: { mode: 'evidence_supported', evidence_level: 'PREDICTIVE' } });
  withTarget.eng.spawn(6); withTarget.eng.run(1200); withTarget.rel.run(300); withTarget.up.run(400); withTarget.endo.run(600); withTarget.intra.run(600);
  ok(withTarget.intra.stats().nuclearMembrane > 0, 'targeted drug reaches the nuclear membrane (only when enabled)');

  // --- molecule object fields ---
  const m0 = withTarget.intra.molecules[0];
  for (const key of ['id', 'parentCarrierId', 'species', 'x', 'u', 'vx', 'vu', 'diffusion', 'releaseTimeH', 'compartment', 'alive', 'evidenceLevel', 'targetCompartment']) {
    ok(key in m0, `intracellular molecule exposes ${key}`);
  }
  ok(!('dna' in m0) && !('rna' in m0), 'molecule has no DNA/RNA objects');

  // --- species switching clears intracellular objects ---
  withTarget.eng.setSpecies('human'); withTarget.endo.setSpecies('human'); withTarget.intra.setSpecies('human');
  eq(withTarget.intra.molecules.length, 0, 'species switch clears intracellular molecules (no stale objects)');

  // --- full app: chain runs; B1 intracellular idle (NOT REPORTED); panel has the level ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.intracellular && app.intracellular.engine, 'app exposes the intracellular engine');
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.uptake.engine.run(1000); app.endocytosis.engine.run(600); app.intracellular.engine.run(300);
  app.renderer.draw();
  eq(app.intracellular.engine.evidenceLevelName(), 'NOT_REPORTED', 'app B1 intracellular = Not Reported (idle)');
  eq(app.intracellular.engine.molecules.length, 0, 'app B1 produces no intracellular drug (honest)');
  ok(Array.isArray(app.renderer.lastNucleusFrame), 'renderer produced a nucleus frame array');
  ok(Array.isArray(app.renderer.lastIntracellularFrame), 'renderer produced an intracellular-drug frame array');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.intracellularRelease, 'NOT_REPORTED', 'panel shows Intracellular Release = Not Reported');
  eq(el.transport, 'EXPERIMENTAL', 'panel: rat transport still Experimental (previous phases unchanged)');
  eq(el.endocytosis, 'PREDICTIVE', 'panel: endocytosis still Predictive (unchanged)');
  app.setSpecies('rat');
}
