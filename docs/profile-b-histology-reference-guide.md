# Profile B — Histology Reference Guide

Design only. Companion: `docs/profile-b-microscopy-reference-guide.md`;
`data/profile-b-microscopy-references.json`.

## What each stain shows (and its color class)
| Method | Shows | Color class |
|---|---|---|
| **H&E** | tissue architecture; nuclei blue-purple (haematoxylin), cytoplasm/ECM pink (eosin) | STAIN_DEPENDENT |
| **Masson trichrome** | collagen (blue), cytoplasm (red), nuclei (dark) | STAIN_DEPENDENT |
| **IHC** | marker-specific (SOX10 / S100 / HMB-45 / Melan-A for melanocytes/melanoma) | STAIN_DEPENDENT (chromogen) |
| **IF / confocal** | labelled targets in assigned channel colors | FLUORESCENCE_PSEUDOCOLOR |
| **TEM** | ultrastructure: corneocyte lipid lamellae, membranes, NP morphology (grayscale) | GRAYSCALE |
| **SEM** | surface topography (grayscale) | GRAYSCALE |
| **Dark-field** | scattering objects on dark ground | DATA_ENCODING |

## Key rule
**Stain colors are not natural tissue colors.** Any histology-inspired view must carry a
legend saying so. H&E pink/purple and trichrome blue are laboratory artifacts; IF green/red
are assigned channels. See the color policy in `data/profile-b-visual-style-registry.json`.

## Structures visible per method (design guidance)
- **SC lipid lamellae / bricks-and-mortar** → best referenced from **TEM**.
- **Epidermal layering, basal melanocytes** → H&E + Melan-A/SOX10 IHC.
- **Dermal collagen organization** → Masson trichrome.
- **Melanoma nuclear pleomorphism, nests, invasion** → H&E + SOX10 (contextual, human).
- **Nanoparticle–cell association / uptake** → IF/confocal or dark-field style (pseudocolor).

The animation combines information from several methods; it must **not** pretend to be a
single method — a scale/mode legend states the current visual language.
