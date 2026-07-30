# Protein Function & Early Cellular Response Runtime (Profile B, Phase 6A)

Architecture and runtime for `simulator/src/biology/proteinFunctionEngine.js`. It consumes
the Phase-5D mature proteins and Phase-5B signaling plus the Phase-6A registries
**read-only** and drives:

```
mature protein → functional eligibility → functional activation/inhibition
  → reversible early cellular-state change → homeostatic/stress response   ⟂ STOP
```

## 1. Objects (`proteinFunctionObjects.js`)

- **`FunctionalProteinState`** — id, proteinId, geneId, species, cellModel, functionType,
  targetStates, evidence/prediction level, confidence; runtime: maturityState,
  functionalState, functionalCapacity, activityState, inhibitionState, activated/deactivated
  time.
- **`CellularStateVariable`** — id, name, species, stateType, baseline, currentValue (0-1),
  direction, evidence/prediction level, reversible, sourceProteins, sourceSignals. Value is
  a **schematic cellular-state abstraction**, never a concentration/biomarker.
- **`FunctionalEdge`** — sourceType (protein_function/signal_node/cellular_state), sourceId,
  targetStateId, relationshipType, strengthClass, delayClass, reversibility, baselineRelative,
  sourceReference, feedback, evidence/prediction level, refs.

## 2. Function gating

A protein affects state only when: it exists AND is mature (Phase 5D) AND not degraded AND
in the active species/cell AND a compatible profile exists AND evidence ≠ UNAVAILABLE.
Never for nascent/folding/degraded/cross-species/cross-cell proteins. Species switching
clears all functional state.

## 3. Functional-protein state machine

`unavailable → eligible → activating → active`, plus `partially_active`, `inhibited`,
`recovering`, `degrading`, `inactive_after_degradation`. Activation lags eligibility by a
schematic delay. `functionalCapacity` tracks the mature-protein abundance (read-only).

## 4. Cellular-state update

Each step, per state: `target = clamp(baseline + Σ active-edge contributions, 0, 1)`;
`currentValue` relaxes toward target (reversible). Edge contribution =
`sign(relationship) × strength(class) × sourceValue`, delay-gated. Source value:
- protein_function → functional capacity (optionally relative to a reference, e.g. ICAM1-like);
- signal_node → node activity (baseline-relative for suppressed baseline-active nodes);
- cellular_state → another state's value (for feedback).

## 5. Global vs gene/edge control; reversibility

Strength and delay are qualitative classes (low/moderate/high; immediate/early/intermediate/
late) mapped to schematic values in the registry — never rate constants. States are
reversible: when inputs fall, they relax back to baseline (recovery, possibly incomplete).

## 6. Feedback (declared, bounded, stable)

Feedback is registry-declared and typed (e.g. antioxidant capacity ⊣ oxidative stress,
oxidative stress → antioxidant recovery). The validator requires every cellular-state cycle
to be broken by a declared feedback edge; values are clamped `[0,1]`, so there is no
oscillation explosion. No hidden or undeclared cycles.

## 7. Time semantics

Timing is schematic simulation time (ordinal early/intermediate/late/recovery), not a
validated biological timescale. The UI states: "Functional-response timing is schematic and
is not a validated biological timescale."

## 8. Determinism & controls

Pure arithmetic, no RNG. `step`/`run`/`restart`/`stepOnce`; `setSpecies` rebuilds and
restarts. Integrates with the existing play/pause/step/speed/timeline/species-switch/overlay.

## 9. Boundaries

Stops at reversible early cellular-state responses. `functionalState` never becomes a
cell-fate state; cell-fate evidence is `NOT_EVALUATED`. No enzyme activity, receptor
function, metabolism, apoptosis, phenotype, PK, or PD.
