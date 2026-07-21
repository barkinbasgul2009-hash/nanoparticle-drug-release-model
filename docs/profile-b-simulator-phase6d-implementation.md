# Profile-B Simulator — Phase 6D Implementation Report

**Tumor Growth, Regression & Treatment-Response Runtime**

Phase 6D extends the Profile-B chain from population composition (Phase 6C) to a **schematic
tumour-level treatment response**. It is the first phase that represents a tumour-level
response — but it is **not** a clinical-response phase. It reads the Phase-6C population
read-only and derives a normalized virtual tumour burden and a treatment-response trajectory.

```
… → population composition → viable tumour-cell burden → growth pressure vs loss pressure
  → treatment-response trajectory → growth / stabilization / regression / rebound → STOP
```

## Scope discipline (what Phase 6D is and is NOT)

**IS:** virtual tumour-cell burden (normalized `[0, upper]`, baseline 1.0), viable / apoptotic
/ terminal fractions, growth pressure, loss pressure, net growth pressure, schematic growth /
stabilization / regression / rebound, treatment on/off + repeated schematic treatment,
formulation comparison (cationic / anionic / neutral NLC, free tripterine, vehicle), untreated
control, population-to-tumour coupling, evidence + prediction labels, uncertainty, and strict
species / cell-model / formulation isolation.

**IS NOT** (Phase 7+ or permanently out of scope): human clinical response, patient-level
prediction, RECIST, survival analysis, metastasis, invasion, angiogenesis, vascular
remodelling, immune recruitment / clearance, lymphatics, systemic circulation, organ
distribution, liver metabolism, renal clearance, PBPK, clinical PK, toxicity, adverse events,
therapeutic index, dose recommendation, personalized medicine, clinical decision support.

Every frame reports `clinicalResponseEvidence` / `survivalEvidence` / `recistEvidence` /
`metastasisEvidence` / `immuneEvidence` / `pkEvidence` = `NOT_EVALUATED`. Burden is normalized
schematic — **never** mm³, diameter, weight, cellularity, or a RECIST measurement.

## What was added

### Engine + objects
- `simulator/src/biology/tumorResponseEngine.js` — `TumorResponseEngine`. Reads the Phase-6C
  `PopulationEngine` (composition + history) read-only + eight Phase-6D registries.
  Deterministic (no RNG — no uncontrolled random growth/regression). Population-gated.
- `simulator/src/biology/tumorObjects.js` — `TumorBurdenState`, `TumorGrowthPressure`,
  `TumorLossPressure`, `TumorTreatmentEvent` (`TumorResponseState` is a string FSM state).

### Registries (eight, all under `simulator/data/`)
`tumor-context`, `tumor-model`, `tumor-response`, `tumor-transitions`, `tumor-formulation`,
`tumor-treatment`, `tumor-evidence`, `tumor-prediction`. No tumour parameter is hardcoded in
runtime source.

### Evidence vocabulary (additive)
`evidenceEngine.js` gains `TUMOR_EVIDENCE_LEVELS` (11 tiers, including
`EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC` and `CONTEXT_TRANSFER_PREDICTION`) + `isTumorExperimental`,
`isTumorPrediction`, `isTumorTransfer`, `tumorLevelActive`. Earlier arrays unchanged.

### Wiring + surfaces
- `types/tumor.ts` — full TypeScript contract (`TumorContext`, `TumorModelProfile`,
  `TumorBurdenState`, `TumorGrowthPressure`, `TumorLossPressure`, `TumorResponseState`,
  `TumorTreatmentEvent`, `TumorFormulationProfile`, `TumorFrame`, `TumorTimelineEvent`,
  `TumorEvidenceRecord`, `TumorPredictionRecord`, `TumorResponseCurve`, `TumorValidationRecord`,
  `TumorUncertaintyRecord`), checked by `tsc --noEmit`.
- `config/app.config.js` — `tumorSources` + `tumor.dtHours`.
- `render/canvasRenderer.js` — `setTumorEngine` + headless `lastTumorFrame` + a **restrained**
  paint block (relative-burden bar with a viable/apoptotic partition, baseline tick,
  treatment-on indicator, and a normalized response curve). No realistic tumour / blood /
  necrotic debris / clinical scan / sensational imagery.
- `biology/transportAnimator.js` — steps the tumour layer **after** population.
- `main.js` — constructs the engine, wires the renderer, exposes the `app.tumor` facade
  (incl. `history()`, `responseCurve()`, `setFormulation`, `setSchedule`, `setTreatment`), and
  rebuilds it on `app.setSpecies`.
- `ui/panels/anatomyPanels.js` — a **fourteenth** evidence-panel section (Tumor Growth &
  Treatment Response) with clinical / survival / RECIST / metastasis / immune / PK =
  `NOT_EVALUATED`.

### Tests
`simulator/tests/tumor.test.mjs` (registered in `tests/run.mjs`).

## Behaviour summary
- **Mouse B16BL6 + cationic NLC (default, EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC):** untreated
  growth → treatment → gradual regression → minimal-residual-burden floor (not zero). Untreated
  control grows above baseline; treat-then-stop rebounds.
- **B16 / B16-F10:** separate selectable experimental contexts (free tripterine).
- **Human:** predictive-exploratory / **UNAVAILABLE** at runtime (no active human melanoma
  population; carries the required non-clinical warning). **Rat:** `NOT_REPORTED`.
- Deterministic history, timeline, and response curve.

## Quality control
- Full simulator suite: **1985 passed, 0 failed**. `tsc --noEmit`: clean. JSON valid (8
  registries). Hidden / zero-width + model-id scans clean. Production diff vs `origin/main`
  empty. Production tests: 99 JS + 31 R green.

## Documentation set
`profile-b-simulator-phase6d-implementation.md` (this file),
`tumor-response-runtime-architecture.md`, `tumor-growth-regression-model.md`,
`tumor-response-evidence-review.md`, `formulation-response-profiles.md`,
`tumor-prediction-framework.md`, `tumor-context-transfer-policy.md`,
`phase6d-validation-report.md`, `phase6d-animation-specification.md`,
`phase6d-developer-notes.md`, `tumor-response-limitations.md`, plus architecture / README /
portfolio / prediction-framework / evidence-architecture updates.
