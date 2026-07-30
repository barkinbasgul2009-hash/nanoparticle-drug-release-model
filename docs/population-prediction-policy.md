# Population Prediction Policy (Phase 6C)

Phase 6C keeps prediction **enabled**, but under a strict, auditable policy. The population
layer has no experimental tier at all: the frozen package contains no measured population
composition, so a population relationship is always either a labelled prediction or
`NOT_REPORTED`.

## The gate

A population profile is available **only** when both hold:

1. **single-cell apoptosis evidence exists** for that context (Phase 6B is active), and
2. **population-level evidence is absent** (no measured apoptotic fraction / accounting).

When both hold, the relationship is a labelled prediction. When single-cell apoptosis is
`NOT_REPORTED`, the population is `NOT_REPORTED` (idle). This is the same rule that produced
idle HaCaT and rat populations.

## The five rules (inherited + extended from the project prediction framework)

1. **A prediction is always labelled.** Every active population profile carries one of
   `MECHANISTIC_PREDICTION`, `LITERATURE_DERIVED_PREDICTION`, `HIGH_CONFIDENCE_PREDICTION`,
   `CONTEXT_TRANSFER_PREDICTION`, or `HYPOTHESIS`.
2. **Population is never experimental.** There is no `EXPERIMENTAL_*` population tier; a
   validator error fires if an active population profile is labelled experimental.
3. **No fabricated numbers.** No apoptotic fraction, cell count, density, cellularity, or
   biological percentage is claimed; evidence citations stay `NOT_REPORTED`-qualitative.
4. **Not reported stays not reported.** HaCaT and rat (single-cell apoptosis `NOT_REPORTED`)
   stay `NOT_REPORTED` and idle — never upgraded to a prediction.
5. **A cross-cell-model extrapolation is a labelled transfer with a record.** The canonical
   B16BL6 population inherits the B16→B16BL6 single-cell transfer and is labelled
   `CONTEXT_TRANSFER_PREDICTION` with a `pop_transfer_b16_to_b16bl6` record; B16 and B16-F10
   stay separate. `validate()` rejects any profile that references another cell model's
   evidence without the transfer label.

## Confidence + uncertainty

Every population profile carries `confidence` (LOW here — no population dataset) and a plain
`uncertainty` string, both propagated into the frame, the history, and the evidence panel so
a reviewer always sees *how* supported the prediction is.

## Auditing

Each profile's `evidence_level` / `prediction_level` and its `evidence_refs` live in the
registries, and each prediction has a record in `population-prediction.registry.json` naming
its single-cell source context, transfer assumptions, and uncertainty. A reviewer can confirm
that (a) no population claim is presented as experimental, (b) no numeric value was
fabricated, and (c) every cross-cell-model use is an explicit, recorded transfer.
