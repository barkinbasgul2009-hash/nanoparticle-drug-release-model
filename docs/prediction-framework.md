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

## Extension in Phase 6D — an experimental tumour tier + a labelled trajectory prediction
Phase 6D (tumour response) restores an **experimental tier** (`TUMOR_EVIDENCE_LEVELS`, additive,
11 tiers incl. `EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC`), because the frozen package holds a verified
in vivo antimelanoma PD study (Chen 2012, doi:10.2147/IJN.S32476, B16BL6). But that evidence
supports only the treatment **direction** and formulation **ranking** (cationic > anionic/neutral;
NLC > free) — the **shape** of the normalized burden trajectory (and rebound) is a
`MECHANISTIC_PREDICTION`, and the response curve is always labelled with its evidence level,
prediction status, `quantitativeStatus = NOT_REPORTED`, and a simulation-time warning (never shown
as extracted data). Note the tumour-level default **B16BL6 is experimental here**, unlike the
6B/6C apoptosis/population layers where B16BL6 was a context transfer — because the PD evidence is
directly in B16BL6. B16 / B16-F10 stay separate; **human is UNAVAILABLE** at runtime (predictive-
exploratory only, mandated non-clinical warning, no mouse parameter copied); **rat is
NOT_REPORTED** (no fallback). No tumour volume / rate / doubling time / % / dose / survival is
fabricated. See `tumor-prediction-framework.md` and `tumor-context-transfer-policy.md`.

## Extension in Phase 7A — a prediction-only passive-microenvironment layer
Phase 7A (passive TME) is **prediction-only**: `MICROENVIRONMENT_EVIDENCE_LEVELS` (additive, 8
tiers) has **no experimental tier**, because the frozen package holds no direct TME dataset. Every
active microenvironment relationship is therefore a labelled prediction (general tumour-ECM /
hypoxia biology applied to this context) or `NOT_REPORTED`. Prediction may estimate *relative* ECM
restriction / hypoxia influence / penetration reduction / oxygen limitation, but never fabricates
an oxygen concentration, ECM fibre density, collagen mass, interstitial pressure, diffusion
coefficient, or penetration rate (all `NOT_REPORTED`). Mouse B16BL6 = `MECHANISTIC_PREDICTION`
(default, shown); human = a predictive-exploratory `MECHANISTIC_PREDICTION` with its **own distinct**
values (not copied from mouse), a mandated non-clinical warning, and not shown by default; rat =
`NOT_REPORTED`. Species are strictly isolated (a cross-species reuse would require a
`CONTEXT_TRANSFER_PREDICTION`); the microenvironment only **modifies** penetration and never
signals or replaces upstream logic. See `microenvironment-prediction-policy.md` and
`microenvironment-evidence-review.md`.

## Extension in Phase 7B — a prediction-only vascular layer
Phase 7B (tumour vasculature) is likewise **prediction-only**: `VASCULAR_EVIDENCE_LEVELS`
(additive, 8 tiers) has **no experimental tier**, because the frozen package holds no direct
tumour-vasculature dataset. Every active vascular relationship is a labelled prediction (general
tumour-vasculature biology) or `NOT_REPORTED`. Prediction may estimate *relative* perfusion /
delivery / permeability / oxygen availability, but never fabricates an absolute blood flow, vessel
count, pO₂, vascular diameter, or perfusion rate (all `NOT_REPORTED`). Mouse B16BL6 =
`MECHANISTIC_PREDICTION` (default, shown); human = a predictive-exploratory `MECHANISTIC_PREDICTION`
with its **own distinct** states (not copied from mouse), a mandated non-clinical warning, not shown
by default; rat = `NOT_REPORTED` (no fallback). Species are strictly isolated; the vasculature only
**modifies** delivery and never signals, induces apoptosis, remodels, or replaces upstream logic.
See `vascular-prediction-policy.md` and `vascular-evidence-review.md`.
