// Phase-5B.2 SIGNAL PROPAGATION ENGINE tests. Validates the first RUNTIME signaling
// layer: node activation, edge propagation with delay, competition, thresholds, decay
// / auto-deactivation, feedback stability, prediction propagation + toggling, evidence
// overlays, timeline, determinism, species switching, renderer frame, full-app wiring,
// and that Phases 1-5B.1 remain unchanged.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { loadSignalGraph } from '../src/biology/signalGraph.js';
import { SignalPropagationEngine, OVERLAY_MODES } from '../src/biology/signalPropagationEngine.js';
import {
  SIGNAL_PREDICTION_LEVELS, isRuntimePrediction, isRuntimeExperimental,
  isRuntimePredictionLevel, SIGNAL_EVIDENCE_LEVELS,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('signal propagation engine (Phase 5B.2)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const graph = await loadSignalGraph(loader, APP_CONFIG.signalSources);
  const preg = await loader.load(APP_CONFIG.signalPropagationSources.propagation, 'generic');
  const DT = 0.5;
  const build = (species, opts = {}) => new SignalPropagationEngine({ signalGraph: graph, propagationRegistry: preg, species, ...opts });

  // ---- runtime prediction vocabulary (additive; 5B.1 array unchanged) ----
  eq(SIGNAL_EVIDENCE_LEVELS.length, 9, '5B.1 signal evidence vocabulary unchanged (still 9)');
  eq(SIGNAL_PREDICTION_LEVELS.length, 5, 'runtime prediction vocabulary has 5 levels');
  ok(SIGNAL_PREDICTION_LEVELS.includes('HYPOTHESIS'), 'HYPOTHESIS is a runtime prediction level');
  ok(isRuntimeExperimental('EXPERIMENTAL') && !isRuntimeExperimental('HYPOTHESIS'), 'experimental classifier');
  ok(isRuntimePrediction('MECHANISTIC_PREDICTION') && isRuntimePrediction('HYPOTHESIS') && !isRuntimePrediction('EXPERIMENTAL'), 'prediction classifier incl HYPOTHESIS');
  ok(isRuntimePredictionLevel('LITERATURE_DERIVED_PREDICTION') && !isRuntimePredictionLevel('NONSENSE'), 'level validity');

  // ---- registry runtime vocab ----
  for (const s of ['inactive', 'transitioning', 'partial', 'active', 'suppressed', 'degraded']) ok(preg.runtime_states.includes(s), `runtime state present: ${s}`);
  for (const m of OVERLAY_MODES) ok(preg.evidence_overlay_modes.includes(m), `overlay mode present: ${m}`);

  // ---- node activation + edge propagation (H1 activation cascade) ----
  const h = build('human');
  eq(h.node('h1_ros').state, 'inactive', 'ROS starts inactive');
  h.run(120, DT); // 60h
  // the whole H1 activation cascade fired at some point (timeline is the record)
  const tl = h.getTimeline();
  for (const id of ['h1_ros', 'h1_erk', 'h1_p38', 'h1_nrf2', 'h1_are', 'h1_ho1']) {
    ok(tl.some((t) => t.nodeId === id && t.event === 'activated'), `H1 node activated at runtime: ${id}`);
  }
  // propagation ordering: ROS activates before HO-1 (signal travels downstream)
  const tRos = tl.find((t) => t.nodeId === 'h1_ros' && t.event === 'activated').timeH;
  const tHo1 = tl.find((t) => t.nodeId === 'h1_ho1' && t.event === 'activated').timeH;
  ok(tRos < tHo1, 'signal propagates downstream (ROS activates before HO-1)');

  // ---- threshold gating ----
  const hi = build('human');
  hi.step(DT); // one step: downstream nodes have not crossed threshold yet
  eq(hi.node('h1_ho1').state, 'inactive', 'far-downstream node below threshold after 1 step');
  ok(hi.node('h1_exposure').activity > 0, 'start node driven immediately');

  // ---- activation delay (fast entry activates before slow-delayed downstream) ----
  const dd = build('human');
  let rosT = null; let areT = null;
  for (let i = 0; i < 120 && (rosT === null || areT === null); i++) {
    dd.step(DT);
    if (rosT === null && dd.node('h1_ros').state === 'active') rosT = dd.timeH;
    if (areT === null && dd.node('h1_are').state === 'active') areT = dd.timeH;
  }
  ok(rosT !== null && areT !== null && rosT < areT, 'edge delay: ROS (fast) active before ARE (slow-delayed)');

  // ---- competition: Nrf2 converges from two MAPKs (weighted sum) ----
  const comp = build('human');
  comp.run(60, DT);
  ok(comp.node('h1_nrf2').activity > 0.2, 'Nrf2 receives combined input from ERK + p38 (competition)');

  // ---- suppression cascade (M1: baseline-active pathway driven down) ----
  const m = build('mouse');
  eq(m.node('m1_pi3k').state, 'active', 'baseline-active PI3K starts active');
  m.run(120, DT);
  for (const id of ['m1_pi3k', 'm1_akt', 'm1_mtor', 'm1_survival_output']) {
    eq(m.node(id).state, 'suppressed', `M1 suppression propagates: ${id} suppressed`);
  }
  ok(m.getTimeline().some((t) => t.event === 'suppressed'), 'suppression events recorded on timeline');

  // ---- H2 suppression (NF-kB) ----
  const h2 = build('human');
  h2.run(120, DT);
  eq(h2.node('h2_nfkb').state, 'suppressed', 'NF-kB suppressed by drug exposure');
  eq(h2.node('h2_inflammatory_output').state, 'suppressed', 'inflammatory output suppressed');

  // ---- signal decay + auto-deactivation (activity does not stay forever) ----
  const dec = build('human');
  dec.run(400, DT); // 200h - well past activation durations
  ok(dec.node('h1_ros').activity < 0.05, 'ROS decays after its activation lifetime');
  ok(dec.getTimeline().some((t) => t.nodeId === 'h1_ros' && t.event === 'deactivated'), 'auto-deactivation recorded');

  // ---- feedback stability (bounded; no oscillation explosion) ----
  const fb = build('human');
  let maxA = 0; for (let i = 0; i < 500; i++) { fb.step(DT); maxA = Math.max(maxA, fb.stats().maxActivity); }
  ok(maxA <= 1.0001, 'activity never exceeds max (no explosion)');
  const feEdge = fb.frame().edges.find((e) => e.id === 'h1_fb_ho1_ros');
  ok(feEdge && feEdge.sign === -1 && feEdge.predicted, 'predicted negative-feedback edge present (HO-1 -| ROS)');
  // feedback lowers ROS exposure integral vs a run without the feedback edge
  const rosArea = (pred) => { const e = build('human', { includePredictions: pred }); let a = 0; for (let i = 0; i < 120; i++) { e.step(DT); a += e.node('h1_ros').activity * DT; } return a; };
  ok(rosArea(true) < rosArea(false), 'feedback (predictions on) reduces cumulative ROS');

  // ---- prediction propagation (STIM1 -> Orai1 -> SOCE -> Ca2+) ----
  const pr = build('human');
  pr.run(120, DT);
  for (const id of ['p1_stim1', 'p1_orai1', 'p1_soce', 'p1_ca']) {
    ok(pr.node(id) && pr.node(id).predicted, `prediction node present + flagged predicted: ${id}`);
    ok(pr.getTimeline().some((t) => t.nodeId === id && t.event === 'activated'), `prediction node propagates: ${id}`);
  }
  eq(pr.node('p1_stim1').predictionLevel, 'MECHANISTIC_PREDICTION', 'STIM1 is a mechanistic prediction');
  ok(pr.node('p1_stim1').rationale && /prediction/i.test(pr.node('p1_stim1').rationale), 'prediction node carries a rationale');

  // ---- prediction toggling (never overwrites experimental) ----
  const on = build('human', { includePredictions: true });
  const off = build('human', { includePredictions: false });
  ok(on.node('p1_ca') && !off.node('p1_ca'), 'predictions toggle off removes prediction nodes');
  ok(off.node('h1_ros') && off.node('h1_nrf2'), 'experimental/frozen nodes remain when predictions off');
  eq(on.setPredictionsEnabled(false).node('p1_ca'), null, 'runtime toggle off drops prediction nodes');
  ok(on.setPredictionsEnabled(true).node('p1_ca') !== null, 'runtime toggle on restores prediction nodes');

  // ---- evidence overlay modes (data never mutated) ----
  const ov = build('human'); ov.run(60, DT);
  ov.setOverlayMode('experimental');
  const expFrame = ov.frame();
  eq(expFrame.nodes.filter((n) => n.predicted && n.visible).length, 0, 'experimental overlay hides prediction nodes');
  ok(expFrame.nodes.some((n) => !n.predicted && n.visible), 'experimental overlay still shows experimental nodes');
  ov.setOverlayMode('prediction');
  ok(ov.frame().nodes.filter((n) => n.visible).every((n) => n.predicted || isRuntimePrediction(n.predictionLevel)), 'prediction overlay shows only predictions');
  ov.setOverlayMode('combined');
  ok(ov.frame().nodes.every((n) => n.visible), 'combined overlay shows all');
  // overlay does not change underlying activity
  const aBefore = ov.node('h1_nrf2').activity; ov.setOverlayMode('experimental'); eq(ov.node('h1_nrf2').activity, aBefore, 'overlay switch does not mutate activity');

  // ---- timeline is ordered + continuous ----
  const times = h.getTimeline().map((t) => t.timeH);
  let ordered = true; for (let i = 1; i < times.length; i++) if (times[i] < times[i - 1]) ordered = false;
  ok(ordered, 'timeline events are time-ordered');

  // ---- determinism ----
  const d1 = build('human'); d1.run(200, DT); const d2 = build('human'); d2.run(200, DT);
  eq(JSON.stringify(d1.stats()), JSON.stringify(d2.stats()), 'deterministic stats across identical runs');
  eq(JSON.stringify(d1.getTimeline()), JSON.stringify(d2.getTimeline()), 'deterministic timeline');

  // ---- restart clears state ----
  const rs = build('human'); rs.run(100, DT); rs.restart();
  eq(rs.timeH, 0, 'restart resets time');
  eq(rs.getTimeline().length, 0, 'restart clears timeline');
  eq(rs.node('h1_ros').state, 'inactive', 'restart resets node state');

  // ---- species switching (rat idle; no signaling) ----
  const rat = build('rat');
  ok(rat.isIdle(), 'rat signal propagation is idle (NOT REPORTED)');
  eq(rat.stats().nodes, 0, 'rat has no signaling nodes');
  rat.run(100, DT); eq(rat.stats().active, 0, 'rat produces no active nodes');
  const sw = build('human'); sw.run(60, DT); sw.setSpecies('mouse');
  ok(!sw.node('h1_ros') && sw.node('m1_pi3k'), 'species switch rebuilds graph (human nodes gone, mouse present)');
  eq(sw.timeH, 0, 'species switch restarts time');
  sw.setSpecies('rat'); ok(sw.isIdle(), 'switch to rat -> idle');

  // ---- playback controls (deterministic step vs run) ----
  const pb = build('human'); for (let i = 0; i < 40; i++) pb.stepOnce(DT);
  const pr2 = build('human'); pr2.run(40, DT);
  eq(JSON.stringify(pb.stats()), JSON.stringify(pr2.stats()), 'stepOnce x40 == run(40) (deterministic playback)');
  pb.setSpeed(4); eq(pb.speed, 4, 'speed control set');

  // ---- summary level for the panel ----
  eq(build('human').summaryLevel(), 'PREDICTIVE', 'human signal summary = Predictive');
  eq(build('rat').summaryLevel(), 'NOT_REPORTED', 'rat signal summary = Not Reported');

  // ---- full app wiring + renderer frame + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.signalPropagation && app.signalPropagation.engine, 'app exposes the signal-propagation engine');
  app.setSpecies('human');
  app.signalPropagation.run(120, DT);
  app.renderer.draw();
  ok(Array.isArray(app.renderer.lastSignalFrame) && app.renderer.lastSignalFrame.length > 0, 'renderer produced a signal node frame');
  ok(Array.isArray(app.renderer.lastSignalEdgeFrame) && app.renderer.lastSignalEdgeFrame.length > 0, 'renderer produced a signal edge frame');
  ok(app.renderer.lastSignalFrame.some((n) => n.predicted), 'signal frame includes prediction nodes (distinct)');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.signalTransduction, 'PREDICTIVE', 'panel shows Signal Transduction = Predictive (human)');
  eq(el.transport, 'PREDICTIVE', 'previous phase unchanged: human transport Predictive (Phase 3.1)');
  eq(el.targetEngagement, 'NOT_REPORTED', 'previous phase unchanged: target engagement Not Reported');

  // rat: idle signaling; earlier layers still behave; panel says Not Reported
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.renderer.draw();
  eq(app.panelModels.evidence.evidenceLevels.signalTransduction, 'NOT_REPORTED', 'panel: rat Signal Transduction Not Reported');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');
  ok(app.signalPropagation.engine.isIdle(), 'rat signal engine idle after full run');
  app.setSpecies('rat');
}
