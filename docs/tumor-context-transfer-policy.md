# Tumor Context-Transfer Policy (Phase 6D)

Phase 6D reconciles independent cell-model contexts and a human extrapolation without ever
merging evidence silently.

## Cell-model independence (B16 / B16BL6 / B16-F10)

The three mouse melanoma lines are **independent tumour-response contexts**:

- **B16BL6** — the canonical line and the Phase-6D default. Its tumour-level evidence is the
  strongest: the Chen 2012 in vivo antimelanoma PD + surface-charge formulation ranking. It is
  labelled `EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC`. Note this differs from Phases 6B/6C, where
  B16BL6 was a *context transfer* from B16 (the apoptosis mechanism was measured in B16): at the
  **tumour** level the PD evidence is directly in B16BL6, so B16BL6 is experimental here.
- **B16** — separate, `EXPERIMENTAL_DRUG_CELL_SPECIFIC` (free-celastrol growth inhibition +
  apoptosis, qualitative). Parameters are never copied into B16BL6.
- **B16-F10** — separate, `EXPERIMENTAL_DRUG_CELL_SPECIFIC` (viability / proliferation / apoptosis
  / cell-cycle, qualitative).

`validate()` enforces **no silent cell-model mixing**: a profile may reference only its own cell
model's evidence unless it is explicitly a `CONTEXT_TRANSFER_PREDICTION` with a transfer record.
The B16BL6 formulation ranking is not transferred to B16 / B16-F10.

## Human extrapolation

No validated human melanoma tumour response is inferred from mouse studies. The canonical human
context is **HaCaT** (a keratinocyte, cytoprotective — its apoptosis and population are
`NOT_REPORTED`), so there is **no active human melanoma population**. Because the tumour engine
is population-gated, the human tumour profile is **UNAVAILABLE at runtime**. The profile
documents a predictive-exploratory intent (`prediction_level: MECHANISTIC_PREDICTION`,
`default_shown: false`) and carries the mandated warning, plus a context-transfer *note*
(`tum_transfer_b16bl6_to_human_note`) recording that any human view is a mechanistic
extrapolation, never a validated clinical claim. No mouse parameter is silently copied; no human
`EXPERIMENTAL` label is ever produced (validator-enforced).

## Rat

Rat data support skin permeation only; there is no rat melanoma tumour evidence, so rat is
`NOT_REPORTED` and has no default tumour model. `validate()` rejects any available rat tumour
profile — no rat fallback.

## Why this matters

The policy is the template for reconciling "canonical line", "line where the effect was measured",
and "species we cannot yet claim": keep contexts independent, ground the default in the line
where the tumour-level effect actually exists, label every cross-context extrapolation as a
transfer with a record, and keep unsupported contexts (`NOT_REPORTED` / `UNAVAILABLE`) honest —
never upgraded to experimental or clinical claims.
