import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { AnatomyModel } from '../src/anatomy/anatomyModel.js';
import { TransportModel } from '../src/biology/transportModel.js';
import { BiologicalStateMachine } from '../src/biology/transportStates.js';
import { TransportEngine, computeLayerBands } from '../src/biology/transportEngine.js';
import { TransportAnimator } from '../src/biology/transportAnimator.js';
import { Particle } from '../src/biology/particle.js';
import { EvidenceEngine } from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

const PATHWAY = ['formulation', 'skin_surface', 'stratum_corneum', 'viable_epidermis', 'dermis', 'target_region'];

export default async function run() {
  section('biological transport (Phase 3)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const areg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const treg = await loader.load(APP_CONFIG.transportSources.transport, 'generic');
  const evidence = new EvidenceEngine();

  // --- biological state machine: single cited linear pathway ---
  const sm = new BiologicalStateMachine(treg);
  eq(sm.order(), PATHWAY, 'state machine is the topical->target pathway');
  const v = sm.validate();
  ok(v.ok, 'state machine validates (linear + covers all states + every transition cited)');
  ok(v.allCited, 'every transition carries evidence');
  eq(sm.next('formulation'), 'skin_surface', 'formulation -> skin_surface');
  eq(sm.next('dermis'), 'target_region', 'dermis -> target_region');
  ok(sm.isTerminal('target_region'), 'target_region is terminal');
  ok(sm.evidenceForTransition('stratum_corneum').referenceIds.includes('chen_2012'), 'SC crossing cites Chen 2012');

  // --- transport model: evidence-based barrier ordering + no active transport ---
  const tm = new TransportModel(treg);
  ok(tm.mobilityFor('stratum_corneum') < tm.mobilityFor('viable_epidermis'), 'SC less mobile than viable epidermis (rate-limiting)');
  ok(tm.mobilityFor('viable_epidermis') < tm.mobilityFor('dermis'), 'viable epidermis less mobile than dermis');
  for (const b of ['stratum_corneum', 'viable_epidermis', 'dermis']) {
    const bar = tm.barrier(b);
    ok(bar && typeof bar.rationale === 'string' && bar.rationale.length > 0, `${b} barrier has a biological rationale (not arbitrary)`);
    eq(bar.basis, 'SCHEMATIC_ORDINAL', `${b} mobility flagged schematic ordinal (not a measured D)`);
  }
  ok(!tm.activeMechanismIds().includes('active_transport'), 'active transport is EXCLUDED (never animated)');
  ok(tm.mechanism('brownian_motion') && tm.mechanism('concentration_gradient'), 'brownian + concentration mechanisms defined');
  ok(tm.notToScale === true, 'transport flagged not-to-scale');
  ok(Array.isArray(treg.integrity.excluded_downstream) && treg.integrity.excluded_downstream.includes('drug_release'), 'downstream biology (drug release etc.) explicitly excluded');

  // --- Phase 3.1: Evidence Level system (Experimental / Predictive / Unavailable) ---
  eq(tm.evidenceLevelFor('rat'), 'EXPERIMENTAL', 'rat = Experimental');
  eq(tm.evidenceLevelFor('human'), 'PREDICTIVE', 'human = Predictive');
  eq(tm.evidenceLevelFor('mouse'), 'PREDICTIVE', 'mouse = Predictive');
  eq(tm.evidenceLevelFor('llama'), 'UNAVAILABLE', 'unknown species = Unavailable (never silently promoted)');
  ok(tm.canAnimateSpecies('rat') && tm.canAnimateSpecies('human') && tm.canAnimateSpecies('mouse'), 'experimental + predictive species animate');
  ok(!tm.canAnimateSpecies('llama'), 'unavailable species does not animate');
  // the gate: experimental + predictive pass; unavailable blocked
  ok(evidence.canAnimate(tm.evidenceForSpecies('rat')), 'gate allows rat (experimental)');
  ok(evidence.canAnimate(tm.evidenceForSpecies('human')), 'gate allows human (predictive)');
  ok(evidence.canAnimate(tm.evidenceForSpecies('mouse')), 'gate allows mouse (predictive)');
  ok(!evidence.canAnimate(tm.evidenceForSpecies('llama')), 'gate blocks an unavailable species');
  // confidence carries the mode
  eq(tm.evidenceForSpecies('rat').confidence, 'QUALITATIVELY_SUPPORTED', 'rat confidence = experimental (qualitatively supported)');
  eq(tm.evidenceForSpecies('human').confidence, 'MECHANISTIC_TRANSFER', 'human confidence = predictive (mechanistic transfer)');
  eq(tm.evidenceForSpecies('mouse').confidence, 'MECHANISTIC_TRANSFER', 'mouse confidence = predictive (mechanistic transfer)');
  // NO rat parameters / citations leak into predictions (no fallback)
  ok(tm.evidenceForSpecies('rat').referenceIds.includes('chen_2012'), 'rat cites Chen 2012');
  eq(tm.evidenceForSpecies('human').referenceIds.length, 0, 'human carries NO permeation references (no rat fallback)');
  eq(tm.evidenceForSpecies('mouse').referenceIds.length, 0, 'mouse carries NO permeation references (no rat fallback)');
  ok(!tm.evidenceForSpecies('human').referenceIds.includes('chen_2012'), 'human never claims Chen 2012');
  ok(tm.evidenceForSpecies('human').principleRefs.length > 0, 'human predictive mode exposes principle references (transparent basis)');
  // clear, non-deceptive messages
  ok(/Predictive/.test(tm.messageFor('human')) && /not .*validated/i.test(tm.messageFor('human')), 'human message: Predictive + not experimentally validated');
  ok(/Predictive/.test(tm.messageFor('mouse')), 'mouse message: Predictive');
  ok(/Experimental/.test(tm.messageFor('rat')), 'rat message: Experimental');

  // --- particle objects are independent, uniquely identified, species-tagged ---
  Particle._resetSequence();
  const pa = new Particle({ species: 'rat' });
  const pb = new Particle({ species: 'rat' });
  ok(pa.id !== pb.id, 'particles have unique ids');
  ok(pa.compatibleWith('rat') && !pa.compatibleWith('human'), 'particle species compatibility (no cross-species)');

  // --- engine (rat): particles travel formulation -> target region ---
  const ratAnatomy = new AnatomyModel(areg, { species: 'rat' });
  const engine = new TransportEngine({ transportModel: tm, anatomyModel: ratAnatomy, stateMachine: sm, evidenceEngine: evidence, species: 'rat', seed: 12345 });
  ok(!engine.isBlocked(), 'rat engine not blocked');
  const spawned = engine.spawn(14);
  eq(spawned.length, 14, 'spawned 14 particles');
  eq(engine.stats().arrived, 0, 'none arrived at spawn');
  const result = engine.run(1000);
  eq(engine.stats().arrived, 14, 'all particles arrive at the target region');
  ok(engine.particles.every((p) => p.transportStatus === 'arrived'), 'every particle status = arrived');
  ok(result.events.some((e) => e.type === 'arrival'), 'arrival events emitted');
  ok(result.events.every((e) => !e.evidence || typeof e.evidence.confidence === 'string'), 'every transition event carries evidence');

  // each particle traversed the pathway IN ORDER (no skipped-backward states) and crossed the SC barrier
  const idx = (s) => PATHWAY.indexOf(s);
  for (const p of engine.particles) {
    eq(p.crossings[0].from, 'formulation', 'each particle starts at the formulation');
    const seq = p.crossings.map((c) => idx(c.to));
    ok(seq.every((n, i) => i === 0 || n > seq[i - 1]), 'state transitions are monotonic along the pathway');
    eq(p.state, 'target_region', 'each particle ends in the target region');
    const toStates = p.crossings.map((c) => c.to);
    const fromStates = p.crossings.map((c) => c.from);
    ok(toStates.includes('stratum_corneum') && fromStates.includes('stratum_corneum'), 'each particle entered AND exited the SC barrier');
  }

  // --- engine (human/mouse): PREDICTIVE mode - animates via its OWN anatomy, no rat copy ---
  const ratBands = computeLayerBands(new AnatomyModel(areg, { species: 'rat' }), 'rat');
  const ratDermisStart = ratBands.find((b) => b.id === 'dermis').start;
  for (const sp of ['human', 'mouse']) {
    const anat = new AnatomyModel(areg, { species: sp });
    const eng = new TransportEngine({ transportModel: tm, anatomyModel: anat, stateMachine: sm, evidenceEngine: evidence, species: sp, seed: 12345 });
    ok(!eng.isBlocked(), `${sp} animates (predictive, not blocked)`);
    eq(eng.evidenceLevelName(), 'PREDICTIVE', `${sp} engine reports Predictive`);
    ok(eng.isPredictive(), `${sp} isPredictive() true`);
    eq(eng.spawn(12).length, 12, `${sp} spawns particles in predictive mode`);
    eng.run(1200);
    eq(eng.stats().arrived, 12, `${sp} predictive particles reach the target region`);
    // uses this species' OWN anatomy depth bands (not rat's) -> not copied
    ok(Math.abs(eng._bandById.get('dermis').start - ratDermisStart) > 1e-3, `${sp} uses its own dermis depth (not rat's)`);
  }

  // --- species switching: engine follows the selection (evidence level + depths) ---
  const sw = new TransportEngine({ transportModel: tm, anatomyModel: new AnatomyModel(areg, { species: 'human' }), stateMachine: sm, evidenceEngine: evidence, species: 'human', seed: 12345 });
  eq(sw.evidenceLevelName(), 'PREDICTIVE', 'starts Predictive on human');
  ok(!sw.isBlocked(), 'human animates (predictive)');
  const humanDermis = { ...sw._bandById.get('dermis') };
  sw.anatomy.setSpecies('rat'); // anatomy follows selection first (as the app wires it)
  sw.setSpecies('rat');
  eq(sw.evidenceLevelName(), 'EXPERIMENTAL', 'switches to Experimental on rat (modes do not mix)');
  const ratDermis = sw._bandById.get('dermis');
  ok(Math.abs(humanDermis.start - ratDermis.start) > 1e-3, 'barrier depths differ by species (species-driven)');
  sw.spawn(10); sw.run(1000);
  eq(sw.stats().arrived, 10, 'rat particles arrive after the switch');

  // --- determinism: same seed -> same result ---
  const mk = () => { const e = new TransportEngine({ transportModel: tm, anatomyModel: new AnatomyModel(areg, { species: 'rat' }), stateMachine: sm, evidenceEngine: evidence, species: 'rat', seed: 777 }); e.spawn(8); e.run(1000); return e; };
  const e1 = mk(); const e2 = mk();
  eq(e1.stats().arrived, e2.stats().arrived, 'deterministic arrival count under a fixed seed');
  ok(Math.abs(e1.particles[0].x - e2.particles[0].x) < 1e-9, 'deterministic particle position under a fixed seed');

  // --- animator: headless run to completion (spawn/move/cross/arrive) ---
  const anim = new TransportAnimator({ engine: new TransportEngine({ transportModel: tm, anatomyModel: new AnatomyModel(areg, { species: 'rat' }), stateMachine: sm, evidenceEngine: evidence, species: 'rat', seed: 5 }), spawnCount: 12, maxSteps: 2000 });
  const summary = anim.runHeadless();
  ok(!summary.blocked, 'animator runs for rat');
  eq(summary.stats.arrived, 12, 'animator drives all particles to arrival');
  // UNAVAILABLE mode (third confidence mode): engine blocks; animator is a no-op.
  const uReg = JSON.parse(JSON.stringify(treg));
  uReg.species_transport.human.evidence_level = 'UNAVAILABLE';
  uReg.species_transport.human.confidence = 'NOT_REPORTED';
  const uModel = new TransportModel(uReg);
  const uEng = new TransportEngine({ transportModel: uModel, anatomyModel: new AnatomyModel(areg, { species: 'human' }), stateMachine: sm, evidenceEngine: evidence, species: 'human' });
  ok(uEng.isBlocked(), 'UNAVAILABLE species is blocked (third mode)');
  eq(uEng.spawn(10).length, 0, 'UNAVAILABLE spawn is a no-op');
  ok(new TransportAnimator({ engine: uEng, spawnCount: 12 }).runHeadless().blocked, 'animator is a no-op for an unavailable species');

  // --- full app: transport wired, species-driven, evidence-labelled, renderer draws particles ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.transport && app.transport.engine, 'app exposes the transport engine');
  eq(app.transport.evidenceLevel(), 'PREDICTIVE', 'app default species (human) => Predictive mode');
  ok(!app.transport.isBlocked(), 'human predictive transport animates');

  app.setSpecies('rat');
  eq(app.transport.evidenceLevel(), 'EXPERIMENTAL', 'app.setSpecies(rat) => Experimental (species-driven)');
  app.transport.spawn(12);
  app.transport.engine.run(1000);
  app.renderer.draw();
  eq(app.transport.engine.stats().arrived, 12, 'rat (experimental) delivers particles to the target');
  ok(Array.isArray(app.renderer.lastParticleFrame) && app.renderer.lastParticleFrame.length === 12, 'renderer produced a particle frame');
  ok(app.renderer.lastParticleFrame.every((pt) => pt.x >= 0 && pt.x <= app.renderer.viewport.width && pt.y >= 0 && pt.y <= app.renderer.viewport.height), 'particles map inside the viewport');
  ok(app.renderer.lastLayout && app.renderer.lastLayout.bands.length >= 5, 'static anatomy still rendered beneath particles (unchanged)');
  ok(/Experimental/.test(app.panelModels.information.transportEvidence.message), 'info panel shows Experimental for rat');

  // predictive species also delivers, via its OWN anatomy, clearly labelled - modes never mix
  app.setSpecies('mouse');
  eq(app.transport.evidenceLevel(), 'PREDICTIVE', 'mouse => Predictive');
  app.transport.spawn(12);
  app.transport.engine.run(1200);
  app.renderer.draw();
  eq(app.transport.engine.stats().arrived, 12, 'mouse (predictive) delivers particles to the target');
  ok(app.panelModels.information.transportEvidence && /Predictive/.test(app.panelModels.information.transportEvidence.message), 'info panel shows the Predictive evidence label for mouse');
  app.setSpecies('human');
  eq(app.transport.evidenceLevel(), 'PREDICTIVE', 'human => Predictive; rat experimental record never overwritten');
}
