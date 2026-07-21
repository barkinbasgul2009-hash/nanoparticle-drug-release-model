# Phase 6B Validation Report — Apoptosis Commitment & Execution

## Quality-control gate (all green)

| Check | Result |
|---|---|
| Full simulator suite (`node simulator/tests/run.mjs`) | **1842 passed, 0 failed** |
| TypeScript contract (`npx tsc --noEmit`, run from `simulator/`) | clean (exit 0) |
| JSON validity (all four Phase-6B registries) | valid |
| Hidden / zero-width character scan | clean |
| Model-id scan (no model identifier string in any pushed artifact) | clean |
| Production diff vs `origin/main` (`web/`, `R/`, `app/`, `tests/`, CI) | **empty** |
| Production tests | 99 JS + 31 R, all green |

## What the apoptosis test suite verifies (`apoptosis.test.mjs`)

### Evidence vocabulary
- `APOPTOSIS_EVIDENCE_LEVELS` has 11 tiers and includes `CONTEXT_TRANSFER_PREDICTION`.
- `isApoptosisExperimental` / `isApoptosisPrediction` / `isApoptosisTransfer` classify
  correctly.

### Registry integrity + cell-model isolation
- B16 = `EXPERIMENTAL_DRUG_CELL_SPECIFIC`; B16BL6 = `CONTEXT_TRANSFER_PREDICTION`;
  B16-F10 = `EXPERIMENTAL_DRUG_CELL_SPECIFIC`; HaCaT and rat = `NOT_REPORTED`.
- B16BL6 transfer record has source `B16` and target `B16BL6`.

### Default mouse runtime
- Default mouse cell model is **B16BL6**; the frame flags a context-transfer prediction; the
  cell starts `homeostatic`.

### Commitment + execution chain (mouse)
- Timeline contains, in order: `apoptosis_committed`, `mitochondrial_potential_reduced`,
  `cytochrome_c_released`, `aif_released`, `initiator_caspase_activated`,
  `parp_cleavage_started`, `execution_complete`; commitment precedes completion.
- After commitment: `committed` / reversibility `irreversible`; reaches `apoptotic` /
  `execution_complete`; Bax/Bcl-2 `strong_pro_apoptotic_shift`; membrane potential collapses.

### Irreversibility (strict FSM)
- `committed` is declared irreversible; an illegal transition from an irreversible state back
  to a recoverable state **throws**.
- After commitment, removing stress does not reverse the cell.

### Interventions
- **ROS scavenger** (before commitment) prevents commitment.
- **PI3K activator** (B16-F10, before commitment) restores survival and prevents commitment.
- **Caspase inhibitor** (partial) does *not* prevent commitment; PARP is not fully cleaved;
  the AIF branch still contributes.
- **AIF knockdown** (strong) substantially reduces total execution drive (> 0.3 drop), sets
  the AIF branch to `suppressed_by_knockdown`, and leaves the caspase branch unaffected — the
  cell still commits.

### Dual-branch + cell-model selection
- Caspase and AIF branches execute simultaneously with no intervention.
- `setCellModel('B16')` / `setCellModel('B16-F10')` select the separate experimental
  profiles; only B16-F10 carries the PI3K-activator intervention.

### Idle species + determinism + robustness
- HaCaT and rat are idle / `NOT_REPORTED`; never commit.
- Deterministic (identical runs); `restart()` returns to `homeostatic`.
- `validate()` passes on the shipped registries and fails on four constructed negative cases.

### Integration
- Full-app wiring: the apoptosis layer steps after protein function; the renderer produces a
  `lastApoptosisFrame`; the evidence panel shows the twelfth section with
  `populationOutcomeEvidence` / `tumourResponseEvidence` = `NOT_EVALUATED`.
- Phases 1–6A are unchanged (previous evidence levels intact).

## Model-behaviour tuning recorded during validation

Two dynamics parameters were introduced/adjusted so that survival signaling behaves
biologically at the commitment gate, verified against the real 6A trajectory:

- `survival_counter_weight` 0.5 → **0.35**, and the net-pressure formula changed so survival
  is a *persistent* offset (`P − k·survival`) rather than one diluted by `(1−P)`.
- new `survival_accumulation_penalty` = **0.1**: strong survival dampens pressure
  *accumulation* (Akt-style hold-off), so a PI3K-rescued cell relieves pressure instead of
  drifting across the gate once pressure saturates.

Both changes preserve the baseline mouse commit trajectory (verified: baseline commits;
PI3K-rescued B16-F10 does not) and keep every other test green.

## Scope compliance
- No population/tumour/tissue/immune outcome is produced; the cell object is never removed.
- No necrosis/necroptosis/pyroptosis/ferroptosis/autophagic death, no PK/PD, no clinical
  outcome.
- No fabricated scientific value or DOI; all apoptosis citations are `NOT_REPORTED`.
- No hardcoded scientific values in engine source — all thresholds, weights, delays, and
  strengths are read from the registries.
