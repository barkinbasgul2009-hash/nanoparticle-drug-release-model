# Stage-2 Source-Acquisition Plan

Purpose: identify the full-text package the user must download/upload to finish
Stage 2. **No model implementation; PR #3 not merged; Stage 3 not started.**
Machine-readable master list: `data/stage2-source-acquisition-registry.json`.

## Verified inventory (already in repo)
- Rothe 2017 (SC K/D), Iliopoulos 2020 (niacinamide IVIVC), OECD TG 428, Sarfraz 2022
  (bladder review), Wilhelm 2016 (EPR context) — opened/verified.
- **Dreher 2006 — NOW FULLY VERIFIED** from user images pp.335–343 **including Table 1**
  (all P_app + vascular/extravascular AUC) and the complete reference list.

## Identity provenance of requested items
- `verified_in_repo` — opened here.
- `verified_citation_from_dreher_reflist` — citation read directly from the Dreher
  2006 reference list (author/title/journal/year/pages verified; DOI/PMID to confirm).
- `identified_search` — bibliographic identity from search; confirm DOI/PMID before use.
No DOI is asserted as confirmed unless actually seen; unseen ones are marked "confirm".

## Totals
35 unique items — Tier 1: 11, Tier 2: 15, Tier 3: 8 (targets: A 7, B 6, C 3, D 7,
E 6, F 6). Open-access/PMC: 6; FDA/EMA: 6; already in repo: 4; user-download-required
(paywalled/subscription): 18.

## Scope note (honest)
This environment cannot fetch full texts (proxy blocks HTTPS). Identities were
established from opened PDFs/images, the Dreher reference list, and search listings —
NOT by opening each target. Quantitative extraction happens in the NEXT task after
the user uploads the files.
