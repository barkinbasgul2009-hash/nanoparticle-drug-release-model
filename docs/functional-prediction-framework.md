# Functional Prediction Framework (Profile B, Phase 6A)

Because the frozen evidence has no functional/cellular-response dataset, every Phase-6A
relationship is a labelled prediction. Backed by
`simulator/data/functional-evidence.registry.json` (`prediction_records`) and the edge
registry.

## 1. Levels (additive vocabulary)

`EXPERIMENTAL_FORMULATION_SPECIFIC` › `EXPERIMENTAL_DRUG_CELL_SPECIFIC` ›
`EXPERIMENTAL_PATHWAY_SPECIFIC` › `HIGH_CONFIDENCE_PREDICTION` ›
`LITERATURE_DERIVED_PREDICTION` › `MECHANISTIC_PREDICTION` › `HYPOTHESIS` › `NOT_REPORTED`
/ `UNAVAILABLE` / `CONTRADICTORY_EVIDENCE`.

Experimental always outranks every prediction; a prediction never overwrites experimental
data. `HYPOTHESIS` is the weakest tier.

## 2. Every predicted relationship carries

- prediction category (level)
- confidence
- rationale / source biological principle
- source context
- target context
- limitations
- species
- cell model
- formulation specificity

(see each `prediction_records` entry).

## 3. No silent transfer

- Human keratinocyte functions are **not** transferred to mouse melanoma, and vice versa.
- Nothing is transferred to rat.
- Only the accepted mouse model (B16BL6) is used; another melanoma line is not assumed
  identical without an explicit evidence record.

## 4. EXPERIMENTAL gate

No functional edge is EXPERIMENTAL unless its reference is `VERIFIED_IN_FROZEN_PACKAGE`
(none is). The validator rejects EXPERIMENTAL claims lacking a verified reference. HO-1
anti-inflammatory function is therefore `LITERATURE_DERIVED_PREDICTION`, upgradeable only
when a verified in-repo primary source is attached.

## 5. Never fabricated

Enzyme kinetics, Km/Vmax, rate constants, ROS/GSH/cytokine concentrations, adhesion %,
membrane-potential values, activity %, affinities, half-lives, response times, thresholds,
viability/apoptosis %, tumour-volume changes, dose-response values. Unavailable →
`NOT_REPORTED`; states are schematic; cell-fate evidence is `NOT_EVALUATED`.

## 6. Feedback predictions

Feedback edges (antioxidant ↔ oxidative stress) are labelled predictions, declared, typed,
bounded, and stable — never hidden, never producing an undeclared cycle.
