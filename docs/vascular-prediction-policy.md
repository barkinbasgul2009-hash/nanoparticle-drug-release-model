# Vascular Prediction Policy (Phase 7B)

Phase 7B keeps prediction **enabled**. Because the frozen package has no measured tumour
vasculature, the vascular layer is **prediction-only**: every active relationship is a labelled
prediction, never presented as experimental.

## What prediction may estimate

- relative perfusion
- relative delivery
- relative permeability
- relative oxygen availability

## What prediction must NEVER fabricate

absolute blood flow, absolute vessel count, oxygen partial pressure (pO₂), vascular diameter,
perfusion rate. When unavailable, mark as `NOT_REPORTED`, `UNAVAILABLE`, or a labelled prediction
(e.g. `MECHANISTIC_PREDICTION`).

## Labels

Prediction output uses labels users can never confuse with validated experimental findings:
`MECHANISTIC_PREDICTION`, `LITERATURE_DERIVED_PREDICTION`, `HIGH_CONFIDENCE_PREDICTION`,
`CONTEXT_TRANSFER_PREDICTION` (cross-species / cross-tumour), `HYPOTHESIS`, plus `NOT_REPORTED` /
`UNAVAILABLE`. The evidence panel renders the prediction status distinctly from experimental
evidence, and each prediction record (`vascular-prediction.registry.json`) carries a category,
confidence, rationale, source/target context, assumptions, uncertainty, limitations, reference
IDs, a `quantitative_status` flag (`NOT_REPORTED`), and a `may_show_by_default` flag.

## Species isolation

Mouse / human / rat are strictly isolated. No vasculature transfers silently: the human profile
carries its **own distinct** ordinal states (not copied from mouse), and any true cross-species
reuse would require an explicit `CONTEXT_TRANSFER_PREDICTION` record. `validate()` rejects
unsupported species, an available rat vasculature (no fallback), and enforces prediction labelling
on every active profile.

## Default visibility

The mouse B16BL6 prediction may be shown by default (`may_show_by_default: true`). The human
predictive-exploratory profile is **not** shown by default (`default_shown: false`,
`may_show_by_default: false`) and always carries the warning *"This vasculature is a mechanistic,
exploratory prediction … and is not validated for human clinical response."*

## Relationship to the project prediction framework

This extends the same rules as earlier phases (a prediction is always labelled; predictions never
overwrite experimental evidence; not-reported stays not-reported), with the same structural point
as Phases 6C/7A: the vascular layer has **no experimental tier at all**, so every active vascular
value is a labelled prediction. See `tumor-vasculature-model.md` and `vascular-evidence-review.md`.
