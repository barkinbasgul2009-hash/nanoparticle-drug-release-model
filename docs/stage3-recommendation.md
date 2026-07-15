# Stage-3 Recommendation

## Scientific decision: OUTCOME B — partially sufficient (selection only), contingent on full-text access

A defensible **selection** of the next system can be made from the qualitative
evidence landscape and modelling-fit analysis. A **quantitative, calibrated,
externally-validated** profile **cannot** be built in this environment because all
full-text access is blocked (`full-text-access-log.md`), so the model-critical
numbers cannot be verified. No candidate therefore exceeds **RESEARCH_SUPPORTED**,
and even that grade is provisional on obtaining the sources in
`critical-paywalled-sources.md`.

This is the honest outcome; fabricating parameters to reach "QUALIFIED" is not
acceptable (Stage-2 §5, §43).

## Primary recommendation
**Solid tumour — released-drug interstitial diffusion from a local (intratumoral)
nanoparticle depot; radial geometry; species/context: preclinical rodent first,
human framed as extrapolation.**

Rationale:
- **Best fit to the existing solver** (spherical/radial reaction–diffusion + local
  first-order clearance ≈ interstitial diffusion + perfusion/IFP-driven removal) —
  minimal new numerics; the current Module 2 maps onto it directly.
- **Independent quantitative data exists** (Dreher 2006 tumour transport; Chen 2024
  spheroid penetration) from more than one group.
- **Clearance term is physically meaningful** (perfusion, interstitial pressure).

Caveats that cap it at RESEARCH_SUPPORTED (at best):
- Most identified data are **carrier** penetration, not **released free API**.
- Data are largely **rodent / in vitro**; human relevance is extrapolation.
- Tumour heterogeneity and the ~0.7% delivery reality (Wilhelm 2016) mean
  uncertainty must be shown prominently.

## Fallback recommendation
**Topical skin — released API through a multilayer skin slab (stratum corneum /
viable epidermis / dermis); nanoparticle as a surface/follicular reservoir.**

Rationale: best-standardized methodology (OECD TG 428, Franz cell) and the richest
API skin-diffusion literature (Potts–Guy; SC D/K). Requires adding **slab /
multilayer geometry** (new solver geometry) and must state clearly that **intact
nanoparticles are retained in the SC/follicle** — only the released API diffuses.

## Explicitly rejected (for now) and why
- **IV oncology products (Doxil/Abraxane/Onivyde)**: endpoint is whole-body
  biodistribution, not local penetration depth — poor fit to this tool.
- **Ocular / GI**: complex clearance/environment and confounded local-vs-systemic
  endpoints; weaker match without deeper data.
- **Intravesical bladder**: promising (human depth–concentration data, clinical NP)
  and a strong future candidate, but placed third pending primary-source depth
  profiles and slab-geometry work.

## What Stage 3 MAY implement (only after review + source access)
- A new **named-tissue profile object** for the chosen system, its equations,
  geometry, boundary condition, and parameter set — **each value sourced** from an
  opened primary source with an exact locator.
- Uncertainty display and applicability-domain warnings.

## What Stage 3 MUST NOT claim
- QUALIFIED status or clinical/patient-specific prediction.
- Human validity where only rodent/in vitro data exist.
- Released-API behaviour inferred from carrier-only measurements.

## Preconditions before Stage 3 can start
1. User selects primary vs fallback.
2. User provides the full texts in `critical-paywalled-sources.md` (or enables a
   networked environment) so parameters can be extracted with provenance.
3. A calibration dataset **and** an independent validation dataset are confirmed for
   the chosen system (see `calibration-validation-inventory.md`); if no independent
   validation set exists, the profile stays RESEARCH_SUPPORTED, never QUALIFIED.
