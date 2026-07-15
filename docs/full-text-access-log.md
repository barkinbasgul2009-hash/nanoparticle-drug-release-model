# Full-Text Access Log

Status: **Stage 2. Decisive environment constraint documented here.**

## Environment access finding
In this build environment, **all direct outbound HTTPS fetching is blocked** by the
agent network proxy. Verified this session:

| Attempt | Tool | Result |
|---|---|---|
| PMC5484360 (stratum-corneum D/K) | WebFetch | HTTP 403 |
| JNCI Dreher 2006 full text | WebFetch | HTTP 403 |
| arXiv 2510.14606 (SC modelling PDF) | WebFetch | HTTP 403 |
| MDPI Pharmaceutics 12(9):887 | WebFetch | HTTP 403 |
| NCBI E-utilities esummary (PMID 16507830) | WebFetch | HTTP 403 |
| NCBI E-utilities (same) | curl via proxy | 56 CONNECT tunnel failed, 403 |

The proxy status endpoint showed no per-host relay failures, i.e. this is a
**policy block on outbound fetch**, not a transient error. **Only server-side
`WebSearch` is available.**

## Consequence for Stage 2 (honest)
`WebSearch` returns AI-generated summaries. The Stage-2 policy (§5) states these
may be used **only to identify possible sources**, never as quantitative evidence,
and that every quantitatively-used source must be **opened and inspected** with an
exact table/figure/page locator. Because full texts cannot be opened here:

- Candidate **systems and sources were identified** (with real DOIs/PMIDs where the
  search listing provided them).
- **No quantitative parameter values were extracted or recorded as data.** Numbers
  seen in search summaries are treated as *leads only* and are NOT entered into any
  parameter/profile registry.
- Therefore no candidate can be graded above **RESEARCH_SUPPORTED**, and even that
  is provisional pending full-text parameterization.

This is reported honestly rather than filled with plausible-looking numbers
(Stage-2 §5, §43 Outcome C). The specific full texts required to proceed are listed
in `critical-paywalled-sources.md`.

---

## Stage-2 CONTINUATION update (user-provided PDFs)
Five PDFs were uploaded and **successfully opened** locally (poppler `pdftotext`);
the web-fetch block is unchanged (still cannot reach publishers/PMC). Quantitative
extraction was therefore performed on the uploaded full texts:

- **Extracted with provenance:** Rothe 2017 (SC K & D/H², Tables 1–2), Iliopoulos
  2020 (IVIVC R², flux, cumulative permeation), OECD TG 428 (method parameters),
  Karadzovska 2013 (QSPR/LFER model forms — supporting).
- **Qualitative only:** Sarfraz 2022 (review; bladder environment structure).
- **One extraction caveat:** Rothe Table (k_p row) lost negative exponent signs in
  `pdftotext`; k_p numeric values were **not** transcribed (only the clean K and
  D/H² values were). 
- **Still unreadable (web-blocked, not uploaded):** Dreher 2006, Chen 2024
  spheroid, Potts & Guy 1992, and newly-identified NP-skin primaries (tripterine
  NLC PMC3392146; caffeic-acid lipid NP PMC7826983; caffeine lipid NP Talanta 2015).

---

## Stage-2 CONTINUATION 3 (user-provided primary IMAGES)
The user provided 5 photographs (IMG_8078–8082) = **Dreher et al. 2006 primary pages
335–339** (JNCI 98(5)). Opened and read directly. This **upgrades Dreher from
UNVERIFIED_SECONDARY to PRIMARY-VERIFIED**: P_app (154/9.5/1.7 ×10⁻⁷ cm/s; albumin
4.9×10⁻⁷), plasma t½ (3.8/19.6 min), extravascular AUC (887/846/2398 %Vmax·min),
penetration (>35/15/5 µm), Kedem–Katchalsky model — all read from the images. (10 kDa
and 70 kDa P_app appear in Fig 3 / dossier but not in the provided text pages →
DIRECT_PARTIAL.) Web-fetch remains blocked; Chen 2024, Potts & Guy 1992, celastrol NLC,
Doxil/Abraxane labels are still not opened.
