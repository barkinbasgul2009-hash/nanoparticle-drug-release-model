# Profile B — Normal Skin vs Melanoma Atlas

Design only. Machine-readable: `data/profile-b-normal-disease-comparison.json`.

## The load-bearing caveat
Human melanoma histopathology is **CONTEXTUAL** education. **B1's experimental disease model
is murine B16BL6** (in vitro monolayer + in vivo C57BL/6 melanoma-bearing mice treated
percutaneously) — **not** human spontaneous invasive cutaneous melanoma. Melanoma scenes for
B1 must be labelled "murine B16BL6 model." Human invasive-melanoma histology may appear only
as a clearly-separated educational comparison.

| Feature | Normal skin | Human melanoma (CONTEXTUAL) | Classification |
|---|---|---|---|
| Epidermal architecture | ordered layers | disorganized, pagetoid spread | CONTEXTUAL |
| Melanocyte distribution | solitary, basal, evenly spaced | atypical, confluent, nests + single cells | CONTEXTUAL |
| Nuclear morphology | small, uniform | pleomorphism, prominent nucleoli | CONTEXTUAL (DermNet/Modern Pathology) |
| Maturation with depth | benign nevus matures | **lack of maturation**, atypia retained | CONTEXTUAL (Libre Pathology) |
| Dermal invasion | none | invasion, expansile nests | CONTEXTUAL |
| Basement membrane | intact | disrupted | CONTEXTUAL |
| Stroma / ECM | ordered collagen | remodeling / desmoplasia (variable) | CONTEXTUAL |
| Vascularity | regular plexus | increased / abnormal (variable) | CONTEXTUAL; NOT_REPORTED for B1 |
| Immune infiltrate | sparse | TILs (variable) | CONTEXTUAL; ICD is B2, not B1 |
| Pigmentation | basal melanin | variable; **B16 line is pigmented** | B16 pigment = QUALITATIVELY_SUPPORTED |

**Rule:** do not automatically portray advanced invasive human melanoma when the source used
a murine cell line / mouse tumour. Keep the educational human comparison and the B1 murine
model visually and textually separate.
