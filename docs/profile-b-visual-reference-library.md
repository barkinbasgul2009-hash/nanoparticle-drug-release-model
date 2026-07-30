# Profile B — Visual Reference Library

**Visual-reference validation phase. Documentation only — no images collected/embedded, no
assets, no illustrations, no code, PR #3 not merged.** Machine-readable:
`data/profile-b-reference-library.json` (+ license, style-features, ranking, selection).

## What this library is (and is not)
It answers *"what biological appearance should the illustrator reproduce?"* — **not** *"what
artwork should be copied?"* No copyrighted artwork is reproduced; only biological appearance
and lawful source pointers are recorded.

## Environment limitation (stated honestly)
Web **fetch** is blocked here — only **search** works. So each reference is recorded with its
**source-level** license policy, and every entry carries `verify_before_use = true`.
Per-file license verification (especially Wikimedia and individual PMC figures) is a required
**user step** before any reuse/trace/crop. No individual image file was opened or verified.

## Coverage
Every Profile-B biological structure (skin layers, cells, ECM, tissue context) has **≥1
source with a known license policy**. Direct-reuse candidates concentrate in **CC-BY** sources
(Human Protein Atlas, OpenStax, Pharmaceutics 2017 species review). Dermal collagen relies on
Wikimedia (per-file verify); cell-line morphology relies on ATCC **descriptions** (images
copyrighted → reference-only).

## Structure → source → appearance (excerpt; full table in JSON)
| Structure | Best source | Reuse mode | Biological appearance |
|---|---|---|---|
| Stratum corneum / lamellae | PMC SC-TEM (verify CC) | REFERENCE_ONLY | overlapping flat plates + parallel bilamellar mortar |
| Epidermal layers / keratinocyte | OpenStax + HPA (CC BY) | DIRECT candidate | graded polygonal layers; basal palisade; anucleate SC |
| Melanocyte | HPA (CC BY) | DIRECT candidate | dendritic basal cell |
| B16 melanoma (murine) | ATCC description | REFERENCE_ONLY | epithelial/spindle, pigmented |
| Fibroblast / endothelium | HPA (CC BY) | DIRECT candidate | spindle / flat lining |
| Dermal collagen | Wikimedia (per-file) | REFERENCE_ONLY | interwoven wavy bundles |
| Species (rat/mouse/human) | PMC5620574 (CC BY) | DIRECT candidate | thickness + follicle-density differences |
| Melanoma tissue (human, context) | NCI (PD) / Libre Path (CC BY-SA) | DIRECT (verify) | atypical nests, pleomorphism, invasion |

## Rules
- Appearance is **lighting- and stain-independent** (H&E/trichrome/IF colors are lab
  artifacts, never recorded as biology).
- `REFERENCE_ONLY` / copyrighted sources inform appearance only — never embedded or traced.
- Where no confirmed-CC image exists (SC lamellae, B16 micrograph, rat cross-section, dermal
  collagen), the recommendation is a **procedural asset informed by the extracted
  appearance**, not a copied image.
