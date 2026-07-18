# Profile-B — Passive Uptake Evidence Report (Phase 4B)

Auditable mapping of the uptake layer to its sources. Authoritative source: the **frozen**
`data/profile-b-evidence-package.json` (Chen 2012). Where the frozen package is silent, nothing is
invented.

## What the frozen package reports (cellular uptake)
| Field | Value | Source |
|---|---|---|
| Cellular uptake | assessed in **HaCaT** (human keratinocytes) and **B16BL6** (mouse melanoma); order **cationic > neutral > anionic** | Chen 2012 (`uptake`) |
| Cell models | HaCaT (human), B16BL6 (mouse) | Chen 2012 (`cell_models`) |
| Uptake time series | 1, 2, 3, 4 h | Chen 2012 (`time_series.cellular_uptake_h`) |
| Uptake **mechanism** | **NOT REPORTED** (uptake is measured; the route — passive vs endocytic — is not resolved) | — |
| Rat cellular uptake | **NOT REPORTED** (rat used for skin permeation only) | — |
| Free-drug passive membrane crossing | **NOT REPORTED** for this formulation | — |
| Membrane permeability / diffusion coefficients | **NOT REPORTED** | — |

Supporting general context: celastrol is a **small lipophilic** molecule (BCS class IV; Shukla
2020), for which passive diffusion across a lipid membrane is a standard biophysical expectation.

## The central reasoning (why uptake is PREDICTIVE for every species)
1. Chen measured **carrier** cellular uptake (HaCaT/B16BL6), not **free-drug passive membrane
   crossing**, and did not resolve the mechanism. The process Phase 4B animates (passive free-drug
   entry) is therefore **not the measured process**.
2. Passive membrane crossing of a small lipophilic molecule is a **general principle**
   (`MECHANISTIC_TRANSFER`), so the animation is **PREDICTIVE**, not experimental — for all species.
3. Consistent with Phase 3.1, PREDICTIVE animates but is clearly labelled and carries **no**
   permeation citation (no fabricated evidence, no rat fallback).

## Per-species Cell Uptake Evidence
| Species | Level | Observational context (does uptake occur?) | Animated mechanism |
|---|---|---|---|
| **Rat** | Predictive | **none** — Chen used rat for skin permeation only | passive free-drug crossing = general principle |
| **Human** | Predictive | HaCaT uptake observed in vitro (carrier uptake, charge-dependent, mechanism unresolved) | passive free-drug crossing = general principle |
| **Mouse** | Predictive | B16BL6 uptake observed in vitro (carrier uptake, mechanism unresolved) | passive free-drug crossing = general principle |

The observational context differs (human/mouse have observed cellular uptake; rat has none) but it
does **not** upgrade the animated passive mechanism to experimental — so all three are Predictive.
This honours the brief (human/mouse Predictive; rat "according to available evidence").

## Accepted vs rejected
- **Accepted:** the *existence* of cellular uptake (human/mouse, in vitro); the general principle
  that a small lipophilic molecule can passively cross a membrane (mechanistic transfer).
- **Rejected / not encoded:** any uptake **rate**, membrane **permeability**, or diffusion
  **coefficient** (NOT REPORTED → schematic, not claimed); any **mechanism** beyond passive
  (endocytosis/receptors/vesicles — forbidden and out of scope); any **rat** uptake claim (no data);
  any per-charge uptake number (charge is a label only).

## Three-level evidence exposure
The evidence panel shows **Transport / Release / Cell Uptake** independently:
- **Rat:** Experimental / Experimental / **Predictive**
- **Human:** Predictive / Predictive / **Predictive**
- **Mouse:** Predictive / Predictive / **Predictive**

Every decision is encoded in `simulator/data/microenvironment.registry.json` (`species_uptake`,
`uptake_model`, `diffusion`, `integrity`) so another scientist can audit each choice against the
frozen package.
