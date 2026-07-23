// Phase-7C shared transition-record framework (Part 1 - Section 2). Wraps the Section-1 stateless
// state-machine guard (ImmuneStateMachines) with a STATEFUL controller that records every transition
// (applied or blocked) into an ordered, serializable history. Every biological subsystem uses this
// controller instead of inventing its own transition logic. Deterministic; transitions are indexed by
// SIMULATION FRAME (never wall-clock time). Supports transition guards, minimum residence time, and
// blocked transitions with an explicit blocking reason. No implicit transitions.

// Part 2 remediation: this Section-2 shared-controller framework (exercised by the Section-2 tests; the
// production engine uses immuneTransitionPopulator) no longer mints ids from a module-global counter.
// TransitionRecord ids are CONTENT-DERIVED from identity-bearing fields so the framework is deterministic
// wherever it is exercised.
import { deterministicId } from './immuneSerialization.js';

/** One recorded transition (applied or blocked). Serializable; frame-indexed; content-derived id. */
export class TransitionRecord {
  constructor(def = {}) {
    this.machine = def.machine;
    this.previousState = def.previousState ?? null;
    this.newState = def.newState ?? null;
    this.trigger = def.trigger || null;
    this.reason = def.reason || null;
    this.frameIndex = Number.isInteger(def.frameIndex) ? def.frameIndex : 0;   // "timestamp" = sim frame
    this.transitionId = def.transitionId || deterministicId('imt', { recordType: 'transition', machine: this.machine, previousState: this.previousState, newState: this.newState, frameIndex: this.frameIndex, trigger: this.trigger, blocked: def.blocked === true, blockingReason: def.blockingReason || null }, `f${this.frameIndex}`);
    this.simulationTime = typeof def.simulationTime === 'number' ? def.simulationTime : null;
    this.confidence = def.confidence ?? null;
    this.availability = def.availability || 'UNAVAILABLE';
    this.evidenceRefs = def.evidenceRefs || [];
    this.predictionRefs = def.predictionRefs || [];
    this.warnings = def.warnings || [];
    this.blocked = def.blocked === true;
    this.blockingReason = def.blockingReason || null;
    this.metadata = def.metadata || {};
  }
  toSerializable() { return { ...this, evidenceRefs: this.evidenceRefs.slice(), predictionRefs: this.predictionRefs.slice(), warnings: this.warnings.slice(), metadata: { ...this.metadata } }; }
}

/** Ordered transition history (chronological; supports deterministic replay + inspection). */
export class TransitionHistory {
  constructor() { this.records = []; }
  add(rec) { this.records.push(rec); return rec; }
  last() { return this.records[this.records.length - 1] || null; }
  forMachine(machine) { return this.records.filter((r) => r.machine === machine); }
  applied() { return this.records.filter((r) => !r.blocked); }
  blocked() { return this.records.filter((r) => r.blocked); }
  toArray() { return this.records.map((r) => r.toSerializable()); }
}

/**
 * Stateful controller for ONE machine. Legality comes from the Section-1 guard; the controller adds
 * current-state tracking, guards, minimum residence time, and transition recording.
 */
export class ImmuneStateController {
  /**
   * @param {object} stateMachines an ImmuneStateMachines instance
   * @param {string} machine machine name
   * @param {{ history?:TransitionHistory, minResidenceFrames?:number, initialState?:string }} [opts]
   */
  constructor(stateMachines, machine, opts = {}) {
    if (!stateMachines || !stateMachines.machine(machine)) throw new Error(`ImmuneStateController: unknown machine ${machine}`);
    this.sm = stateMachines;
    this.machine = machine;
    this.state = opts.initialState || stateMachines.initialState(machine);
    this.enteredAtFrame = 0;
    this.minResidenceFrames = Number.isInteger(opts.minResidenceFrames) ? opts.minResidenceFrames : 0;
    this.history = opts.history || new TransitionHistory();
    // record the initialization transition explicitly (no implicit transitions)
    this.history.add(new TransitionRecord({ machine, previousState: null, newState: this.state, trigger: 'initialization', reason: 'registry initial state', frameIndex: 0, blocked: false }));
  }

  /**
   * Propose a transition to `toState`. Applies it only if it is legal, passes the optional guard, and
   * satisfies minimum residence time; otherwise records a BLOCKED transition with the reason. Returns
   * the recorded TransitionRecord.
   * @param {string} toState
   * @param {{ trigger?:string, reason?:string, frameIndex?:number, simulationTime?:number,
   *   confidence?:number, availability?:string, evidenceRefs?:string[], predictionRefs?:string[],
   *   guard?:() => ({ok:boolean, reason?:string}) }} [ctx]
   */
  propose(toState, ctx = {}) {
    const frameIndex = Number.isInteger(ctx.frameIndex) ? ctx.frameIndex : 0;
    const base = { machine: this.machine, previousState: this.state, newState: toState, trigger: ctx.trigger || null, reason: ctx.reason || null, frameIndex, simulationTime: ctx.simulationTime, confidence: ctx.confidence, availability: ctx.availability || 'UNAVAILABLE', evidenceRefs: ctx.evidenceRefs || [], predictionRefs: ctx.predictionRefs || [] };
    // hold (self) is always allowed and not recorded as a change
    if (toState === this.state) return this.history.add(new TransitionRecord({ ...base, blocked: false, reason: 'hold' }));
    // legality
    if (!this.sm.canTransition(this.machine, this.state, toState)) return this.history.add(new TransitionRecord({ ...base, blocked: true, blockingReason: 'illegal_transition' }));
    // minimum residence time
    if (this.minResidenceFrames > 0 && (frameIndex - this.enteredAtFrame) < this.minResidenceFrames) return this.history.add(new TransitionRecord({ ...base, blocked: true, blockingReason: `minimum_residence_not_met (${frameIndex - this.enteredAtFrame}<${this.minResidenceFrames})` }));
    // guard
    if (typeof ctx.guard === 'function') { const g = ctx.guard(); if (g && g.ok === false) return this.history.add(new TransitionRecord({ ...base, blocked: true, blockingReason: g.reason || 'guard_blocked' })); }
    // apply
    this.state = toState; this.enteredAtFrame = frameIndex;
    return this.history.add(new TransitionRecord({ ...base, blocked: false }));
  }

  current() { return this.state; }
  getHistory() { return this.history; }
}

export default ImmuneStateController;
