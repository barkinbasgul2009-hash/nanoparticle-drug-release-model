# Vascular Evidence Review (Phase 7B)

This review states, honestly, what the frozen Profile-B package supports about tumour
vasculature. The frozen package (Chen 2012 skin-permeation + antimelanoma PD; the celastrol
apoptosis studies) contains **no direct tumour-vasculature characterization** for this context —
no vessel count, blood flow, pO₂, vascular diameter, or perfusion rate. **No scientific value or
DOI is fabricated.**

## Evidence vocabulary (additive, 8 tiers — no experimental tier)

`VASCULAR_EVIDENCE_LEVELS`: `HIGH_CONFIDENCE_PREDICTION`, `LITERATURE_DERIVED_PREDICTION`,
`MECHANISTIC_PREDICTION`, `CONTEXT_TRANSFER_PREDICTION`, `HYPOTHESIS`, `NOT_REPORTED`,
`UNAVAILABLE`, `CONTRADICTORY_EVIDENCE`.

There is deliberately **no `EXPERIMENTAL_*` tier**: with no measured tumour vasculature, a
vascular relationship can only ever be a labelled prediction (general tumour-vasculature biology
applied to this context) or `NOT_REPORTED`. This mirrors the population and microenvironment
layers.

## Per-context evidence

### Mouse B16BL6 — `MECHANISTIC_PREDICTION` (default)
Records `va_b16bl6_vasculature` and `va_b16bl6_perfusion` (both `PREDICTION_ONLY`, `citation:
NOT_REPORTED`): general solid-tumour biology says melanoma vasculature is abnormal — hypervascular
but immature/chaotic and leaky — and that tumour vessels are often poorly perfused despite high
density, limiting drug delivery and oxygen supply. Applied predictively to the B16BL6
tripterine-NLC context; no direct dataset. All quantities `NOT_REPORTED`.

### Human — `MECHANISTIC_PREDICTION` (predictive-exploratory)
Record `va_human_vasculature` (`PREDICTION_ONLY`): a moderately vascularized, developing human
vasculature. This profile carries **its own distinct** ordinal states (not copied from mouse) and
the mandated non-clinical warning. Not shown by default; not validated for human clinical
response.

### Rat — `NOT_REPORTED`
Rat data support skin permeation only; no rat tumour vasculature dataset → `NOT_REPORTED` (idle).
A vasculature is never generated from skin-permeation evidence alone.

## Integrity rules enforced (`validate()` + registry)

- No fabricated blood flow / vessel count / pO₂ / vascular diameter / perfusion rate.
- Vascular relationships are labelled predictions; none is presented as experimental (no
  experimental tier exists).
- Absent vascular data stays `NOT_REPORTED`; rat has no available vasculature (no fallback).
- Species are isolated; a cross-species use would require an explicit
  `CONTEXT_TRANSFER_PREDICTION`.

## What is deliberately NOT concluded

Nothing about immune biology, VEGF/HIF signalling, vascular inflammation, fibroblasts, ECM
remodeling, lymphatics, metastasis, or clinical outcome. Those are `NOT_EVALUATED` by
construction (later phases).
