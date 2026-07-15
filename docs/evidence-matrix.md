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
