# Population Limitations (Phase 6C)

Phase 6C is a deliberately narrow, honest layer. This document states plainly what it does
**not** represent, so no reader mistakes the schematic population for a biological or clinical
result.

## The population is an abstraction

- It is a **conceptual virtual population**, not real tumour geometry or tissue architecture.
- Population size is **schematic**; all quantities are normalized `[0,1]` fractions.
- **No biological cell count, density, cellularity, or apoptotic index is claimed.** A bar
  reading "apoptotic 0.75" means three-quarters of a normalized schematic population, not a
  measured fraction of real cells.

## Evidence limitations

- The frozen package contains **no population-level apoptosis dataset**. Every population
  relationship is a **labelled prediction** (`MECHANISTIC_PREDICTION` /
  `CONTEXT_TRANSFER_PREDICTION`) or `NOT_REPORTED` — never experimental.
- The canonical B16BL6 population is a **context-transfer prediction** (B16 → B16BL6), itself
  built on the Phase-6B single-cell transfer; its confidence is LOW.
- Human HaCaT and rat populations are `NOT_REPORTED` (idle) — not modelled, not predicted.

## Model limitations

- The population is derived from **one** modal single-cell trajectory plus schematic
  heterogeneity parameters; it is not an agent-based simulation of distinct cells.
- The **resistant fraction** (`1 − susceptible_ceiling`) is a schematic stand-in for
  cell-to-cell susceptibility differences, not a measured resistant population.
- Adaptation and recovery are schematic reclassifications of surviving cells; they carry no
  biochemical mechanism of their own (that lives upstream in Phases 6A–6B).
- Timing is schematic simulation hours, not a validated biological timescale.

## Hard stop boundary (NOT evaluated)

The simulator stops at population composition / viability / state / history. It does **not**
represent, and reports `NOT_EVALUATED` / does not compute:

tumour response, tumour size / volume / growth / shrinkage / regression, tumour
growth-inhibition, RECIST, survival, immune recruitment / clearance, macrophages / dendritic
cells / T cells, cytokines, angiogenesis / vascular response, fibrosis, wound healing,
proliferation kinetics, cell cycle, mitosis, necrosis, invasion, metastasis, organ toxicity,
PK, PD efficacy, clinical response, patient outcome.

There is also **no population growth**: `living + apoptotic = 1` always and the apoptotic
fraction is monotonic, so the model can never add cells, resurrect apoptotic cells, or
proliferate.

## Future phases

Phase 6D and later may build tumour-, tissue-, immune-, and outcome-level layers **on top of**
this one (reading it read-only). Until then, the population composition is the end of the
chain, and any tumour or clinical interpretation is out of scope.
