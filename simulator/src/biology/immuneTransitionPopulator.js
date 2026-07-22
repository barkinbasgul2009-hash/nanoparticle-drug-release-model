// Phase-7C Part 2 transition populator. Produces REAL transition records from production state changes
// using the SHARED state-machine framework (no new controller framework, no fabricated records). It
// reads the computed categorical states of the current frame + the per-machine states carried by the
// PRIOR canonical frame (previous-state propagation), steps each machine ONE legal step toward its
// current computed state (ordinal machines via ordinalToward; categorical via a legal single edge),
// and records a transition record only when a legal state change is accepted. The FIRST frame (no prior)
// seeds baseline states and emits NO transition (no false initial transition). Deterministic ordering.

// Transition ids are derived PURELY from frame content (frame index + machine), never from a mutable
// module counter, so identical input sequences produce byte-identical frames (deterministic replay).
// A machine steps at most once per frame, so `imt_<frameIndex>_<machine>` is unique within a frame.
function makeRecord(machine, from, to, ctx) {
  return {
    transitionId: `imt_${ctx.frameIndex}_${machine}`, machine, previousState: from, newState: to,
    previousValue: ctx.previousValue ?? null, newValue: ctx.newValue ?? null,
    direction: ctx.direction, trigger: ctx.trigger || 'state_change', transitionType: 'categorical_state_change',
    frameIndex: ctx.frameIndex, simulationTime: ctx.simulationTime ?? ctx.frameIndex,
    previousFrameId: ctx.previousFrameId ?? null, currentFrameId: ctx.currentFrameId ?? null,
    confidence: ctx.confidence ?? null, availability: ctx.availability ?? 'AVAILABLE',
    evidenceRefs: ctx.evidenceRefs || ['im_b16bl6_posture'], predictionRefs: ctx.predictionRefs || ['pred_im_b16bl6'],
    residenceStatus: ctx.residenceStatus || 'satisfied', controllerVersion: ctx.controllerVersion || '7C.1.0',
  };
}

/**
 * @param {object} stateMachines an ImmuneStateMachines instance
 * @param {{ priorStates?:Record<string,string>, currentStates:Record<string,string>,
 *   valueMap?:Record<string,number>, availabilityMap?:Record<string,string>, frameIndex:number,
 *   simulationTime?:number, previousFrameId?:string, currentFrameId?:string,
 *   minResidence?:Record<string,number>, enteredAt?:Record<string,number> }} ctx
 * @returns {{ transitionRecords:object[], controllerStates:Record<string,string>, enteredAt:Record<string,number> }}
 */
export function populateTransitions(stateMachines, ctx) {
  const sm = stateMachines;
  const prior = ctx.priorStates || null;                 // from prior canonical frame (may be null on first frame)
  const current = ctx.currentStates || {};
  const values = ctx.valueMap || {}; const avail = ctx.availabilityMap || {};
  const minResidence = ctx.minResidence || {}; const enteredAt = { ...(ctx.enteredAt || {}) };
  const records = []; const controllerStates = {};

  const machines = Object.keys(current).sort();          // deterministic component ordering
  for (const machine of machines) {
    const target = current[machine];
    const def = sm.machine(machine);
    if (!def || !sm.isState(machine, target)) { controllerStates[machine] = prior && prior[machine] ? prior[machine] : (def ? sm.initialState(machine) : target); continue; }

    // FIRST frame (no prior state for this machine): seed at the computed state; NO transition recorded.
    if (!prior || prior[machine] == null) { controllerStates[machine] = target; enteredAt[machine] = ctx.frameIndex; continue; }

    const from = sm.isState(machine, prior[machine]) ? prior[machine] : sm.initialState(machine);
    // minimum residence time (registry-configurable; default 0)
    const res = Number.isInteger(minResidence[machine]) ? minResidence[machine] : 0;
    if (res > 0 && (ctx.frameIndex - (enteredAt[machine] ?? 0)) < res) { controllerStates[machine] = from; continue; }

    // step ONE legal step toward the computed target (real, controller-accepted change)
    const next = def.type === 'ordinal_bidirectional' ? sm.ordinalToward(machine, from, target) : (sm.canTransition(machine, from, target) ? target : from);
    if (next !== from) {
      const fromIdx = sm.ordinalIndex ? sm.ordinalIndex(machine, from) : def.states.indexOf(from);
      const toIdx = def.states.indexOf(next);
      records.push(makeRecord(machine, from, next, {
        frameIndex: ctx.frameIndex, simulationTime: ctx.simulationTime, previousFrameId: ctx.previousFrameId, currentFrameId: ctx.currentFrameId,
        previousValue: values[`${machine}__prev`] ?? null, newValue: values[machine] ?? null,
        direction: toIdx > fromIdx ? 'up' : toIdx < fromIdx ? 'down' : 'lateral',
        availability: avail[machine] || 'AVAILABLE',
      }));
      enteredAt[machine] = ctx.frameIndex;
    }
    controllerStates[machine] = next;
  }

  // deterministic ordering: machine, then transitionId
  records.sort((a, b) => (a.machine < b.machine ? -1 : a.machine > b.machine ? 1 : (a.transitionId < b.transitionId ? -1 : 1)));
  return { transitionRecords: records, controllerStates, enteredAt };
}

export default populateTransitions;
