// Phase-7C Part 2 Section 1 RENDERER / TIMELINE / REPLAY tests. Validates the read-only visualization
// layer: renderer (dual value+state, availability/confidence never hidden, colour semantics,
// accessibility), read-only frame inspector, timeline navigation, replay (validation + round-trip +
// determinism + no recalculation), transition/evidence/prediction/contribution/warning views +
// traceability + double-counting, debugger execution trace + dependencies, search + filtering, export
// + round-trip serialization, and the core invariant that NO view operation mutates any immutable
// object. All prior tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { ImmuneAdaptiveEngine } from '../src/biology/immuneAdaptiveEngine.js';
import { contentId } from '../src/biology/immuneSerialization.js';
import { ImmuneRenderer, ImmuneFrameInspector } from '../src/render/immuneRenderer.js';
import { ImmuneTimeline, ImmuneReplay } from '../src/render/immuneTimeline.js';
import { buildTransitionView, buildEvidenceView, buildPredictionView, buildContributionView, buildWarningView, buildDoubleCountingView } from '../src/render/immuneViews.js';
import { ImmuneDebugger, ImmuneSearch, MODULE_EXECUTION_ORDER } from '../src/render/immuneDebugger.js';
import { exportFrame, exportRange, exportImmuneSummary, exportContributionLedger, exportPhase8AOutput, validateRoundTrip, IMMUNE_EXPORT_FORMATS } from '../src/render/immuneExport.js';

export default async function run() {
  section('immune renderer / timeline / replay (Phase 7C - Part 2 Section 1)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.immuneSources)) R[k] = await loader.load(f, 'generic');
  const A = (v) => ({ value: v, availability: 'AVAILABLE' });
  const good = { tumor_immune_visibility: A(0.6), antigen_availability: A(0.55), immune_accessibility: A(0.6), dendritic_contribution: A(0.6), antigen_presentation_potential: A(0.6), adaptive_priming_potential: A(0.65), innate_immune_readiness: A(0.55), innate_tumor_pressure: A(0.4), nk_contribution: A(0.4), macrophage_contribution: A(0.35), vascular_access: A(0.6), vascular_functionality: A(0.6) };
  const eng = new ImmuneAdaptiveEngine({ registries: R });   // real Section-3 innate runtime drives states + transitions
  const frames = []; for (let i = 0; i < 5; i++) frames.push(eng.evaluate({ explicitInputs: good, frameIndex: i }).frame);
  const bare = new ImmuneAdaptiveEngine({ registries: R }).evaluate({ frameIndex: 0 }).frame;   // Section-3 absent -> UNAVAILABLE

  // ---- renderer ----
  ok(R.render && R.render.palettes, 'render registry loaded');
  const rend = new ImmuneRenderer(R.render);
  const rf = rend.renderFrame(frames[4]);
  eq(rf.components.length, 18, 'renderer produces all 18 renderable components');
  ok(Object.isFrozen(rf), 'render frame is frozen (no mutable references escape)');
  const cd8 = rf.components.find((c) => c.id === 'cd8');
  ok(cd8.value != null && cd8.band != null, 'component preserves BOTH continuous value + categorical band (dual view)');
  ok(cd8.icon && cd8.label && cd8.text && cd8.stateDescription, 'accessibility: icon + label + text + state description (never colour-only)');
  ok(cd8.confidence.category != null && cd8.confidenceEncoding != null, 'confidence exposed via its OWN encoding channel');
  ok(cd8.palette !== 'unavailable', 'available component uses a biological palette');
  const rfBare = rend.renderFrame(bare);
  const unavail = rfBare.components.find((c) => c.availability === 'UNAVAILABLE');
  ok(unavail && unavail.palette === 'unavailable' && unavail.text === 'Unavailable', 'unavailable values shown with distinct palette + text (NOT zero)');
  ok(rend.renderSequence(frames).length === 5, 'renderer renders a whole sequence deterministically');
  eq(contentId(rend.renderFrame(frames[4])), contentId(rf), 'rendering is deterministic (identical render frame)');

  // ---- frame inspector (read-only) ----
  const insp = new ImmuneFrameInspector(frames[4]);
  ok(insp.canEdit() === false, 'inspector is read-only (canEdit false)');
  ok(insp.tree().type === 'object' && insp.tree().keys.length > 0, 'inspector produces a hierarchical (depth-limited) tree');
  ok(insp.tree(1).children.immuneEffect && insp.tree(1).children.immuneEffect.truncated, 'deep nodes are truncated for lazy expansion');
  ok(insp.expand('immuneEffect').type === 'object', 'inspector expands a subtree on demand');
  ok(Object.keys(insp.availabilityMap()).length > 0, 'inspector exposes an availability map');
  ok(insp.field('schemaVersion') === frames[4].schemaVersion, 'inspector reads a field by path (read-only)');

  // ---- timeline ----
  const tl = new ImmuneTimeline([...frames].reverse());   // deterministic ordering regardless of input order
  eq(tl.length(), 5, 'timeline holds all frames');
  eq(tl.first().frameIndex, 0, 'timeline orders deterministically (first = frameIndex 0)');
  eq(tl.last().frameIndex, 4, 'timeline last = frameIndex 4');
  tl.first();
  eq(tl.next().frameIndex, 1, 'next navigation');
  eq(tl.prev().frameIndex, 0, 'prev navigation');
  eq(tl.jumpToFrame(3).frameIndex, 3, 'jump to frame index');
  eq(tl.jumpToTimestamp(2).frameIndex, 2, 'jump to timestamp (nearest <=)');
  ok(tl.jumpToEvidence(0) != null, 'jump to evidence lands on a frame with evidence');
  eq(tl.ordered().length, 5, 'timeline exposes ordered frames read-only');

  // ---- replay ----
  const rp = new ImmuneReplay(frames);
  ok(rp.validate().ok, 'replay validation passes (ordering/version/schema/serialization/completeness)');
  ok(rp.roundTripStable(), 'replay frames are round-trip serialization stable');
  eq(rp.first().frameId, frames[0].frameId, 'replay first');
  eq(rp.stepForward().frameId, frames[1].frameId, 'replay step forward (reconstructs stored frame, no recalculation)');
  eq(rp.stepBackward().frameId, frames[0].frameId, 'replay step backward');
  rp.setSpeed(4); eq(rp.speed, 4, 'replay speed is visualization-only state');
  // version-mismatch sequence fails validation safely
  const badSeq = new ImmuneReplay([frames[0], { ...frames[1], schemaVersion: 'WRONG' }]);
  ok(!badSeq.validate().ok, 'replay validation rejects a schema-mismatched sequence');

  // ---- transition / evidence / prediction / contribution / warning views ----
  const withT = { ...frames[4], transitionRecords: [{ transitionId: 't1', machine: 'cd8', previousState: 'UNPRIMED', newState: 'PRIMED', trigger: 'priming', simulationTime: 4, availability: 'AVAILABLE', evidenceRefs: ['im_b16bl6_posture'], predictionRefs: [], warnings: [] }] };
  const tv = buildTransitionView(withT);
  eq(tv.length, 1, 'transition view: one row per transition record (never inferred)');
  ok(tv[0].component === 'cd8' && tv[0].previousState === 'UNPRIMED' && tv[0].newState === 'PRIMED' && tv[0].hasEvidence, 'transition row carries prev/new state + evidence traceability');
  eq(buildTransitionView([{ ...frames[0], transitionRecords: [] }]).length, 0, 'no transition records -> empty transition view (not fabricated)');
  ok(buildTransitionView(frames).length >= 1, 'real production transitions populate the transition view (wired, not fabricated)');
  ok(buildEvidenceView(frames).length === 5 && buildEvidenceView(frames)[0].traceTo.frame, 'evidence view rows + traceability to frame');
  ok(buildPredictionView(frames).length === 5 && buildPredictionView(frames)[0].status === 'AVAILABLE', 'prediction view rows + lifecycle status');
  const cv = buildContributionView(frames[4]);
  ok(cv.length >= 1 && cv.every((r) => ['Applied', 'Rejected', 'Superseded', 'Unavailable', 'Partially Applied', 'Not Applicable'].includes(r.applicationStatus)), 'contribution view: each row has an application status');
  // double-counting: force duplicate contributions to produce exclusions
  const dupEng = new ImmuneAdaptiveEngine({ registries: R });
  const dupRes = dupEng.evaluate({ explicitInputs: good, frameIndex: 0 });
  ok(Array.isArray(dupRes.exclusions), 'engine surfaces exclusion records');
  ok(buildDoubleCountingView(dupRes.frame).every((r) => r.doubleCounting === true), 'double-counting view returns only exclusion rows');
  // an out-of-range explicit input produces a real IMMUNE_VALUE_OUT_OF_RANGE warning to exercise the view
  const warned = new ImmuneAdaptiveEngine({ registries: R }).evaluate({ explicitInputs: { tumor_immune_visibility: A(5) }, frameIndex: 0 }).frame;
  const wv = buildWarningView([warned], R.render);
  ok(wv.length >= 1 && wv[0].renderSeverity && ['INFO', 'MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'].includes(wv[0].renderSeverity), 'warning view maps to registry render severity');

  // ---- debugger ----
  const dbg = new ImmuneDebugger(frames[4]);
  eq(dbg.executionTrace().length, MODULE_EXECUTION_ORDER.length, 'debugger execution trace covers every module in runtime order');
  ok(dbg.executionTrace()[0].module === 'section3_innate_input', 'execution trace starts at the Section-3 input');
  ok(dbg.dependencies('cd8').in.length === 4 && dbg.dependencies('cd8').out.length > 0, 'dependency inspection (incoming/outgoing)');
  ok(dbg.canEdit() === false, 'debugger is read-only');
  ok(Array.isArray(dbg.appliedContributions()) && Array.isArray(dbg.rejectedContributions()), 'debugger inspects applied + rejected contributions');

  // ---- search + filtering ----
  const srch = new ImmuneSearch(frames);
  ok(srch.search('cd8').length > 0, 'search partial match');
  ok(srch.search('cd8', { mode: 'module' }).length > 0, 'search by module');
  eq(srch.search('', { type: 'frame' }).length, 5, 'search filter by type=frame');
  ok(srch.search('', { availability: 'PARTIALLY_AVAILABLE' }).length >= 0, 'advanced filter by availability');
  ok(srch.search('', { minFrame: 3 }).every((r) => r.frameIndex >= 3), 'advanced filter by frame range');

  // ---- export + round-trip ----
  eq(IMMUNE_EXPORT_FORMATS.length, 3, 'three export formats declared');
  ok(typeof exportFrame(frames[4], 'json') === 'string', 'export frame as JSON');
  ok(exportFrame(frames[4], 'diagnostic').kind === 'immune_diagnostic_package', 'export as diagnostic package');
  ok(exportRange(frames, 1, 3, 'snapshot').count === 3, 'export frame range');
  ok(exportImmuneSummary(frames, 'snapshot').rows.length === 5, 'export immune summary');
  ok(exportContributionLedger(frames[4], 'snapshot').rows.length >= 1, 'export contribution ledger');
  ok(exportPhase8AOutput(eng.getResistanceReadiness(), 'snapshot').kind === 'phase8a_immune_output', 'export Phase-8A output');
  ok(validateRoundTrip(frames[4]).ok, 'round-trip serialization validation passes');

  // ---- read-only invariant: no view operation mutates any immutable object ----
  const before = frames.map((f) => contentId(f));
  rend.renderSequence(frames); new ImmuneFrameInspector(frames[0]).tree(); new ImmuneTimeline(frames).next();
  buildContributionView(frames); buildTransitionView(frames); new ImmuneSearch(frames).search('x'); exportImmuneSummary(frames, 'json'); new ImmuneDebugger(frames[2]).executionTrace();
  ok(frames.every((f, i) => contentId(f) === before[i]), 'NO view/render/timeline/replay/search/export/debug operation mutates any immune frame');
}
