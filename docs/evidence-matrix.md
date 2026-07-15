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
