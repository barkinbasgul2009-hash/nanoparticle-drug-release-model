// Biological State Machine (Phase 3). Turns the transport registry's states +
// transitions into an ordered, evidence-tagged state machine for topical carrier
// transport: Topical Formulation -> Skin Surface -> Stratum Corneum -> Viable
// Epidermis -> Dermis -> Target Region. It performs NO simulation and NO
// rendering - it only describes the allowed states/transitions and the evidence
// behind each. Everything comes from simulator/data/transport.registry.json.

export class BiologicalStateMachine {
  /** @param {any} registry parsed transport.registry.json */
  constructor(registry) {
    if (!registry || !Array.isArray(registry.states) || !Array.isArray(registry.transitions)) {
      throw new Error('BiologicalStateMachine requires a registry with states[] and transitions[]');
    }
    this.registry = registry;
    /** @type {any[]} states in registry (declared) order */
    this.states = registry.states;
    this.transitions = registry.transitions;
    this._byId = new Map(this.states.map((s) => [s.id, s]));
    // Map from-state -> transition (linear pathway: one outgoing transition each).
    this._out = new Map(this.transitions.map((t) => [t.from, t]));
  }

  /** Ordered state ids (the canonical pathway). */
  order() { return this.states.map((s) => s.id); }

  /** @param {string} id */
  state(id) { return this._byId.get(id) || null; }

  /** The first (source) and last (target) states. */
  first() { return this.states[0]; }
  last() { return this.states[this.states.length - 1]; }

  /** The transition leaving `stateId`, or null at the terminal state. */
  transitionFrom(stateId) { return this._out.get(stateId) || null; }

  /** The next state id after `stateId`, or null at the terminal state. */
  next(stateId) {
    const t = this.transitionFrom(stateId);
    return t ? t.to : null;
  }

  /** Is `stateId` the terminal (target) state? */
  isTerminal(stateId) { return stateId === this.last().id; }

  /** Evidence descriptor for a transition (from -> to), or null. */
  evidenceForTransition(fromId) {
    const t = this.transitionFrom(fromId);
    return t ? (t.evidence || null) : null;
  }

  /**
   * Verify the machine is a single linear chain covering every declared state
   * from the first to the last, with each transition citing evidence.
   * @returns {{ ok:boolean, linear:boolean, covered:boolean, allCited:boolean }}
   */
  validate() {
    const ids = this.order();
    let cursor = ids[0];
    const visited = [cursor];
    let allCited = true;
    while (!this.isTerminal(cursor)) {
      const t = this.transitionFrom(cursor);
      if (!t) break;
      if (!t.evidence || !t.evidence.confidence) allCited = false;
      cursor = t.to;
      visited.push(cursor);
      if (visited.length > ids.length + 1) break; // cycle guard
    }
    const linear = this.transitions.length === ids.length - 1;
    const covered = visited.length === ids.length && visited.every((v, i) => v === ids[i]);
    return { ok: linear && covered && allCited, linear, covered, allCited };
  }
}

export default BiologicalStateMachine;
