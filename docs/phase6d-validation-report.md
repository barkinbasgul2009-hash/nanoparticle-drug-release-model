# Phase 6D Validation Report — Tumor Growth, Regression & Treatment Response

## Quality-control gate (all green)

| Check | Result |
|---|---|
| Full simulator suite (`node simulator/tests/run.mjs`) | **1985 passed, 0 failed** |
| TypeScript contract (`npx tsc --noEmit`, from `simulator/`) | clean (exit 0) |
| JSON validity (all eight Phase-6D registries) | valid |
| Hidden / zero-width character scan | clean |
| Model-id scan (no model identifier in any pushed artifact) | clean |
| Production diff vs `origin/main` (`web/`, `R/`, `app/`, `tests/`, CI) | **empty** |
| Production tests | 99 JS + 31 R, all green |

## Engine `validate()` checks

`TumorResponseEngine.validate()` verifies, over the registries + current runtime:

- unique tumour-profile IDs; `profile_id` matches its key; valid species; non-empty cell model;
  valid evidence level;
- **no human EXPERIMENTAL** tumour label; **no rat available** tumour model (no rat fallback);
- experimental profiles cite a **verified** source; **no silent cell-model mixing** (a referenced
  record for another cell model needs a transfer label); no fabricated quantitative status;
- no forbidden clinical concept named in a profile field;
- **formulation ranking** matches evidence (cationic > anionic, cationic > neutral, NLC > free,
  vehicle = 0);
- FSM integrity: no regression directly from `untreated_growth`; no `cure` / `complete_response`
  terminal state;
- runtime burden within schematic bounds (never negative).

## What the tumour test suite verifies (`tumor.test.mjs`)

**Evidence vocabulary** — 11 tiers incl. `EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC`; experimental /
prediction / transfer / active classifiers correct.

**Registry integrity + isolation** — B16BL6 experimental tumour-model; B16 / B16-F10 experimental
drug-cell (separate); human UNAVAILABLE; rat NOT_REPORTED; human + rat not available; B16 does
not carry the B16BL6-specific NLC formulations.

**Formulation ranking** — cationic outranks anionic + neutral; NLC outranks free; vehicle = 0.

**Population-input gating + initialization** — default mouse = B16BL6 + cationic NLC, available
(population active), experimental direction; starts `untreated_growth` at burden 1.0.

**Full treated trajectory** — burden never negative and within bounds; regression is gradual (max
per-step drop < 0.05 — no instant disappearance); reaches a regression state; burden regresses
well below baseline but holds at a minimal-residual floor (not zero / not a cure); `treatment_
started` is the first transition; partial regression precedes strong regression.

**Pressures** — growth and loss are distinct non-negative values; net = growth − loss.

**STOP boundary** — clinical / survival / RECIST / metastasis / PK evidence all `NOT_EVALUATED`.

**Untreated control** — stays `untreated_growth`; burden grows above baseline; illegal
`untreated_growth → strong_regression` throws (no regression without treatment).

**Treatment end → rebound** — treat-then-stop reaches a post-treatment / rebound state;
`treatment_ended` recorded.

**Formulation comparison** — cationic regresses at least as much as neutral; vehicle burden
exceeds cationic-treated burden.

**Cell-model isolation** — B16 / B16-F10 selectable and separate; B16 default formulation is free
tripterine.

**Species isolation** — human idle / UNAVAILABLE with the required non-clinical warning, no
history; rat idle / NOT_REPORTED.

**Deterministic replay** — identical history across runs; response curve deterministic, 240
points, `quantitativeStatus = NOT_REPORTED`, schematic-time warning.

**Validation** — positive on shipped registries; negatives caught: human experimental label, rat
fallback, silent cell-model mixing.

**Full-app integration** — `app.tumor` exposed; renderer produces a tumour frame (burden bar +
response curve) flagging the experimental direction; the evidence panel shows an independent
**Tumor Growth & Treatment Response** section with clinical / survival / RECIST `NOT_EVALUATED`
and a normalized-burden warning; earlier phases unchanged; human idle via the full app; renderer
draws no burden for an idle human.

## Determinism, replay, and previous-phase regression
- Deterministic engine + history + timeline + response curve (no RNG) — verified by identical
  replay.
- Phases 1–6C unchanged: the tumour layer is stepped after population and reads it read-only; the
  full pre-6D suite still passes as part of the 1985 total.

## Scope compliance
- Normalized schematic burden only; never a real tumour volume / RECIST measurement; no negative
  burden; no instant regression; no cure state.
- No clinical / survival / RECIST / metastasis / invasion / angiogenesis / immune / lymphatic /
  systemic / PBPK / PK / toxicity / dose-recommendation / patient-outcome field anywhere.
- No fabricated tumour quantity or DOI; the one real citation (Chen 2012, doi:10.2147/IJN.S32476)
  is a verified in-repo primary study and supports direction / ranking only.
- No hardcoded scientific values in engine source — all thresholds, rates, ceilings, effect
  classes, and schedules come from the registries.
