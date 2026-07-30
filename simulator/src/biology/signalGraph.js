// Signal-graph LOADER + VALIDATOR (Phase 5B.1). ARCHITECTURE + VALIDATION ONLY.
//
// This module DELIBERATELY does NOT propagate signals, animate, phosphorylate,
// activate/inhibit at runtime, or render anything. It only assembles the six
// separable registries (context, nodes, edges, pathways, evidence, prediction)
// into an in-memory directed graph and CHECKS the architecture is well-formed and
// scientifically auditable. A future Phase-5B.2 engine will consume this graph.
//
// Nothing biological is hardcoded here: all nodes/edges/evidence come from the
// registries. The validator enforces the Phase-5B.1 rules:
//   - unique node ids, unique edge ids
//   - every edge references existing nodes (no orphan edges)
//   - no edge points across profiles / species / cell models (no silent mixing)
//   - every profile is a DAG UNLESS a cycle is explicitly declared as typed feedback
//   - forbidden node types (gene/mRNA/ribosome/apoptosis/PK/...) are absent
//   - each profile declares a start and stop condition
//   - experimental vs predictive evidence is distinguishable on every node/edge
//   - referenced evidence ids resolve; no fabricated DOI leaks in as "experimental"

import {
  isSignalEvidenceLevel, isSignalExperimental, isSignalPrediction,
} from '../evidence/evidenceEngine.js';

/** Node types that must NEVER appear (the graph stops before gene regulation / PD). */
export const FORBIDDEN_NODE_TYPES = Object.freeze([
  'gene', 'mRNA', 'ribosome', 'translated_protein', 'protein_synthesis',
  'apoptosis', 'necrosis', 'proliferation', 'cell_cycle', 'tumour_response',
  'immune_response', 'toxicity', 'pharmacokinetics', 'clinical_efficacy',
]);

/** Feedback/cycle relationship types that MAY legitimately form a declared cycle. */
export const FEEDBACK_RELATIONSHIP_TYPES = Object.freeze([
  'positive_feedback', 'negative_feedback', 'recovery', 'adaptation', 'desensitization',
]);

export class SignalGraph {
  /**
   * @param {{
   *   context:any, nodes:any, edges:any, pathways:any, evidence:any, prediction:any
   * }} registries parsed signal-*.registry.json objects
   */
  constructor(registries) {
    if (!registries) throw new Error('SignalGraph requires the six signal registries');
    for (const k of ['context', 'nodes', 'edges', 'pathways', 'evidence', 'prediction']) {
      if (!registries[k]) throw new Error(`SignalGraph missing registry: ${k}`);
    }
    this.contextReg = registries.context;
    this.nodesReg = registries.nodes;
    this.edgesReg = registries.edges;
    this.pathwaysReg = registries.pathways;
    this.evidenceReg = registries.evidence;
    this.predictionReg = registries.prediction;

    this.contexts = this.contextReg.contexts || {};
    this.nodes = this.nodesReg.nodes || {};
    this.edges = this.edgesReg.edges || {};
    this.profiles = this.pathwaysReg.profiles || {};
    this.references = this.evidenceReg.reference_records || {};
  }

  /** All node ids. */
  nodeIds() { return Object.keys(this.nodes); }
  /** All edge ids. */
  edgeIds() { return Object.keys(this.edges); }
  /** All profile ids (including NOT_REPORTED/empty ones). */
  profileIds() { return Object.keys(this.profiles); }

  /** Outgoing edges from a node id. */
  outgoing(nodeId) { return this.edgeIds().map((id) => this.edges[id]).filter((e) => e.source === nodeId); }
  /** Incoming edges to a node id. */
  incoming(nodeId) { return this.edgeIds().map((id) => this.edges[id]).filter((e) => e.target === nodeId); }

  /** Is a node/edge evidence level experimental (vs prediction)? Distinguishable, never conflated. */
  isExperimental(level) { return isSignalExperimental(level); }
  isPrediction(level) { return isSignalPrediction(level); }

  /**
   * Detect cycles within a single profile's edge set using DFS. Returns an array
   * of cycles (each a list of node ids). Empty means the profile is a DAG.
   * @param {string} profileId
   * @returns {string[][]}
   */
  findCycles(profileId) {
    const profile = this.profiles[profileId];
    if (!profile) return [];
    const nodeSet = new Set(profile.node_ids || []);
    const adj = new Map();
    for (const nid of nodeSet) adj.set(nid, []);
    for (const eid of (profile.edge_ids || [])) {
      const e = this.edges[eid];
      if (e && nodeSet.has(e.source) && nodeSet.has(e.target)) adj.get(e.source).push(e.target);
    }
    const cycles = [];
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map([...nodeSet].map((n) => [n, WHITE]));
    const stack = [];
    const visit = (u) => {
      color.set(u, GRAY); stack.push(u);
      for (const v of (adj.get(u) || [])) {
        if (color.get(v) === GRAY) {
          const idx = stack.indexOf(v);
          cycles.push(stack.slice(idx).concat(v));
        } else if (color.get(v) === WHITE) {
          visit(v);
        }
      }
      color.set(u, BLACK); stack.pop();
    };
    for (const n of nodeSet) if (color.get(n) === WHITE) visit(n);
    return cycles;
  }

  /**
   * True if a cycle (list of node ids) is CLOSED by a declared feedback edge. A
   * legitimate feedback loop is forward activations/inhibitions plus at least one
   * typed feedback back-edge; a cycle made only of plain activations is undeclared.
   */
  _cycleIsDeclaredFeedback(profileId, cycle) {
    const profile = this.profiles[profileId];
    const edgeIds = profile.edge_ids || [];
    for (let i = 0; i < cycle.length - 1; i++) {
      const src = cycle[i], tgt = cycle[i + 1];
      const edge = edgeIds.map((id) => this.edges[id]).find((e) => e && e.source === src && e.target === tgt);
      if (edge && FEEDBACK_RELATIONSHIP_TYPES.includes(edge.relationship_type)) return true;
    }
    return false;
  }

  /**
   * Full architecture validation. Returns { ok, errors:[], warnings:[] }.
   * Never throws for a scientific-integrity problem - it reports it, so tests can
   * assert on specific failures.
   */
  validate() {
    const errors = [];
    const warnings = [];
    const nodeIds = this.nodeIds();
    const edgeIds = this.edgeIds();

    // --- unique ids (object keys are unique by construction; guard duplicate profile_id refs) ---
    const seenNode = new Set();
    for (const id of nodeIds) {
      if (seenNode.has(id)) errors.push(`duplicate node id: ${id}`);
      seenNode.add(id);
    }
    const seenEdge = new Set();
    for (const id of edgeIds) {
      if (seenEdge.has(id)) errors.push(`duplicate edge id: ${id}`);
      seenEdge.add(id);
    }

    // --- node-level checks: forbidden types, evidence level validity/distinguishability ---
    const allowedTypes = new Set(this.nodesReg.node_types_allowed || []);
    for (const id of nodeIds) {
      const n = this.nodes[id];
      if (FORBIDDEN_NODE_TYPES.includes(n.node_type)) {
        errors.push(`node ${id} uses forbidden node_type: ${n.node_type}`);
      }
      if (allowedTypes.size && !allowedTypes.has(n.node_type)) {
        errors.push(`node ${id} node_type not in node_types_allowed: ${n.node_type}`);
      }
      if (!isSignalEvidenceLevel(n.evidence_level)) {
        errors.push(`node ${id} has invalid evidence_level: ${n.evidence_level}`);
      }
      // experimental vs prediction must be distinguishable (never both / neither wrongly)
      if (isSignalExperimental(n.evidence_level) && isSignalPrediction(n.evidence_level)) {
        errors.push(`node ${id} evidence_level cannot be both experimental and prediction`);
      }
      // referenced evidence ids should resolve (predictions/canonical are allowed but must exist)
      for (const rid of (n.reference_ids || [])) {
        if (!this.references[rid]) warnings.push(`node ${id} references unknown evidence id: ${rid}`);
      }
    }

    // --- edge-level checks: orphan refs, evidence, cross-context mixing ---
    const allowedRel = new Set(this.edgesReg.relationship_types_allowed || []);
    for (const id of edgeIds) {
      const e = this.edges[id];
      const s = this.nodes[e.source];
      const t = this.nodes[e.target];
      if (!s) errors.push(`edge ${id} references missing source node: ${e.source}`);
      if (!t) errors.push(`edge ${id} references missing target node: ${e.target}`);
      if (allowedRel.size && !allowedRel.has(e.relationship_type)) {
        errors.push(`edge ${id} relationship_type not allowed: ${e.relationship_type}`);
      }
      if (!isSignalEvidenceLevel(e.evidence_level)) {
        errors.push(`edge ${id} has invalid evidence_level: ${e.evidence_level}`);
      }
      if (e.direction !== 'forward' && e.direction !== 'unresolved') {
        errors.push(`edge ${id} has invalid direction: ${e.direction}`);
      }
      // No silent species / cell-model mixing across an edge.
      if (s && t) {
        if (s.species !== t.species) errors.push(`edge ${id} mixes species: ${s.species} -> ${t.species}`);
        if (s.cell_model !== t.cell_model) errors.push(`edge ${id} mixes cell_model: ${s.cell_model} -> ${t.cell_model}`);
        if (e.profile_id && (s.profile_id !== e.profile_id || t.profile_id !== e.profile_id)) {
          errors.push(`edge ${id} crosses profiles (edge ${e.profile_id}, nodes ${s.profile_id}/${t.profile_id})`);
        }
      }
      for (const rid of (e.reference_ids || [])) {
        if (!this.references[rid]) warnings.push(`edge ${id} references unknown evidence id: ${rid}`);
      }
    }

    // --- profile-level checks: membership, start/stop, DAG-or-declared-feedback ---
    for (const pid of this.profileIds()) {
      const p = this.profiles[pid];
      const nset = new Set(p.node_ids || []);
      // NOT_REPORTED profiles are intentionally empty.
      if (p.status === 'NOT_REPORTED') {
        if ((p.node_ids || []).length || (p.edge_ids || []).length) {
          errors.push(`profile ${pid} is NOT_REPORTED but is not empty`);
        }
        continue;
      }
      if (!p.start_condition) errors.push(`profile ${pid} missing start_condition`);
      if (!p.stop_condition) errors.push(`profile ${pid} missing stop_condition`);
      // every referenced node/edge exists and belongs to this profile
      for (const nid of (p.node_ids || [])) {
        if (!this.nodes[nid]) errors.push(`profile ${pid} references missing node: ${nid}`);
        else if (this.nodes[nid].profile_id !== pid) errors.push(`profile ${pid} claims node ${nid} owned by ${this.nodes[nid].profile_id}`);
      }
      for (const eid of (p.edge_ids || [])) {
        const e = this.edges[eid];
        if (!e) { errors.push(`profile ${pid} references missing edge: ${eid}`); continue; }
        if (e.profile_id !== pid) errors.push(`profile ${pid} claims edge ${eid} owned by ${e.profile_id}`);
        if (!nset.has(e.source) || !nset.has(e.target)) {
          errors.push(`profile ${pid} edge ${eid} links nodes outside the profile`);
        }
      }
      // DAG unless every cycle is a declared typed-feedback cycle
      const cycles = this.findCycles(pid);
      for (const cyc of cycles) {
        if (!this._cycleIsDeclaredFeedback(pid, cyc)) {
          errors.push(`profile ${pid} has an UNDECLARED cycle: ${cyc.join(' -> ')}`);
        }
      }
    }

    return { ok: errors.length === 0, errors, warnings };
  }
}

/**
 * Convenience loader: given a JsonLoader-like object and the signalSources config,
 * load all six registries and build a SignalGraph. Loading only - no validation.
 * @param {{load:(name:string, species:string)=>Promise<any>}} loader
 * @param {{context:string,nodes:string,edges:string,pathways:string,evidence:string,prediction:string}} sources
 * @returns {Promise<SignalGraph>}
 */
export async function loadSignalGraph(loader, sources) {
  const [context, nodes, edges, pathways, evidence, prediction] = await Promise.all([
    loader.load(sources.context, 'generic'),
    loader.load(sources.nodes, 'generic'),
    loader.load(sources.edges, 'generic'),
    loader.load(sources.pathways, 'generic'),
    loader.load(sources.evidence, 'generic'),
    loader.load(sources.prediction, 'generic'),
  ]);
  return new SignalGraph({ context, nodes, edges, pathways, evidence, prediction });
}

export default SignalGraph;
