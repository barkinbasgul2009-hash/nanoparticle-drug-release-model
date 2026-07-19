# Transcription Evidence Review & Prediction Policy (Profile B, Phase 5C)

Records what the frozen evidence supports for gene regulation (nothing directly), and how
every transcription claim is labelled. No citation, value, or kinetic is fabricated.

## 1. The evidence hierarchy is intact

```
Chen 2012  →  molecular target NOT_REPORTED (Phase 5A)
           →  signaling partly predicted (Phase 5B)
           →  gene regulation MOSTLY PREDICTED (Phase 5C)
```

The frozen `data/profile-b-evidence-package.json` contains **no** transcription-factor
activation, promoter binding, gene-expression, or mRNA data. Therefore gene regulation is
never presented as experimental; it is a set of **labelled predictions** derived from
canonical general biology and drug-class literature, applied to the exposure-driven
context.

## 2. Vocabulary

`GENE_EVIDENCE_LEVELS` (additive; `simulator/src/evidence/evidenceEngine.js`):

| Level | Meaning | Used here |
|---|---|---|
| `EXPERIMENTAL` | Measured in this context (real reference required) | **none** |
| `HIGH_CONFIDENCE` | Strong convergent support, not measured here | (reserved) |
| `LITERATURE_DERIVED_PREDICTION` | Reported for the drug/class in literature; unverified in repo | HMOX1 gene, HMOX1 mRNA |
| `MECHANISTIC_PREDICTION` | Canonical mechanism applied to this context | Nrf2/NF-κB TFs, ARE/RE binding, NQO1, INFL gene |
| `HYPOTHESIS` | Labelled, biologically-reasonable guess | Nrf2→NF-κB-target cross-repression edge |
| `NOT_REPORTED` | No data / honest empty state | mouse + rat transcription |

`isGeneExperimental` and `isGenePrediction` keep the two classes disjoint;
`isGeneExperimental` is true only for `EXPERIMENTAL`.

## 3. Per-element classification (human HaCaT)

| Element | Level | Rationale |
|---|---|---|
| TF Nrf2 (`tf_nrf2`) | MECHANISTIC_PREDICTION | Canonical Nrf2 nuclear translocation + ARE binding applied to this exposure-driven context |
| TF NF-κB (`tf_nfkb`) | MECHANISTIC_PREDICTION | Canonical NF-κB behaviour; here drug-suppressed (5B-H2) |
| Promoter ARE → HMOX1/NQO1 | MECHANISTIC_PREDICTION | Canonical Nrf2/ARE relationship |
| Promoter NF-κB RE (NF-κB activation) | MECHANISTIC_PREDICTION | Canonical NF-κB→target relationship |
| Promoter NF-κB RE (Nrf2 suppression) | HYPOTHESIS | Nrf2/NF-κB cross-talk described generally; hypothesis in this context |
| Gene HMOX1 | LITERATURE_DERIVED_PREDICTION | Celastrol→HO-1 induction in literature; not in the frozen package |
| Gene NQO1 | MECHANISTIC_PREDICTION | Canonical Nrf2/ARE target (branching) |
| Gene INFL (schematic) | MECHANISTIC_PREDICTION | Schematic NF-κB target; no specific gene identity or value claimed |
| mRNA (all) | inherit the gene's level | Copy state schematic; half-life NOT_REPORTED |

## 4. Mouse & rat: NOT_REPORTED (no transfer)

- **Mouse B16BL6:** the signal graph (5B-M1: PI3K/AKT/mTOR → survival output) contains **no
  transcription-factor node**, and there is no transcription evidence → NOT_REPORTED.
- **Rat:** no cellular signaling profile (5B-R1) and no transcription evidence →
  NOT_REPORTED.
- No human transcription profile is transferred to mouse or rat.

## 5. Prediction policy

- A prediction is acceptable **only** when canonical biology strongly supports it **and**
  it is clearly labelled. Prediction never replaces evidence; experimental always takes
  priority.
- Predictions are programmatically distinct (`isGenePrediction`) and visually distinct
  (violet outline + `⌁` badge in the renderer; a "Predictive" panel label).
- No DOI, gene-expression value, fold-change, kinetic, transcription rate, RNA copy
  number, or protein abundance is fabricated. Unavailable quantities are `NOT_REPORTED`.
- An `EXPERIMENTAL` claim is only acceptable with a real reference; the validator emits a
  warning for any `EXPERIMENTAL` gene so a reviewer must attach one (none is expected for
  Profile B).

## 6. Path to upgrades

A `LITERATURE_DERIVED_PREDICTION` may be upgraded to `EXPERIMENTAL` only when a primary
source measuring that gene in this context is attached and verified — with the evidence
level and its reference changed together. No upgrade happens implicitly.
