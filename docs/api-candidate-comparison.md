# API–Formulation–Route–Tissue Candidate Comparison

Status: **Stage 2 landscape + finalist screen.** "API" = active pharmaceutical
ingredient. Grades are provisional: quantitative parameterization is blocked by the
environment access limit (`full-text-access-log.md`), so **no candidate exceeds
RESEARCH_SUPPORTED**, and quantitative fields are deliberately left as
"identified, not verified" rather than transcribed from search summaries.

## Candidate landscape (identified via search)

| System | Route | Local-penetration data? | Geometry fit to current solver | Notes |
|---|---|---|---|---|
| Solid tumour — released drug from local depot | intratumoral / local | Yes (interstitial transport, penetration depth) — Dreher 2006; spheroids | **Radial/spherical — best fit** | Clearance≈perfusion/IFP meaningful; most data are carrier + rodent/in vitro |
| Tumour spheroid (in vitro) | n/a (model system) | Yes, depth vs NP size (Chen 2024) | Spherical — excellent | Measures **carrier**, not released API; no perfusion |
| Topical skin | topical | Yes (Franz cell, Raman depth; Potts–Guy) | Planar multilayer slab — needs new geometry | Best-standardized method (OECD TG 428); **intact NP retained in SC/follicle** |
| Intravesical bladder wall | intravesical | Yes, depth–concentration (µg/g vs µm) | Slab from luminal surface — needs new geometry | Clinical NP exists (NanoDoce, NCT03636256); urothelium barrier |
| Ocular cornea | topical ocular | Partial (low % penetration) | Multilayer slab | <5% typical corneal penetration; complex clearance (tear turnover) |
| GI (regional) | oral/luminal | Mostly systemic-absorption endpoints | Slab + complex environment | Region-specific; confounds local vs systemic |

## Legacy IV oncology products (Stage-1 screening, retained for context)
Doxil (doxorubicin/PEG-liposome/IV), Abraxane (paclitaxel/albumin-NP/IV), Onivyde
(irinotecan/liposome/IV): approval identities to verify at Drugs@FDA. Their primary
endpoint is **whole-body delivery**, not local penetration depth, so they are weaker
fits for this tool's local-diffusion physics (see Wilhelm 2016 context).

## Finalist screen (top 3)
1. **Solid tumour — local/intratumoral released-drug diffusion** (radial). Best
   geometric/physics fit; independent quantitative transport data exists.
2. **Topical skin — released API through multilayer skin** (slab). Best methodology
   and richest API-diffusion literature; NP is a surface/follicular reservoir.
3. **Intravesical bladder wall** (slab). Cleanest human-relevant depth–concentration
   endpoint; clinical-stage NP.

## Why quantitative cells are blank
Filling particle size, loading, EE, release t50, tissue D, K, clearance, or
penetration depth requires opening the primary sources, which the environment
blocks. Entering search-summary numbers would violate the no-fabrication policy.
Required PDFs are listed in `critical-paywalled-sources.md`.

Machine-readable: `data/api-candidates.json`, `data/formulation-profiles.json`.
