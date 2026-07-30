# Profile-B Simulator — Phase 7B Implementation Report

**Tumor Vasculature & Angiogenesis Runtime**

Phase 7B introduces the **active vascular component** of the tumour microenvironment. Where
Phase 7A represented passive extracellular transport barriers, Phase 7B introduces blood-vessel
architecture and its influence on oxygen / nutrient delivery and drug accessibility. It is
**not** an immune, metastasis, or fibroblast phase — only vascular architecture and angiogenic
adaptation. The objective is to explain why tumours with identical ECM properties may still show
different therapeutic responses because vascular supply, oxygen delivery, and perfusion differ.

```
… → passive tumour microenvironment → TUMOUR VASCULATURE → perfusion → oxygen supply
  → nutrient availability → drug delivery modifier → interstitial transport → (downstream) → STOP
```

## Core principle
Blood vessels do **not** activate signalling and do **not** induce apoptosis. They **modify**
oxygen availability, nutrient availability, drug accessibility, and penetration opportunity —
only these effects are permitted. The engine's delivery modifier is **advisory**
(`modifiesDelivery: true`, `modifiesSignalling: false`, `inducesApoptosis: false`,
`remodels: false`); it never mutates an upstream engine.

## Scope discipline (what Phase 7B is and is NOT)

**IS:** vascular architecture, vessel hierarchy / density / maturity / organization, angiogenic
state, perfusion, oxygen + nutrient supply, a vascular permeability abstraction, and a
nanoparticle-delivery modifier — all schematic ordinal / 0–1.

**IS NOT:** macrophages / dendritic / NK / T / B cells, CAFs / fibroblasts, ECM remodeling,
collagen synthesis, MMP activity, lymphatics, metastasis / invasion / intravasation /
extravasation, vascular inflammation, coagulation / thrombosis, immune trafficking, VEGF
molecular signalling, HIF-1α transcriptional regulation, and endothelial signalling cascades.
These stay `NOT_EVALUATED`.

## What was added

### Engine + objects (Part 1)
- `vascularEngine.js` — deterministic, registry-driven, evidence- and prediction-aware,
  tumour-model / formulation / species aware. Combines vessel density, perfusion, oxygen +
  nutrient supply, and permeability into a schematic **delivery modifier** `[floor,1]` + ordinal
  delivery state (`poor_delivery … excellent_delivery`). Optionally reads the Phase-7A
  microenvironment engine **read-only** for a combined delivery × penetration view.
- `vascularObjects.js` — VesselState, VascularNetwork, PerfusionState, OxygenSupply,
  NutrientEnvironment, PermeabilityState, DeliveryModifier, VascularState.

### Nine registries (Part 1)
`vascular-context`, `angiogenesis`, `perfusion`, `oxygen-supply`, `nutrient`, `permeability`,
`delivery`, `vascular-evidence`, `vascular-prediction`. No behaviour hardcoded in engine source.

### Evidence vocabulary (Part 1, additive)
`VASCULAR_EVIDENCE_LEVELS` (8 tiers, **no experimental tier** — the frozen package has no direct
tumour-vasculature dataset) + classifiers. `config.vascularSources`.

### Part 2 additions
- **Engine:** `getTimeline()` (eight vascular-evaluation milestones) + `validate()` (registry +
  consistency: required fields, species / tumour / formulation compatibility, prediction
  labelling, evidence completeness, component-variant existence, registry-driven support-list
  checks, oxygen/perfusion coherence, no rat fallback).
- **Renderer:** `setVascularEngine` + headless `lastVascularFrame` + a schematic paint block
  (simplified branching vessels whose count/amplitude track density and opacity tracks maturity,
  a perfusion tint, and a drug-delivery path whose strength tracks the delivery modifier). No
  endothelial cells / blood cells / capillary ultrastructure / flow vectors.
- **Animator:** steps the vascular layer (static field; step advances its clock, replay-safe).
- **main.js:** constructs the engine (passing the Phase-7A engine for the combined view), wires
  the renderer, exposes `app.vascular` (incl. `timeline()`, `validate()`, `setTumourModel`,
  `setFormulation`, `deliveryModifier()`), and rebuilds it on `app.setSpecies`.
- **Evidence panel:** a **sixteenth** section (Tumor Vasculature & Angiogenesis) exposing each
  modifier's evidence / prediction status, confidence, species, tumour model, supporting
  literature, uncertainty, limitations, and excluded biology — with immune / VEGF / HIF /
  metastasis = `NOT_EVALUATED`.
- **types/vascular.ts** — full contract (checked by `tsc --noEmit`).
- **Tests:** `vascular.test.mjs` (registered) — 108 new assertions.

## Behaviour summary
- **Mouse B16BL6 (MECHANISTIC_PREDICTION, default):** abnormal melanoma vasculature — highly
  vascularized but immature/chaotic, poorly perfused, leaky (high permeability). The tumour
  paradox (high density + high permeability offset by poor perfusion + immaturity) yields a
  moderate delivery modifier.
- **Human:** predictive-exploratory with its **own distinct** values (moderately vascularized,
  developing, moderate perfusion) — not copied from mouse; carries the mandated non-clinical
  warning.
- **Rat:** `NOT_REPORTED` → idle. Deterministic; static vascular field.

## Quality control
- Full simulator suite: **2203 passed, 0 failed** (108 new). `tsc --noEmit` clean. JSON valid
  (9 registries). Hidden / zero-width + model-id scans clean. Production diff vs `origin/main`
  empty. Production tests: 99 JS + 31 R green.

## Documentation set
`profile-b-simulator-phase7b-implementation.md` (this file), `vascular-runtime-architecture.md`,
`tumor-vasculature-model.md`, `vascular-evidence-review.md`, `vascular-prediction-policy.md`,
`vascular-registry-guide.md`, `vascular-renderer-guide.md`, `vascular-validation-report.md`,
`phase7b-developer-notes.md`, `vascular-limitations.md`, plus `CHANGELOG.md` and architecture /
README / portfolio / prediction-framework / evidence-architecture updates.
