// Protein-function & early-cellular-response engine (Phase 6A). The first phase where a
// newly synthesized protein may produce a functional cellular consequence:
//
//   mature protein -> functional eligibility -> functional activation/inhibition
//     -> early biochemical cellular-state change -> homeostatic/stress response
//     -> reversible adaptation   [STOP - no cell fate]
//
// SEPARATE layer. Reads the Phase-5D TranslationEngine (mature proteins) and the Phase-5B
// SignalPropagationEngine (accepted signaling outputs) plus the Phase-6A registries
// READ-ONLY; modifies NOTHING upstream (never mutates Protein objects, signal nodes, etc.).
// Deterministic (pure arithmetic, no RNG, fixed-dt). Every cellular-state value is a
// SCHEMATIC 0-1 abstraction, reversible and bounded; NO concentration/biomarker/activity %.
// Cell fate is NEVER evaluated. Feedback is registry-declared, typed, bounded, stable.

import { FunctionalProteinState, CellularStateVariable, FunctionalEdge, stateOrdinal } from './proteinFunctionObjects.js';
import { isFunctionEvidenceLevel, isFunctionExperimental, isFunctionPrediction, functionLevelActive } from '../evidence/evidenceEngine.js';

const NEGATIVE_RELATIONSHIPS = new Set(['inhibition', 'attenuation', 'capacity_decrease', 'readiness_decrease', 'stress_reduction']);
function relationshipSign(rel) { return NEGATIVE_RELATIONSHIPS.has(rel) ? -1 : 1; }

export class ProteinFunctionEngine {
  /**
   * @param {{
   *   functionContextRegistry:any, cellularStateRegistry:any, functionalEdgeRegistry:any, functionalEvidenceRegistry:any,
   *   translationEngine: object, signalEngine?: object, species?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.functionContextRegistry || !deps.cellularStateRegistry || !deps.functionalEdgeRegistry || !deps.functionalEvidenceRegistry || !deps.translationEngine) {
      throw new Error('ProteinFunctionEngine requires the four Phase-6A registries + translationEngine');
    }
    this.fnCtxReg = deps.functionContextRegistry;
    this.stateReg = deps.cellularStateRegistry;
    this.edgeReg = deps.functionalEdgeRegistry;
    this.evReg = deps.functionalEvidenceRegistry;
    this.translation = deps.translationEngine; // read-only mature proteins
    this.signal = deps.signalEngine || null;   // read-only signaling outputs
    this.logger = deps.logger || null;
    this.dyn = (this.edgeReg.dynamics) || {};
    this.species = deps.species || 'human';
    this._build();
  }

  _profile(reg) { return Object.values(reg.profiles || {}).find((p) => p.species === this.species) || null; }

  _build() {
    /** @type {Map<string,FunctionalProteinState>} */ this.functions = new Map();
    /** @type {Map<string,CellularStateVariable>} */ this.states = new Map();
    /** @type {FunctionalEdge[]} */ this.edges = [];
    this.timeH = 0; this._stepCount = 0; this.timeline = [];

    const fnP = this._profile(this.fnCtxReg);
    const stP = this._profile(this.stateReg);
    const edP = this._profile(this.edgeReg);
    this.fnProfile = fnP;
    this.summaryLevelName = fnP ? (fnP.summary_level || 'NOT_REPORTED') : 'NOT_REPORTED';

    // Function profiles that carry protein-sourced functions.
    if (fnP && (fnP.status === 'ACTIVE' || fnP.status === 'ACTIVE_SIGNAL_DRIVEN')) {
      for (const [id, def] of Object.entries(fnP.functions || {})) {
        this.functions.set(id, new FunctionalProteinState(id, { ...def, species: this.species, cell_model: fnP.cell_model }));
      }
    }
    // Cellular states.
    if (stP && stP.status === 'ACTIVE') {
      for (const [id, def] of Object.entries(stP.states || {})) {
        this.states.set(id, new CellularStateVariable(id, { ...def, species: this.species, cell_model: stP.cell_model }));
      }
    }
    // Functional edges.
    if (edP && edP.status === 'ACTIVE') {
      for (const [id, def] of Object.entries(edP.edges || {})) this.edges.push(new FunctionalEdge(id, def));
    }
    // Wire state.sourceProteins / sourceSignals for the frame.
    for (const e of this.edges) {
      const t = this.states.get(e.targetStateId);
      if (!t) continue;
      if (e.sourceType === 'protein_function') t.sourceProteins.push(e.sourceId);
      else if (e.sourceType === 'signal_node') t.sourceSignals.push(e.sourceId);
    }
  }

  /** Idle when there are no cellular states and no functional proteins for the species. */
  isIdle() { return this.states.size === 0 && this.functions.size === 0; }

  // ---- runtime -----------------------------------------------------------

  restart() {
    for (const f of this.functions.values()) { f.maturityState = 'unavailable'; f.functionalState = 'unavailable'; f.functionalCapacity = 0; f.activityState = 0; f.inhibitionState = 0; f.activatedAt = null; f.deactivatedAt = null; f._since = null; }
    for (const s of this.states.values()) { s.currentValue = s.baseline; s.updatedAt = null; }
    for (const e of this.edges) { e.active = false; e.contribution = 0; e._since = null; }
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    return this;
  }
  reset() { return this.restart(); }

  _strength(cls) { const m = this.dyn.strength_class_values || { low: 0.2, moderate: 0.45, high: 0.7 }; return typeof m[cls] === 'number' ? m[cls] : 0.45; }
  _delayH(cls) { const m = this.dyn.delay_class_hours || { immediate: 0, early: 2, intermediate: 5, late: 10 }; return typeof m[cls] === 'number' ? m[cls] : 2; }

  /** Mature-protein gate: functional capacity from the Phase-5D protein (read-only). */
  _updateFunction(f) {
    const p = this.translation && this.translation.protein ? this.translation.protein(f.proteinId) : null;
    const evActive = functionLevelActive(f.evidenceLevel) && f.functionAvailable;
    if (!p || this.translation.isIdle()) { f.maturityState = 'unavailable'; f.functionalState = 'unavailable'; f.functionalCapacity = Math.max(0, f.functionalCapacity - 0.2); if (f.functionalCapacity < 0.02) f.functionalCapacity = 0; return; }
    f.maturityState = p.state;
    const mature = p.matureUnits > 0 && p.abundanceFrac > (this.dyn.eligibility_abundance_threshold ?? 0.05);
    const degradedOnly = p.producedUnits > 0 && p.matureUnits === 0 && p.foldingUnits === 0;
    if (!evActive) { f.functionalState = 'unavailable'; f.functionalCapacity = 0; return; }
    if (mature) {
      if (f._since == null) { f._since = this.timeH; this._push('function', f.id, 'function_eligible'); }
      const wasActive = f.functionalState === 'active';
      // small activation delay (early class) before full function
      const actDelay = this._delayH('early');
      f.functionalCapacity = p.abundanceFrac;
      if (this.timeH - f._since >= actDelay) { f.functionalState = 'active'; f.activityState = f.functionalCapacity; if (f.activatedAt == null) { f.activatedAt = this.timeH; this._push('function', f.id, 'function_activated'); } }
      else { f.functionalState = 'activating'; f.activityState = f.functionalCapacity * 0.5; }
    } else if (degradedOnly) {
      f.functionalState = 'inactive_after_degradation'; f.functionalCapacity = Math.max(0, f.functionalCapacity - 0.2); if (f.functionalCapacity < 0.02) f.functionalCapacity = 0; if (f.deactivatedAt == null && f.activatedAt != null) f.deactivatedAt = this.timeH;
    } else {
      f.functionalState = f.activatedAt ? 'recovering' : 'eligible'; f.functionalCapacity = Math.max(0, f.functionalCapacity - 0.1);
    }
  }

  _sourceValue(e) {
    if (e.sourceType === 'protein_function') {
      const f = this.functions.get(e.sourceId); if (!f) return { v: 0, ready: false };
      const ready = f.functionalState === 'active' || f.functionalState === 'activating' || f.functionalState === 'partially_active';
      let v = f.functionalCapacity;
      if (e.baselineRelative) v = f.functionalCapacity - e.sourceReference;
      return { v, ready };
    }
    if (e.sourceType === 'signal_node') {
      if (!this.signal || !this.signal.node || this.signal.isIdle()) return { v: 0, ready: false };
      const n = this.signal.node(e.sourceId); if (!n) return { v: 0, ready: false };
      let v = n.activity;
      if (e.baselineRelative) v = n.activity - (n.baselineActive ? (n.baseline || 0) : 0);
      return { v, ready: n.everActivated || n.baselineActive };
    }
    if (e.sourceType === 'cellular_state') {
      const s = this.states.get(e.sourceId); if (!s) return { v: 0, ready: true };
      return { v: s.currentValue, ready: true };
    }
    return { v: 0, ready: false };
  }

  _push(kind, id, event, extra) { this.timeline.push({ timeH: r2(this.timeH), kind, id, event, ...(extra || {}) }); }

  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.dyn.dt_hours ?? 0.5);
    if (this.isIdle()) { this.timeH += dt; this._stepCount += 1; return []; }
    const events = [];
    const relax = this.dyn.relax_rate_per_hour ?? 0.5;

    // 1) update functional proteins from the read-only Phase-5D output.
    for (const f of this.functions.values()) {
      const before = f.functionalState;
      this._updateFunction(f);
      if (before !== 'active' && f.functionalState === 'active') events.push({ type: 'function:activated', id: f.id, timeH: this.timeH });
    }

    // 2) accumulate per-state contributions from active edges (delay-gated).
    const inputs = new Map();
    for (const id of this.states.keys()) inputs.set(id, 0);
    for (const e of this.edges) {
      const t = this.states.get(e.targetStateId);
      if (!t) { e.active = false; e.contribution = 0; continue; }
      const { v, ready } = this._sourceValue(e);
      if (ready && e._since == null) e._since = this.timeH;
      const cleared = e._since != null && (this.timeH - e._since) >= this._delayH(e.delayClass);
      const sign = relationshipSign(e.relationshipType);
      const contrib = (ready && cleared) ? sign * this._strength(e.strengthClass) * v : 0;
      e.active = ready && cleared && Math.abs(contrib) > 1e-6;
      e.contribution = contrib;
      inputs.set(e.targetStateId, inputs.get(e.targetStateId) + contrib);
    }

    // 3) update cellular states: relax toward (baseline + inputs), clamped [0,1] (reversible).
    for (const s of this.states.values()) {
      const target = Math.max(0, Math.min(1, s.baseline + (inputs.get(s.id) || 0)));
      const prevOrd = stateOrdinal(s.currentValue);
      s.currentValue += (target - s.currentValue) * Math.min(1, relax * dt);
      s.currentValue = Math.max(0, Math.min(1, s.currentValue));
      s.updatedAt = this.timeH;
      const ord = stateOrdinal(s.currentValue);
      if (ord !== prevOrd) this._push('state', s.id, `${s.canonicalName}_${ord}`, { direction: s.currentValue > (target - 1e-9) ? 'toward' : 'toward' });
    }

    this.timeH += dt; this._stepCount += 1;
    return events;
  }

  run(steps, dtHours) { const ev = []; for (let i = 0; i < steps; i++) ev.push(...this.step(dtHours)); return ev; }
  stepOnce(dtHours) { return this.step(dtHours); }
  setSpecies(speciesId) { this.species = speciesId; this._build(); this._log('info', 'function', `species -> ${speciesId} (${this.states.size} states, ${this.functions.size} functions)`); return this; }

  // ---- accessors / frame -------------------------------------------------

  fn(id) { return this.functions.get(id) || null; }
  state(id) { return this.states.get(id) || null; }
  getTimeline() { return this.timeline.slice(); }

  summaryLevel() { return this.isIdle() ? 'NOT_REPORTED' : 'PREDICTIVE'; }
  summaryMessage() {
    if (this.isIdle()) return `Protein function & early cellular response: Not Reported for ${this.species} (no mature protein / no functional profile).`;
    return `Protein function & early cellular response: Predictive - ${this.functions.size} functions, ${this.states.size} cellular states; schematic reversible states (not a biological timescale); cell fate NOT evaluated.`;
  }

  stats() {
    let activeFns = 0; for (const f of this.functions.values()) if (f.functionalState === 'active') activeFns += 1;
    let activeEdges = 0; for (const e of this.edges) if (e.active) activeEdges += 1;
    const stateVals = {}; for (const s of this.states.values()) stateVals[s.id] = r3(s.currentValue);
    return { functions: this.functions.size, activeFunctions: activeFns, states: this.states.size, activeEdges, stateValues: stateVals, timeH: r2(this.timeH), steps: this._stepCount };
  }

  frame() {
    const functions = [...this.functions.values()].map((f) => ({
      id: f.id, proteinId: f.proteinId, functionType: f.functionType, functionalState: f.functionalState,
      capacity: r3(f.functionalCapacity), activity: r3(f.activityState), maturityState: f.maturityState,
      predicted: isFunctionPrediction(f.evidenceLevel), evidenceLevel: f.evidenceLevel, predictionLevel: f.predictionLevel, confidence: f.confidence,
    }));
    const states = [...this.states.values()].map((s) => ({
      id: s.id, name: s.displayName, stateType: s.stateType, value: r3(s.currentValue), ordinal: stateOrdinal(s.currentValue),
      baseline: s.baseline, reversible: s.reversible, evidenceLevel: s.evidenceLevel, predictionLevel: s.predictionLevel, confidence: s.confidence,
      sourceProteins: s.sourceProteins.slice(), sourceSignals: s.sourceSignals.slice(),
    }));
    const edges = this.edges.map((e) => ({ id: e.id, sourceType: e.sourceType, sourceId: e.sourceId, targetStateId: e.targetStateId, relationship: e.relationshipType, sign: relationshipSign(e.relationshipType), active: e.active, contribution: r3(e.contribution), predicted: isFunctionPrediction(e.evidenceLevel), evidenceLevel: e.evidenceLevel, feedback: e.feedback }));
    return { functions, states, edges, timeH: r2(this.timeH), summaryLevel: this.summaryLevel(), cellFateEvidence: 'NOT_EVALUATED' };
  }

  // ---- validation --------------------------------------------------------

  validate() {
    const errors = []; const warnings = [];
    const FORBIDDEN = ['apoptosis', 'caspase', 'cytochrome', 'aif', 'necrosis', 'ferroptosis', 'bax', 'bcl2', 'bcl-2', 'parp', 'tumour', 'tumor', 'immune', 'cytokine', 'pharmacokinet', 'pharmacodynam'];
    const evRefs = this.evReg.evidence_records || {};
    const predRecs = this.evReg.prediction_records || {};

    // cellular-state profiles
    const stProfs = this.stateReg.profiles || {};
    for (const [pid, p] of Object.entries(stProfs)) {
      if (p.status === 'NOT_REPORTED') { if (Object.keys(p.states || {}).length) errors.push(`cellular-state profile ${pid} NOT_REPORTED but not empty`); continue; }
      const seen = new Set();
      for (const [sid, s] of Object.entries(p.states || {})) {
        if (seen.has(sid)) errors.push(`duplicate cellular-state id: ${sid}`); seen.add(sid);
        if (typeof s.baseline !== 'number' || s.baseline < 0 || s.baseline > 1) errors.push(`state ${sid} baseline out of [0,1]`);
        if (!isFunctionEvidenceLevel(s.evidence_level)) errors.push(`state ${sid} invalid evidence_level`);
        for (const bad of FORBIDDEN) if ((s.canonical_name || '').toLowerCase().includes(bad) || (s.state_type || '').toLowerCase().includes(bad)) errors.push(`state ${sid} uses a forbidden (cell-fate) concept: ${bad}`);
      }
    }
    // function profiles: protein refs, species, evidence
    const fnProfs = this.fnCtxReg.profiles || {};
    for (const [pid, p] of Object.entries(fnProfs)) {
      if (p.status === 'NOT_REPORTED') { if (Object.keys(p.functions || {}).length) errors.push(`function profile ${pid} NOT_REPORTED but not empty`); continue; }
      const seen = new Set();
      for (const [fid, f] of Object.entries(p.functions || {})) {
        if (seen.has(fid)) errors.push(`duplicate function id: ${fid}`); seen.add(fid);
        if (!isFunctionEvidenceLevel(f.evidence_level)) errors.push(`function ${fid} invalid evidence_level`);
        if (isFunctionExperimental(f.evidence_level)) errors.push(`function ${fid} EXPERIMENTAL requires a verified reference (none expected for Profile B)`);
        if (this.translation && this.translation.species === p.species && !this.translation.isIdle() && !this.translation.protein(f.source_protein)) {
          errors.push(`function ${fid} references a protein not present in Phase-5D: ${f.source_protein}`);
        }
        if (p.cell_fate_evidence && p.cell_fate_evidence !== 'NOT_EVALUATED') errors.push(`function profile ${pid} cell_fate_evidence must be NOT_EVALUATED`);
      }
    }
    // edges: valid refs, no cross-species, evidence, prediction records, cycle-must-be-feedback
    const edgeProfs = this.edgeReg.profiles || {};
    const feedbackTypes = new Set(this.edgeReg.feedback_relationship_types || []);
    for (const [pid, p] of Object.entries(edgeProfs)) {
      if (p.status === 'NOT_REPORTED') { if (Object.keys(p.edges || {}).length) errors.push(`edge profile ${pid} NOT_REPORTED but not empty`); continue; }
      const stateIds = new Set(Object.keys(((stProfs[pid] || {}).states) || {}));
      const fnIds = new Set(Object.keys(((fnProfs[pid] || {}).functions) || {}));
      const adj = new Map();
      for (const [eid, e] of Object.entries(p.edges || {})) {
        if (!stateIds.has(e.target_state_id)) errors.push(`edge ${eid} references missing target state: ${e.target_state_id}`);
        if (e.source_type === 'protein_function' && !fnIds.has(e.source_id)) errors.push(`edge ${eid} references missing function: ${e.source_id}`);
        if (e.source_type === 'cellular_state' && !stateIds.has(e.source_id)) errors.push(`edge ${eid} references missing source state: ${e.source_id}`);
        if (!isFunctionEvidenceLevel(e.evidence_level)) errors.push(`edge ${eid} invalid evidence_level`);
        if (isFunctionExperimental(e.evidence_level)) {
          const refs = (e.reference_ids || []).map((r) => evRefs[r]).filter(Boolean);
          if (!refs.length || refs.some((r) => r.verification_status !== 'VERIFIED_IN_FROZEN_PACKAGE')) errors.push(`edge ${eid} EXPERIMENTAL without a verified reference`);
        }
        if (isFunctionPrediction(e.evidence_level)) {
          const pr = Object.values(predRecs).find((r) => r.edge_id === eid);
          if (pr && (!pr.confidence || !pr.source_principle)) warnings.push(`prediction record for ${eid} lacks confidence/rationale`);
        }
        for (const bad of FORBIDDEN) if ((e.relationship_type || '').toLowerCase().includes(bad)) errors.push(`edge ${eid} uses a forbidden relationship: ${bad}`);
        // build state->state adjacency for cycle detection, EXCLUDING declared feedback
        // edges. A legitimate cycle must be broken by removing feedback edges; if a cycle
        // survives among non-feedback edges only, it is undeclared.
        if (e.source_type === 'cellular_state' && !(e.feedback || feedbackTypes.has(e.relationship_type))) {
          if (!adj.has(e.source_id)) adj.set(e.source_id, []); adj.get(e.source_id).push({ to: e.target_state_id, rel: e.relationship_type });
        }
      }
      // any cycle remaining among non-feedback state->state edges is undeclared
      const cyc = this._findCycle(adj);
      if (cyc) errors.push(`edge profile ${pid} has an UNDECLARED cellular-state cycle: ${cyc.nodes.join(' -> ')}`);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _findCycle(adj) {
    const WHITE = 0, GRAY = 1, BLACK = 2; const color = new Map();
    for (const k of adj.keys()) color.set(k, WHITE);
    const stack = []; const relStack = [];
    let found = null;
    const visit = (u) => {
      color.set(u, GRAY); stack.push(u);
      for (const { to, rel } of (adj.get(u) || [])) {
        if (found) return;
        if (color.get(to) === GRAY) { const idx = stack.indexOf(to); found = { nodes: stack.slice(idx).concat(to), edges: relStack.slice(idx).concat(rel) }; return; }
        if ((color.get(to) ?? WHITE) === WHITE) { relStack.push(rel); visit(to); relStack.pop(); }
      }
      color.set(u, BLACK); stack.pop();
    };
    for (const k of adj.keys()) if (color.get(k) === WHITE && !found) visit(k);
    return found;
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default ProteinFunctionEngine;
