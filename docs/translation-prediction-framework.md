# Translation Prediction Framework (Profile B, Phase 5D)

Because the frozen evidence has no translation dataset, every protein output is a labelled
prediction. This framework governs how translation predictions are made and labelled.
Backed by `simulator/data/protein.registry.json` (`prediction_records`) and
`translation-context.registry.json`.

## 1. Levels (additive vocabulary)

`EXPERIMENTAL_FORMULATION_SPECIFIC` › `EXPERIMENTAL_DRUG_CELL_SPECIFIC` ›
`EXPERIMENTAL_PATHWAY_SPECIFIC` › `HIGH_CONFIDENCE_PREDICTION` ›
`LITERATURE_DERIVED_PREDICTION` › `MECHANISTIC_PREDICTION` › `HYPOTHESIS` › `NOT_REPORTED`
/ `UNAVAILABLE` / `CONTRADICTORY_EVIDENCE`.

Experimental always outranks every prediction; a prediction never overwrites experimental
data. `HYPOTHESIS` is the weakest tier.

## 2. Every predicted process carries

- prediction category (level)
- confidence
- rationale
- source biological principle
- context limitations
- species
- cell model
- formulation specificity

(see each `prediction_records` entry and each `outputs.*` profile).

## 3. Prediction records (summary)

| Record | Protein | Level | Source principle |
|---|---|---|---|
| `pred_ho1_translation` | HO-1 | LITERATURE_DERIVED_PREDICTION | Nrf2/ARE cytoprotective HO-1 induction (drug-class literature) |
| `pred_nqo1_translation` | NQO1 | MECHANISTIC_PREDICTION | canonical Nrf2/ARE target translation |
| `pred_infl_translation` | INFL_PROTEIN | MECHANISTIC_PREDICTION | reduced mRNA → reduced translation input |

## 4. Global-capacity prediction policy

A profile may tie global translation capacity to an upstream signal node (e.g. mTOR
suppression → reduced capacity) **only** when its evidence record permits it, labelled
`LITERATURE_DERIVED_PREDICTION` or `MECHANISTIC_PREDICTION`. This is **not** applied
automatically to every profile. The default human profile uses a constitutive capacity (no
human mTOR node); signal-linked capacity is exercised only via a test-only patched
registry.

## 5. Never fabricated

Rates, ribosome counts, lengths, copy numbers, half-lives, folding times, polysome counts,
initiation probabilities, degradation constants, fold changes, dose–protein curves.
Unavailable → `NOT_REPORTED`. Simulation decay class is labelled schematic and kept
distinct from biological half-life.

## 6. Path to upgrades

A `LITERATURE_DERIVED_PREDICTION` protein may become `EXPERIMENTAL_DRUG_CELL_SPECIFIC` only
when a primary source measuring that protein in this species/cell/context is attached and
verified in the repository (the validator rejects EXPERIMENTAL claims whose reference is
not verified). No upgrade happens implicitly.
