import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { AnatomyModel } from '../src/anatomy/anatomyModel.js';
import { TransportModel } from '../src/biology/transportModel.js';
import { BiologicalStateMachine } from '../src/biology/transportStates.js';
import { TransportEngine } from '../src/biology/transportEngine.js';
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

  // --- evidence gating per species (no fallback to human/rat) ---
  ok(tm.isSupportedForSpecies('rat'), 'rat topical transport is supported (Chen 2012)');
  ok(!tm.isSupportedForSpecies('human'), 'human topical transport NOT supported (NOT REPORTED)');
  ok(!tm.isSupportedForSpecies('mouse'), 'mouse topical transport NOT supported (NOT REPORTED)');
  ok(evidence.canAnimate(tm.evidenceForSpecies('rat')), 'evidence gate allows rat transport');
  ok(!evidence.canAnimate(tm.evidenceForSpecies('human')), 'evidence gate BLOCKS human transport');
  ok(!evidence.canAnimate(tm.evidenceForSpecies('mouse')), 'evidence gate BLOCKS mouse transport');
  eq(tm.evidenceForSpecies('human').referenceIds.length, 0, 'human carries NO rat references (no fallback)');
  ok(tm.evidenceForSpecies('rat').referenceIds.includes('chen_2012'), 'rat transport cites Chen 2012');

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

  // --- engine (human/mouse): blocked, no particles, no motion, no fallback ---
  for (const sp of ['human', 'mouse']) {
    const anat = new AnatomyModel(areg, { species: sp });
    const eng = new TransportEngine({ transportModel: tm, anatomyModel: anat, stateMachine: sm, evidenceEngine: evidence, species: sp, seed: 12345 });
    ok(eng.isBlocked(), `${sp} engine blocked (NOT REPORTED)`);
    eq(eng.spawn(14).length, 0, `${sp} spawn is a no-op (no fallback)`);
    eq(eng.step().length, 0, `${sp} step is a no-op`);
    eq(eng.particles.length, 0, `${sp} has zero particles`);
    ok(typeof eng.blockReason() === 'string' && eng.blockReason().length > 0, `${sp} exposes a block reason`);
  }

  // --- species switching: an engine follows the selected species (gate + depths) ---
  const sw = new TransportEngine({ transportModel: tm, anatomyModel: new AnatomyModel(areg, { species: 'human' }), stateMachine: sm, evidenceEngine: evidence, species: 'human', seed: 12345 });
  ok(sw.isBlocked(), 'starts blocked on human');
  const humanDermis = { ...sw._bandById.get('dermis') };
  sw.anatomy.setSpecies('rat'); // anatomy follows selection first (as the app wires it)
  sw.setSpecies('rat');
  ok(!sw.isBlocked(), 'unblocks when switched to rat');
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
  const blockedAnim = new TransportAnimator({ engine: new TransportEngine({ transportModel: tm, anatomyModel: new AnatomyModel(areg, { species: 'human' }), stateMachine: sm, evidenceEngine: evidence, species: 'human' }), spawnCount: 12 });
  ok(blockedAnim.runHeadless().blocked, 'animator is a no-op for a blocked species');

  // --- full app: transport wired, species-driven, renderer draws particles ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.transport && app.transport.engine, 'app exposes the transport engine');
  ok(app.transport.isBlocked(), 'app default species (human) => transport blocked');
  app.setSpecies('rat');
  ok(!app.transport.isBlocked(), 'app.setSpecies(rat) unblocks transport (species-driven)');
  app.transport.spawn(12);
  app.transport.engine.run(1000);
  app.renderer.draw();
  eq(app.transport.engine.stats().arrived, 12, 'app transport delivers particles to the target');
  ok(Array.isArray(app.renderer.lastParticleFrame) && app.renderer.lastParticleFrame.length === 12, 'renderer produced a particle frame');
  ok(app.renderer.lastParticleFrame.every((pt) => pt.x >= 0 && pt.x <= app.renderer.viewport.width && pt.y >= 0 && pt.y <= app.renderer.viewport.height), 'particles map inside the viewport');
  ok(app.renderer.lastLayout && app.renderer.lastLayout.bands.length >= 5, 'static anatomy still rendered beneath particles (unchanged)');
  // switching to a blocked species clears transport (no fallback), anatomy still fine
  app.setSpecies('mouse');
  ok(app.transport.isBlocked(), 'switching to mouse re-blocks transport');
  eq(app.transport.engine.particles.length, 0, 'mouse has no particles (cleared, no fallback)');
  app.setSpecies('human');
}
