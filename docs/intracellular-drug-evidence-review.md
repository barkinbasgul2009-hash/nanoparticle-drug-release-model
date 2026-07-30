# Profile-B — Intracellular Drug Evidence Review (Phase 4D)

Evidence review for the intracellular stage. Authoritative source: the **frozen**
`data/profile-b-evidence-package.json` (Chen 2012). Where the frozen package is silent, nothing is
invented.

## What the frozen package reports (intracellular)
| Item | Value | Source |
|---|---|---|
| In-vitro (extracellular) release | first-order selected | Chen 2012 (`release_profile`) — this is **Phase 4A**, extracellular |
| Intracellular release kinetics | **NOT REPORTED** | — |
| Intracellular degradation / half-life | **NOT REPORTED** | — |
| Endosomal escape | **NOT REPORTED** (Phase 4C: no escape) | — |
| Nucleus targeting | **NOT REPORTED** (Chen NLC is not nucleus-targeting) | — |
| Cellular uptake (context) | observed in HaCaT/B16BL6 (carrier uptake, pathway unresolved) | Chen 2012 (`uptake`) |

Note: Wang 2025 (a different, PLGA formulation) describes **ER** targeting and downstream
immunogenic cell death — those are (a) a different formulation and (b) downstream biology that is
**forbidden** in this phase; they are not used here.

## The honest conclusion for B1
Because intracellular release/degradation/targeting are **NOT REPORTED** *and* endosomal escape is
**Unavailable** (so no carrier reaches the cytoplasm), the intracellular stage for the B1 NLC is
**idle**: the evidence level is **Not Reported** for all species and no intracellular drug is
produced. This is the scientifically correct outcome, not a limitation to be papered over.

## Per-species intracellular-release evidence
| Species | Level |
|---|---|
| Rat | Not Reported |
| Human | Not Reported |
| Mouse | Not Reported |

No per-species intracellular parameters exist, so nothing is copied between species, and no
validation is claimed.

## Accepted vs rejected
- **Accepted:** the *model catalog* (burst / first-order / zero-order / Higuchi / Korsmeyer–Peppas)
  as available math; the schematic nucleus geometry; the *ordered* possibility of cytoplasmic
  diffusion → optional nuclear-membrane arrest.
- **Rejected / not claimed:** any intracellular release **rate/constant**, degradation
  **half-life**, or targeting **mode** for B1 (all NOT REPORTED → the stage is idle); any nuclear
  **entry** (out of scope); any downstream biology (forbidden). Reusing the extracellular
  first-order constant intracellularly is explicitly **not** done (release is independent, and the
  intracellular kinetics are not reported).

## Evidence-level system
The evidence panel now has six independent levels: Transport / Release / Passive Uptake /
Endocytosis / Intracellular Trafficking / **Intracellular Release**, each Experimental / Predictive
/ Unavailable / **Not Reported**. `NOT_REPORTED` was added to the controlled evidence-level
vocabulary (distinct from `UNAVAILABLE`; neither animates).

Every decision is encoded in `simulator/data/intracellular.registry.json`
(`formulations.B1_nlc.*.evidence_level`, `species_intracellular`, `integrity`) so another scientist
can audit each choice against the frozen package.
