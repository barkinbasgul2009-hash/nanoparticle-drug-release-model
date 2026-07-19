# Signal Prediction Framework (Profile B, Phase 5B.1)

Because the frozen evidence contains **no** signal-transduction data and the molecular
target is NOT REPORTED, every signaling claim is either a **canonical general
relationship applied to a context** or a **labelled prediction**. This framework
governs how predictions are made, labelled, and (never silently) transferred across
contexts. It is backed by `simulator/data/signal-prediction.registry.json`.

## 1. Prediction levels

| Level | Definition |
|---|---|
| `HIGH_CONFIDENCE_PREDICTION` | Strong, convergent support (e.g. same drug + closely related context) but not measured in this context. |
| `LITERATURE_DERIVED_PREDICTION` | Reported for the drug/drug-class in the literature but not in the frozen package and not verified in repo. |
| `MECHANISTIC_PREDICTION` | Inferred from mechanism / canonical biology without a direct drug-in-context report. |

A prediction is **acceptable only when labelled**; it is never presented as an
experimental result. `isSignalPrediction()` and `isSignalExperimental()` keep the two
classes disjoint.

## 2. Prediction basis kinds

`canonical_general_biology`, `drug_class_literature`, `same_drug_other_context`,
`mechanistic_inference`. Each prediction record names its `basis_kind` and its
`reference_ids`.

## 3. The two kinds of claim, made explicit

1. **Applying a canonical relationship to a context.** The relationship (e.g.
   PI3K→AKT→mTOR) is established general biology; only its *operation in this context*
   is predicted. Recorded as a `MECHANISTIC_PREDICTION` with
   `cross_context_transfer` describing the application explicitly (e.g. "canonical
   relationship applied TO mouse melanoma context").
2. **A drug-in-context claim.** e.g. "celastrol suppresses NF-κB in HaCaT". Recorded as
   a `LITERATURE_DERIVED_PREDICTION` with `verification_status: UNVERIFIED_IN_REPO` and
   no fabricated citation.

## 4. Prediction records (summary)

| Record | Profile | Claim | Level | Transfer |
|---|---|---|---|---|
| `pred_h1_exposure_ros` | 5B-H1 | celastrol elevates ROS in HaCaT | LITERATURE_DERIVED_PREDICTION | none |
| `pred_h1_ros_mapk_nrf2_are` | 5B-H1 | ROS→MAPK→Nrf2→ARE operates in HaCaT | MECHANISTIC_PREDICTION | canonical → human HaCaT (explicit) |
| `pred_h1_are_ho1` | 5B-H1 | ARE raises HO-1 output in HaCaT | LITERATURE_DERIVED_PREDICTION | none |
| `pred_h2_nfkb_suppression` | 5B-H2 | celastrol suppresses NF-κB in HaCaT | LITERATURE_DERIVED_PREDICTION | none |
| `pred_h2_nfkb_inflammatory` | 5B-H2 | ↓NF-κB → ↓inflammatory output | MECHANISTIC_PREDICTION | canonical → human HaCaT (explicit) |
| `pred_m1_pi3k_suppression` | 5B-M1 | celastrol suppresses PI3K in B16BL6 | LITERATURE_DERIVED_PREDICTION | none |
| `pred_m1_akt_mtor_survival` | 5B-M1 | PI3K→AKT→mTOR operates in B16BL6 | MECHANISTIC_PREDICTION | canonical → mouse melanoma (explicit) |

## 5. Cross-context transfer ledger (no silent transfer)

| Transfer | Status | Note |
|---|---|---|
| human → mouse | **NONE** | Human HaCaT axes are not transferred to mouse melanoma; 5B-M1 is built independently on canonical PI3K/AKT/mTOR biology. |
| mouse → rat | **NOT REPORTED** | No rat cellular signaling profile exists. |
| human → rat | **NOT REPORTED** | No rat cellular signaling profile exists. |

**Rule.** Only canonical *general* relationships are "applied to" a context (recorded
explicitly). A context-specific *pathway/profile* is never copied across species or cell
models.

## 6. Deliberate NOT-REPORTED predictions

- **Rat (5B-R1):** no valid predictive basis without a cellular model; deliberately
  empty.
- **Target-mediated start:** because the Phase-5A molecular target is NOT REPORTED, no
  target-mediated (as opposed to exposure-driven) prediction is made.

## 7. Path to Phase 5B.2 upgrades

A `LITERATURE_DERIVED_PREDICTION` (UNVERIFIED_IN_REPO) may be upgraded only when a
primary source is attached and verified — at which point its `verification_status` and
`evidence_level` change together, with a new audit-trail entry. No upgrade happens
implicitly.
