# Apoptosis Evidence Review (Phase 6B)

This review states, honestly, what the frozen Profile-B evidence package supports about
celastrol-induced apoptosis, what is transferred, and what is simply not reported. **No
scientific value or DOI is fabricated.** Every apoptosis evidence record carries
`citation: NOT_REPORTED` and captures only *qualitative* relationships.

## Evidence vocabulary (additive, 11 tiers)

`APOPTOSIS_EVIDENCE_LEVELS` in `evidenceEngine.js`:

```
EXPERIMENTAL_FORMULATION_SPECIFIC     (strongest — this drug + formulation + cell)
EXPERIMENTAL_DRUG_CELL_SPECIFIC       (this drug + this cell model)
EXPERIMENTAL_PATHWAY_SPECIFIC         (this pathway, drug/cell context)
HIGH_CONFIDENCE_PREDICTION
LITERATURE_DERIVED_PREDICTION
MECHANISTIC_PREDICTION
CONTEXT_TRANSFER_PREDICTION           (extrapolated across cell models)
HYPOTHESIS
NOT_REPORTED
UNAVAILABLE
CONTRADICTORY_EVIDENCE
```

Earlier phase vocabularies (transport → 6A) are unchanged; this array is purely additive.

## Per-cell-model evidence

### B16 (mouse melanoma) — `EXPERIMENTAL_DRUG_CELL_SPECIFIC`
The strongest celastrol apoptosis mechanism evidence in the package concerns the **B16**
line. The qualitative relationships captured (each a `VERIFIED_PRIMARY_STUDY` record with a
`NOT_REPORTED` citation string, i.e. the relationship is asserted qualitatively, not with a
fabricated numeric source):

- oxidative stress / ROS involvement (`apop_b16_ros`)
- a pro-apoptotic Bax/Bcl-2 shift (`apop_b16_bax_bcl2`)
- cytochrome-c release (`apop_b16_cytc`)
- **AIF** involvement (`apop_b16_aif`) — i.e. a caspase-independent component
- caspase activation and PARP cleavage (`apop_b16_caspase`, `apop_b16_parp`)
- **partial** caspase dependence (`apop_b16_partial_caspase`) — caspase inhibition does not
  abolish death, consistent with a parallel AIF branch
- AIF knockdown attenuation (`apop_b16_aif_knockdown`)
- a survival/PI3K axis (`apop_b16_pi3k`)

No rate, percentage, IC50, caspase-activity fold change, or ΔΨm value is claimed; those are
`NOT_REPORTED`.

### B16-F10 (mouse melanoma) — `EXPERIMENTAL_DRUG_CELL_SPECIFIC` (separate profile)
A separate experimental profile with its own qualitative records (`apop_b16f10_*`),
including a PI3K/survival axis that is exposed as the **PI3K-activator** intervention. B16-F10
is kept **strictly separate** from B16 — no record is silently shared.

### B16BL6 (mouse melanoma) — `CONTEXT_TRANSFER_PREDICTION` (default mouse runtime)
B16BL6 is the project's canonical mouse line, but the strongest mechanism evidence is in
B16. Rather than silently reuse B16 data, B16BL6 is an **explicit context-transfer
prediction**: it carries a transfer record (`apop_transfer_b16_to_b16bl6`, B16 → B16BL6) and
is labelled `CONTEXT_TRANSFER_PREDICTION`. See `apoptosis-context-transfer-policy.md`.

### Human HaCaT — `NOT_REPORTED`
The package reports HaCaT *uptake*, not a celastrol apoptosis program. HaCaT apoptosis is
therefore `NOT_REPORTED` and the runtime is **idle** (the cell never commits). It is not
converted into a prediction.

### Rat (ex vivo skin) — `NOT_REPORTED`
No apoptosis dataset; idle.

## Integrity rules enforced in `validate()`

- An `EXPERIMENTAL_*` profile must reference at least one record whose
  `verification_status` is `VERIFIED_PRIMARY_STUDY` or `VERIFIED_IN_FROZEN_PACKAGE`.
- A `CONTEXT_TRANSFER_PREDICTION` profile must carry a transfer record with distinct
  source/target cell models.
- **No silent cell-model mixing:** a profile may only reference evidence for its *own* cell
  model unless it is explicitly a transfer.
- A `NOT_REPORTED` profile may not declare `apoptosis_available`.
- No profile field may name a forbidden downstream concept (necrosis, immune, tumour,
  population, PK/PD, viability, …).

## What is deliberately NOT concluded

Nothing about how many cells die, tumour response, tissue effect, immune involvement, or any
clinical outcome. Those are `NOT_EVALUATED` by construction (Phase 6C+ territory).
