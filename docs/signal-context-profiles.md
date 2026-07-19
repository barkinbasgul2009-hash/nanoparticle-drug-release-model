# Signal-Context Profiles (Profile B, Phase 5B.1)

A **context** is the biological setting a signaling profile is keyed by: species + cell
model + tissue/disease + drug + formulation + molecular target. Contexts live in
`simulator/data/signal-context.registry.json` and are **never mixed**: one profile binds
exactly one context. This document lists the contexts and the accepted/deferred/
not-reported profiles bound to them.

## Contexts

| Context id | Species | Cell model | Disease | Drug | Formulation | Molecular target | Start condition |
|---|---|---|---|---|---|---|---|
| `human_hacat` | human | HaCaT (keratinocyte line) | normal keratinocyte | tripterine (celastrol) | surface-charged NLC (Profile B/B1) | **null (NOT REPORTED)** | `drug_exposure` |
| `mouse_b16bl6` | mouse | B16BL6 (melanoma line) | malignant melanoma | tripterine (celastrol) | surface-charged NLC | **null (NOT REPORTED)** | `drug_exposure` |
| `rat_skin` | rat | ex-vivo full-thickness skin | none | tripterine (celastrol) | surface-charged NLC | **null (NOT REPORTED)** | `none` |

Because the molecular target is NOT REPORTED for every context (Phase 5A), signaling is
**exposure-driven**, never target-mediated. Rat has no cellular model and therefore no
start condition and no signaling profile.

## Context rules (enforced)

- **one_species_one_cell_model** — a profile binds exactly one context; species and cell
  models are never mixed within a profile.
- **no_silent_transfer** — a human keratinocyte pathway is never auto-transferred to
  mouse melanoma; a mouse pathway is never auto-transferred to rat. Any transfer is a
  labelled prediction recorded in `signal-prediction.registry.json`.
- **target_gating** — signal transduction never begins without a declared start
  condition; with an unknown target, only an exposure-driven predictive profile may
  exist. A fake generic target is never used to force a pathway.

## Profiles by context

### `human_hacat`

**5B-H1 — Oxidative-stress / Nrf2-ARE cytoprotective axis (ACCEPTED).**
`drug_exposure → ROS → {ERK, p38} → Nrf2 → ARE → HO-1 output`. DAG with a diamond
(ROS fans out to ERK and p38, which converge on Nrf2). Stops at the HO-1 signaling-output
state (no protein expression).

**5B-H2 — NF-κB suppression / anti-inflammatory axis (ACCEPTED).**
`drug_exposure ⊣ NF-κB → inflammatory output` (baseline NF-κB active; drug inhibits it;
canonical NF-κB→inflammatory-output edge). Linear DAG. Stops at reduced inflammatory
signaling output (no cytokine production).

**5B-H3 — additional stress/crosstalk axis (DEFERRED).**
Considered but deferred: it would require crosstalk edges with 5B-H1 (shared ROS/stress
input) that exceed the available evidence. Feedback/crosstalk is NOT REPORTED in 5B.1;
revisit only with primary-source evidence and a typed crosstalk design.

### `mouse_b16bl6`

**5B-M1 — PI3K/AKT/mTOR survival-signaling suppression (ACCEPTED).**
`drug_exposure ⊣ PI3K → AKT → mTOR → survival output` (baseline pathway active; drug
inhibits PI3K upstream, attenuating the canonical activating chain). Linear DAG. Stops
at reduced survival signaling output (no apoptosis, caspases, or tumour endpoints).

### `rat_skin`

**5B-R1 — NOT REPORTED.** No cellular signaling evidence exists; the profile is empty.
No human or mouse pathway is transferred to rat.

## Accept / defer / reject log

| Profile | Decision | Basis |
|---|---|---|
| 5B-H1 | ACCEPT | Coherent Nrf2-ARE cytoprotective axis; cleanly tiered evidence. |
| 5B-H2 | ACCEPT | Distinct inhibitory NF-κB axis, same context; exercises inhibition semantics. |
| 5B-M1 | ACCEPT | Second species/disease survival axis; exercises the no-silent-transfer rule. |
| 5B-H3 | DEFER | Would require crosstalk edges beyond available evidence; feedback/crosstalk NOT REPORTED in 5B.1. |
| 5B-R1 | NOT REPORTED | No rat cellular signaling evidence; empty profile is the honest state. |
