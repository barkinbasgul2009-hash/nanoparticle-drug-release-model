import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { AnatomyModel } from '../src/anatomy/anatomyModel.js';
import { TransportModel } from '../src/biology/transportModel.js';
import { BiologicalStateMachine } from '../src/biology/transportStates.js';
import { TransportEngine } from '../src/biology/transportEngine.js';
import { TransportAnimator } from '../src/biology/transportAnimator.js';
import { ReleaseModel } from '../src/biology/releaseModel.js';
import { ReleaseEngine } from '../src/biology/releaseEngine.js';
import { EvidenceEngine } from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('drug release (Phase 4)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const areg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const treg = await loader.load(APP_CONFIG.transportSources.transport, 'generic');
  const rreg = await loader.load(APP_CONFIG.releaseSources.release, 'generic');
  const evidence = new EvidenceEngine();

  // --- release model: evidence-selected first-order kinetics ---
  const rm = new ReleaseModel(rreg);
  eq(rm.modelId(), 'first_order', 'first-order model selected (Chen 2012)');
  eq(rm.fractionReleased(0, 0.0625), 0, 'nothing released at t=0');
  ok(rm.fractionReleased(1, 0.0625) < rm.fractionReleased(12, 0.0625), 'released fraction increases over time');
  ok(rm.fractionReleased(48, 0.0625) > 0.9, 'most payload released by the end of the reported window');
  ok(Math.abs(rm.fractionRemaining(12, 0.0625) + rm.fractionReleased(12, 0.0625) - 1) < 1e-9, 'remaining + released = 1 (conservation)');
  ok(!rm.rateIsReported(), 'rate constant k is NOT REPORTED (schematic)');
  const rev = rm.evidence();
  eq(rev.confidence, 'QUALITATIVELY_SUPPORTED', 'release model confidence = qualitatively supported');
  ok(rev.referenceIds.includes('chen_2012'), 'release model cites Chen 2012');
  ok(rev.limitations.some((l) => /NOT REPORTED/.test(l)), 'evidence flags the schematic (NOT REPORTED) rate');
  ok(evidence.canAnimate(rev), 'release model may animate (supported)');
  // scope guard: downstream biology is explicitly excluded
  for (const x of ['cellular_uptake', 'endocytosis', 'lysosome', 'pharmacokinetics', 'pharmacodynamics', 'apoptosis']) {
    ok(rm.excludedDownstream().includes(x), `release registry excludes ${x}`);
  }

  // helper to build a fresh rat transport engine that has delivered particles
  const buildArrived = (species, n, seed = 3) => {
    const anat = new AnatomyModel(areg, { species });
    const tm = new TransportModel(treg);
    const sm = new BiologicalStateMachine(treg);
    const eng = new TransportEngine({ transportModel: tm, anatomyModel: anat, stateMachine: sm, evidenceEngine: evidence, species, seed });
    eng.spawn(n); eng.run(1200);
    return eng;
  };

  // --- separation: release does NOT begin before transport ends (arrival) ---
  const preEng = new TransportEngine({ transportModel: new TransportModel(treg), anatomyModel: new AnatomyModel(areg, { species: 'rat' }), stateMachine: new BiologicalStateMachine(treg), evidenceEngine: evidence, species: 'rat', seed: 3 });
  const preRel = new ReleaseEngine({ releaseModel: rm, transportEngine: preEng, evidenceEngine: evidence });
  preEng.spawn(10);
  preEng.step(); preEng.step(); // particles moving, NOT arrived
  ok(preEng.particles.every((p) => p.transportStatus !== 'arrived'), 'particles have not arrived yet');
  preRel.step(); preRel.step();
  eq(preRel.states.size, 0, 'no release before arrival (transport must end first)');
  eq(preRel.stats().withState, 0, 'no payload released before arrival');

  // --- release dynamics: arrive -> release -> empty ---
  const eng = buildArrived('rat', 10);
  eq(eng.stats().arrived, 10, 'transport delivered all particles');
  const rel = new ReleaseEngine({ releaseModel: rm, transportEngine: eng, evidenceEngine: evidence });
  const startEvents = rel.step();
  ok(startEvents.some((e) => e.type === 'release_start'), 'release_start emitted once particles have arrived');
  const p0 = eng.particles[0];
  const early = { ...rel.stateFor(p0.id) };
  eq(early.releaseState, 'releasing', 'payload begins releasing after arrival');
  ok(early.payloadFraction < 1 && early.payloadFraction > 0, 'drug inside has begun to decrease');
  ok(early.releasedFraction > 0 && early.releasedFraction < 1, 'released amount has begun to increase');
  ok(Math.abs(early.payloadFraction + early.releasedFraction - 1) < 1e-9, 'payload + released = 1 (mass conservation)');

  // capture the transport position/state; release must NOT move particles
  const fixedX = p0.x; const fixedD = p0.d; const fixedStatus = p0.transportStatus;
  const runOut = rel.run(400);
  eq(p0.x, fixedX, 'release does not change particle x (transport unchanged)');
  eq(p0.d, fixedD, 'release does not change particle depth (transport unchanged)');
  eq(p0.transportStatus, fixedStatus, 'release does not change transport status (processes never mix)');

  const late = rel.stateFor(p0.id);
  eq(late.releaseState, 'empty', 'particle eventually becomes empty');
  eq(late.payloadFraction, 0, 'no drug remains inside an empty carrier');
  eq(late.releasedFraction, 1, 'all payload has been released');
  ok(rel.allEmpty(), 'every arrived particle empties');
  eq(rel.stats().empty, 10, 'all ten carriers are empty');
  ok(runOut.events.some((e) => e.type === 'release_complete'), 'release_complete emitted');

  // --- release curve updates over time and is monotonic non-decreasing ---
  const curve = rel.curve();
  ok(curve.length > 3, 'release curve accumulates points over time');
  ok(curve[0].released < curve[curve.length - 1].released, 'release curve rises over time');
  for (let i = 1; i < curve.length; i += 1) ok(curve[i].released >= curve[i - 1].released - 1e-9, 'release curve is non-decreasing');
  ok(Math.abs(curve[curve.length - 1].released - 1) < 1e-6, 'release curve reaches full release');

  // --- release is formulation-level: same model for predictive species (own transport) ---
  for (const sp of ['human', 'mouse']) {
    const e = buildArrived(sp, 8);
    eq(e.stats().arrived, 8, `${sp} predictive transport delivered particles`);
    const r = new ReleaseEngine({ releaseModel: rm, transportEngine: e, evidenceEngine: evidence });
    r.run(500);
    ok(r.allEmpty(), `${sp} carriers release + empty (formulation-level model, same kinetics)`);
    eq(r.evidenceDescriptor().confidence, 'QUALITATIVELY_SUPPORTED', `${sp} uses the formulation release model (not species-gated)`);
  }

  // --- determinism: identical seed -> identical release outcome ---
  const mk = () => { const e = buildArrived('rat', 6, 99); const r = new ReleaseEngine({ releaseModel: rm, transportEngine: e, evidenceEngine: evidence }); r.run(400); return r; };
  const r1 = mk(); const r2 = mk();
  eq(r1.stats().empty, r2.stats().empty, 'deterministic empty count under a fixed seed');
  ok(Math.abs(r1.stats().meanReleased - r2.stats().meanReleased) < 1e-9, 'deterministic mean release under a fixed seed');

  // --- animator drives transport THEN release to completion ---
  const animEng = new TransportEngine({ transportModel: new TransportModel(treg), anatomyModel: new AnatomyModel(areg, { species: 'rat' }), stateMachine: new BiologicalStateMachine(treg), evidenceEngine: evidence, species: 'rat', seed: 7 });
  const animRel = new ReleaseEngine({ releaseModel: rm, transportEngine: animEng, evidenceEngine: evidence });
  const anim = new TransportAnimator({ engine: animEng, releaseEngine: animRel, spawnCount: 10, maxSteps: 4000, untilReleased: true });
  const summary = anim.runHeadless();
  eq(summary.stats.arrived, 10, 'animator delivers all particles (transport)');
  eq(summary.release.empty, 10, 'animator then empties all carriers (release)');

  // --- full app: release wired, renderer shows payload emptying ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.release && app.release.engine, 'app exposes the release engine');
  app.setSpecies('rat');
  const runFull = app.transport.animator.runHeadless();
  eq(runFull.stats.arrived, app.transport.animator.spawnCount, 'app: all particles arrive');
  eq(runFull.release.empty, app.transport.animator.spawnCount, 'app: all carriers empty (arrive -> release -> empty)');
  app.renderer.draw();
  ok(app.renderer.lastParticleFrame.every((pt) => pt.payload <= 0.001), 'renderer particle frame shows empty payload');
  ok(app.renderer.lastParticleFrame.every((pt) => pt.releaseState === 'empty'), 'renderer sees release state = empty');
  ok(app.panelModels.information.release && app.panelModels.information.release.model === 'first_order', 'info panel exposes the release model');
  ok(app.renderer.lastLayout && app.renderer.lastLayout.bands.length >= 5, 'static anatomy still rendered beneath (unchanged)');
}
