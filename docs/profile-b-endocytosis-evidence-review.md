# Profile-B — Endocytosis Evidence Review (Phase 4C)

Literature review focused only on intracellular uptake and trafficking, categorised per the phase
brief. Authoritative formulation source: the **frozen** `data/profile-b-evidence-package.json`
(Chen 2012). General mechanisms are drawn from cell-biology consensus.

## A) Strong experimental evidence (general mechanisms)
| Mechanism | Note |
|---|---|
| Clathrin-mediated endocytosis | well-established general uptake route |
| Caveolae-mediated endocytosis | well-established general uptake route |
| Macropinocytosis | well-established general bulk-uptake route |
| Endosome maturation (early → late) | textbook cell biology |
| Lysosome trafficking (late endosome → lysosome) | textbook cell biology |

These are strong **general** mechanisms. They are implemented as the available pathways +
compartment sequence.

## B) Mechanistically supported evidence
| Mechanism | Note |
|---|---|
| Endosomal escape | mechanistically supported, **formulation-dependent** |
| Proton-sponge hypothesis | mechanistic, debated |
| Membrane destabilization | mechanistic |
| Fusion-mediated escape | mechanistic |

Escape is implemented **only** when a formulation's evidence supports it (registry-gated).

## C) Unsupported / speculative — NOT implemented
Intracellular efficacy · therapeutic response · downstream signalling. These are out of scope and
absent (and forbidden alongside 32 other downstream/intracellular structures).

## What the frozen package says about THIS formulation
| Item | Value | Source |
|---|---|---|
| Cellular uptake | observed in **HaCaT** (human) and **B16BL6** (mouse); order cationic > neutral > anionic | Chen 2012 (`uptake`) |
| Uptake pathway | **NOT REPORTED** (mechanism unresolved) | — |
| Endosomal escape | **NOT REPORTED** | — |
| Rat cellular uptake | **NOT REPORTED** (rat = skin permeation only) | — |
| Uptake kinetics / rate | **NOT REPORTED** (uptake time series 1–4 h only) | — |

## From general → formulation-specific evidence level
Although the general mechanisms are category A/B, the **formulation-specific** claim is weaker:
- **Endocytosis (carrier internalisation):** uptake is observed (human/mouse) but the **pathway is
  unresolved** → **Predictive** for all species (`MECHANISTIC_TRANSFER`). Rat has no observation.
- **Intracellular trafficking (endosome → lysosome):** general cell biology, **not measured** for
  this formulation → **Predictive** for all species.
- **Endosomal escape:** **NOT REPORTED** for the NLC → **Unavailable** (no escape); carriers
  terminate in the lysosome.

## Per-species evidence (endocytosis)
| Species | Level | Observational support |
|---|---|---|
| Rat | Predictive | none (skin permeation only) |
| Human | Predictive | HaCaT uptake observed (pathway unresolved) |
| Mouse | Predictive | B16BL6 uptake observed (pathway unresolved) |

## Pathway selection basis
The three pathways are weighted in the registry for a ~85–90 nm carrier (clathrin 0.5, caveolae
0.4, macropinocytosis 0.1) — small-particle routes favoured over bulk macropinocytosis. This is a
**schematic / predictive** distribution reflecting particle size, **not** a measured pathway split
(Chen did not resolve the pathway). Selection is registry-driven, never hard-coded.

## Accepted vs rejected
- **Accepted:** the *occurrence* of carrier uptake (human/mouse); the ordered compartment
  sequence (general cell biology); the three general pathways as available routes.
- **Rejected / not claimed:** any measured uptake rate, pathway split, or maturation time (NOT
  REPORTED → schematic); endosomal escape for the NLC (NOT REPORTED → Unavailable); any rat
  uptake claim; any receptor/active/vesicle-independent route beyond the three allowed pathways.

Every decision is encoded in `simulator/data/endocytosis.registry.json` (`evidence_review`,
`species_endocytosis`, `species_trafficking`, `formulations.*.escape`) for audit against the
frozen package.
