# Profile B — Microscopic Tissue Atlas

**Biological visualization research — design only. No implementation, no Stage 3, no
production code, PR #3 not merged.** Machine-readable: `data/profile-b-tissue-atlas.json`.

## Reading rule (critical)
General skin/melanoma anatomy below is **CONTEXTUAL_ANATOMY** — a recognizable scaffold
cited to open atlases. **It is not the B1 experimental specimen.** B1's evidence spans four
*separate* models that must never be merged: **ex vivo rat skin** (permeation), **in vitro
HaCaT** (human keratinocyte), **in vitro B16BL6** (murine melanoma), **in vivo C57BL/6
mouse** (efficacy). Sources: OpenStax A&P 5.1 (CC BY), StatPearls "Histology, Skin"
(NBK537325), Open Histology (Galway); species: Pharmaceutics 2017;9(3):33 (PMC5620574).

## Skin layers (top → bottom)
### Stratum corneum
Flattened **anucleate** corneocytes in a "bricks-and-mortar" arrangement with extracellular
**lipid lamellae** (the mortar) — the primary barrier. **Visual rules:** no nuclei, no
vessels in the SC; show corneocyte stacks + lamellae; this is where nanoparticle deposition
and released-API diffusion are depicted. Maps to the B1 **0–30 µm** depth band. Do **not**
assign a specific SC thickness to the B1 rat specimen (NOT REPORTED).

### Viable epidermis
Keratinized stratified squamous epithelium: **stratum basale → spinosum → granulosum**
(+ lucidum in thick skin). Nucleated keratinocytes; **melanocytes at the basale**;
Langerhans cells in the spinosum. **The epidermis is AVASCULAR — never draw blood vessels
inside it.** A simplified 2–3 band grouping is acceptable if labelled. Maps (approximately,
species-dependent) to the **30–60 µm** band.

### Dermis
Dense irregular connective tissue: collagen bundles, elastin, ground substance
(GAGs/hyaluronan); fibroblasts; **capillary loops (papillary) + deeper plexus (reticular)**;
appendages (hair follicles, sweat/sebaceous glands); immune cells. **Vessels appear here as
anatomical context only.** Maps (approximately) to the **60–90 µm** band. Do **not** imply
nanoparticle entry into dermal vessels → circulation (unsupported for topical B1).

### Subcutis / hypodermis
Adipocytes, larger vessels. **Orientation-only or omit** — the B1 supported depth (≤ ~90 µm
sections) does not reach the hypodermis. Do not show nanoparticles reaching it.

## Melanoma tissue
Human melanoma histopathology (nuclear pleomorphism, nests + single cells, dermal invasion,
loss of maturation; DermNet / Libre Pathology / Modern Pathology) is **CONTEXTUAL** teaching
material. **B1's disease model is murine B16BL6** (culture + subcutaneous mouse), so
melanoma scenes for B1 are labelled "murine B16BL6 model" and must **not** depict human
invasive cutaneous melanoma as the experimental outcome.

## Species compatibility (why rat ≠ human)
Rodent viable epidermis ≈ 20 µm, thinner SC, higher hair-follicle density (rat ~1.84 %,
mouse ~2.02 %) than human; **rat skin typically over-predicts human permeation**
(PMC5620574). Every skin scene must state its species/model; rat permeation must not be
shown as human-skin behavior without an explicit transfer label.

## Depth bands (B1)
`0–30 µm` = SC region · `30–60 µm` = viable epidermis (approx) · `60–90 µm` = upper dermis
(approx). These are the **Chen section boundaries** — show relative deposition by band, not a
fabricated continuous concentration field.
