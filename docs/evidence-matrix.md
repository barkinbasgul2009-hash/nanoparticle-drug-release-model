# Evidence Matrix

Status: **Phase-2 scaffold (pre-approval).** This matrix currently records only
**verified methodology/regulatory anchors**. It contains **no tissue-specific
numeric parameters** — populating those is gated on the eligibility review and
explicit user approval (Phase 17). The machine-readable copy is
`data/source-registry.json`.

## Verification checklist (every future row must satisfy)
Before a value enters this matrix or `data/source-registry.json`, confirm by
reading the actual source: title · authors/issuer · year · DOI/PMID/official ID ·
species · tissue/organ · route · nanoparticle material · particle size ·
surface properties · dose · endpoint · conditions · model type · units ·
applicability · limitations. **No AI-generated citations, no invented DOIs, no
cross-species/route/material transfer without an explicit supported scaling
method.**

## Matrix columns
`tissue/organ · route · nanoparticle type · parameter · value/range · unit ·
source_id · experimental|fitted|assumed · species · confidence · applicability ·
uncertainty · notes`

## Verified anchors (methodology/context — NOT tissue parameters)

| tissue/organ | route | NP type | parameter | value/range | unit | source_id | status | species | confidence | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| N/A | N/A | N/A | *(reporting framework)* | — | — | `fda-pbpk-2018` | guidance | N/A | high | Basis for model-status vocabulary & assumptions reporting |
| whole-body | multiple | N/A | *(PBPK platform)* | — | — | `osp-suite` | platform | human+animal | high | Whole-body scope ≠ this tool's local-diffusion scope; no documented NP module |
| solid tumour | IV (mostly) | mixed | delivered dose fraction | 0.7 (median) | % ID | `wilhelm-2016` | experimental (meta) | mostly rodent | high | Delivery efficiency context; **not** a diffusion coefficient; do not transfer across material/route |

## Tissue-parameter rows — INTENTIONALLY EMPTY
No diffusion coefficients, permeabilities, clearance rates, partition
coefficients, barrier thicknesses, or organ presets have been added. Candidate
tissues awaiting audit: generic soft tissue, skin, intestinal mucosa, colon,
gastric mucosa, solid tumour (see `docs/model-scope.md` and the eligibility
decisions in the pull-request discussion). **Each requires its own verified,
route-matched, species-appropriate sources before activation.**

## What is still missing (honest statement)
To populate even one *QUALIFIED* tissue profile, the following must be located
and read (not yet done): route-matched, species-appropriate, nanoparticle-class-
appropriate quantitative studies giving tissue diffusion coefficient (and/or
effective permeability), local clearance/elimination, and — where relevant —
interface partition, each with units and uncertainty. If such sources cannot be
verified for a tissue, that tissue stays `ILLUSTRATIVE_ONLY` or `EXCLUDED`; its
numbers will **not** be invented.

---

## Stage-2 update — identified sources (identity only; full texts NOT opened)
Per `full-text-access-log.md`, quantitative extraction was blocked. The following
were **identified** (bibliographic identity from search listings) as the primary
quantitative anchors to open in a source-enabled pass. **No values from these are
recorded as data.**

| tissue/route | source_id | identity | data it should provide | status |
|---|---|---|---|---|
| tumour | `dreher-2006` | JNCI 98(5):335–344, PMID 16507830 | vascular permeability vs MW; penetration depth (µm) | identified, not opened |
| tumour spheroid | `spheroid-size-penetration-2024` | Small, DOI 10.1002/smll.202304693 | NP penetration depth vs size | identified, not opened |
| skin | `rothe-2017` | J Appl Toxicol, PMC5484360 | SC diffusion D & partition K | identified, not opened |
| skin | `potts-guy-1992` | Pharm Res, PMID 1608900 | skin permeability model form | identified, not opened |
| skin | `pharmaceutics-2020-franz-raman` | Pharmaceutics 12(9):887, PMC7558152 | Franz/Raman IVIVC | identified, not opened |
| bladder | `intravesical-review-2022` | Pharmaceutics 14:1909, PMC9501312 | entry to depth–conc profiles | identified, not opened |
| skin method | `oecd-tg428-2004` | OECD TG 428 | standardized method | identified, not opened |

Tissue-parameter rows remain intentionally empty (no verified numeric values).

---

## Stage-2 CONTINUATION — EXTRACTED values (from opened full-text PDFs, with provenance)
All values below were read from the uploaded full texts. Class flagged: all are
**small-molecule** skin studies (no nanoparticle).

| Parameter | Value (mean, %CV) | Unit | Compound | Source (locator) | Status |
|---|---|---|---|---|---|
| SC partition K_SC/v | 2.68 (20%) | – | caffeine (human) | Rothe 2017, Table 2, Protocol 1 | measured |
| SC diffusion D_SC/H²_SC | 0.21 (26%) | h⁻¹ | caffeine (human) | Rothe 2017, Table 2, Protocol 1 | measured |
| SC partition K_SC/v | 5.35 (28%) | – | resorcinol (human) | Rothe 2017, Table 2, Protocol 1 | measured |
| SC diffusion D_SC/H²_SC | 0.19 (37%) | h⁻¹ | resorcinol (human) | Rothe 2017, Table 2, Protocol 1 | measured |
| SC partition K_SC/v | 39.5 (19%) | – | 7-ethoxycoumarin (human) | Rothe 2017, Table 2, Protocol 1 | measured |
| SC diffusion D_SC/H²_SC | 0.030 (55%) | h⁻¹ | 7-EC (human) | Rothe 2017, Table 2, Protocol 1 | measured |
| D_SC/H²_SC range (all protocols) | 0.03–0.23 | h⁻¹ | 3 compounds | Rothe 2017, text | measured |
| Cumulative permeation, 24 h | 100.3±10.8 / 106.7±12.9 | µg/cm² | niacinamide (human) | Iliopoulos 2020, Results | measured |
| Steady-state flux | 96.1 (vs 0.2 neat PG) | µg/cm²/h | niacinamide | Iliopoulos 2020 | measured |
| IVIVC (in vitro vs in vivo SC) | R²=0.98 (Pearson R²=0.94) | – | niacinamide | Iliopoulos 2020 | measured |
| Skin temperature | 32 ± 1 | °C | method | OECD TG 428 | guideline |
| Split-thickness skin | 200–400 | µm | method | OECD TG 428 | guideline |
| Finite dose (solid) | 1–5 | mg/cm² | method | OECD TG 428 | guideline |

**Not transcribed:** Rothe k_p (cm/h) values — pdftotext corrupted the negative
exponents; require careful re-read. **Absolute D (cm²/s)** cannot be computed
without an SC thickness H_SC value from a matched source.

---

## Stage-2 BATCH-1 — VERIFIED nanoparticle values (from opened primaries)

**Profile B — celastrol/tripterine NLC** (`chen-2012-tripterine-nlc`, Int J Nanomedicine
2012;7:3023-3033, DOI 10.2147/IJN.S32476). *Genuine nanoparticle; rat-skin permeation.*

| Parameter | Value (cationic/neutral/anionic) | Unit | Locator | Status |
|---|---|---|---|---|
| Particle size | 90.2 / 87.8 / 84.5 | nm | Table 2 | measured (n=3) |
| PDI | 0.109 / 0.113 / 0.116 | – | Table 2 | measured |
| Zeta potential | +26.4 / −2.7 / −24.3 | mV | Table 2 | measured |
| Entrapment efficiency | 69.3 / 67.8 / 72.5 | % | Table 2 | measured |
| Release best-fit | first-order (r² 0.9559/0.9521/0.9614) | – | Table 3 | fitted |
| Release 24 h / 48 h | 64.77–75.69 / 68.01–95.15 | % | text | measured |
| Franz flux | 1.26 / 1.10 / 0.91 | µg/cm²/h | Table 4 | measured |
| Permeability coeff | 2.10 / 1.83 / 1.52 (×10⁻³) | cm/h | Table 4 | measured |
| Lag time | 0.43 / 0.42 / 0.52 | h | Table 4 | measured |
| Cumulative (24 h) | 16.3 / 13.5 / 11.9 | µg/cm² | Fig 4A | measured |

**Profile E — Doxil** (`doxil-fda-pi` DailyMed PI rev 3/2026, cross-validated by NDA
050718/S-060; PK from Section 12.3 Table 8, total doxorubicin, AIDS-KS N=23).

| Parameter | 10 mg/m² | 20 mg/m² | Unit | Status |
|---|---|---|---|---|
| Cmax (total dox) | 4.12 | 8.34 | µg/mL | measured |
| Plasma clearance | 0.056 | 0.041 | L/h/m² | measured |
| Vss | 2.83 | 2.72 | L/m² | measured |
| AUC | 277 | 590 | µg/mL·h | measured |
| t½ λ1 | 4.7 | 5.2 | h | measured |
| t½ λ2 | 52.3 | 55.0 | h | measured |

Formulation (Section 11, per mL): doxorubicin HCl 2 mg; cholesterol 3.19 mg; HSPC 9.58 mg;
MPEG-DSPE 3.19 mg; ammonium sulfate ~0.6 mg; histidine 1.55 mg; sucrose 94 mg; pH 6.0–7.0;
≥90% encapsulated. **Contrast (conventional doxorubicin): Vd 700–1100 L/m², CL 24–35 L/h/m².**
**Free doxorubicin:** not directly measurable (mass-balance estimate unreliable per FDA
NDA 050718/S-050 review). **No tumour tissue concentration** in any uploaded document.
