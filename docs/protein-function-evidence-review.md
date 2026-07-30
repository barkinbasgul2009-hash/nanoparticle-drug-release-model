# Protein-Function Evidence Review (Profile B, Phase 6A)

Records what the frozen evidence supports for early cellular response (no quantitative
functional dataset), and how each functional relationship is labelled. No enzyme kinetic,
concentration, %, half-life, or dose-response value is fabricated.

## 1. The hierarchy is intact

```
Chen 2012 → target NOT_REPORTED (5A) → signaling partly predicted (5B)
          → gene regulation mostly predicted (5C) → protein output mostly predicted (5D)
          → EARLY CELLULAR RESPONSE mostly predicted (6A)
```

The frozen package contains no functional/cellular-response measurement, so Phase-6A
relationships are labelled predictions.

## 2. Vocabulary

`FUNCTION_EVIDENCE_LEVELS` (additive; `simulator/src/evidence/evidenceEngine.js`):
`EXPERIMENTAL_FORMULATION_SPECIFIC`, `EXPERIMENTAL_DRUG_CELL_SPECIFIC`,
`EXPERIMENTAL_PATHWAY_SPECIFIC`, `HIGH_CONFIDENCE_PREDICTION`,
`LITERATURE_DERIVED_PREDICTION`, `MECHANISTIC_PREDICTION`, `HYPOTHESIS`, `NOT_REPORTED`,
`UNAVAILABLE`, `CONTRADICTORY_EVIDENCE`. `isFunctionExperimental` / `isFunctionPrediction`
keep the classes disjoint.

## 3. The HO-1 anti-inflammatory classification decision

The Phase-6A prompt permits classifying celastrol-induced HO-1 → inflammatory-signaling
suppression as `EXPERIMENTAL_DRUG_CELL_SPECIFIC` **only where supported by verified primary
evidence**. No such primary source is verified in this repository (consistent with 5D,
where HO-1 protein is `LITERATURE_DERIVED_PREDICTION`). Therefore the HO-1 anti-inflammatory
edge is `LITERATURE_DERIVED_PREDICTION`, and the HO-1 antioxidant edge is
`MECHANISTIC_PREDICTION` (canonical). Neither is experimental; the exact nanoparticle
formulation is never claimed as experimentally validated.

## 4. Accepted human HaCaT relationships (all labelled predictions)

| Edge | Relationship | Level |
|---|---|---|
| HO-1 → antioxidant capacity | capacity_increase | MECHANISTIC_PREDICTION |
| HO-1 → inflammatory state | stress_reduction | LITERATURE_DERIVED_PREDICTION |
| NQO1 → antioxidant capacity | capacity_increase | MECHANISTIC_PREDICTION |
| ROS signal → oxidative stress | stress_promotion | LITERATURE_DERIVED_PREDICTION |
| antioxidant capacity ⊣ oxidative stress | stress_reduction (feedback) | MECHANISTIC_PREDICTION |
| oxidative stress → antioxidant capacity | recovery (feedback) | MECHANISTIC_PREDICTION |
| NF-κB signal → inflammatory state | activation (baseline-relative) | MECHANISTIC_PREDICTION |
| inflammatory (ICAM1-like) protein → adhesion readiness | readiness_increase | MECHANISTIC_PREDICTION |

## 5. Accepted mouse B16BL6 early-response relationships (signal-driven)

| Edge | Relationship | Level |
|---|---|---|
| survival-output signal → survival signaling | activation (baseline-relative) | MECHANISTIC_PREDICTION |
| exposure signal → oxidative stress | stress_promotion | LITERATURE_DERIVED_PREDICTION |
| survival signaling ⊣ mitochondrial stress | stress_reduction | MECHANISTIC_PREDICTION |
| oxidative stress → mitochondrial stress | stress_promotion | MECHANISTIC_PREDICTION |
| mitochondrial stress → stress readiness | stress_promotion | MECHANISTIC_PREDICTION |
| survival signaling ⊣ stress readiness | stress_reduction | MECHANISTIC_PREDICTION |

Reduced survival signaling and elevated stress readiness are **preparatory, reversible**
states — explicitly NOT apoptosis. No cell dies.

## 6. ICAM1

ICAM1 was considered as the adhesion protein identity but not adopted (no verified ICAM1
evidence); a schematic inflammatory (ICAM1-like) protein/state is used. Adhesion stops at
readiness; no monocytes, leukocytes, recruitment, or vascular adhesion.

## 7. Rat: NOT_REPORTED

No Phase-5D protein and no validated intracellular functional response for rat → idle. Rat
skin-permeation evidence does not imply rat functional response; no human/mouse fallback.

## 8. What is never fabricated

Enzyme turnover, Km/Vmax, catalytic rate constants, ROS/GSH/cytokine concentrations,
adhesion %, membrane-potential values, activity %, affinities, biological half-lives,
response times, thresholds, viability %, apoptosis %, tumour-volume changes, dose-response
values. Unavailable → `NOT_REPORTED`; states are schematic; cell-fate evidence is
`NOT_EVALUATED`.
