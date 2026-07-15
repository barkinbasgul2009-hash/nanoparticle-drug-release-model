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
