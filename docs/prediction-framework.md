# Profile-B — Prediction Framework (Phase 5A)

The pharmacology layers introduce parameters (affinities, rates) that are often not measured for a
specific formulation. Prediction is **allowed** — but only when **explicitly labelled**, and never
presented as an experimental fact. This document defines the label vocabulary and how it is applied.

## Label vocabulary (`PREDICTION_LABELS`)
| Label | Meaning | Animates? |
|---|---|---|
| **EXPERIMENTAL** | measured for this formulation | yes |
| **HIGH_CONFIDENCE_PREDICTION** | strongly supported prediction (close analogue / robust model) | yes |
| **MECHANISTIC_PREDICTION** | prediction from a general binding mechanism | yes |
| **LITERATURE_PREDICTION** | prediction derived from separate literature (not this formulation) | yes |
| **UNAVAILABLE** | no profile / cannot animate | no |
| **NOT_REPORTED** | not reported for this formulation (idle) | no |

Helpers in `simulator/src/evidence/evidenceEngine.js`:
- `labelAnimates(label)` — true for EXPERIMENTAL + the three prediction labels.
- `isPrediction(label)` — true only for the three prediction labels (used to flag "this is a
  prediction, not a fact").

## Relationship to the Evidence Level system
The earlier phases use the coarser `EVIDENCE_LEVELS` (EXPERIMENTAL / PREDICTIVE / UNAVAILABLE /
NOT_REPORTED). The prediction labels are a **finer** vocabulary for the pharmacology layer: the
single `PREDICTIVE` level is split into three prediction *strengths* so the viewer can see *how*
supported a prediction is. `UNAVAILABLE` and `NOT_REPORTED` keep their meaning (neither animates).

## Rules
1. **A prediction is always labelled.** Any behaviour driven by a predicted parameter carries one
   of the three prediction labels; it is never shown as EXPERIMENTAL.
2. **No fabricated numbers.** Kd / Ki / IC50 / kon / koff are shown only when evidence exists;
   otherwise the behaviour is a labelled prediction or NOT REPORTED. A missing value is never
   replaced by an invented number.
3. **Experimental outranks prediction.** Where a formulation *does* have measured data, it is
   labelled EXPERIMENTAL and predictions never override it.
4. **Not reported stays not reported.** If neither data nor a defensible prediction exists, the
   behaviour is NOT REPORTED and the engine stays idle (this is the B1 target-engagement case).

## Application in Phase 5A
- The B1 NLC has **no** reported molecular target or binding constants → target engagement is
  **NOT_REPORTED** for all species (idle). Nothing is invented.
- The engine and tests demonstrate the prediction labels using **test-only** patched profiles
  (e.g. `MECHANISTIC_PREDICTION` binding) — clearly labelled predictions, never committed to the
  real registry as experimental fact.

## Auditing
Every predicted value's label lives in the registry (`formulations.*.binding.evidence_level`,
`species_target.*.evidence_level`) so a reviewer can confirm that (a) no prediction is presented as
experimental, and (b) no numeric value was fabricated.

## Extension in Phase 6B — the context-transfer prediction
Phase 6B (apoptosis) adds a distinct prediction *kind*: **`CONTEXT_TRANSFER_PREDICTION`** (part of
the additive `APOPTOSIS_EVIDENCE_LEVELS`). It applies the same four rules, plus one:

5. **A cross-cell-model extrapolation is labelled a transfer and carries a transfer record.**
   The canonical mouse line is **B16BL6**, but the strongest celastrol apoptosis mechanism
   evidence is in **B16**. Rather than silently reuse B16 data as B16BL6 fact, the default mouse
   runtime is `CONTEXT_TRANSFER_PREDICTION` with an explicit `B16 → B16BL6` transfer record; the
   experimental B16 and B16-F10 profiles stay separate and selectable. `validate()` rejects any
   profile that references another cell model's evidence without the transfer label. See
   `apoptosis-context-transfer-policy.md`. `NOT_REPORTED` (HaCaT, rat) still stays `NOT_REPORTED`
   — a transfer is only made where a defensible same-species, same-lineage source exists.

## Extension in Phase 6C — a prediction-only layer (no experimental tier)
Phase 6C (population response) applies the same rules with one structural difference: the
frozen package has **no measured population composition**, so the population layer has **no
`EXPERIMENTAL_*` tier at all**. A population relationship is therefore always a labelled
prediction (`MECHANISTIC_PREDICTION` / `CONTEXT_TRANSFER_PREDICTION`) or `NOT_REPORTED`. The
availability **gate**: a population profile exists only where (a) single-cell apoptosis
evidence exists and (b) population evidence is absent. So B16BL6 is a
`CONTEXT_TRANSFER_PREDICTION` (echoing the 6B B16→B16BL6 transfer), B16 / B16-F10 are separate
`MECHANISTIC_PREDICTION`s, and HaCaT / rat (single-cell apoptosis `NOT_REPORTED`) stay
`NOT_REPORTED` and idle — no human/rat fallback. No apoptotic fraction, cell count, or
percentage is fabricated; all citations stay `NOT_REPORTED`. See
`population-prediction-policy.md`.
