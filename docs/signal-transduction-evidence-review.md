# Signal-Transduction Evidence Review (Profile B, Phase 5B.1)

This review records **what the frozen evidence supports**, **what it does not**, and how
each signaling claim was classified. It is the audit basis for every node and edge in
the signal registries. No citation is fabricated.

## 1. Authoritative source and its boundary

- **Frozen package:** `data/profile-b-evidence-package.json` (from the user-provided
  Profile_B_Evidence_Package.pdf).
- **Primary study:** Chen Y et al. *Int J Nanomedicine* 2012;7:3023-3033
  (DOI 10.2147/IJN.S32476).

**What Chen 2012 supports (context only):**
- Cell models: HaCaT (human keratinocyte line) and B16BL6 (murine melanoma line).
- Rat ex-vivo full-thickness skin permeation.
- Cellular **uptake** of the NLC in HaCaT and B16BL6.
- In-vitro cytotoxicity (B16BL6) and in-vivo antimelanoma efficacy — **downstream**,
  not modelled here.

**What Chen 2012 does NOT support:**
- Any signal-transduction node or edge.
- ROS / MAPK / Nrf2 / ARE / HO-1 in HaCaT.
- NF-κB suppression in HaCaT.
- PI3K / AKT / mTOR in B16BL6.
- Any molecular target identity or binding constant (established NOT REPORTED in Phase 5A).

**Consequence:** signaling for Profile B is at best a **labelled prediction**. It is
modelled as **exposure-driven** (start condition = `drug_exposure`), never as a
target-mediated cascade.

## 2. The nine-level signal evidence vocabulary

Defined in `simulator/src/evidence/evidenceEngine.js` as `SIGNAL_EVIDENCE_LEVELS`:

| Level | Meaning | Used here for |
|---|---|---|
| `EXPERIMENTAL_FORMULATION_SPECIFIC` | Exact formulation, same species/cell/context | **(none — nothing qualifies)** |
| `EXPERIMENTAL_DRUG_CELL_SPECIFIC` | Same drug, same species/cell (maybe other formulation) | the exposure/uptake **entry** nodes (Chen measured uptake) |
| `EXPERIMENTAL_PATHWAY_SPECIFIC` | Relationship established generally, not this context | canonical edges (ROS→MAPK, etc.) |
| `HIGH_CONFIDENCE_PREDICTION` | Strong convergent support, not measured in this context | (reserved) |
| `LITERATURE_DERIVED_PREDICTION` | Reported for drug/class in literature; unverified in repo | celastrol-in-cell claims |
| `MECHANISTIC_PREDICTION` | Inferred from mechanism/canonical biology | pathway-operation predictions |
| `NOT_REPORTED` | No data | rat signaling; magnitudes/timings |
| `UNAVAILABLE` | No profile at all | (reserved) |
| `CONTRADICTORY_EVIDENCE` | Sources conflict | (reserved) |

Experimental and prediction levels are **kept distinguishable** (`isSignalExperimental`
vs `isSignalPrediction`); a prediction is never relabelled as experimental.

## 3. Classification of each claim

### Human HaCaT — oxidative-stress / Nrf2-ARE (Profile 5B-H1)
- **Exposure → ROS** — `LITERATURE_DERIVED_PREDICTION` (`celastrol_ros_literature`,
  UNVERIFIED_IN_REPO). Celastrol-induced ROS is described generally; not in the frozen
  package for HaCaT.
- **ROS → ERK / ROS → p38** — `EXPERIMENTAL_PATHWAY_SPECIFIC` (`canonical_ros_mapk`,
  CANONICAL_GENERAL_BIOLOGY).
- **ERK → Nrf2 / p38 → Nrf2** — `EXPERIMENTAL_PATHWAY_SPECIFIC` (`canonical_mapk_nrf2`).
- **Nrf2 → ARE (translocation)** — `EXPERIMENTAL_PATHWAY_SPECIFIC` (`canonical_nrf2_are`).
  Nrf2 may reach a **nuclear-localized state**; the graph **stops before transcription**.
- **ARE → HO-1 (signaling output)** — `LITERATURE_DERIVED_PREDICTION`
  (`celastrol_ho1_literature`). HO-1 is an **output state only**; protein expression is
  not modelled.

### Human HaCaT — NF-κB suppression (Profile 5B-H2)
- **Exposure ⊣ NF-κB (inhibition)** — `LITERATURE_DERIVED_PREDICTION`
  (`celastrol_nfkb_literature`). Celastrol NF-κB suppression is widely described; not in
  the frozen package for HaCaT.
- **NF-κB → inflammatory output** — `EXPERIMENTAL_PATHWAY_SPECIFIC`
  (`canonical_nfkb_inflammatory`). NF-κB is the baseline activator; drug inhibits it
  upstream. No cytokine production is simulated.

### Mouse B16BL6 — PI3K/AKT/mTOR survival (Profile 5B-M1)
- **Exposure ⊣ PI3K (inhibition)** — `LITERATURE_DERIVED_PREDICTION`
  (`celastrol_pi3k_literature`).
- **PI3K → AKT → mTOR → survival output** — `EXPERIMENTAL_PATHWAY_SPECIFIC`
  (`canonical_pi3k_akt_mtor`). Reduced mTOR → reduced survival signaling output. The
  graph **stops before apoptosis / caspases / tumour endpoints**.

### Rat skin (Profile 5B-R1)
- **NOT REPORTED.** No cellular signaling evidence; empty profile; no transfer from
  human or mouse.

## 4. Integrity rules

- **No fabricated DOIs.** Canonical relationships carry `citation: NOT_REPORTED` with
  `verification_status: CANONICAL_GENERAL_BIOLOGY`; celastrol/context claims are
  `UNVERIFIED_IN_REPO` until a primary source is attached and verified in Phase 5B.2.
- **Frozen-package boundary.** Only `chen_2012` is `VERIFIED_IN_FROZEN_PACKAGE`, and it
  supports **context (uptake)** only — never a signaling node or edge.
- **NOT REPORTED stays NOT REPORTED.** Where the frozen package reports nothing (all
  signaling), the record is a labelled prediction or NOT REPORTED — never upgraded to
  experimental.
