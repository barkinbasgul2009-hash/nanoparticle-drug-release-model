// Phase-7C immune finite-state machines. Generic enforcement mechanism ONLY; the enumerated legal
// transitions live in immune-transition.registry.json (registry-driven). Any transition not
// enumerated there is ILLEGAL and rejected. Machines are deterministic - no RNG, no wall-clock time,
// no unordered iteration. Temporal transitions consume the PRIOR immutable frame, never hidden
// module memory. This mirrors the established resistance state-machine pattern (not a new framework).

import { IMMUNE_STATE_MACHINE_VERSION } from './immuneObjects.js';

export class ImmuneStateMachines {
  /** @param {any} transitionRegistry parsed immune-transition.registry.json */
  constructor(transitionRegistry) {
    if (!transitionRegistry || !transitionRegistry.state_machines) throw new Error('ImmuneStateMachines requires the immune-transition registry');
    this.version = transitionRegistry.state_machine_version || IMMUNE_STATE_MACHINE_VERSION;
    this.machines = transitionRegistry.state_machines;
  }

  names() { return Object.keys(this.machines); }
  machine(name) { return this.machines[name] || null; }
  initialState(name) { const m = this.machine(name); return m ? m.initial_state : null; }
  states(name) { const m = this.machine(name); return m ? (m.states || []).slice() : []; }
  isState(name, state) { const m = this.machine(name); return !!m && (m.states || []).includes(state); }

  /** Are `from` -> `to` legal for machine `name`? (self-transition is always legal.) */
  canTransition(name, from, to) {
    const m = this.machine(name);
    if (!m) return false;
    if (!(m.states || []).includes(from) || !(m.states || []).includes(to)) return false;
    if (from === to) return true;
    return ((m.legal_transitions || {})[from] || []).includes(to);
  }

  assertTransition(name, from, to) {
    if (!this.canTransition(name, from, to)) throw new Error(`illegal ${name} transition: ${from} -> ${to}`);
    return to;
  }

  /** Apply a proposed transition, or HOLD at `from` if illegal (strict throws instead of holding). */
  step(name, from, to, strict = false) {
    if (this.canTransition(name, from, to)) return to;
    if (strict) throw new Error(`illegal ${name} transition: ${from} -> ${to}`);
    return from;
  }

  ordinalToward(name, from, target) {
    const states = this.states(name);
    const i = states.indexOf(from); const j = states.indexOf(target);
    if (i < 0 || j < 0 || i === j) return from;
    return this.step(name, from, states[i + (j > i ? 1 : -1)]);
  }

  /** Structural integrity of every machine (states/edges reference declared states). */
  validate() {
    const errors = [];
    for (const [name, m] of Object.entries(this.machines)) {
      const states = new Set(m.states || []);
      if (!states.size) errors.push(`immune machine ${name} has no states`);
      if (m.initial_state && !states.has(m.initial_state)) errors.push(`immune machine ${name} initial_state ${m.initial_state} not in states`);
      for (const [from, tos] of Object.entries(m.legal_transitions || {})) {
        if (!states.has(from)) errors.push(`immune machine ${name} references unknown state ${from}`);
        for (const to of tos) if (!states.has(to)) errors.push(`immune machine ${name} transition ${from}->${to} targets unknown state ${to}`);
      }
    }
    return { ok: errors.length === 0, errors };
  }
}

export default ImmuneStateMachines;
