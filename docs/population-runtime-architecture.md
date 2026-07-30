# Population Runtime Architecture (Phase 6C)

This document describes the software architecture of the Phase-6C population layer: how it
reads the single-cell trajectory, how the state machine and history are structured, and how
it stays isolated from every other engine.

## Position in the layer stack

The population engine is the thirteenth separate layer. Each layer reads the layer(s) below
it **read-only** and modifies nothing upstream. `TransportAnimator.tick()` steps the layers
in order and the population step runs **after** apoptosis:

```
… → protein function → apoptosis → POPULATION
```

The population engine reads exactly one upstream source: the **Phase-6B `ApoptosisEngine`**
(the single/modal cell's `apoptoticPressure`, `survivalPressure`, `committed`,
`totalExecutionDrive`, and FSM state). It never writes to it — `_drivers()` reads
`apop.frame()` defensively and returns a plain object; the apoptosis engine's own state is
untouched.

## Core principle: derive, don't re-simulate

Phase 6C invents **no new intracellular biology**. The single-cell apoptosis trajectory is
the propensity signal; the population engine maps that propensity onto normalized population
fractions via registry-driven response parameters. The population is a **schematic
abstraction** — never a real cell count.

## Object model (`populationObjects.js`)

`PopulationState` carries: `livingFraction`, `apoptoticFraction`, `adaptedFraction`,
`recoveredFraction`, `cumulativeApoptosis` (all normalized `[0,1]`), `populationState`
(FSM), evidence/prediction levels, confidence, uncertainty, and internal book-keeping
(`_stressSignal`, `_terminalSince`). No field is ever a count, density, or cellularity.

## Finite-state machine

States (from `population-state.registry.json`):

```
idle | not_reported | unavailable
healthy → minimal_response → adaptive_response → partial_response
  → mixed_population → apoptosis_accumulating → apoptosis_dominant → stable_terminal_state
```

- **Recoverable:** `minimal_response`, `adaptive_response`, `partial_response`,
  `mixed_population`, `apoptosis_accumulating`. Backward (recovery) edges reclassify
  surviving cells; they never lower the apoptotic fraction.
- **Irreversible:** `apoptosis_dominant`, `stable_terminal_state`. No path back.

`transitionTo(next)` is **strict**: it throws on any transition not listed in
`legal_transitions`. `validate()` proves the registry never declares a legal transition from
an irreversible state back to a recoverable one. The engine advances **at most one legal step
per tick** toward the composition-derived target state (see `population-state-machine.md`).

## Deterministic dynamics (no RNG)

Each `step(dt)` (details in `population-response-model.md`):
1. read the single-cell drivers;
2. accumulate apoptotic fraction monotonically toward the susceptible ceiling;
3. adapt / recover surviving cells;
4. clamp sub-fractions to living (conservation);
5. advance the FSM one legal step;
6. append a history entry.

## Deterministic replay history

`this.history` records one entry per step (`timeH`, `populationState`, the four fractions,
`cumulativeApoptosis`, evidence/prediction levels, confidence, uncertainty). Because every
step is pure arithmetic, `getHistory()` is byte-identical across runs with the same inputs —
the basis for replay. The renderer's history sparkline reads this trace.

## Timeline

`getTimeline()` returns milestone + state events: `population_initialized`,
`stress_propagated`, `adaptive_response`, `recovery_initiated`, `apoptosis_accumulating`,
`population_composition_changed`, `population_stabilized`, `terminal_population_state`,
`prediction_activated`, `context_transfer_activated`, `experimental_evidence_active` (the
last never fires — population is never experimental). No biological timestamps are claimed;
times are schematic simulation hours.

## Isolation guarantees

- Reads the apoptosis engine + six registries read-only; writes nothing upstream.
- Owns all runtime state in its own object; only **one** population exists at a time.
- Species / cell-model switches rebuild the engine from the registries (`_build`), clearing
  fractions, history, timeline, and milestones — no cross-species / cross-cell-model leakage.
- Every frame reports `tumourResponseEvidence` / `survivalEvidence` /
  `clinicalOutcomeEvidence` = `NOT_EVALUATED`.
