# Profile-B — Predictive Mode Evidence Justification (Phase 3.1)

Why animating human and mouse transport is scientifically defensible **as a prediction**, and
exactly which established principles it rests on. Uses established biological principles only; no
quantitative transport coefficients are fabricated.

## Literature reviewed (principles, not formulation-specific data)
| Topic | Established principle used | Sources |
|---|---|---|
| Human skin barrier biology | epidermis (stratum corneum outermost, rate-limiting) → viable epidermis → dermis; SC is the principal permeation barrier | StatPearls "Histology, Skin" NBK537325; OpenStax A&P 5.1 (CC BY 4.0) |
| Mouse skin barrier biology | same layer ordering; rodent skin thin overall; panniculus carnosus in the hypodermis | PMC5620574 (CC BY, rodent skin); StatPearls / OpenStax (ordering) |
| General nanoparticle transport | passive movement of a small (~85–90 nm) carrier through a permeability barrier | general colloid/transport principles |
| Passive topical diffusion | net movement from high concentration (formulation) into skin, down the gradient | Fick's laws (general) |
| Brownian motion | thermal random-walk diffusion of nanoscale particles | general physics |
| Fickian transport | flux proportional to concentration gradient; barrier lowers effective mobility | Fick's laws (general) |
| Barrier resistance | the SC dominates resistance; deeper layers resist a small carrier less | consensus skin-barrier biology |

These are the **same mechanism types** the experimental rat path uses. What rat additionally has
— and human/mouse do **not** — is *formulation-specific experimental permeation data* (Chen 2012).

## The justification, stated plainly
1. **The barrier architecture is species-general.** All three species share the ordering
   SC ≪ viable epidermis < dermis. This is textbook consensus, not a rat result. Applying it to
   human and mouse is transfer of an established principle, i.e. `MECHANISTIC_TRANSFER`.
2. **The anatomy is species-specific and already independent.** Human and mouse have their own
   Phase-2.6 anatomy profiles, so their predicted transport differs from rat because their layer
   depths differ — not because any rat number was reused.
3. **No quantitative claim is made.** Because per-layer diffusion coefficients / flux / lag are
   NOT REPORTED (for any species in the frozen package), the prediction is qualitative and
   schematic, exactly as the rat visualization already is. Predicting a *plausible qualitative
   pathway* from established principles does not require, and does not assert, any measured value.
4. **The prediction is bounded.** No penetration-depth claim beyond the general expectation that
   a topically-applied carrier moves surface → dermis; the target is the skin (topical, no
   systemic stage).

## Why this is NOT over-claiming
| Guardrail | Mechanism |
|---|---|
| Not experimental | confidence = `MECHANISTIC_TRANSFER`, evidence level = `PREDICTIVE`, never `QUALITATIVELY_SUPPORTED` |
| No borrowed data | predictive `referenceIds = []` (never Chen 2012); only `principle_refs` |
| No fabricated coefficients | no per-species mobility numbers; shared schematic ordering + own anatomy |
| Uncertainty visible | explicit "not yet experimentally validated" message; outlined (not filled) particles; evidence caption |
| Experimental protected | rat's record is independent and unchanged; modes never mix |

## What would upgrade a species to Experimental
A primary study reporting **topical skin-permeation** of *this* celastrol NLC in that species
(e.g. human or mouse Franz-cell permeation). Until then, human and mouse remain **Predictive**,
and the frozen evidence package continues to record their permeation as NOT REPORTED.

## Rat is unchanged
Rat continues to cite Chen 2012 (ex-vivo full-thickness abdominal rat skin, 1–12 h, sections
0–90 µm) at evidence level **Experimental**, confidence `QUALITATIVELY_SUPPORTED`. Nothing in
Phase 3.1 alters the rat evidence, parameters, or behaviour.
