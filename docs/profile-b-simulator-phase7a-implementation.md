# Profile-B Simulator — Phase 7A Implementation Report

**Passive Tumor Microenvironment (TME) Runtime**

Phase 7A introduces the first Tumor Microenvironment layer. It is **not** an immune,
angiogenesis, or metastasis phase. It models only the **passive** physical / biochemical
environment surrounding tumour cells that **modifies** drug transport, penetration, oxygen
availability, and mechanical resistance — explaining why identical formulations may produce
different outcomes in different environments. The microenvironment is a **passive modulator**:
it does not kill cells, generate immune responses, or perform signalling.

```
… → skin penetration → PASSIVE TUMOUR MICROENVIRONMENT → interstitial transport
  → ECM barrier → oxygen environment → drug penetration modifier → (downstream unchanged) → STOP
```

## Core principle
The microenvironment **modifies** transport / uptake / penetration — it never **replaces** an
upstream engine, never alters upstream biological logic, and never directly modifies
intracellular signalling. Its penetration modifier is an **advisory** output (effective drug
availability); applying it downstream is deferred and never mutates upstream engines.

## Scope discipline (what Phase 7A is and is NOT)

**IS:** extracellular matrix (collagen / hyaluronic acid / proteoglycan / fluid), interstitial
space + extracellular diffusion resistance, passive transport barriers, tumour stiffness /
density, a passive oxygen field + hypoxia, oxygen diffusion, a drug-penetration modifier, and
tumour heterogeneity descriptors — all schematic ordinal / 0–1.

**IS NOT:** macrophages / dendritic / NK / T / B cells, cytokines / chemokines, VEGF /
angiogenesis, fibrosis / ECM remodeling, collagen synthesis-degradation, fibroblasts / CAF /
MMPs, immune killing / suppression / checkpoint, metastasis / invasion, lymphatics, vascular
leakage, systemic circulation. These stay `NOT_EVALUATED`.

## What was added (Part 1 + Part 2)

### Engine + objects (Part 1)
- `microenvironmentEngine.js` — deterministic, registry-driven, evidence- and prediction-aware,
  species / tumour-model / formulation aware. Computes passive ECM / diffusion / mechanical /
  oxygen / hypoxia resistances and combines them into a single schematic **penetration
  modifier** `[floor,1]` + an ordinal microenvironment state (`permissive …
  extremely_restrictive`).
- `microenvironmentObjects.js` — ECMState, CollagenNetwork, InterstitialSpace, DiffusionBarrier,
  OxygenEnvironment, HypoxiaState, MechanicalBarrier, PenetrationModifier, MicroenvironmentState.

### Nine registries (Part 1)
`microenvironment-context`, `ecm`, `diffusion`, `mechanical`, `oxygen`, `hypoxia`,
`penetration`, `microenvironment-evidence`, `microenvironment-prediction`. No behaviour
hardcoded in engine source.

### Evidence vocabulary (Part 1, additive)
`MICROENVIRONMENT_EVIDENCE_LEVELS` (8 tiers, **no experimental tier** — the frozen package has
no direct TME dataset) + classifiers. Earlier arrays unchanged. `config.tmeSources` (key
distinct from the frozen Phase-4B `microenvironmentSources`).

### Part 2 additions
- **Engine:** `getTimeline()` (eight passive-evaluation milestones) + `validate()` (registry +
  consistency: required fields, species / tumour validity, prediction labelling, evidence
  completeness, component-variant existence, oxygen/hypoxia coherence, dense-ECM-not-permissive).
- **Renderer:** `setMicroenvironmentEngine` + headless `lastMicroenvironmentFrame` + a schematic
  paint block (ECM mesh whose spacing/opacity track density, an oxygen/hypoxia darkening
  overlay, and a drug-penetration path that is direct when permissive and tortuous when
  restrictive). No photorealism / vasculature / immune cells.
- **Animator:** steps the passive layer (static field; step advances its clock, replay-safe).
- **main.js:** constructs the engine, wires the renderer, exposes `app.microenvironment` (incl.
  `timeline()`, `validate()`, `setTumourModel`, `setFormulation`, `penetrationModifier()`), and
  rebuilds it on `app.setSpecies`.
- **Evidence panel:** a **fifteenth** section (Passive Tumor Microenvironment) exposing each
  modifier's evidence / prediction status, confidence, species, tumour model, supporting
  literature, uncertainty, limitations, and excluded biology — with immune / vascular /
  remodeling / metastasis = `NOT_EVALUATED`.
- **types/microenvironment.ts** — full contract (checked by `tsc --noEmit`).
- **Tests:** `microenvironment.test.mjs` (registered) — 110 new assertions.

## Behaviour summary
- **Mouse B16BL6 (MECHANISTIC_PREDICTION, default):** moderately dense, hyaluronic-acid-rich,
  moderately hypoxic melanoma TME → a restrictive microenvironment with a reduced penetration
  modifier.
- **Human:** predictive-exploratory with its **own distinct** values (collagen-rich dermis) — not
  copied from mouse; carries the mandated non-clinical warning.
- **Rat:** `NOT_REPORTED` → idle. Deterministic; static passive field.

## Quality control
- Full simulator suite: **2095 passed, 0 failed** (110 new). `tsc --noEmit` clean. JSON valid
  (9 registries). Hidden / zero-width + model-id scans clean. Production diff vs `origin/main`
  empty. Production tests: 99 JS + 31 R green.

## Documentation set
`profile-b-simulator-phase7a-implementation.md` (this file),
`microenvironment-runtime-architecture.md`, `passive-microenvironment-model.md`,
`microenvironment-evidence-review.md`, `microenvironment-prediction-policy.md`,
`microenvironment-registry-guide.md`, `microenvironment-renderer-guide.md`,
`microenvironment-validation-report.md`, `phase7a-developer-notes.md`,
`microenvironment-limitations.md`, plus `CHANGELOG.md` and architecture / README / portfolio /
prediction-framework / evidence-architecture updates.
