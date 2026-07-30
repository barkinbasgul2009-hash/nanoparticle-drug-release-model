# Tumor-Response Evidence Review (Phase 6D)

This review states, honestly, what the frozen Profile-B package supports about tumour-level
treatment response. Unlike the population layer, a tumour-level **experimental** tier exists
here — because the package contains a verified in vivo antimelanoma pharmacodynamic study — but
it supports **direction / ranking only**; every exact quantitative value stays `NOT_REPORTED`.
**No scientific value or DOI is fabricated.**

## Primary studies reviewed

### Chen et al. 2012 (verified primary study; B16BL6)
`Chen Y, Zhou L, Yuan L, Zhang Z-h, Liu X, Wu Q. Formulation, characterization, and evaluation
of in vitro skin permeation and in vivo pharmacodynamics of surface-charged tripterine-loaded
nanostructured lipid carriers. Int J Nanomedicine 2012;7:3023-3033. doi:10.2147/IJN.S32476
(PMC3392146).` This is the Profile-B primary NLC study, already verified and full-text opened
in the frozen package. It supports (qualitatively): B16BL6 cellular uptake + cytotoxicity, **in
vivo antimelanoma pharmacodynamic activity**, **superior efficacy of cationic NLCs vs anionic /
neutral**, improvement of NLCs over free tripterine where reported, and a topical / percutaneous
treatment context. Records: `tum_chen_b16bl6_pd`, `tum_chen_b16bl6_ranking`,
`tum_chen_b16bl6_control` (all `VERIFIED_PRIMARY_STUDY`).

### B16 (free celastrol; qualitative)
Supports B16 melanoma-cell apoptosis, growth inhibition, ROS-dependent mitochondrial apoptosis,
and PI3K/AKT suppression. No verified numeric extraction is in the repo, so `tum_b16_growth_
inhibition` is a `VERIFIED_PRIMARY_STUDY` qualitative record with `citation: NOT_REPORTED`
(mirroring how Phase 6B handled B16 apoptosis).

### B16-F10 (free celastrol; qualitative)
Supports reduced viability, proliferation suppression, apoptosis, cell-cycle effects, and
PI3K/AKT/mTOR suppression. Phase 6D uses only **growth pressure, loss pressure, and
treatment-response direction** (NOT invasion / metastasis / migration). `tum_b16f10_growth_
inhibition` is qualitative with `citation: NOT_REPORTED`.

## Cell-model independence

**B16, B16BL6, and B16-F10 remain independent tumour-response contexts.** Their evidence is
never silently merged. The Chen formulation ranking is B16BL6-specific and is not transferred to
B16 / B16-F10. `validate()` rejects any profile that references another cell model's evidence
without an explicit transfer label.

## What the B16BL6 default may and may not claim

| Claim | Status |
|---|---|
| Treatment effect **direction** | experimentally supported (Chen) |
| Formulation **ranking** (cationic > anionic / neutral; NLC > free) | experimentally supported (qualitative) |
| Tumour-growth **inhibition** | experimentally supported (qualitative) |
| Exact growth curve / regression rate / tumour volume / doubling time / dose-response | **NOT_REPORTED** |
| Long-term recurrence | **NOT_REPORTED** |
| Clinical response / survival / cure | **NOT represented** |

## Human and rat

- **Human:** no validated human melanoma tumour response is inferred from mouse studies. The
  canonical human context (HaCaT keratinocyte) has no active melanoma population, so the tumour
  engine is **UNAVAILABLE** at runtime; a predictive-exploratory human view would carry the
  mandated non-clinical warning. See `tumor-context-transfer-policy.md`.
- **Rat:** supports skin permeation only → `NOT_REPORTED`. A rat tumour regression is never
  generated from skin-permeation evidence alone.

## Integrity rules enforced
No fabricated tumour quantities; experimental records support direction / ranking only; no
cell-model merge without a transfer label; no clinical / survival / cure / patient-outcome claim
anywhere.
