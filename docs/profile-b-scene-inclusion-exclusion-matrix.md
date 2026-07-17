# Profile B — Scene Inclusion / Exclusion Matrix

Design only. Machine-readable: `data/profile-b-biological-exclusions.json` +
`data/profile-b-scene-evidence-map.json`. Every visible biological element must have a
reason; anything without one is excluded.

## Anatomical inclusion matrix (B1)
| Structure | B1 required | B1 optional/context | B1 prohibited | Scale | Reason |
|---|---|---|---|---|---|
| Stratum corneum | ✅ | | | L3 | barrier + 0–30 µm deposition |
| Basal epidermis | ✅ | | | L3 | melanocyte location, basal boundary |
| Keratinocytes | ✅ | | | L4 | uptake (HaCaT) + tissue context |
| Melanocytes | | ✅ | | L4 | normal-skin context |
| Melanoma cells (B16BL6) | ✅ | | | L4 | uptake/cytotoxicity/efficacy (murine) |
| Fibroblasts | | ✅ | | L4 | dermal context |
| Collagen / ECM | | ✅ | | L3–L4 | dermal context (intentional pattern) |
| Basement membrane | | ✅ | | L3 | DEJ context |
| Dermal vessels | | ✅ | | L3–L4 | anatomical context only |
| Vessels **in epidermis** | | | 🚫 | — | epidermis is avascular |
| Lymphatics | | ✅ (label) | | L3 | optional context |
| Macrophages / neutrophils | | | 🚫 | — | not in B1 evidence (no decorative immune cells) |
| Dendritic / CD8+ T cells | | | 🚫 (B1) | — | B2 ICD only |
| Hair follicles / sweat / sebaceous glands | | ✅ | | L3 | optional appendage context |
| Adipocytes / subcutis | | ✅ (orientation) | | L3 | depth not reached by B1 |
| Nerves | | | 🚫 | — | irrelevant to B1 events |
| Red blood cells | | ✅ (illustrative) | | L3 | vessel lumen content |

## Event exclusion (all presets)
`UNSUPPORTED_DO_NOT_ANIMATE`: bloodstream journey for topical B1; oral/GI transit; IV
injection; intact NP reaching subcutis; NP entering vessels / systemic distribution;
extravasation; intracellular trafficking/organelles for B1; metabolic conversion; ECM
traversal as a quantified process; precipitation clock; aggregation as inevitable; exact
concentration fields; human invasive-melanoma histology as the B1 model; microscopy stain
colors as natural colors without a legend; decorative cells.

## Per-preset
- **B1:** as above (topical rat/mouse single-study).
- **B2:** prohibit numeric read-outs, deterministic timing, release curve, B1 skin scenes,
  precipitation/aggregation/degradation; ER organelle scene **allowed for B2 only**.
- **B3:** prohibit particle size/morphology/growth, precipitation/aggregation timing, skin
  scenes, circulation — comparator info panel only.
