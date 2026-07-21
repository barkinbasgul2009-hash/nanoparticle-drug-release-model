# Microenvironment Evidence Review (Phase 7A)

This review states, honestly, what the frozen Profile-B package supports about the passive
tumour microenvironment. The frozen package (Chen 2012 skin-permeation + antimelanoma PD; the
celastrol apoptosis studies) contains **no direct TME characterization** for this context — no
ECM density, collagen mass, interstitial pressure, oxygen concentration, or diffusion
coefficient. **No scientific value or DOI is fabricated.**

## Evidence vocabulary (additive, 8 tiers — no experimental tier)

`MICROENVIRONMENT_EVIDENCE_LEVELS`: `HIGH_CONFIDENCE_PREDICTION`,
`LITERATURE_DERIVED_PREDICTION`, `MECHANISTIC_PREDICTION`, `CONTEXT_TRANSFER_PREDICTION`,
`HYPOTHESIS`, `NOT_REPORTED`, `UNAVAILABLE`, `CONTRADICTORY_EVIDENCE`.

There is deliberately **no `EXPERIMENTAL_*` tier**: because the package has no measured TME, a
microenvironment relationship can only ever be a labelled prediction (general tumour-ECM /
hypoxia biology applied to this context) or `NOT_REPORTED`. This mirrors the population layer.

## Per-context evidence

### Mouse B16BL6 — `MECHANISTIC_PREDICTION` (default)
Records `me_b16bl6_ecm` and `me_b16bl6_hypoxia` (both `PREDICTION_ONLY`, `citation:
NOT_REPORTED`): general solid-tumour biology says a dense, hyaluronic-acid-rich ECM and moderate
tumour hypoxia raise passive penetration resistance and lower oxygen availability. Applied
predictively to the B16BL6 tripterine-NLC context; no direct dataset. All quantities
`NOT_REPORTED`.

### Human — `MECHANISTIC_PREDICTION` (predictive-exploratory)
Record `me_human_ecm` (`PREDICTION_ONLY`): the human collagen-rich dermis raises passive
penetration resistance. This profile carries **its own distinct** ordinal values (not copied
from mouse) and the mandated non-clinical warning. Not shown by default; not validated for human
clinical response.

### Rat — `NOT_REPORTED`
Rat data support skin permeation only; no rat tumour microenvironment dataset → `NOT_REPORTED`
(idle). A passive TME is never generated from skin-permeation evidence alone.

## Integrity rules enforced (`validate()` + registry)

- No fabricated ECM fibre density / collagen mass / interstitial pressure / oxygen
  concentration / diffusion coefficient / penetration rate.
- Microenvironment relationships are labelled predictions; none is presented as experimental
  (no experimental tier exists).
- Absent TME data stays `NOT_REPORTED`.
- Species are isolated; a cross-species use would require an explicit
  `CONTEXT_TRANSFER_PREDICTION`.

## What is deliberately NOT concluded

Nothing about immune biology, vasculature, ECM remodeling, fibrosis, angiogenesis, migration,
metastasis, or clinical outcome. Those are `NOT_EVALUATED` by construction (later phases).
