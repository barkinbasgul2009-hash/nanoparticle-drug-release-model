// Phase-5B.1 signal-transduction EVIDENCE + GRAPH ARCHITECTURE tests.
// Validates the six signal-*.registry.json files and the SignalGraph VALIDATOR.
// There is NO runtime signaling engine in 5B.1, so these tests assert on
// architecture + evidence integrity ONLY - never on propagation/animation.
// Includes negative tests (undeclared cycle, orphan edge, mixed species, forbidden
// node, duplicate id) and confirms previous phases are unchanged.

import { section, ok, eq } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { nodeFetcher } from './harness.mjs';
import APP_CONFIG from '../src/config/app.config.js';
import {
  SIGNAL_EVIDENCE_LEVELS, isSignalEvidenceLevel, isSignalExperimental,
  isSignalPrediction, signalLevelAnimates,
} from '../src/evidence/evidenceEngine.js';
import { SignalGraph, loadSignalGraph, FORBIDDEN_NODE_TYPES, FEEDBACK_RELATIONSHIP_TYPES } from '../src/biology/signalGraph.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('signal transduction evidence & graph architecture (Phase 5B.1)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const S = APP_CONFIG.signalSources;
  const context = await loader.load(S.context, 'generic');
  const nodes = await loader.load(S.nodes, 'generic');
  const edges = await loader.load(S.edges, 'generic');
  const pathways = await loader.load(S.pathways, 'generic');
  const evidence = await loader.load(S.evidence, 'generic');
  const prediction = await loader.load(S.prediction, 'generic');

  // ---- evidence vocabulary (9 refined classifications) ----
  const expect9 = [
    'EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_PATHWAY_SPECIFIC',
    'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION',
    'NOT_REPORTED', 'UNAVAILABLE', 'CONTRADICTORY_EVIDENCE',
  ];
  eq(SIGNAL_EVIDENCE_LEVELS.length, 9, 'exactly 9 signal evidence levels');
  for (const l of expect9) ok(SIGNAL_EVIDENCE_LEVELS.includes(l), `signal evidence level present: ${l}`);
  ok(isSignalExperimental('EXPERIMENTAL_PATHWAY_SPECIFIC') && !isSignalExperimental('LITERATURE_DERIVED_PREDICTION'), 'experimental classifier');
  ok(isSignalPrediction('LITERATURE_DERIVED_PREDICTION') && !isSignalPrediction('EXPERIMENTAL_PATHWAY_SPECIFIC'), 'prediction classifier');
  ok(!isSignalExperimental('LITERATURE_DERIVED_PREDICTION') || false, 'prediction never counted as experimental');
  ok(!signalLevelAnimates('NOT_REPORTED') && !signalLevelAnimates('UNAVAILABLE'), 'not-reported / unavailable never eligible to animate');
  ok(signalLevelAnimates('EXPERIMENTAL_PATHWAY_SPECIFIC') && signalLevelAnimates('MECHANISTIC_PREDICTION'), 'experimental + predictions eligible');
  for (const l of expect9) ok(isSignalEvidenceLevel(l), `isSignalEvidenceLevel accepts ${l}`);
  ok(!isSignalEvidenceLevel('BOGUS'), 'isSignalEvidenceLevel rejects bogus level');

  // ---- build graph + validate the real registries ----
  const g = new SignalGraph({ context, nodes, edges, pathways, evidence, prediction });
  const res = g.validate();
  ok(res.ok, `real registries validate cleanly${res.ok ? '' : ': ' + res.errors.join('; ')}`);
  eq(res.errors.length, 0, 'no validation errors on real registries');
  eq(res.warnings.length, 0, `no unresolved evidence references${res.warnings.length ? ': ' + res.warnings.join('; ') : ''}`);

  // loader convenience path builds an equivalent graph
  const g2 = await loadSignalGraph(loader, S);
  eq(g2.nodeIds().length, g.nodeIds().length, 'loadSignalGraph builds the same node set');

  // ---- contexts: never mix species/cell-model, target NOT_REPORTED, exposure-driven ----
  for (const cid of ['human_hacat', 'mouse_b16bl6', 'rat_skin']) ok(g.contexts[cid], `context present: ${cid}`);
  eq(g.contexts.human_hacat.species, 'human', 'human context species');
  eq(g.contexts.mouse_b16bl6.species, 'mouse', 'mouse context species');
  eq(g.contexts.rat_skin.species, 'rat', 'rat context species');
  for (const cid of ['human_hacat', 'mouse_b16bl6', 'rat_skin']) {
    eq(g.contexts[cid].molecular_target, null, `${cid} molecular target null (unknown)`);
    eq(g.contexts[cid].target_evidence, 'NOT_REPORTED', `${cid} target evidence Not Reported`);
  }
  eq(g.contexts.human_hacat.start_condition, 'drug_exposure', 'human start is exposure-driven');
  eq(g.contexts.mouse_b16bl6.start_condition, 'drug_exposure', 'mouse start is exposure-driven');
  eq(g.contexts.rat_skin.start_condition, 'none', 'rat has no start condition (no signaling)');

  // ---- nodes: forbidden types absent everywhere; evidence distinguishable ----
  for (const id of g.nodeIds()) {
    const n = g.nodes[id];
    ok(!FORBIDDEN_NODE_TYPES.includes(n.node_type), `node ${id} not a forbidden type`);
    ok(isSignalEvidenceLevel(n.evidence_level), `node ${id} has a valid evidence level`);
    ok(!(isSignalExperimental(n.evidence_level) && isSignalPrediction(n.evidence_level)), `node ${id} evidence unambiguous`);
  }
  // activity representation is schematic, never concentration/phospho-%
  const act = g.nodesReg.activity_representation;
  eq(act.kind, 'normalized_schematic_activity', 'activity is normalized schematic');
  eq(act.range[0], 0.0, 'activity min 0');
  eq(act.range[1], 1.0, 'activity max 1');
  for (const bad of ['concentration', 'phosphorylation_percentage', 'protein_abundance', 'receptor_occupancy', 'therapeutic_effect']) {
    ok(act.not.includes(bad), `activity representation forbids ${bad}`);
  }
  // transcription factor may reach a nuclear-localized STATE but graph stops before gene regulation
  ok(g.nodes.h1_nrf2.allowed_states.includes('nuclear_localized'), 'Nrf2 can reach nuclear-localized state');
  ok(g.nodes.h1_nrf2.node_type === 'transcription_factor', 'Nrf2 is a transcription factor node');

  // ---- edges: no orphan refs, no silent mixing, directions valid ----
  for (const id of g.edgeIds()) {
    const e = g.edges[id];
    ok(g.nodes[e.source], `edge ${id} source resolves`);
    ok(g.nodes[e.target], `edge ${id} target resolves`);
    eq(g.nodes[e.source].species, g.nodes[e.target].species, `edge ${id} does not mix species`);
    eq(g.nodes[e.source].cell_model, g.nodes[e.target].cell_model, `edge ${id} does not mix cell model`);
    ok(e.direction === 'forward' || e.direction === 'unresolved', `edge ${id} has valid direction`);
    ok(g.edgesReg.relationship_types_allowed.includes(e.relationship_type), `edge ${id} relationship allowed`);
  }
  // effect strength qualitative, never numeric
  for (const bad of ['fold_change', 'rate_constant', 'percentage', 'concentration']) {
    ok(g.edgesReg.effect_strength_vocabulary.not.includes(bad), `effect strength forbids ${bad}`);
  }

  // ---- profiles: DAGs, start/stop present, membership correct ----
  eq(g.profiles['5B-H1'].status, 'ACCEPTED', '5B-H1 accepted');
  eq(g.profiles['5B-H2'].status, 'ACCEPTED', '5B-H2 accepted');
  eq(g.profiles['5B-M1'].status, 'ACCEPTED', '5B-M1 accepted');
  eq(g.profiles['5B-R1'].status, 'NOT_REPORTED', '5B-R1 not reported');
  for (const pid of ['5B-H1', '5B-H2', '5B-M1']) {
    ok(g.profiles[pid].start_condition === 'drug_exposure', `${pid} exposure-driven start`);
    ok(!!g.profiles[pid].stop_condition, `${pid} has a stop condition`);
    eq(g.findCycles(pid).length, 0, `${pid} is a DAG (no cycles)`);
  }
  // rat profile empty (no silent transfer)
  eq(g.profiles['5B-R1'].node_ids.length, 0, '5B-R1 has no nodes');
  eq(g.profiles['5B-R1'].edge_ids.length, 0, '5B-R1 has no edges');
  // H1 diamond shape: ROS -> {ERK,p38} -> Nrf2
  eq(g.outgoing('h1_ros').length, 2, 'ROS fans out to two MAPKs');
  eq(g.incoming('h1_nrf2').length, 2, 'Nrf2 converges from two MAPKs');

  // ---- evidence audit trail: canonical vs literature vs frozen; no fabricated DOI ----
  eq(g.references.chen_2012.verification_status, 'VERIFIED_IN_FROZEN_PACKAGE', 'Chen is the verified frozen source');
  ok(/does_not_support/.test(JSON.stringify(g.references.chen_2012)) && g.references.chen_2012.does_not_support.length > 0, 'Chen explicitly supports no signaling');
  for (const k of ['canonical_ros_mapk', 'canonical_mapk_nrf2', 'canonical_nrf2_are', 'canonical_nfkb_inflammatory', 'canonical_pi3k_akt_mtor']) {
    eq(g.references[k].verification_status, 'CANONICAL_GENERAL_BIOLOGY', `${k} is canonical general biology`);
    ok(/NOT_REPORTED/.test(g.references[k].citation), `${k} carries no fabricated DOI`);
  }
  for (const k of ['celastrol_ros_literature', 'celastrol_ho1_literature', 'celastrol_nfkb_literature', 'celastrol_pi3k_literature']) {
    eq(g.references[k].verification_status, 'UNVERIFIED_IN_REPO', `${k} is unverified in repo`);
    ok(/NOT_REPORTED/.test(g.references[k].citation), `${k} carries no fabricated DOI`);
  }
  // every audit-trail entry resolves to a real reference + a real target
  for (const a of evidence.audit_trail) {
    ok(!!g.references[a.reference_ids[0]], `audit entry ${a.target_id} references a real evidence record`);
    const exists = a.target_kind === 'node' ? !!g.nodes[a.target_id] : !!g.edges[a.target_id];
    ok(exists, `audit entry target ${a.target_id} exists`);
  }

  // ---- prediction registry: no silent cross-context transfer ----
  eq(prediction.cross_context_transfer_ledger.human_to_mouse.status, 'NONE', 'no human->mouse profile transfer');
  eq(prediction.cross_context_transfer_ledger.mouse_to_rat.status, 'NOT_REPORTED', 'no mouse->rat transfer');
  eq(prediction.cross_context_transfer_ledger.human_to_rat.status, 'NOT_REPORTED', 'no human->rat transfer');
  for (const pr of Object.values(prediction.prediction_records)) {
    ok(isSignalPrediction(pr.level), `prediction ${pr.claim.slice(0, 24)}... is a labelled prediction level`);
  }

  // ---- NEGATIVE TESTS: the validator must catch each integrity violation ----
  const clone = () => ({
    context: JSON.parse(JSON.stringify(context)),
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    pathways: JSON.parse(JSON.stringify(pathways)),
    evidence: JSON.parse(JSON.stringify(evidence)),
    prediction: JSON.parse(JSON.stringify(prediction)),
  });

  // (a) orphan edge -> missing target node
  {
    const c = clone();
    c.edges.edges.h1_e_are_ho1.target = 'does_not_exist';
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /missing target node/.test(e)), 'negative: orphan edge caught');
  }
  // (b) mixed species across an edge
  {
    const c = clone();
    c.nodes.nodes.h1_ho1.species = 'mouse';
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /mixes species/.test(e)), 'negative: mixed species caught');
  }
  // (c) forbidden node type
  {
    const c = clone();
    c.nodes.nodes.h1_ho1.node_type = 'apoptosis';
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /forbidden node_type|not in node_types_allowed/.test(e)), 'negative: forbidden node type caught');
  }
  // (d) undeclared cycle (add a plain activation back-edge HO1 -> exposure)
  {
    const c = clone();
    c.edges.edges.h1_bad_cycle = { profile_id: '5B-H1', source: 'h1_ho1', target: 'h1_exposure', relationship_type: 'activation', direction: 'forward', required: false, effect_strength: 'not_reported', temporal_order: 6, delay_basis: 'NOT_REPORTED', evidence_level: 'MECHANISTIC_PREDICTION', reference_ids: [], confidence: 'LOW', uncertainty: '', formulation_specific: false, drug_specific: false, species_specific: false, cell_model_specific: false, measurement_basis: 'NOT_REPORTED', notes: '' };
    c.pathways.profiles['5B-H1'].edge_ids.push('h1_bad_cycle');
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /UNDECLARED cycle/.test(e)), 'negative: undeclared cycle caught');
  }
  // (e) declared feedback cycle is ALLOWED (same back-edge typed as negative_feedback)
  {
    const c = clone();
    c.edges.edges.h1_fb = { profile_id: '5B-H1', source: 'h1_ho1', target: 'h1_exposure', relationship_type: 'negative_feedback', direction: 'forward', required: false, effect_strength: 'not_reported', temporal_order: 6, delay_basis: 'NOT_REPORTED', evidence_level: 'MECHANISTIC_PREDICTION', reference_ids: [], confidence: 'LOW', uncertainty: '', formulation_specific: false, drug_specific: false, species_specific: false, cell_model_specific: false, measurement_basis: 'NOT_REPORTED', notes: '' };
    c.pathways.profiles['5B-H1'].edge_ids.push('h1_fb');
    const r = new SignalGraph(c).validate();
    ok(!r.errors.some((e) => /UNDECLARED cycle/.test(e)), 'positive: declared feedback cycle allowed');
    ok(FEEDBACK_RELATIONSHIP_TYPES.includes('negative_feedback'), 'negative_feedback is a declarable feedback type');
  }
  // (f) invalid evidence level on a node
  {
    const c = clone();
    c.nodes.nodes.h1_ros.evidence_level = 'TOTALLY_MADE_UP';
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /invalid evidence_level/.test(e)), 'negative: invalid evidence level caught');
  }
  // (g) profile claims a node owned by another profile (cross-profile mixing)
  {
    const c = clone();
    c.pathways.profiles['5B-H2'].node_ids.push('m1_akt');
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /owned by|links nodes outside/.test(e)), 'negative: cross-profile node claim caught');
  }
  // (h) NOT_REPORTED profile must stay empty
  {
    const c = clone();
    c.pathways.profiles['5B-R1'].node_ids.push('h1_ros');
    const r = new SignalGraph(c).validate();
    ok(!r.ok && r.errors.some((e) => /NOT_REPORTED but is not empty/.test(e)), 'negative: non-empty NOT_REPORTED profile caught');
  }

  // ---- previous phases unchanged: full app still idle for B1, panel intact ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  app.setSpecies('rat');
  app.transport.animator.runHeadless();
  app.uptake.engine.run(400); app.endocytosis.engine.run(300); app.intracellular.engine.run(200); app.targetEngagement.engine.run(200);
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.transport, 'EXPERIMENTAL', 'previous phase: transport still Experimental');
  eq(el.targetEngagement, 'NOT_REPORTED', 'previous phase: target engagement still Not Reported');
  ok(!app.signalTransduction, 'no runtime signaling engine wired in 5B.1 (architecture only)');
  app.setSpecies('rat');
}
