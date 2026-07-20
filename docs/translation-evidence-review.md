# Translation Evidence Review (Profile B, Phase 5D)

Records what the frozen evidence supports for translation/protein output (no quantitative
dataset), and how each protein output is classified. No citation, rate, count, or half-life
is fabricated.

## 1. The hierarchy is intact

```
Chen 2012 → target NOT_REPORTED (5A) → signaling partly predicted (5B)
          → gene regulation mostly predicted (5C) → protein output mostly predicted (5D)
```

The frozen `data/profile-b-evidence-package.json` contains **no** translation rate,
ribosome, protein-abundance, or protein half-life data. Protein output is therefore a set
of **labelled predictions**.

## 2. Vocabulary

`TRANSLATION_EVIDENCE_LEVELS` (additive; `simulator/src/evidence/evidenceEngine.js`):
`EXPERIMENTAL_FORMULATION_SPECIFIC`, `EXPERIMENTAL_DRUG_CELL_SPECIFIC`,
`EXPERIMENTAL_PATHWAY_SPECIFIC`, `HIGH_CONFIDENCE_PREDICTION`,
`LITERATURE_DERIVED_PREDICTION`, `MECHANISTIC_PREDICTION`, `HYPOTHESIS`, `NOT_REPORTED`,
`UNAVAILABLE`, `CONTRADICTORY_EVIDENCE`. `isTranslationExperimental` and
`isTranslationPrediction` keep the classes disjoint.

## 3. The HO-1 classification decision (important)

The general literature reports celastrol-induced HO-1/HMOX1 **protein** in HaCaT
keratinocytes. The Phase-5D prompt permits `EXPERIMENTAL_DRUG_CELL_SPECIFIC` **only when
mapped to verified primary evidence already present in the evidence registry**. The frozen
Profile-B package (Chen 2012) contains no HaCaT HO-1 protein measurement, and **no primary
HO-1 protein source is verified in this repository**. Per the project rule, HO-1 protein is
therefore classified **`LITERATURE_DERIVED_PREDICTION`**, not experimental. It may be
upgraded to `EXPERIMENTAL_DRUG_CELL_SPECIFIC` only when such a source is attached and
verified here (the validator rejects any EXPERIMENTAL claim whose reference is not
`VERIFIED_IN_FROZEN_PACKAGE`).

## 4. Per-protein classification (human HaCaT)

| Protein | Source mRNA | Level | Rationale |
|---|---|---|---|
| HO-1 (`prot_ho1`) | mrna_hmox1 | LITERATURE_DERIVED_PREDICTION | Celastrol→HO-1 protein described in literature; not in frozen package; unverified in repo |
| NQO1 (`prot_nqo1`) | mrna_nqo1 | MECHANISTIC_PREDICTION | Canonical Nrf2/ARE target translation; no same-context primary protein evidence |
| INFL_PROTEIN (`prot_infl`) | mrna_infl | MECHANISTIC_PREDICTION | Schematic NF-κB target; suppressed mRNA → reduced protein; not named ICAM1 (no verified evidence) |

Reference records (`protein.registry.json` → `protein_evidence`) carry a
`verification_status`: celastrol claims are `UNVERIFIED_IN_REPO`; canonical relationships
are `CANONICAL_GENERAL_BIOLOGY`. No DOI is fabricated.

## 5. ICAM1

ICAM1 was considered as the inflammatory protein identity but **not adopted**: no verified
ICAM1 primary evidence is present in the repository. A schematic inflammatory protein
mapped to the Phase-5C suppressed gene is used instead. Adhesion / inflammation phenotype
is not modelled.

## 6. Mouse & rat: NOT_REPORTED

Phase 5C leaves mouse and rat transcription NOT_REPORTED (no mRNA), so translation is idle.
No human protein output is transferred; rat skin permeation evidence does not imply rat
protein expression.

## 7. What is never fabricated

Translation rates, ribosome counts, amino-acid lengths, protein copy numbers, half-lives,
folding times, polysome counts, initiation probabilities, degradation constants, fold
changes, and dose–protein curves. Unavailable values are `NOT_REPORTED`; the simulation
decay class is labelled schematic and kept distinct from a biological half-life.
