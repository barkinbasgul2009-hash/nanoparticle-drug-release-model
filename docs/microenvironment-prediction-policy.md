# Microenvironment Prediction Policy (Phase 7A)

Phase 7A keeps prediction **enabled**. Because the frozen package has no measured TME, the
microenvironment layer is **prediction-only**: every active relationship is a labelled prediction,
never presented as experimental.

## What prediction may estimate

- relative ECM restriction
- relative hypoxia influence
- relative penetration reduction
- relative oxygen limitation

## What prediction must NEVER fabricate

oxygen concentration, ECM fibre density, collagen mass, interstitial pressure, absolute
diffusion coefficient, absolute penetration rate. When unavailable, mark as `NOT_REPORTED`,
`UNAVAILABLE`, or a labelled prediction (e.g. `MECHANISTIC_PREDICTION`).

## Labels

Prediction output uses labels that users can never confuse with validated experimental findings:
`MECHANISTIC_PREDICTION`, `LITERATURE_DERIVED_PREDICTION`, `HIGH_CONFIDENCE_PREDICTION`,
`CONTEXT_TRANSFER_PREDICTION` (cross-species / cross-tumour), `HYPOTHESIS`, plus `NOT_REPORTED` /
`UNAVAILABLE`. The evidence panel renders the prediction status distinctly from experimental
evidence, and each prediction record (`microenvironment-prediction.registry.json`) carries a
category, confidence, rationale, source/target context, assumptions, uncertainty, limitations,
reference IDs, a `quantitative_status` flag (`NOT_REPORTED`), and a `may_show_by_default` flag.

## Species isolation

Mouse / human / rat are strictly isolated. No passive microenvironment transfers silently: the
human profile carries its **own distinct** ordinal values (not copied from mouse), and any true
cross-species reuse would require an explicit `CONTEXT_TRANSFER_PREDICTION` record. `validate()`
rejects unsupported species and enforces prediction labelling on every active profile.

## Default visibility

The mouse B16BL6 prediction may be shown by default (`may_show_by_default: true`). The human
predictive-exploratory profile is **not** shown by default (`default_shown: false`,
`may_show_by_default: false`) and always carries the warning *"This microenvironment is a
mechanistic, exploratory prediction of the passive human environment and is not validated for
human clinical response."*

## Relationship to the project prediction framework

This extends the same rules as earlier phases (a prediction is always labelled; predictions never
overwrite experimental evidence; not-reported stays not-reported), with one structural point: the
TME layer has **no experimental tier at all**, so there is nothing for a prediction to be confused
with — every active TME value is a labelled prediction. See `passive-microenvironment-model.md`
and `microenvironment-evidence-review.md`.
