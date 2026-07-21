# Microenvironment Limitations (Phase 7A)

Phase 7A is a deliberately narrow, passive layer. This document states plainly what it does
**not** include, so no reader mistakes the schematic passive environment for a full tumour
microenvironment model.

## The microenvironment is a passive abstraction

- It represents only the **dominant passive** physical / biochemical factors known to influence
  nanoparticle transport — not complete tumour histology.
- Every value is a **schematic** ordinal state or a normalized 0–1 value. **No** real ECM fibre
  density, collagen mass, interstitial pressure, oxygen concentration (pO₂), absolute diffusion
  coefficient, or penetration rate is claimed (all `NOT_REPORTED`).
- It **modifies** penetration; it never **replaces** an upstream engine, alters upstream logic, or
  touches intracellular signalling.

## Evidence limitations

- The frozen package contains **no direct TME dataset** for this context, so there is **no
  experimental tier**: every active microenvironment relationship is a labelled prediction
  (general tumour-ECM / hypoxia biology).
- Mouse B16BL6 is a `MECHANISTIC_PREDICTION`; human is a predictive-exploratory prediction with
  its own distinct values and a non-clinical warning; rat is `NOT_REPORTED` (idle).

## Explicitly excluded (intentionally NOT in Phase 7A)

Immune cells (macrophages, dendritic, NK, T, B), fibroblasts, CAFs, ECM remodeling, matrix
metalloproteinases, collagen synthesis / degradation, angiogenesis, blood vessels / vasculature,
vascular leakage, drug clearance, cytokines / chemokines, VEGF signalling, checkpoint inhibition,
immune killing / suppression, metastasis, invasion, migration, lymphatics, systemic circulation,
systemic PK, and clinical outcomes. These stay `NOT_EVALUATED` and belong to later phases.

## Model limitations

- The passive field is **static** per context (no interstitial-flow / CFD / fluid-dynamics
  solver); it does not evolve over time.
- Hypoxia is a **passive modifier** only; it does not activate HIF-1α or any signalling pathway in
  Phase 7A.
- The penetration modifier is **advisory** — Phase 7A exposes it but does not force upstream
  transport / uptake engines to consume it (that would alter upstream logic).

## Future extensions

Phase 7B and later may build **active** microenvironment biology (immune, vascular, remodeling)
and may let downstream engines consume the penetration modifier — as **new** layers reading this
one read-only. Until then, the passive penetration modifier is the end of this layer's scope.
