# Caspase-Dependent and AIF-Associated Execution Model (Phase 6B)

Phase 6B models apoptotic execution as **two parallel branches** downstream of MOMP: a
caspase-dependent branch (via cytochrome-c) and an AIF-associated, caspase-*independent*
branch (via AIF). The B16 evidence indicates **partial** caspase dependence with a
substantial AIF contribution, so the two branches are represented separately and combined
into a bounded, schematic total execution drive.

## Branch weights

Each profile declares `branch_weights = { caspase_weight, aif_weight, other_weight }`. For
the mouse profiles the AIF branch is the dominant one (`aif_weight` > `caspase_weight`),
matching the evidence that AIF knockdown attenuates death strongly while caspase inhibition
only partially reduces it.

## Caspase-dependent branch

Driven by released cytochrome-c, gated on `execution_in_progress`, advancing by
time-in-execution `tcx`:

1. **Initiator caspase** activates (`initiator_caspase_activated`).
2. **Executioner caspase** activates after the `caspase` stage delay
   (`executioner_caspase_activated`).
3. **PARP cleavage** starts (`parp_cleavage_started`) and, after the `parp` delay, completes.

Contribution: `caspase_weight × (1 − casInhStr)`, ramped by `tcx`.

### Caspase inhibitor (partial dependence)
The caspase inhibitor is a **partial** intervention (strength 0.5). Under it:
- initiator/executioner caspases are marked `partially_inhibited` (not `inhibited`);
- PARP is capped at `partially_cleaved` — **full** cleavage requires an uninhibited caspase
  branch;
- the caspase contribution is scaled down but not zeroed;
- **commitment is not prevented** and the cell still dies, because the AIF branch remains.

Only a hypothetical *complete* (strength ≥ 1.0) inhibitor fully inhibits the caspase branch
(`initiatorState`/`executionerState = inhibited`, contribution 0); the AIF branch still
carries execution.

## AIF-associated branch (caspase-independent)

Driven by released AIF, independent of the caspase machinery:

1. AIF is released at MOMP (`aif_released`) unless silenced by knockdown.
2. After the `aif` stage delay, AIF translocates and the branch becomes `execution_active`
   (`aif_execution_active`).

Contribution: `aif_weight × (1 − aifKdStr)`, ramped by `tcx`.

### AIF knockdown (strong, dominant branch)
The AIF knockdown is a **strong** intervention (strength 0.8) for the default B16BL6 line. A
knockdown at or above the "strong" strength **silences the AIF branch entirely**: AIF stays
`suppressed_by_knockdown`, is never released, and contributes 0. Because AIF is the dominant
branch, this drops the total execution drive substantially (> 0.3 in the runtime), while
leaving the caspase branch untouched. A merely *partial* AIF knockdown only attenuates the
contribution (the branch stays active with reduced weight) and does not flip the branch to
the suppressed state.

## Total execution drive

```
totalExecutionDrive = caspaseContribution + aifExecutionContribution + other_weight
```

This is a **schematic, bounded** sum of distinct branch contributions — not a death
probability, not a percentage of cells, not a caspase-activity measurement. It exists only to
drive the richness of the single-cell execution timeline and the restrained renderer.

## Partial-dependence matrix (default B16BL6)

| Condition | Caspase branch | AIF branch | Commits? | Total drive |
|---|---|---|---|---|
| none | active | active | yes | high (both) |
| caspase inhibitor (partial) | attenuated, PARP `partially_cleaved` | active | yes | reduced |
| AIF knockdown (strong) | active | `suppressed_by_knockdown`, 0 | yes | substantially reduced |
| ROS scavenger (before commit) | — | — | **no** (prevented upstream) | 0 |
| PI3K activator (B16-F10, before commit) | — | — | **no** (survival restored) | 0 |

Execution-stage interventions (caspase inhibitor, AIF knockdown) **attenuate** an
already-committed cell; they never reverse commitment. Upstream interventions (ROS scavenger,
PI3K activator) can **prevent** commitment only if applied before the gate. See
`apoptosis-intervention-model.md`.

## Honesty boundaries
No caspase-3/7/9 activity units, no PARP-cleavage percentage, no AIF nuclear-translocation
fraction, no timing in real hours. All ordinal/schematic. Execution stops at the apoptotic
single cell.
