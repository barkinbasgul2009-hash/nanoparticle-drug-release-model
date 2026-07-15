# Search Log (Stage 2)

All searches via server-side WebSearch (only reachable tool; see
`full-text-access-log.md`). Full texts could not be opened, so "outcome" records
identified sources, not verified extractions.

| # | Query (abridged) | Facet | Key sources identified |
|---|---|---|---|
| 1 | nanoparticle skin penetration stratum corneum Franz cell confocal | skin penetration | Pharmaceutics 2020 12(9):887 (PMC7558152); consensus: NPs retained in SC/follicle, limited deeper penetration |
| 2 | stratum corneum diffusion/partition Potts–Guy | skin transport params | Potts & Guy 1992 (PMID 1608900); Rothe 2017 (PMC5484360); arXiv 2510.14606 |
| 3 | Dreher 2006 tumor vascular permeability penetration dextran | tumour transport | Dreher 2006 JNCI 98(5):335–344 (PMID 16507830) |
| 4 | NP penetration multicellular tumor spheroid depth size | tumour/spheroid | Chen 2024 Small (DOI 10.1002/smll.202304693); PMC7824314 |
| 5 | OECD TG 428 skin absorption in vitro Franz finite dose | skin method | OECD TG 428 (2004); EFSA mass-balance guidance |
| 6 | intravesical bladder + ocular/corneal NP penetration depth | bladder/ocular | Intravesical review 2022 (PMC9501312); NanoDoce NCT03636256; ocular reviews (PMC3693026) |

**Facets not yet searched to saturation** (blocked by access limits, deferred to a
source-enabled follow-up): release-assay methodology detail; free-vs-encapsulated
per product; GI regional environment primary data; calibration/validation dataset
independence; assay-interference primary studies.

---

## Stage-2 CONTINUATION — deeper search + backward citation (from uploaded full texts)
Backward-citation identification (read from the uploaded PDFs' own text):
- Rothe 2017 references: Herkenne et al. 2006 (K_SC/v, D_SC methodology), Nitsche
  (hydration correction), Hansen et al. 2008 (literature K), Davies et al. 2004
  (skin integrity), Russell et al. 2008 (SC density).
- Karadzovska 2013 references: Potts & Guy [171] (first QSAR), Abraham LFER [172],
  Geinoz et al. [175] (16 LFER equations reviewed).

Forward-citation searching (who later cited these) requires opening records and is
**blocked** by the web-fetch policy — deferred to a source-enabled pass.

| # | Query (abridged) | Facet | Identified (not opened) |
|---|---|---|---|
| 7 | nanoparticle topical release + Franz permeation depth primary | NP-skin gap | tripterine NLC (PMC3392146); caffeic-acid lipid NP (PMC7826983); caffeine lipid NP (Talanta 2015) |

**Saturation:** NOT reached for the NP-formulation facet — multiple candidate
NP-skin primaries exist but are inaccessible. Saturation cannot be honestly
declared while these remain unopened.
