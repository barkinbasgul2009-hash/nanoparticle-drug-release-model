# Profile-B Simulator — Phase 6C Implementation Report

**Cell Population Response & Tissue-Level Dynamics**

Phase 6C extends the Profile-B mechanistic chain from single-cell apoptosis (Phase 6B) to
the **population level** — the first phase where the simulator reasons about many cells at
once. It answers *"what fraction of cells have entered each state?"*, not *"what happens to
one cell?"*. It invents no new intracellular biology; it reads the Phase-6B single-cell
apoptosis trajectory read-only and derives a **schematic virtual population**.

```
… → apoptosis (6B) → population viability → population composition
  → population state evolution → population history → STOP
```

## Scope discipline (what Phase 6C is and is NOT)

**IS:** living / apoptotic / adapted / recovered accounting as **normalized fractions**,
cumulative apoptosis, a strict population state machine, population recovery + adaptation,
deterministic replay history, renderer, timeline, evidence panel, prediction labels, and
strict species / cell-model isolation.

**IS NOT** (deferred to Phase 6D+ or permanently out of scope): tumour response / size /
volume / growth / shrinkage / regression / growth-inhibition, RECIST, survival, immune
recruitment / clearance, macrophages / dendritic cells / T cells, cytokines, angiogenesis /
vascular response, fibrosis, wound healing, proliferation kinetics, cell cycle, mitosis,
necrosis, invasion, metastasis, organ toxicity, PK, PD efficacy, clinical response, patient
outcome.

The population is a **conceptual abstraction**: population size is schematic, fractions are
normalized `[0,1]` simulation values, and **no biological cell count / density / cellularity
is ever claimed**. Every frame reports `tumourResponseEvidence` / `survivalEvidence` /
`clinicalOutcomeEvidence` = `NOT_EVALUATED`.

## What was added (Part 1 + Part 2)

### Engine + object
- `simulator/src/biology/populationEngine.js` — `PopulationEngine`. Reads the Phase-6B
  `ApoptosisEngine` + Phase-6C registries **read-only**; modifies nothing upstream.
  Deterministic (no RNG). Computes normalized fractions, runs the strict population FSM,
  records deterministic replay history, emits the timeline, and self-validates.
- `simulator/src/biology/populationObjects.js` — `PopulationState` (normalized fractions
  only).

### Registries (six, all under `simulator/data/`)
- `population-context.registry.json` — per-species/cell-model profiles.
- `population-state.registry.json` — state vocabulary + composition→state thresholds +
  fraction semantics.
- `population-transitions.registry.json` — the FSM (legal transitions + irreversible /
  recoverable sets) + deterministic dynamics defaults.
- `population-evidence.registry.json` — evidence records (all `citation: NOT_REPORTED`,
  qualitative) + a B16→B16BL6 transfer record.
- `population-prediction.registry.json` — labelled prediction records.
- `population-interventions.registry.json` — upstream-applied intervention echo policy (no
  population-only intervention; effects arrive via the single-cell trajectory).

### Evidence vocabulary (additive)
`evidenceEngine.js` gains `POPULATION_EVIDENCE_LEVELS` (8 tiers, **predictions +
not-reported only — no experimental tier**) + `isPopulationEvidenceLevel`,
`isPopulationPrediction`, `isPopulationTransfer`, `populationLevelActive`. Every earlier
evidence array is unchanged.

### Wiring + surfaces
- `types/population.ts` — full TypeScript contract (`PopulationProfile`, `PopulationState`,
  `PopulationFrame`, `PopulationTimelineEvent`, `PopulationEvidenceRecord`,
  `PopulationPredictionRecord`, `PopulationRendererState`, `PopulationHistory`,
  `PopulationStatistics`, `PopulationValidationRecord`), checked by `tsc --noEmit`.
- `config/app.config.js` — `populationSources` + `population.dtHours`.
- `render/canvasRenderer.js` — `setPopulationEngine` + headless `lastPopulationFrame` and a
  **restrained** paint block: a stacked composition bar (living green / adaptive cyan /
  recovered blue / apoptotic orange) + an apoptotic-fraction history sparkline. No blood /
  explosions / dead-body graphics.
- `biology/transportAnimator.js` — steps the population layer **after** apoptosis.
- `main.js` — constructs the engine, wires the renderer, exposes the `app.population` facade
  (incl. `history()`), and rebuilds it on `app.setSpecies`.
- `ui/panels/anatomyPanels.js` — a **thirteenth** evidence-panel section (Population
  Response) with tumour / survival / clinical outcome = `NOT_EVALUATED`.

### Tests
`simulator/tests/population.test.mjs` (registered in `tests/run.mjs`).

## Behaviour summary

- **Mouse (default B16BL6, CONTEXT_TRANSFER_PREDICTION):** as the single (context-transferred)
  cell commits and executes apoptosis, a susceptible sub-population accumulates apoptosis
  (bounded by a resistant ceiling) while surviving cells may adapt or recover. The population
  traverses `healthy → minimal_response → adaptive_response → partial_response →
  mixed_population → apoptosis_accumulating → apoptosis_dominant → stable_terminal_state`.
- **B16 / B16-F10:** selectable, separate MECHANISTIC_PREDICTION profiles.
- **Human HaCaT & rat:** `NOT_REPORTED` → idle (no fallback).
- **Determinism:** identical inputs give identical fractions, history, and timeline.

## Quality control
- Full simulator suite (`node simulator/tests/run.mjs`): **1916 passed, 0 failed**.
- `npx tsc --noEmit` (from `simulator/`): clean.
- JSON validity (all six registries): valid. Hidden / zero-width scan: clean. Model-id scan:
  clean.
- Production diff vs `origin/main` (`web/`, `R/`, `app/`, `tests/`, CI): **empty**.
- Production tests: 99 JS + 31 R, all green.

## Documentation set
`profile-b-simulator-phase6c-implementation.md` (this file),
`population-runtime-architecture.md`, `population-response-model.md`,
`population-evidence-review.md`, `population-prediction-policy.md`,
`population-state-machine.md`, `population-validation-report.md`,
`population-animation-specification.md`, `population-developer-notes.md`,
`population-limitations.md`, plus architecture / README / portfolio / prediction-framework /
evidence-architecture updates.
