// Signal propagation engine (Phase 5B.2). The first RUNTIME signaling layer: it takes
// the frozen Phase-5B.1 directed graph (read-only, via SignalGraph) plus the
// Phase-5B.2 runtime-dynamics registry and actually PROPAGATES activity through the
// graph over simulated time - nodes activate, signals travel across edges with delay
// and attenuation, thresholds gate activation, activity decays and auto-deactivates,
// baseline-active pathways get suppressed, multiple inputs compete, feedback loops
// execute (bounded, no oscillation explosion), and labelled PREDICTION extensions
// (a mechanistic negative-feedback edge and the STIM1->Orai1->SOCE->Ca2+ pathway)
// propagate too - always visually/semantically distinct and never overwriting
// experimental nodes.
//
// It is a SEPARATE layer: it reads the 5B.1 registries and the runtime registry
// read-only and modifies NEITHER. Determinism: pure arithmetic, no RNG, fixed-dt
// stepping. It STOPS at signaling - no transcription/translation/apoptosis/immune/
// PD/PK/toxicity/phenotype.

import { isRuntimePrediction, isRuntimeExperimental } from '../evidence/evidenceEngine.js';

/** Relationship types that carry a NEGATIVE sign (suppress the target). */
const NEGATIVE_RELATIONSHIPS = new Set([
  'inhibition', 'negative_feedback', 'attenuation', 'dephosphorylation',
  'dissociation', 'desensitization', 'adaptation',
]);

/** @param {string} rel @returns {number} +1 or -1 */
function relationshipSign(rel) { return NEGATIVE_RELATIONSHIPS.has(rel) ? -1 : 1; }

export const OVERLAY_MODES = Object.freeze(['experimental', 'prediction', 'combined', 'unavailable', 'not_reported']);

export class SignalPropagationEngine {
  /**
   * @param {{
   *   signalGraph: import('./signalGraph.js').SignalGraph,
   *   propagationRegistry: any,
   *   species?: string,
   *   includePredictions?: boolean,
   *   overlayMode?: string,
   *   relaxRatePerHour?: number,
   *   logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.signalGraph || !deps.propagationRegistry) {
      throw new Error('SignalPropagationEngine requires signalGraph + propagationRegistry');
    }
    this.graph = deps.signalGraph;
    this.reg = deps.propagationRegistry;
    this.logger = deps.logger || null;
    this.defaults = this.reg.defaults || {};
    this.overlayMode = deps.overlayMode || 'combined';
    this.includePredictions = deps.includePredictions !== false; // default ON (labelled + toggleable)
    this.relaxRate = typeof deps.relaxRatePerHour === 'number' ? deps.relaxRatePerHour : 0.9;
    this.species = deps.species || 'human';
    // Playback state
    this.speed = 1;
    this.playing = false;
    this._raf = null;
    this._build();
  }

  // ---- construction ------------------------------------------------------

  _delayFor(delayClass) {
    const c = (this.defaults.delay_classes_h) || { fast: 0.5, medium: 3, slow: 8 };
    if (typeof delayClass === 'number') return delayClass;
    return typeof c[delayClass] === 'number' ? c[delayClass] : (c.medium || 3);
  }

  /** Build the runtime node/edge maps for the active species (frozen + optional predictions). */
  _build() {
    /** @type {Map<string,object>} */
    this.nodes = new Map();
    /** @type {object[]} */
    this.edges = [];
    this.timeH = 0;
    this.timeline = [];
    this._stepCount = 0;

    const nodeDyn = this.reg.node_dynamics || {};
    const edgeDyn = this.reg.edge_dynamics || {};

    // Accepted, non-empty profiles for this species (never mixes species/cell models).
    const profiles = this.graph.profileIds()
      .map((id) => ({ id, p: this.graph.profiles[id] }))
      .filter(({ p }) => p && p.status === 'ACCEPTED' && p.species === this.species);

    for (const { id: pid, p } of profiles) {
      for (const nid of (p.node_ids || [])) {
        const src = this.graph.nodes[nid];
        if (!src) continue;
        const dyn = nodeDyn[nid] || {};
        this.nodes.set(nid, this._makeNode(nid, src, dyn, false));
      }
      for (const eid of (p.edge_ids || [])) {
        const e = this.graph.edges[eid];
        if (!e) continue;
        const dyn = edgeDyn[eid] || {};
        this.edges.push(this._makeEdge(eid, e, dyn, false, e.evidence_level));
      }
    }

    if (this.includePredictions) this._addPredictions();

    // Resolve each edge's source baseline reference (for activation-suppression semantics).
    for (const edge of this.edges) {
      const s = this.nodes.get(edge.source);
      edge.sourceRef = s && s.baselineActive ? s.baseline : 0;
    }
    this._initState();
  }

  _makeNode(id, src, dyn, predicted) {
    const baselineActive = !!dyn.baseline_active;
    return {
      id,
      profileId: src.profile_id || dyn.profile_id || null,
      canonicalName: src.canonical_name || dyn.canonical_name || id,
      displayName: src.display_name || dyn.display_name || id,
      nodeType: src.node_type || dyn.node_type || 'signaling_output',
      compartment: src.compartment || dyn.compartment || 'cytoplasm',
      species: src.species || this.species,
      cellModel: src.cell_model || null,
      evidenceLevel: src.evidence_level || 'NOT_REPORTED',       // frozen 5B.1 level (unchanged)
      predictionLevel: dyn.prediction_level || (predicted ? 'MECHANISTIC_PREDICTION' : 'EXPERIMENTAL'),
      predicted,
      confidence: dyn.confidence || src.confidence || 'MEDIUM',
      rationale: dyn.rationale || src.uncertainty || '',
      threshold: typeof dyn.threshold === 'number' ? dyn.threshold : (this.defaults.activation_threshold ?? 0.2),
      decayRate: typeof dyn.decay_rate_per_hour === 'number' ? dyn.decay_rate_per_hour : (this.defaults.decay_rate_per_hour ?? 0.15),
      duration: typeof dyn.activation_duration_h === 'number' ? dyn.activation_duration_h : (this.defaults.activation_duration_h ?? 24),
      isStart: !!dyn.is_start,
      isOutput: !!dyn.is_output,
      baselineActive,
      baseline: baselineActive ? 0.8 : 0,
      layout: dyn.layout || { col: 0, row: 0 },
      // runtime:
      activity: 0, state: 'inactive', activationTimeH: null, everActivated: false,
      activeTimeH: 0, degraded: false, rising: false,
    };
  }

  _makeEdge(id, e, dyn, predicted, evidenceLevel) {
    return {
      id,
      source: e.source, target: e.target,
      relationshipType: e.relationship_type,
      direction: e.direction || 'forward',
      sign: relationshipSign(e.relationship_type),
      delayH: this._delayFor(dyn.delay_class ?? e.delay_class),
      attenuation: typeof dyn.attenuation === 'number' ? dyn.attenuation : (this.defaults.attenuation_per_edge ?? 0.9),
      weight: typeof dyn.weight === 'number' ? dyn.weight : (this.defaults.edge_weight ?? 1.0),
      predicted,
      predictionLevel: dyn.prediction_level || (predicted ? 'MECHANISTIC_PREDICTION' : 'EXPERIMENTAL'),
      evidenceLevel: evidenceLevel || dyn.evidence_level || (predicted ? 'MECHANISTIC_PREDICTION' : 'NOT_REPORTED'),
      confidence: dyn.confidence || 'MEDIUM',
      rationale: dyn.rationale || '',
      flowing: false, active: false,
    };
  }

  /** Add labelled, toggleable predicted extensions (feedback edge + STIM1/Orai1 pathway). */
  _addPredictions() {
    const ext = this.reg.predicted_extensions || {};
    // Predicted feedback edges - only wire if BOTH endpoints exist for this species.
    for (const [eid, fe] of Object.entries(ext.feedback_edges || {})) {
      if (this.nodes.has(fe.source) && this.nodes.has(fe.target)) {
        this.edges.push(this._makeEdge(eid, fe, fe, true, fe.evidence_level));
      }
    }
    // Predicted extension pathways (their own nodes + edges).
    for (const [ppid, pp] of Object.entries(ext.prediction_pathways || {})) {
      if (pp.species !== this.species) continue;
      for (const [nid, pn] of Object.entries(pp.nodes || {})) {
        const src = { profile_id: ppid, canonical_name: pn.canonical_name, display_name: pn.display_name,
          node_type: pn.node_type, compartment: pn.compartment, species: pp.species, cell_model: pp.cell_model,
          evidence_level: 'MECHANISTIC_PREDICTION' };
        this.nodes.set(nid, this._makeNode(nid, src, pn, true));
      }
      for (const [eid, pe] of Object.entries(pp.edges || {})) {
        if (this.nodes.has(pe.source) && this.nodes.has(pe.target)) {
          this.edges.push(this._makeEdge(eid, pe, pe, true, pe.prediction_level));
        }
      }
    }
  }

  _initState() {
    for (const n of this.nodes.values()) {
      if (n.baselineActive) {
        n.activity = n.baseline; n.state = 'active'; n.everActivated = true; n.activationTimeH = 0;
      } else if (n.isStart) {
        n.activity = 0; n.state = 'inactive';
      } else {
        n.activity = 0; n.state = 'inactive';
      }
      n.activeTimeH = 0; n.degraded = false; n.rising = false;
      if (!n.baselineActive) { n.everActivated = false; n.activationTimeH = null; }
    }
  }

  // ---- runtime -----------------------------------------------------------

  /** Restart the simulation (clears all runtime state; deterministic). */
  restart() { this.timeH = 0; this.timeline = []; this._stepCount = 0; this._initState(); this._log('debug', 'signal', 'restart'); return this; }
  reset() { return this.restart(); }

  /** Idle when there are no nodes for the active species (e.g. rat = NOT REPORTED). */
  isIdle() { return this.nodes.size === 0; }

  /** One deterministic propagation step over dt hours. */
  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.defaults.dt_hours ?? 0.5);
    if (this.isIdle()) { this.timeH += dt; this._stepCount += 1; return []; }
    const max = this.defaults.activity_max ?? 1.0;
    const events = [];

    // 1) Accumulate incoming contributions per node (competition = weighted sum), only
    //    across edges whose source has been active long enough to clear the edge delay.
    const inputs = new Map();
    for (const n of this.nodes.keys()) inputs.set(n, 0);
    for (const edge of this.edges) {
      const s = this.nodes.get(edge.source);
      const t = this.nodes.get(edge.target);
      if (!s || !t) { edge.flowing = false; edge.active = false; continue; }
      const elapsed = s.everActivated && s.activationTimeH != null ? (this.timeH - s.activationTimeH) : -1;
      const clear = s.everActivated && elapsed >= edge.delayH;
      edge.active = clear;
      let contrib = 0;
      if (clear) {
        if (edge.sign > 0) {
          // Activation: drive relative to source's baseline reference so suppression
          // propagates (a source held at baseline adds 0; a suppressed source subtracts).
          contrib = (s.activity - edge.sourceRef) * edge.weight * edge.attenuation;
        } else {
          // Inhibition: an active source pushes the target down.
          contrib = -s.activity * edge.weight * edge.attenuation;
        }
      }
      edge.flowing = clear && Math.abs(contrib) > 0.01;
      inputs.set(edge.target, inputs.get(edge.target) + contrib);
    }

    // 2) Drive start nodes toward their configured start activity (ramp).
    const drive = this.defaults.drive || { start_activity: 1.0, ramp_per_hour: 0.6 };
    for (const n of this.nodes.values()) {
      if (n.isStart) inputs.set(n.id, inputs.get(n.id) + (drive.start_activity - n.activity) * (drive.ramp_per_hour) );
    }

    // 3) Update each node: relax toward its target, then apply lifetime/decay.
    for (const n of this.nodes.values()) {
      const net = inputs.get(n.id) || 0;
      const target = Math.max(0, Math.min(max, n.baseline + net));
      if (n.degraded) {
        // refractory: monotone decay to inactive; ignore positive drive (stable)
        n.activity = n.activity * Math.exp(-n.decayRate * 2 * dt);
      } else {
        const prev = n.activity;
        n.activity += (target - n.activity) * Math.min(1, this.relaxRate * dt);
        // gentle natural decay pulls non-baseline nodes toward 0 when undriven
        if (!n.baselineActive && net <= 0) n.activity *= Math.exp(-n.decayRate * dt);
        n.activity = Math.max(0, Math.min(max, n.activity));
        n.rising = n.activity > prev + 1e-6;
      }

      // activation crossing (non-baseline nodes)
      if (!n.baselineActive && !n.everActivated && n.activity >= n.threshold) {
        n.everActivated = true; n.activationTimeH = this.timeH; n.activeTimeH = 0;
        this.timeline.push({ timeH: round2(this.timeH), nodeId: n.id, event: 'activated', activity: round3(n.activity), predicted: n.predicted, predictionLevel: n.predictionLevel });
        events.push({ type: 'signal:activated', nodeId: n.id, timeH: this.timeH });
      }
      // lifetime / auto-deactivation for activated non-baseline nodes
      if (!n.baselineActive && n.everActivated && !n.degraded) {
        n.activeTimeH += dt;
        if (n.activeTimeH >= n.duration) {
          n.degraded = true;
          this.timeline.push({ timeH: round2(this.timeH), nodeId: n.id, event: 'deactivated', activity: round3(n.activity), predicted: n.predicted, predictionLevel: n.predictionLevel });
          events.push({ type: 'signal:deactivated', nodeId: n.id, timeH: this.timeH });
        }
      }
      // suppression event (baseline-active node driven below baseline)
      if (n.baselineActive) {
        const suppressed = n.activity < n.baseline - 0.05;
        if (suppressed && n._lastSuppressed !== true) {
          this.timeline.push({ timeH: round2(this.timeH), nodeId: n.id, event: 'suppressed', activity: round3(n.activity), predicted: n.predicted, predictionLevel: n.predictionLevel });
          events.push({ type: 'signal:suppressed', nodeId: n.id, timeH: this.timeH });
        }
        n._lastSuppressed = suppressed;
      }
      n.state = this._stateFor(n);
    }

    this.timeH += dt;
    this._stepCount += 1;
    return events;
  }

  _stateFor(n) {
    const a = n.activity;
    if (n.baselineActive) {
      if (a < n.baseline - 0.05) return 'suppressed';
      return 'active';
    }
    if (n.degraded) return a < 0.05 ? 'inactive' : 'degraded';
    if (!n.everActivated) {
      if (a >= 0.02 && n.rising) return 'transitioning';
      return 'inactive';
    }
    if (a >= n.threshold) return 'active';
    if (a >= 0.05) return 'partial';
    return 'inactive';
  }

  /** Deterministic headless run. */
  run(steps, dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.defaults.dt_hours ?? 0.5);
    const events = [];
    for (let i = 0; i < steps; i++) events.push(...this.step(dt));
    return events;
  }

  // ---- controls / overlays ----------------------------------------------

  setSpecies(speciesId) { this.species = speciesId; this._build(); this._log('info', 'signal', `species -> ${speciesId} (${this.nodes.size} nodes)`); return this; }
  setPredictionsEnabled(on) { this.includePredictions = !!on; this._build(); return this; }
  predictionsEnabled() { return this.includePredictions; }
  setOverlayMode(mode) { if (OVERLAY_MODES.includes(mode)) this.overlayMode = mode; return this; }
  overlay() { return this.overlayMode; }
  setSpeed(mult) { this.speed = Math.max(0.1, Math.min(16, mult || 1)); return this; }

  /** Is a node visible under the current evidence-overlay mode? (never mutates data) */
  _visible(n) {
    switch (this.overlayMode) {
      case 'experimental': return !n.predicted && isRuntimeExperimental(n.predictionLevel);
      case 'prediction': return n.predicted || isRuntimePrediction(n.predictionLevel);
      case 'unavailable': return n.evidenceLevel === 'UNAVAILABLE';
      case 'not_reported': return n.evidenceLevel === 'NOT_REPORTED';
      case 'combined':
      default: return true;
    }
  }

  /** Publication-style render frame (headless-testable): node + edge visual state. */
  frame() {
    const nodes = [...this.nodes.values()].map((n) => ({
      id: n.id, displayName: n.displayName, nodeType: n.nodeType, compartment: n.compartment,
      activity: round3(n.activity), state: n.state,
      predicted: n.predicted, predictionLevel: n.predictionLevel, evidenceLevel: n.evidenceLevel,
      confidence: n.confidence, rationale: n.rationale,
      visible: this._visible(n), layout: n.layout, isOutput: n.isOutput,
    }));
    const visibleIds = new Set(nodes.filter((n) => n.visible).map((n) => n.id));
    const edges = this.edges.map((e) => ({
      id: e.id, source: e.source, target: e.target, relationship: e.relationshipType,
      sign: e.sign, flowing: e.flowing, active: e.active,
      predicted: e.predicted, predictionLevel: e.predictionLevel, evidenceLevel: e.evidenceLevel,
      visible: visibleIds.has(e.source) && visibleIds.has(e.target),
    }));
    return { nodes, edges, timeH: round2(this.timeH), overlay: this.overlayMode, predictions: this.includePredictions };
  }

  /** Timeline of first activation/suppression/deactivation events (ordered). */
  getTimeline() { return this.timeline.slice(); }

  /** Aggregate stats for tests/panels. */
  stats() {
    let active = 0, suppressed = 0, degraded = 0, predicted = 0, maxActivity = 0;
    for (const n of this.nodes.values()) {
      if (n.state === 'active') active += 1;
      if (n.state === 'suppressed') suppressed += 1;
      if (n.state === 'degraded') degraded += 1;
      if (n.predicted) predicted += 1;
      if (n.activity > maxActivity) maxActivity = n.activity;
    }
    return { nodes: this.nodes.size, edges: this.edges.length, active, suppressed, degraded, predicted, maxActivity: round3(maxActivity), timeH: round2(this.timeH), steps: this._stepCount };
  }

  node(id) { return this.nodes.get(id) || null; }

  /** Panel-friendly summary evidence level. Idle (e.g. rat) => NOT_REPORTED; otherwise
   * the runtime cascade is exposure-driven => PREDICTIVE (canonical edges are experimental
   * relationships, but the whole in-context cascade is a labelled prediction). */
  summaryLevel() { return this.isIdle() ? 'NOT_REPORTED' : 'PREDICTIVE'; }
  summaryMessage() {
    if (this.isIdle()) return `Signal transduction: Not Reported for ${this.species} (no cellular signaling evidence).`;
    return `Signal transduction: Predictive (exposure-driven) - ${this.nodes.size} nodes, overlay '${this.overlayMode}', predictions ${this.includePredictions ? 'on' : 'off'}.`;
  }

  // ---- browser playback (deterministic per fixed dt; speed = frames/tick) ----
  play(dtHours) {
    if (this.playing || this.isIdle()) return;
    this.playing = true;
    const dt = typeof dtHours === 'number' ? dtHours : (this.defaults.dt_hours ?? 0.5);
    const raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (cb) => setTimeout(() => cb(Date.now()), 16);
    const loop = () => {
      if (!this.playing) return;
      const frames = Math.max(1, Math.round(this.speed));
      for (let i = 0; i < frames; i++) this.step(dt);
      this._raf = raf(loop);
    };
    this._raf = raf(loop);
  }
  pause() { this.playing = false; if (this._raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this._raf); this._raf = null; }
  stepOnce(dtHours) { return this.step(dtHours); }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function round2(x) { return Math.round(x * 100) / 100; }
function round3(x) { return Math.round(x * 1000) / 1000; }

export default SignalPropagationEngine;
