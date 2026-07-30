# Profile B — Reference Selection Guide

Documentation only. Machine-readable: `data/profile-b-reference-ranking.json` +
`data/profile-b-reference-selection.json`.

## How references were scored
Each source scored 1–5 on: scientific fidelity, microscopy quality, **license confidence**,
educational usefulness, animation usefulness, visual clarity → overall recommendation.
License confidence is capped where per-file verification is pending (fetch blocked).

## Top pick per tissue
| Need | Selected source | Reuse mode |
|---|---|---|
| Skin-layer schematic | **OpenStax A&P** (CC BY) | DIRECT candidate |
| Skin/cell micrographs | **Human Protein Atlas** (CC BY) | DIRECT candidate |
| SC lipid-lamellae ultrastructure | **PMC SC-TEM** (verify CC) | reference-only until CC confirmed |
| Dermal collagen | **Wikimedia** (per-file) | reference-only until verified |
| Species differences | **PMC5620574** (CC BY) | DIRECT candidate |
| Melanoma histology (context) | **NCI** (PD) / **Libre Pathology** (CC BY-SA) | DIRECT (verify) |
| Cell-line morphology (B16/HaCaT) | **ATCC descriptions** | reference-only (images copyrighted) |

## Selection principle
Prefer **CC-BY** sources for any candidate direct reuse; use `REFERENCE_ONLY` sources for
appearance only. Where no confirmed-CC image exists, build a **procedural asset informed by
the extracted appearance** rather than copy a restricted image.

## Gaps (structures lacking a confirmed-reusable image)
- Confirmed-CC **SC lipid-lamellae TEM** (PMC articles identified; CC pending per-article).
- Open-licensed **B16BL6/B16F10 micrograph** (ATCC copyrighted) → procedural + murine label.
- Specific open **rat-skin cross-section** micrograph → procedural, informed by PMC5620574.
- Confirmed-CC **dermal collagen** micrograph (Wikimedia per-file unverified).

These gaps do **not** block design: each has an evidence-grounded appearance spec and a
procedural fallback.
