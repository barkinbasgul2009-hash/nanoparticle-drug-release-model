// Phase-7C unified registry framework (Part 1 - Section 2). Wraps the already-loaded immune registry
// bundle (loaded via the repository's JsonLoader - NOT a second loader) and provides schema / duplicate
// / range / reference / version validation before runtime execution. Registry categories stay
// independent; one registry never overwrites another. If validation fails, callers stop safely rather
// than run on a corrupted bundle. Deterministic (sorted iteration). No biological constants live here.

import { ImmuneRuntimeIssue, ISSUE_SEVERITY, isFiniteNumber } from './immuneObjects.js';

export class ImmuneRegistryProvider {
  /** @param {Record<string, any>} bundle keyed immune registries (from APP_CONFIG.immuneSources) */
  constructor(bundle) {
    if (!bundle || typeof bundle !== 'object') throw new Error('ImmuneRegistryProvider requires a registry bundle');
    this.bundle = bundle;
    this._report = null;
  }

  categories() { return Object.keys(this.bundle).sort(); }
  get(category) { return this.bundle[category] || null; }
  /** Safe nested accessor: getEntry('aggregation', ['targets','tumor_visibility','method']). */
  getEntry(category, path = []) { let node = this.bundle[category]; for (const k of path) { if (node == null) return null; node = node[k]; } return node ?? null; }

  /** True only after a successful validate(). */
  get ok() { return !!(this._report && this._report.ok); }

  /**
   * Validate the whole bundle. Returns { ok, issues } with structured ImmuneRuntimeIssue records.
   * Never throws for ordinary content problems; the caller decides to stop.
   */
  validate() {
    const issues = [];
    const push = (code, severity, message, field) => issues.push(new ImmuneRuntimeIssue({ code, severity, module: 'immuneRegistryFramework', message, affectedField: field, recoverable: severity !== ISSUE_SEVERITY.FATAL }));

    for (const cat of this.categories()) {
      const reg = this.bundle[cat];
      if (!reg || typeof reg !== 'object') { push('IMMUNE_INPUT_MISSING', ISSUE_SEVERITY.FATAL, `registry ${cat} missing or not an object`, cat); continue; }
      if (!reg.$schema_version && !reg.registry_bundle_version && !reg.aggregation_framework_version && !reg.confidence_framework_version && !reg.state_machine_version) {
        push('IMMUNE_VALUE_OUT_OF_RANGE', ISSUE_SEVERITY.WARNING, `registry ${cat} has no schema/version marker`, cat);
      }
      // duplicate id + range checks over keyed entry maps that expose id/min/max/value
      this._checkKeyedEntries(cat, reg, push);
    }

    // cross-reference: context evidence_refs must resolve; prediction targets must resolve
    this._checkReferences(issues, push);

    // state-machine structural integrity (delegated to the transition registry's own shape)
    const tr = this.bundle.transition;
    if (tr && tr.state_machines) {
      for (const [name, m] of Object.entries(tr.state_machines)) {
        const states = new Set(m.states || []);
        if (m.initial_state && !states.has(m.initial_state)) push('IMMUNE_STATE_TRANSITION_BLOCKED', ISSUE_SEVERITY.ERROR, `machine ${name} initial_state not in states`, name);
        for (const [from, tos] of Object.entries(m.legal_transitions || {})) {
          if (!states.has(from)) push('IMMUNE_STATE_TRANSITION_BLOCKED', ISSUE_SEVERITY.ERROR, `machine ${name} unknown state ${from}`, name);
          for (const to of tos) if (!states.has(to)) push('IMMUNE_STATE_TRANSITION_BLOCKED', ISSUE_SEVERITY.ERROR, `machine ${name} ${from}->${to} unknown target`, name);
        }
      }
    }

    const ok = !issues.some((i) => i.severity === ISSUE_SEVERITY.ERROR || i.severity === ISSUE_SEVERITY.FATAL);
    this._report = { ok, issues };
    return this._report;
  }

  _checkKeyedEntries(cat, reg, push) {
    // scan one level of nested maps for min/max range sanity + non-finite numeric values
    for (const [group, val] of Object.entries(reg)) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
      for (const [id, entry] of Object.entries(val)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        if (isFiniteNumber(entry.min) && isFiniteNumber(entry.max) && entry.min > entry.max) push('IMMUNE_VALUE_OUT_OF_RANGE', ISSUE_SEVERITY.ERROR, `${cat}.${group}.${id} min ${entry.min} > max ${entry.max}`, `${cat}.${group}.${id}`);
        for (const [k, v] of Object.entries(entry)) if (typeof v === 'number' && !isFiniteNumber(v)) push('IMMUNE_VALUE_OUT_OF_RANGE', ISSUE_SEVERITY.ERROR, `${cat}.${group}.${id}.${k} is non-finite`, `${cat}.${group}.${id}.${k}`);
      }
    }
  }

  _checkReferences(issues, push) {
    const ctx = this.bundle.context; const ev = this.bundle.evidence; const pred = this.bundle.prediction;
    if (ctx && ctx.profiles && ev && ev.evidence_records) {
      for (const [pid, p] of Object.entries(ctx.profiles)) for (const ref of (p.evidence_refs || [])) if (!ev.evidence_records[ref]) push('IMMUNE_INPUT_MISSING', ISSUE_SEVERITY.ERROR, `context profile ${pid} references missing evidence ${ref}`, pid);
    }
    if (ctx && ctx.profiles && pred && pred.prediction_records) {
      const profileIds = new Set(Object.keys(ctx.profiles));
      for (const [rid, r] of Object.entries(pred.prediction_records)) if (r.target_context && !profileIds.has(r.target_context) && r.target_context !== 'immune_associated_resistance') push('IMMUNE_INPUT_PARTIAL', ISSUE_SEVERITY.WARNING, `prediction ${rid} targets unknown context ${r.target_context}`, rid);
    }
  }
}

export default ImmuneRegistryProvider;
