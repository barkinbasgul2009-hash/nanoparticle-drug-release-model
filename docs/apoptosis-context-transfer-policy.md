# Apoptosis Context-Transfer Policy (Phase 6B)

Phase 6B is the first phase to make a **context-transfer prediction** its default runtime.
This document explains why, and the rules that keep the transfer explicit and honest.

## The tension

- The project's **canonical mouse line is B16BL6**.
- The **strongest celastrol apoptosis mechanism evidence** in the frozen package is in the
  **B16** line (ROS, Bax/Bcl-2 shift, cytochrome-c, AIF, caspase/PARP, partial caspase
  dependence, AIF knockdown, PI3K axis).

Silently running the B16 mechanism *as if* it were B16BL6 data would be a fabrication. Simply
ignoring it and marking B16BL6 `NOT_REPORTED` would discard directly relevant same-species,
same-tumour-type mechanism evidence.

## The resolution: an explicit context transfer

`mouse_b16bl6_apoptosis` is modelled as a **`CONTEXT_TRANSFER_PREDICTION`**, the default
mouse runtime, and it carries a transfer record:

```
apop_transfer_b16_to_b16bl6 :  source_cell_model = B16  →  target_cell_model = B16BL6
```

The transfer record documents the shared biological features (same species, melanoma lineage,
shared intrinsic apoptotic machinery) and the uncertain differences (B16 vs B16BL6 are
distinct sublines; celastrol potency and exact branch balance in B16BL6 are not directly
reported). The runtime frame flags `contextTransfer: true` and the evidence panel shows the
level as `CONTEXT_TRANSFER_PREDICTION`, never as experimental.

## Separate, selectable experimental profiles

B16 and B16-F10 remain **separate experimental profiles**, selectable with
`app.apoptosis.setCellModel('B16')` / `setCellModel('B16-F10')`:

- `mouse_b16_apoptosis` — `EXPERIMENTAL_DRUG_CELL_SPECIFIC`
- `mouse_b16f10_apoptosis` — `EXPERIMENTAL_DRUG_CELL_SPECIFIC` (also carries the
  PI3K-activator intervention)

Selecting a cell model rebuilds the engine from that profile only. The three mouse lines
never mix: the default B16BL6 transfer never adopts B16-F10's PI3K intervention, and neither
experimental profile borrows the other's records.

## No-silent-mixing rule (enforced)

`validate()` enforces:

- an `EXPERIMENTAL_*` profile must cite at least one verified record for **its own** cell
  model;
- a `CONTEXT_TRANSFER_PREDICTION` profile must carry a transfer record with **distinct**
  source and target cell models;
- **no profile may reference evidence for a different cell model unless it is explicitly a
  transfer** — a B16BL6 profile referencing a B16 record without the transfer label is a
  validation error.

## Other species

- **Human HaCaT** and **rat** apoptosis are `NOT_REPORTED` → idle. They are *not* upgraded to
  predictions. `NOT_REPORTED` stays `NOT_REPORTED`.

## Canonical mapping

`_canonicalCellModel(species)` maps `mouse → B16BL6`, `human → HaCaT`, `rat → ex_vivo_skin`.
So selecting the mouse species yields the B16BL6 context-transfer runtime by default, while
the experimental B16 / B16-F10 profiles remain one `setCellModel` call away.

## Why this matters

This policy is the template for every later phase that must reconcile "canonical line" with
"line where the mechanism was actually measured": transfer, don't fabricate; label the
transfer; keep the experimental sources separate and selectable; and never let
`NOT_REPORTED` drift into a prediction.
