# Profile B — Visual Asset Acquisition Plan

Design only. Machine-readable: `data/profile-b-bio-asset-inventory.json` (extends
`data/profile-b-animation-asset-inventory.json`). No assets are created or downloaded in this
task — this is the sourcing/licensing plan.

## Build vs reuse vs reference
- **Procedural (build in code):** skin cross-section, corneocyte/lamellae, keratinocyte,
  melanocyte, B16 cell, fibroblast, dermal vessel, collagen/BM, NLC particle, ER (B2), immune
  cells (B2), labels/legends/badges. → self-contained, evidence-controllable, GitHub-Pages
  friendly.
- **Reuse (open license):** simplified body frame (Z-Anatomy CC BY-SA / BodyParts3D); celastrol
  molecule (3Dmol.js BSD from PubChem, optional); UI micro-animation (Lottie/Rive, optional).
- **Reference-only (design principles, never embedded unless license-verified):** histology /
  microscopy images.

## Reference-image sourcing (verify each license before any embedding)
| Need | Preferred open source | License |
|---|---|---|
| Skin layer diagram | OpenStax A&P 5.1 | CC BY 4.0 |
| Skin / melanocyte histology | Human Protein Atlas; StatPearls NBK537325 | CC BY 4.0 / NCBI terms |
| SC lipid lamellae ultrastructure | open TEM figures (Wikimedia / OA articles) | per-file (verify) |
| Dermal collagen (trichrome) | Wikimedia Commons | per-file (verify) |
| Melanoma histology (contextual) | Libre Pathology; NCI Visuals; HPA | CC BY-SA / PD / CC BY |
| Cell-line morphology (B16 / HaCaT) | ATCC pages (reference); HPA (images) | reference / CC BY |

## Per-asset record (required)
source · URL/identifier · license · tissue · species · stain/method · magnification ·
structures · design use · reuse restriction · direct-use vs reference-only.

## Priorities
- **High:** skin cross-section, corneocyte/lamellae, keratinocyte, B16 cell, NLC particle,
  labels/legends/badges.
- **Medium:** melanocyte, collagen/BM, ER (B2), immune cells (B2), reference images.
- **Low:** whole body, fibroblast, vessels, celastrol molecule, EpiIntestinal glyph.

## Licensing rules
Prefer CC BY / CC BY-SA / public domain / BSD/MIT; record attribution + share-alike; keep the
deployed page self-contained (bundle/inline, no runtime CDN); reference-only images are never
embedded unless their specific license is verified.
