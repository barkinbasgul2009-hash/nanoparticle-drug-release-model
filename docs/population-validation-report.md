# Population Validation Report — Phase 6C

## Quality-control gate (all green)

| Check | Result |
|---|---|
| Full simulator suite (`node simulator/tests/run.mjs`) | **1916 passed, 0 failed** |
| TypeScript contract (`npx tsc --noEmit`, run from `simulator/`) | clean (exit 0) |
| JSON validity (all six Phase-6C registries) | valid |
| Hidden / zero-width character scan | clean |
| Model-id scan (no model identifier in any pushed artifact) | clean |
| Production diff vs `origin/main` (`web/`, `R/`, `app/`, `tests/`, CI) | **empty** |
| Production tests | 99 JS + 31 R, all green |

## Engine `validate()` checks

`PopulationEngine.validate()` verifies, over the registries + current runtime:

- unique population profile IDs; `profile_id` matches its key;
- species validity (mouse / human / rat) and non-empty cell model;
- unavailable / `NOT_REPORTED` profiles are not marked available and carry no prediction;
- an active population profile is a **labelled prediction** (never experimental);
- a `CONTEXT_TRANSFER_PREDICTION` profile carries a transfer record with **distinct**
  source/target cell models;
- **no silent cell-model mixing** (referencing another cell model's evidence requires a
  transfer label);
- **no human / rat fallback** (those profiles must be unavailable);
- **no fabricated quantitative values** (evidence citations stay `NOT_REPORTED`-qualitative);
- no forbidden downstream concept named in a population field;
- FSM integrity: no legal recovery out of an irreversible state;
- runtime fractions bounded `[0,1]`, `living + apoptotic == 1`, `adapted + recovered ≤ living`.

## What the population test suite verifies (`population.test.mjs`)

**Evidence vocabulary** — 8 tiers, includes `CONTEXT_TRANSFER_PREDICTION`, **no experimental
tier**; prediction / transfer / active classifiers correct.

**Registry integrity + cell-model isolation** — B16BL6 = context transfer; B16 / B16-F10 =
mechanistic prediction (separate); HaCaT / rat = `NOT_REPORTED` and unavailable; transfer
record source/target correct.

**Population initialization** — default mouse = B16BL6 context-transfer prediction; starts
`healthy`, fully living, no apoptosis.

**Population accounting + conservation** — over a full run: `living + apoptotic == 1` every
step; apoptotic non-decreasing; a resistant living fraction persists; `adapted + recovered ≤
living`; `cumulativeApoptosis == apoptoticFraction`; mouse reaches apoptosis-dominant /
terminal.

**STOP boundary** — `tumourResponseEvidence` / `survivalEvidence` / `clinicalOutcomeEvidence`
= `NOT_EVALUATED`.

**State machine** — states occur in the legal FSM order; illegal transitions throw (terminal
→ healthy; healthy → apoptosis_dominant skip); `apoptosis_dominant` declared irreversible.

**Timeline events** — `population_initialized`, `stress_propagated`, `apoptosis_accumulating`,
`population_composition_changed`, `population_stabilized`, `terminal_population_state`,
`context_transfer_activated` all occur.

**History / replay** — one entry per step; living fraction declines; identical replay history
and stats across runs (deterministic).

**Recovery + interventions** — ROS scavenger (upstream) lowers population apoptosis while
conserving; PI3K activation (B16-F10) keeps the population viable / `healthy` while the single
cell never commits.

**Species / cell-model isolation** — B16 / B16-F10 selectable and separate; HaCaT + rat idle
/ `NOT_REPORTED`; idle populations record no history.

**Confidence + uncertainty** — propagate to the frame.

**Validation** — positive on shipped registries; negatives caught: experimental population
level, human fallback, transfer-without-record, silent cell-model mixing.

**Full-app integration** — `app.population` exposed; renderer produces a population frame
(composition bar + history sparkline) flagging the context-transfer prediction; the evidence
panel shows an independent **Population Response** section with tumour / survival / clinical
= `NOT_EVALUATED`; earlier phases unchanged; rat idle via the full app; renderer draws no
composition for an idle population.

## Determinism, replay, and previous-phase regression
- Deterministic engine + history + timeline (no RNG) — verified by identical replay.
- Phases 1–6B unchanged: the population layer is stepped after apoptosis and reads it
  read-only; the full pre-6C suite still passes as part of the 1916 total.

## Scope compliance
- Normalized fractions only; the cell population is never given a real count; no population
  growth / proliferation / mitosis; no resurrection of apoptotic cells.
- No tumour / immune / vascular / fibrosis / wound-healing / PK / PD / toxicity / clinical
  field anywhere.
- No fabricated scientific value or DOI; all population citations are `NOT_REPORTED`.
- No hardcoded scientific values in engine source — all thresholds, rates, ceilings, and
  windows come from the registries.
