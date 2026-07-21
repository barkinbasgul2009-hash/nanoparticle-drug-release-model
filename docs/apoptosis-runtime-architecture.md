# Apoptosis Runtime Architecture (Phase 6B)

This document describes the software architecture of the Phase-6B apoptosis layer: how it
reads upstream state, how the finite-state machine is structured, and how it stays isolated
from every other engine.

## Position in the layer stack

The apoptosis engine is the twelfth separate layer. Each layer reads the layer(s) below it
**read-only** and modifies nothing upstream. `TransportAnimator.tick()` steps the layers in
order and the apoptosis step runs **after** protein function:

```
transport → release → uptake → endocytosis → intracellular release → target engagement
  → signal propagation → transcription → translation → protein function → APOPTOSIS
```

The apoptosis engine reads two upstream sources:

- **Phase-6A `ProteinFunctionEngine`** — the cellular-stress state variables
  (`oxidative_stress`, `survival_signaling`, `mitochondrial_stress`, `general_stress`). These
  are the *only* biological drivers of apoptotic pressure.
- **Phase-5B `SignalPropagationEngine`** — available read-only for provenance; the engine
  does not mutate it.

It never writes to either. `_stressInputs()` reads `func.frame().states` by `stateType` and
returns a plain map; the protein-function engine's own objects are untouched.

## Object model (`apoptosisObjects.js`)

| Object | Responsibility |
|---|---|
| `ApoptosisState` | FSM state, eligibility/commitment flags, reversibility, the schematic pressures (apoptotic, survival, mitochondrial, caspase, AIF), timestamps (`enteredAt`/`committedAt`/`executedAt`), evidence level |
| `MitochondrialApoptosisState` | membrane potential, Bax/Bcl-2 balance, MOMP readiness+state, cytochrome-c state, mitochondrial AIF state, integrity |
| `CaspaseCascadeState` | initiator/executioner caspase states, PARP state, dependence, inhibitor flag, branch contribution |
| `AIFExecutionState` | mitochondrial AIF state, released flag, translocation state, execution contribution, knockdown flag |
| `ApoptosisIntervention` | type, target, effect, strength class, timing ("acts"), active flag |

All schematic pressures are `[0,1]`; every mitochondrial / caspase / AIF / morphology field
is an **ordinal state label**, never a concentration, percentage, membrane voltage, or rate.

## Finite-state machine

States (from `apoptosis-dynamics.registry.json`):

```
idle | not_reported | unavailable
homeostatic → stressed → apoptosis_eligible → pre_commitment → commitment_threshold_reached
  → committed → mitochondrial_transition → execution_in_progress → apoptotic → execution_complete
```

- **Recoverable states:** `stressed`, `apoptosis_eligible`, `pre_commitment`. Pressure can
  fall and the cell can step *back down* toward `homeostatic`.
- **Irreversible states:** `committed`, `mitochondrial_transition`, `execution_in_progress`,
  `apoptotic`, `execution_complete`. Once entered, the cell can never transition to a
  recoverable state.

`transitionTo(next)` is **strict**: it throws on any transition not listed in
`legal_transitions`. On entering an irreversible state it stamps
`reversibility = 'irreversible'`. `validate()` additionally proves the registry itself never
declares a legal transition from an irreversible state back to a recoverable one.

## The commitment gate (deterministic, no RNG)

Each `step(dt)`:

1. **Compute the stress target** from the 6A inputs and the registry `pressure_weights`
   (oxidative stress, survival withdrawal, mitochondrial stress, stress readiness).
2. **Accumulate or relieve apoptotic pressure.** Accumulation is gated on an
   *effective* stress = `stressTarget − survival_accumulation_penalty × survival`. Strong
   survival signaling (e.g. restored by the PI3K activator) drives the effective stress below
   the eligibility threshold, so a rescued cell stops accumulating pressure and instead
   relieves it. This is the Akt-style survival hold-off, modelled at the accumulation stage
   rather than as a cosmetic subtraction.
3. **Reversible FSM up/down** through `stressed → apoptosis_eligible → pre_commitment` (and
   back down when pressure falls).
4. **Commitment persistence.** In `pre_commitment`, the *net* pressure
   (`apoptoticPressure − survival_counter_weight × survival`) must stay at or above the
   commitment threshold for `commitment_persist_hours`. Only then does the cell reach
   `commitment_threshold_reached` and cross the irreversible gate to `committed`.
5. **Execution** (`_advanceExecution`) advances deterministically by time-since-commit plus
   per-stage delays — see `mitochondrial-apoptosis-pathway.md` and
   `caspase-and-aif-execution-model.md`.

There is **no random death probability** anywhere: commitment is a deterministic function of
sustained net pressure, and execution is a deterministic function of elapsed schematic time.

## Isolation guarantees

- Reads 6A/5B and the four registries read-only; writes nothing upstream (verified by tests
  that snapshot the protein-function frame before/after apoptosis steps).
- Owns all of its runtime state in its own objects; the cell object is never removed.
- Species/cell-model switches rebuild the engine from the registries (`_build`), clearing all
  runtime state — no cross-species or cross-cell-model leakage.
- Every frame reports `populationOutcomeEvidence` / `tumourResponseEvidence` =
  `NOT_EVALUATED` and `cellFateEvidence = 'single_cell_only'`.
