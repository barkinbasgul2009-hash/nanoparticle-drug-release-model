# Vascular Limitations (Phase 7B)

Phase 7B is a deliberately narrow, advisory layer. This document states plainly what it does
**not** include, so no reader mistakes the schematic vasculature for a full vascular model.

## The vasculature is a schematic abstraction

- It represents only the **dominant vascular characteristics** known to affect drug delivery — not
  complete vascular anatomy.
- Every value is a **schematic** ordinal state or a normalized 0–1 value. **No** real vessel count,
  blood flow, oxygen partial pressure (pO₂), vascular diameter, or perfusion rate is claimed (all
  `NOT_REPORTED`).
- Vessels **modify** oxygen / nutrient / drug accessibility / penetration opportunity; they never
  **signal**, induce apoptosis, remodel, or alter upstream logic.

## Evidence limitations

- The frozen package contains **no direct tumour-vasculature dataset**, so there is **no
  experimental tier**: every active vascular relationship is a labelled prediction (general
  tumour-vasculature biology).
- Mouse B16BL6 is a `MECHANISTIC_PREDICTION`; human is a predictive-exploratory prediction with its
  own distinct states and a non-clinical warning; rat is `NOT_REPORTED` (idle).

## Explicitly excluded (intentionally NOT in Phase 7B)

Immune cells (macrophages, NK, T, B), fibroblasts, cancer-associated fibroblasts (CAFs), ECM
remodeling, VEGF molecular signalling, HIF-1α transcriptional regulation, vascular inflammation,
coagulation / thrombosis, immune trafficking, endothelial signalling cascades, lymphatics,
metastasis, invasion, intravasation / extravasation, drug clearance, systemic PK, and clinical
outcomes. These stay `NOT_EVALUATED` and belong to later phases.

## Model limitations

- The vascular field is **static** per context (no blood-flow / CFD / rheology solver); it does not
  evolve over time.
- Vessel architecture is ordinal (density / branching / maturity / organization) — no individual
  endothelial cells, capillary ultrastructure, or blood pressure.
- Permeability is an abstracted leakiness (EPR-style) — no endothelial-junction or pore-size model.
- Vascular oxygen supply is represented independently from the Phase-7A ECM oxygen field; the two
  are not merged into a single oxygen value in Phase 7B.
- The delivery modifier is **advisory** — Phase 7B exposes it (and a combined delivery × penetration
  with Phase 7A read-only) but does not force upstream transport / uptake engines to consume it.

## Future extensions

Phase 7C and later may build **active** vascular biology (VEGF/HIF signalling, vascular
inflammation, immune trafficking, remodeling, lymphatics, metastasis) and may let downstream
engines consume the delivery modifier — as **new** layers reading this one read-only. Until then,
the vascular delivery modifier is the end of this layer's scope.
