# Population Evidence Review (Phase 6C)

This review states, honestly, what the frozen Profile-B evidence package supports about
population-level response, and what is simply not reported. **No scientific value or DOI is
fabricated.** The frozen package contains **no population-level apoptosis dataset** — no
apoptotic fraction, no viable/apoptotic accounting, no cellularity — so every population
evidence record carries `citation: NOT_REPORTED` and captures only qualitative relationships.

## Evidence vocabulary (additive, 8 tiers — no experimental tier)

`POPULATION_EVIDENCE_LEVELS` in `evidenceEngine.js`:

```
HIGH_CONFIDENCE_PREDICTION
LITERATURE_DERIVED_PREDICTION
MECHANISTIC_PREDICTION
CONTEXT_TRANSFER_PREDICTION
HYPOTHESIS
NOT_REPORTED
UNAVAILABLE
CONTRADICTORY_EVIDENCE
```

There is deliberately **no `EXPERIMENTAL_*` tier**: the package has no measured population
composition, so a population relationship can only ever be a labelled prediction or
not-reported. Earlier phase vocabularies (transport → 6B) are unchanged; this array is purely
additive.

## Per-cell-model evidence

### B16BL6 (canonical mouse line) — `CONTEXT_TRANSFER_PREDICTION` (default runtime)
The single-cell apoptosis mechanism for B16BL6 is itself a B16→B16BL6 context transfer
(Phase 6B). The population composition therefore inherits that transfer: `pop_b16bl6_transfer`
(`verification_status: CONTEXT_TRANSFER`) with a transfer record `pop_transfer_b16_to_b16bl6`
(B16 → B16BL6). Qualitative claim only: *as the single cell commits and executes apoptosis, a
susceptible sub-population accumulates apoptosis while a resistant fraction and adapted /
recovered survivors persist.* No apoptotic fraction, cell count, or timing is claimed.

### B16 / B16-F10 (mouse) — `MECHANISTIC_PREDICTION` (separate)
The single-cell apoptosis mechanism is experimentally grounded in B16 and (separately) in
B16-F10, but the package reports **no population-level accounting** for either. So each
population profile is a labelled mechanistic prediction (`pop_b16_mech`, `pop_b16f10_mech`),
kept strictly separate — no record is shared across the two lines.

### Human HaCaT — `NOT_REPORTED`
Phase-6B apoptosis is `NOT_REPORTED` for HaCaT (no single-cell apoptosis evidence), so no
population relationship is defensible → population is `NOT_REPORTED` (idle). It is **not**
upgraded to a prediction.

### Rat (ex vivo skin) — `NOT_REPORTED`
No cellular apoptosis dataset → population `NOT_REPORTED` (idle).

## The single-cell → population evidence gate

A population profile is available **only** where (a) Phase-6B single-cell apoptosis evidence
exists for that context **and** (b) population-level evidence is absent. The relationship is
then a labelled prediction. Where single-cell apoptosis is `NOT_REPORTED` (HaCaT, rat), the
population stays `NOT_REPORTED`. This is the whole prediction policy in one sentence — see
`population-prediction-policy.md`.

## Integrity rules enforced in `validate()`

- An active population profile must be a **labelled prediction** (never experimental).
- A `CONTEXT_TRANSFER_PREDICTION` profile must carry a transfer record with distinct
  source/target cell models.
- **No silent cell-model mixing:** a profile may reference only its own cell model's evidence
  unless it is explicitly a transfer.
- **No human / rat fallback:** human and rat profiles must be unavailable (`NOT_REPORTED`),
  never borrowing mouse behaviour.
- Evidence citations must stay `NOT_REPORTED`-qualitative (no fabricated numbers).

## What is deliberately NOT concluded

Nothing about tumour response, tumour size/volume, survival, immune involvement, or clinical
outcome. Those are `NOT_EVALUATED` by construction (Phase 6D+ territory).
