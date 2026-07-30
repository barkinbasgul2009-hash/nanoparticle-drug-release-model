// Endocytosis finite-state machine (Phase 4C). A STRICT FSM for a carrier's
// intracellular fate. It knows the legal states and transitions from the registry
// and REJECTS illegal transitions. It performs NO simulation and NO rendering.
// Everything comes from simulator/data/endocytosis.registry.json.

export class EndocytosisFSM {
  /** @param {any} registry parsed endocytosis.registry.json */
  constructor(registry) {
    const fsm = registry && registry.fsm;
    if (!fsm || !Array.isArray(fsm.states) || !Array.isArray(fsm.transitions)) {
      throw new Error('EndocytosisFSM requires registry.fsm with states[] and transitions[]');
    }
    this.registry = registry;
    this.states = fsm.states;
    this.initial = fsm.initial || fsm.states[0];
    this.terminal = new Set(fsm.terminal || []);
    this.compartmentOf = fsm.compartment_of || {};
    // adjacency: from -> Set(to)
    this._adj = new Map(this.states.map((s) => [s, new Set()]));
    for (const [from, to] of fsm.transitions) {
      if (!this._adj.has(from)) throw new Error(`FSM transition from unknown state: ${from}`);
      if (!this.states.includes(to)) throw new Error(`FSM transition to unknown state: ${to}`);
      this._adj.get(from).add(to);
    }
  }

  isState(s) { return this.states.includes(s); }
  isTerminal(s) { return this.terminal.has(s); }

  /** Is `from -> to` a legal transition? */
  canTransition(from, to) {
    return this._adj.has(from) && this._adj.get(from).has(to);
  }

  /** Assert a legal transition, else throw (illegal transitions are rejected). */
  assertTransition(from, to) {
    if (!this.canTransition(from, to)) {
      throw new Error(`illegal endocytosis transition: ${from} -> ${to}`);
    }
    return to;
  }

  /** Legal next states from `s`. */
  nextStates(s) { return this._adj.has(s) ? [...this._adj.get(s)] : []; }

  /** The intracellular compartment for a state (early/late endosome, lysosome), or null. */
  compartment(state) { return this.compartmentOf[state] || null; }
}

export default EndocytosisFSM;
