// Phase-7C Part 2 immune debugger + search (read-only, deterministic). The debugger exposes the
// complete execution history (module order matching the ACTUAL runtime, dependency inspection,
// contribution application incl. rejected/superseded/unavailable) without modifying runtime state.
// The search engine queries immutable published objects only. Neither mutates anything.

import { deepFreeze } from '../biology/immuneObjects.js';
import { buildContributionView, buildDoubleCountingView } from './immuneViews.js';

// The ACTUAL acyclic runtime order (Section 4 engine). Section-3 innate input is upstream (absent in
// this build). "Execution order must match actual runtime" - this reflects the real sequence.
export const MODULE_EXECUTION_ORDER = Object.freeze([
  'section3_innate_input', 'adaptive_context', 'treg', 'checkpoint', 'integrated_suppression',
  'cd4', 'cd8', 'immune_escape', 'adaptive_integration', 'net_immune_integration', 'immune_frame_publication', 'phase8a_adapter',
]);

// Static dependency map (data flow, acyclic).
const DEPENDENCIES = Object.freeze({
  adaptive_context: { in: ['section3_innate_input', 'phase7a', 'phase7b', 'immune_frame'], out: ['treg', 'checkpoint', 'cd4', 'cd8', 'immune_escape'] },
  treg: { in: ['adaptive_context'], out: ['integrated_suppression', 'immune_escape'] },
  checkpoint: { in: ['adaptive_context'], out: ['integrated_suppression', 'cd4', 'cd8', 'immune_escape'] },
  integrated_suppression: { in: ['treg', 'checkpoint', 'adaptive_context'], out: ['cd4', 'cd8', 'immune_escape', 'net_immune_integration'] },
  cd4: { in: ['adaptive_context', 'checkpoint', 'integrated_suppression'], out: ['cd8', 'adaptive_integration'] },
  cd8: { in: ['adaptive_context', 'checkpoint', 'integrated_suppression', 'cd4'], out: ['immune_escape', 'adaptive_integration', 'net_immune_integration'] },
  immune_escape: { in: ['cd8', 'cd4', 'treg', 'checkpoint', 'integrated_suppression'], out: ['adaptive_integration', 'net_immune_integration'] },
  adaptive_integration: { in: ['cd8', 'cd4', 'treg', 'checkpoint', 'integrated_suppression', 'immune_escape'], out: ['net_immune_integration'] },
  net_immune_integration: { in: ['adaptive_integration', 'immune_escape', 'integrated_suppression', 'checkpoint', 'cd8'], out: ['immune_frame_publication', 'phase8a_adapter'] },
});

export class ImmuneDebugger {
  constructor(frame) { if (!frame) throw new Error('ImmuneDebugger requires a frame'); this.frame = frame; }

  /** Execution trace: each module in runtime order + its published-output availability. */
  executionTrace() {
    const f = this.frame; const ds = f;   // domain states live at the top level of the frame
    const availOf = (o) => (o && typeof o.availability === 'string' ? o.availability : 'UNAVAILABLE');
    const map = {
      section3_innate_input: f.metadata && f.metadata.innateAvailable ? 'AVAILABLE' : 'UNAVAILABLE',
      adaptive_context: (f.inputSummary && f.inputSummary.availability) ? 'PRESENT' : 'UNAVAILABLE',
      treg: availOf(ds.adaptiveImmunity && ds.adaptiveImmunity.treg), checkpoint: availOf(ds.checkpointState),
      integrated_suppression: availOf(ds.immuneSuppression), cd4: availOf(ds.adaptiveImmunity && ds.adaptiveImmunity.cd4),
      cd8: availOf(ds.adaptiveImmunity && ds.adaptiveImmunity.cd8), immune_escape: availOf(ds.immuneEscape),
      adaptive_integration: availOf(ds.adaptiveImmunity && ds.adaptiveImmunity.adaptive), net_immune_integration: availOf(ds.immuneEffect),
      immune_frame_publication: f.availability, phase8a_adapter: availOf(ds.resistanceReadiness),
    };
    return deepFreeze(MODULE_EXECUTION_ORDER.map((m, i) => ({ order: i, module: m, availability: map[m] || 'UNAVAILABLE', dependencies: DEPENDENCIES[m] || { in: [], out: [] } })));
  }

  /** Incoming/outgoing dependencies for a module (read-only; no editing). */
  dependencies(module) { return deepFreeze(DEPENDENCIES[module] || { in: [], out: [] }); }

  appliedContributions() { return buildContributionView(this.frame).filter((c) => c.applied); }
  rejectedContributions() { return buildContributionView(this.frame).filter((c) => c.applicationStatus === 'Rejected'); }
  supersededContributions() { return buildContributionView(this.frame).filter((c) => c.applicationStatus === 'Superseded'); }
  unavailableContributions() { return buildContributionView(this.frame).filter((c) => c.applicationStatus === 'Unavailable'); }
  doubleCountingEvents() { return buildDoubleCountingView(this.frame); }
  canEdit() { return false; }
}

// ---------------------------------------------------------------------------
// Search engine over immutable published objects.
// ---------------------------------------------------------------------------
export class ImmuneSearch {
  constructor(frames) { this.frames = Array.isArray(frames) ? frames : [frames]; this._index = this._build(); }

  _build() {
    const rows = [];
    for (const f of this.frames) {
      rows.push({ type: 'frame', id: f.frameId, frameId: f.frameId, frameIndex: f.frameIndex, simulationTime: f.simulationTime, availability: f.availability, status: f.status, version: f.schemaVersion, text: `${f.frameId} ${f.status}` });
      const ds = f;
      const add = (type, id, module, extra) => rows.push({ type, id, module, frameId: f.frameId, frameIndex: f.frameIndex, simulationTime: f.simulationTime, availability: f.availability, ...extra, text: `${type} ${id} ${module || ''} ${extra && extra.state || ''}`.toLowerCase() });
      if (ds.adaptiveImmunity) { add('contribution_object', 'cd8', 'cd8', { state: ds.adaptiveImmunity.cd8 && ds.adaptiveImmunity.cd8.activation && ds.adaptiveImmunity.cd8.activation.state }); add('contribution_object', 'cd4', 'cd4', {}); add('contribution_object', 'treg', 'treg', {}); }
      if (ds.checkpointState) add('contribution_object', 'checkpoint', 'checkpoint', {});
      if (ds.immuneSuppression) add('contribution_object', 'suppression', 'suppression', { state: ds.immuneSuppression.state });
      if (ds.immuneEscape) add('contribution_object', 'escape', 'escape', { state: ds.immuneEscape.magnitudeState });
      if (ds.immuneEffect) add('contribution_object', 'net', 'net', { controlState: ds.immuneEffect.controlState, failureState: ds.immuneEffect.failureState });
      for (const w of (f.warnings || [])) add('warning', w.code, w.module, { severity: w.severity });
      for (const t of (f.transitionRecords || [])) add('transition', t.transitionId, t.machine, { state: t.newState });
      for (const e of (f.evidenceRecords || [])) add('evidence', e.id || e.evidence_id, 'immune', {});
      for (const p of (f.predictionRecords || [])) add('prediction', p.prediction_id || p.predictionId, 'immune', {});
      for (const c of (f.contributionLedger || [])) add('contribution', c.contributionId, c.sourceModule, {});
    }
    return rows;
  }

  /**
   * @param {string} query
   * @param {{ mode?:string, type?:string, module?:string, frameId?:string, availability?:string, state?:string, version?:string, minFrame?:number, maxFrame?:number }} opts
   */
  search(query = '', opts = {}) {
    const mode = opts.mode || 'partial'; const q = String(query).toLowerCase();
    let rows = this._index.slice();
    if (opts.type) rows = rows.filter((r) => r.type === opts.type);
    if (opts.module) rows = rows.filter((r) => r.module === opts.module);
    if (opts.frameId) rows = rows.filter((r) => r.frameId === opts.frameId);
    if (opts.availability) rows = rows.filter((r) => r.availability === opts.availability);
    if (opts.state) rows = rows.filter((r) => r.state === opts.state || r.controlState === opts.state || r.failureState === opts.state);
    if (opts.version) rows = rows.filter((r) => r.version === opts.version);
    if (opts.minFrame != null) rows = rows.filter((r) => (r.frameIndex ?? 0) >= opts.minFrame);
    if (opts.maxFrame != null) rows = rows.filter((r) => (r.frameIndex ?? 0) <= opts.maxFrame);
    if (q) {
      if (mode === 'exact') rows = rows.filter((r) => String(r.id).toLowerCase() === q);
      else if (mode === 'identifier') rows = rows.filter((r) => String(r.id).toLowerCase().includes(q));
      else if (mode === 'module') rows = rows.filter((r) => String(r.module || '').toLowerCase() === q);
      else rows = rows.filter((r) => r.text.includes(q));   // partial (default)
    }
    return deepFreeze(rows);
  }
}

export default ImmuneDebugger;
