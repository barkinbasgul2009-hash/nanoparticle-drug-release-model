# Profile-B — Target Binding Evidence Review (Phase 5A)

Evidence review for the target-engagement layer. Authoritative source: the **frozen**
`data/profile-b-evidence-package.json` (Chen 2012). No outside knowledge is used to fill gaps.

## What the frozen package reports (target binding)
| Item | Value | Source |
|---|---|---|
| Molecular target identity (for tripterine) | **NOT REPORTED** | — |
| Binding constants Kd / Ki / IC50 | **NOT REPORTED** | — |
| kon / koff | **NOT REPORTED** | — |
| Cellular uptake (context) | HaCaT / B16BL6 (carrier uptake) | Chen 2012 |
| In-vivo pharmacodynamics (context) | melanoma efficacy | Chen 2012 — this is **downstream** (Phase 5B+, not modelled here) |
| "Binding affinity" (Shukla 2020) | celastrol–**cyclodextrin complexation**, NOT a protein target | Shukla 2020 |

## The honest conclusion for B1
No molecular target and no binding constants are reported for tripterine in the frozen package, and
Shukla's affinity is a drug–excipient complexation, not target engagement. Therefore the B1
target-engagement layer is **NOT REPORTED** for all species (idle): no targets are placed and no
binding is shown. This is the scientifically correct outcome — the frozen package's in-vivo PD is
*downstream* biology that this phase does not model, and inferring a target from outside knowledge
would violate the project's evidence discipline.

## Per-species target-engagement evidence
| Species | Level |
|---|---|
| Rat | Not Reported |
| Human | Not Reported |
| Mouse | Not Reported |

No per-species binding parameters exist, so nothing is copied between species and no validation is
claimed.

## Accepted vs rejected
- **Accepted:** the generic target-type catalog and binding-model math (reversible/irreversible,
  occupancy, saturation, competition, residence time) as available machinery; the ordered
  possibility encounter → binding → occupancy → dissociation.
- **Rejected / not claimed:** any target identity, Kd/Ki/IC50, or kon/koff for B1 (all NOT REPORTED
  → idle); any target inferred from outside knowledge; any downstream response (forbidden).

## Predictive mode (how predictions would be labelled)
When a formulation *does* have a defensible predicted parameter, it is shown with a **prediction
label** (High-confidence / Mechanistic / Literature-derived Prediction) and never as EXPERIMENTAL —
see `docs/prediction-framework.md`. Numeric affinities are never fabricated. In this phase the
prediction machinery is demonstrated only via test-only patched profiles; the real B1 registry
remains NOT REPORTED.

## Auditing
Every decision is encoded in `simulator/data/target-engagement.registry.json`
(`formulations.B1_nlc.binding.evidence_level`, `species_target`, `integrity.forbidden`) so a
reviewer can confirm nothing is fabricated and no downstream biology is modelled.
