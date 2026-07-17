# Profile B — Cell Atlas

Design only. Machine-readable: `data/profile-b-cell-atlas.json`. Every cell has a role
(REQUIRED / OPTIONAL_CONTEXT / LABEL_ONLY / EXCLUDED) and a confidence label. **No invented
densities, sizes, or colors.** A cell appears only if relevant to the tissue + disease +
experiment + purpose — decorative cells are prohibited.

| Cell | B1 role | Confidence | Morphology (cited) | Visual rule |
|---|---|---|---|---|
| Corneocyte | REQUIRED | CONTEXTUAL_ANATOMY | flat, **anucleate**, keratin-filled; bricks-and-mortar (OpenStax) | no nucleus; the barrier crossed by released API |
| Keratinocyte / **HaCaT** | REQUIRED | QUALITATIVELY_SUPPORTED (HaCaT uptake) | polygonal, nucleated, desmosomes; HaCaT in vitro: spindle→cobblestone (ATCC/organotypic) | HaCaT scene = labelled "in vitro human keratinocyte", separate from tissue |
| Melanocyte | OPTIONAL_CONTEXT | CONTEXTUAL_ANATOMY | dendritic, basal, melanin-producing (OpenStax) | basal; do not conflate with melanoma |
| **B16BL6 / B16F10** melanoma | REQUIRED | QUALITATIVELY_SUPPORTED | monolayer, epithelial-like + spindle, melanin-pigmented (ATCC CRL-6475) | label **murine**; pigment optional |
| Fibroblast | OPTIONAL_CONTEXT | CONTEXTUAL_ANATOMY | spindle; dermal ECM producer | dermal context only |
| Endothelial / pericyte | OPTIONAL_CONTEXT | CONTEXTUAL_ANATOMY | flat endothelium; pericyte wrap | dermal vessels **context only**; no NP entry |
| Langerhans cell | LABEL_ONLY | CONTEXTUAL_ANATOMY | dendritic epidermal immune cell | label-only |
| Dendritic / CD8+ T cell | **EXCLUDED (B1)** / REQUIRED (B2) | ABSTRACT_SUPPORTED (B2) | immune | **B2 ICD scene only**, never B1 |
| Macrophage / neutrophil / other | EXCLUDED | NOT_REPORTED | — | not in B1 evidence; no decorative immune cells |

**Density policy:** no invented ratios. Where proportion is needed, use qualitative
sparse/moderate/dense or NOT_REPORTED. Melanocytes are a minority basal population relative
to keratinocytes (qualitative, OpenStax); exact ratios for the B1 specimen are not specified.
The scene must never place equal random numbers of every cell type.
