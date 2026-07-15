# API–Formulation Candidate Comparison

Status: **candidate screening only** ("api" = active pharmaceutical ingredient).
No candidate is selected. All specifics require primary-source verification
before use. Machine-readable copy: `data/api-candidates.json`.

| Candidate | API | Carrier | Route | Approval (unverified) | Tissue-penetration data | Grade |
|---|---|---|---|---|---|---|
| Doxil / Caelyx | doxorubicin | PEGylated liposome | IV | ~1995 (verify Drugs@FDA) | NOT_ASSESSED | pending |
| Abraxane | paclitaxel | albumin-bound NP | IV | ~2005 (verify Drugs@FDA) | NOT_ASSESSED | pending |
| Onivyde | irinotecan (→SN-38) | liposome | IV | year to verify | NOT_ASSESSED | pending |

## Notes
- These are IV oncology nanomedicines; none yet has **verified local
  tissue-penetration** data suitable for this simulator.
- **Skin (topical)** and **intestinal (oral/luminal)** candidates are **not yet
  identified** — they need a dedicated verified search and will likely involve
  *different* APIs/formulations (do not reuse the IV oncology products).
- The full per-candidate table required by task Section 9 (size, PDI, zeta,
  loading, EE, release method, etc.) will be filled only from verified sources
  after a priority profile is approved.
