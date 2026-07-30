# Tumor Prediction Framework (Phase 6D)

Phase 6D keeps prediction **enabled** and encouraged where it meaningfully extends the
simulator, under a strict, auditable policy. Unlike the population layer, Phase 6D has an
**experimental tumour-model tier** (grounded in the verified Chen 2012 study) that always
outranks predictions.

## Evidence tiers (`TUMOR_EVIDENCE_LEVELS`, additive)

```
EXPERIMENTAL_FORMULATION_SPECIFIC
EXPERIMENTAL_DRUG_CELL_SPECIFIC
EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC
HIGH_CONFIDENCE_PREDICTION
LITERATURE_DERIVED_PREDICTION
MECHANISTIC_PREDICTION
CONTEXT_TRANSFER_PREDICTION
HYPOTHESIS
NOT_REPORTED
UNAVAILABLE
CONTRADICTORY_EVIDENCE
```

## Rules

1. **Experimental outranks prediction.** Where a context has measured (direction-level)
   evidence — the B16BL6 in vivo PD + formulation ranking — it is labelled experimental, and a
   prediction never overwrites it.
2. **Every prediction is labelled** with one of the prediction tiers and carries: prediction
   category, confidence, rationale, source model / target model, source / target species, source
   / target formulation, assumptions, uncertainty, limitations, evidence IDs, quantitative-status
   flag, and whether it may be shown by default (see `tumor-prediction.registry.json`).
3. **No fabricated quantities.** No tumour volume / diameter / weight, doubling time, rate
   constant, Gompertz / logistic parameter, kill coefficient, dose-response, % TGI, survival, or
   recurrence probability. When exact data are unavailable: schematic normalized burden, ordinal
   response states, `NOT_REPORTED`, an evidence-supported treatment ranking, a labelled
   prediction with confidence, or a qualitative trajectory.
4. **Not reported / unavailable stays so.** Rat is `NOT_REPORTED`; human is `UNAVAILABLE` at
   runtime — neither is upgraded to an experimental claim.
5. **A cross-cell-model / cross-species extrapolation is a labelled transfer.** The
   `CONTEXT_TRANSFER_PREDICTION` tier + a transfer record is required; `validate()` rejects silent
   mixing.

## The burden trajectory is a prediction

Experimental evidence supports the treatment **direction** and formulation **ranking**; the
**shape** of the normalized burden trajectory (and rebound) is a `MECHANISTIC_PREDICTION`
(`pred_tum_b16bl6_trajectory`, `pred_tum_rebound`). The response curve is always labelled with
its evidence level, prediction status, `quantitativeStatus = NOT_REPORTED`, and a simulation-time
warning, and is never presented as extracted experimental data.

## Human predictive-exploratory mode

A human tumour-response view would be a mechanistic extrapolation only
(`pred_tum_human_exploratory`, `may_show_by_default: false`). It must carry the label *Evidence
Level: Predictive* and the warning *"This tumour-response trajectory is a mechanistic
visualization derived from preclinical evidence and is not validated for human clinical
response."* It must not show clinical efficacy, cure, patient outcome, expected survival,
clinical tumour-volume reduction, or a dose recommendation. In Profile B there is no active human
melanoma population, so at runtime the human tumour engine is **UNAVAILABLE**.

## Auditing

Every profile's `evidence_level` / `prediction_level` and `evidence_refs`, and every prediction
record's full metadata, live in the registries. A reviewer can confirm that no prediction is
presented as experimental, no numeric value is fabricated, and every cross-context use is an
explicit, recorded transfer.
