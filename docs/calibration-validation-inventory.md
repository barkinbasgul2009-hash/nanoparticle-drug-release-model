# Calibration & Validation Dataset Inventory

Rule: never fit and validate on the same data; external validation must come from an
independent lab/publication/batch under compatible conditions. Without an
independent validation set, a profile **cannot** be QUALIFIED (stays
RESEARCH_SUPPORTED at most).

| Candidate | Possible calibration source | Possible independent validation | Independence confirmed? |
|---|---|---|---|
| Tumour (primary) | Dreher 2006 (transport vs MW) | spheroid studies (Chen 2024) or a second in vivo group | **No — full texts not opened** |
| Skin (fallback) | a Franz-cell dataset (e.g. Pharmaceutics 2020) | a second lab / OECD ring trial | **No — not opened** |
| Bladder | a depth–concentration primary study | a second intravesical study | **No — not opened** |

**Conclusion:** calibration/validation pairing cannot be finalized in this
environment. Confirming independence and compatibility requires the PDFs in
`critical-paywalled-sources.md`. Machine-readable: `data/validation-datasets.json`.

---

## Stage-2 CONTINUATION update
- **Skin (revised primary):** Rothe 2017 (SC K, D/H²) and Iliopoulos 2020
  (permeation/IVIVC) are now **available** and could serve as **calibration** inputs
  for a released-small-molecule skin-diffusion sub-model. However, they are the same
  class of source (same groups' methodology), and **no independent nanoparticle
  validation dataset is available** → the profile **cannot be QUALIFIED**; maximum
  grade RESEARCH_SUPPORTED.
- **Tumour (fallback):** calibration (Dreher 2006) and validation (Chen 2024)
  candidates remain **unavailable**.
- **Explicit statement:** NO ADEQUATE INDEPENDENT EXTERNAL VALIDATION DATASET
  IDENTIFIED for any candidate. No QUALIFIED profile is possible at this time.
