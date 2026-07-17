# Profile B — Style Extraction Guide (biological appearance)

Documentation only. Machine-readable: `data/profile-b-style-features.json`. Describes **only
biological appearance** — geometry, morphology, texture, density, spatial organization, visual
hierarchy — **lighting-independent** and **without inferring colors from stains**.

## Extraction rules
1. Describe biology, never artistic style.
2. No color from stains (H&E pink/purple, trichrome blue, IF green/red are lab artifacts).
3. Observations are lighting-independent.
4. Density is `sparse / moderate / dense` — never invented counts.

## Extracted characteristics (excerpt; full set in JSON)
- **Stratum corneum** — geometry: horizontal lamellar band of overlapping flat plates;
  texture: laminated; density: dense/compact; spatial: strong horizontal anisotropy;
  hierarchy: **dominant** barrier band. Corneocytes are **anucleate** high-aspect tiles.
- **Lipid lamellae** — parallel repeating thin bilayers (mortar); subtle, visible only at high
  zoom.
- **Viable epidermis** — graded polygonal layers with **vertical polarity** (basal palisade);
  nucleated; granular layer shows dark granules.
- **Keratinocyte** — polygon, central oval nucleus, desmosomal outline, packed sheet.
- **Melanocyte** — small dendritic body, **sparse** basal minority.
- **B16 melanoma cell** — rounded/spindle, enlarged nucleus, optional pigment speckle, loosely
  cohesive nests + single cells (label **murine**).
- **Dermis / collagen I** — interwoven **wavy bundles**; moderate (papillary) → dense
  (reticular); recedes at low zoom.
- **Basement membrane** — thin **undulating** DEJ line (rete ridges).
- **NLC nanoparticle** — smooth sphere, one ~85–90 nm class; **protagonist** in hierarchy.
- **ER (B2 only)** — lacy perinuclear reticular network.

## Visual hierarchy guidance
Protagonist = nanoparticle. Load-bearing context = SC barrier + depth bands. Recessive =
dermis/ECM/vessels. Melanocytes/fibroblasts = subtle accents. At low zoom, ECM and vessels
simplify or disappear (see the microscopy abstraction rules).
