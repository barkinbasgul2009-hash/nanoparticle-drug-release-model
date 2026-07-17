# Profile B — ECM and Vascular Atlas

Design only. Machine-readable: `data/profile-b-ecm-atlas.json`. ECM must be **biologically
intentional**, not random fibers. Abundance is qualitative — no invented volume fractions.

## Extracellular matrix (dermal context)
| Component | Location | H&E / special stain | B1 relevance |
|---|---|---|---|
| Collagen I | dermis (dominant fibrillar) | eosinophilic pink / blue in trichrome | dermal context |
| Collagen III | papillary dermis, reticular fibers | — | context |
| Collagen IV | basement membrane (DEJ) | — | barrier context; BM disruption is a *human melanoma* feature (contextual) |
| Elastin | dermis | — | context |
| Hyaluronan / proteoglycans | dermal interstitium | — | interstitial context; **not** a quantified transport modifier for B1 |
| Fibronectin / laminin | BM / interstitium | — | context / label-only |

**ECM transport effect:** `UNSUPPORTED_DO_NOT_ANIMATE` as a quantified process — Chen 2012
does not report ECM-dependent nanoparticle transport, so ECM traversal must not be shown as
a measured event.

## Vascular / lymphatic
Papillary capillary loops, deeper dermal plexus, endothelium + pericytes, optional RBCs
(illustrative color), lymphatics (label-only). Tumor-associated vasculature is CONTEXTUAL for
human histology and NOT_REPORTED for the B1 model.

## Vascular rule for B1 (topical)
- **Epidermis is AVASCULAR** — never draw vessels in it.
- **Dermis** — vessels allowed as **anatomical context only**.
- **Prohibited:** nanoparticle entry into vessels, systemic distribution, extravasation —
  all `UNSUPPORTED_DO_NOT_ANIMATE`. Dermal vessels existing does **not** license a
  bloodstream-transport animation.
