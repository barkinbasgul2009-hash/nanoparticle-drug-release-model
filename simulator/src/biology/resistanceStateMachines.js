// Phase-8A resistance finite-state machines. This module holds ONLY the generic enforcement
// mechanism; the enumerated legal transitions live in resistance-transition.registry.json
// (registry-driven coefficient policy). Every transition not enumerated there is ILLEGAL and
// rejected here. Machines are deterministic - no RNG, no wall-clock time, no unordered iteration.
//
// Categorical machines (drug_tolerance, adaptive_resistance, acquired_resistance,
// persistent_resistance, re_sensitization, treatment_exposure, population_subpopulation) enumerate
// exact edges. Ordinal-magnitude machines (treatment_pressure, selection_pressure,
// population_enrichment, resistance_burden_category) are single-step bidirectional over an ordered
// state list; their adjacency is ALSO enumerated in the registry so the same guard applies.

export class ResistanceStateMachines {
  /** @param {any} transitionRegistry parsed resistance-transition.registry.json */
  constructor(transitionRegistry) {
    if (!transitionRegistry || !transitionRegistry.state_machines) throw new Error('ResistanceStateMachines requires the resistance-transition registry');
    this.machines = transitionRegistry.state_machines;
    this.originClassifications = transitionRegistry.origin_classifications || [];
  }

  /** All machine names. */
  names() { return Object.keys(this.machines); }

  /** The machine definition (or null). */
  machine(name) { return this.machines[name] || null; }

  /** Initial state for a machine. */
  initialState(name) { const m = this.machine(name); return m ? m.initial_state : null; }

  /** The ordered list of states for a machine. */
  states(name) { const m = this.machine(name); return m ? (m.states || []).slice() : []; }

  /** Is `state` a valid state of `name`? */
  isState(name, state) { const m = this.machine(name); return !!m && (m.states || []).includes(state); }

  /** Are `from` -> `to` legal for machine `name`? (self-transition is always legal.) */
  canTransition(name, from, to) {
    const m = this.machine(name);
    if (!m) return false;
    if (!(m.states || []).includes(from) || !(m.states || []).includes(to)) return false;
    if (from === to) return true;                              // idempotent hold
    const legal = (m.legal_transitions || {})[from] || [];
    return legal.includes(to);
  }

  /** Throw on an illegal transition; return `to` on success. */
  assertTransition(name, from, to) {
    if (!this.canTransition(name, from, to)) throw new Error(`illegal ${name} transition: ${from} -> ${to}`);
    return to;
  }

  /**
   * Apply a proposed transition, returning `to` if legal or clamping to `from` (hold) if not.
   * `strict` throws instead of holding. Used by the engine so an unsupported proposal never
   * produces an illegal jump (it simply holds the previous state).
   */
  step(name, from, to, strict = false) {
    if (this.canTransition(name, from, to)) return to;
    if (strict) throw new Error(`illegal ${name} transition: ${from} -> ${to}`);
    return from;
  }

  /** Ordinal helpers: index of a state in its ordered list (or -1). */
  ordinalIndex(name, state) { return this.states(name).indexOf(state); }

  /** Move one ordinal step toward a target magnitude state (single-step bidirectional guarantee). */
  ordinalToward(name, from, target) {
    const states = this.states(name);
    const i = states.indexOf(from); const j = states.indexOf(target);
    if (i < 0 || j < 0 || i === j) return from;
    const next = states[i + (j > i ? 1 : -1)];
    return this.step(name, from, next);
  }

  /** Validate every machine's structural integrity (states/edges reference declared states). */
  validate() {
    const errors = [];
    for (const [name, m] of Object.entries(this.machines)) {
      const states = new Set(m.states || []);
      if (!states.size) errors.push(`machine ${name} has no states`);
      if (m.initial_state && !states.has(m.initial_state)) errors.push(`machine ${name} initial_state ${m.initial_state} not in states`);
      for (const [from, tos] of Object.entries(m.legal_transitions || {})) {
        if (!states.has(from)) errors.push(`machine ${name} legal_transitions references unknown state ${from}`);
        for (const to of tos) if (!states.has(to)) errors.push(`machine ${name} transition ${from}->${to} targets unknown state ${to}`);
      }
    }
    return { ok: errors.length === 0, errors };
  }
}

export default ResistanceStateMachines;
