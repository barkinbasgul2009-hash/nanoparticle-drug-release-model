# Profile B — Disease and Tissue Map

Machine-readable: `data/profile-b-disease-tissue-registry.json`.

## Verified anchor (P1) — murine cutaneous melanoma
**Chain:** topical NLC → stratum corneum → skin permeation (rat, ex vivo Franz) → viable
epidermis/dermis → melanoma tissue → B16BL6 cells → charge-dependent uptake → antimelanoma
pharmacodynamic response → tolerability.

- Species: **C57BL/6** mice (in vivo); **Sprague-Dawley rat** skin (ex-vivo permeation) —
  **species mismatch** noted.
- Endpoint: antimelanoma efficacy (cationic NLC highest, P < 0.05).
- **Not transcribed** (in the paper, pending re-read; do not invent): exact dose/volume,
  dosing frequency/duration, tumour implantation method/location, survival endpoint,
  skin-irritation histology, systemic exposure.

## Tissue-microenvironment elements
- **Modeled candidates:** SC barrier, viable epidermis/dermis diffusion (released API),
  melanoma-cell uptake compartment.
- **Visual-only candidates:** corneocytes/lipid lamellae, keratinocytes, fibroblasts,
  collagen/ECM, tumour vasculature, immune cells, interstitial fluid.
- **Informational only:** pH, oxygenation, hydration, local enzymes.

An element appearing in the animation is **not** thereby quantitatively modeled — each is
tagged in `data/profile-b-animation-events.json`.

## Additional disease presets (identified, unopened)
- P3 melanoma (systemic PLGA-PEG ER-targeting) — different route.
- P4 / P5 breast cancer (systemic micelles).
- P2 rheumatoid arthritis (transdermal, combination drug).

**Rule:** an additional disease option requires a real evidence bridge (celastrol
formulation + route + tissue model + measured endpoint). Celastrol's general pharmacology
is **not** converted into formulation-specific presets. Different carrier ⇒ separate preset.
