# Phase 6D Developer Notes — Tumor-Response Runtime

Practical notes for anyone extending or debugging the tumour layer.

## Files

| File | Role |
|---|---|
| `src/biology/tumorResponseEngine.js` | the engine (burden, pressures, response FSM, history, curve, validate) |
| `src/biology/tumorObjects.js` | runtime objects (burden + growth/loss pressure + treatment event) |
| `data/tumor-context.registry.json` | per-species/cell-model profiles |
| `data/tumor-response.registry.json` | response-state vocabulary + burden semantics + thresholds |
| `data/tumor-transitions.registry.json` | FSM legal transitions + dynamics defaults |
| `data/tumor-model.registry.json` | growth-model architecture + burden defaults |
| `data/tumor-formulation.registry.json` | formulation effect classes + ranking |
| `data/tumor-treatment.registry.json` | treatment schedules + timing types |
| `data/tumor-evidence.registry.json` | evidence + transfer records |
| `data/tumor-prediction.registry.json` | labelled prediction records |
| `src/types/tumor.ts` | TypeScript contract |
| `tests/tumor.test.mjs` | behaviour suite (registered in `tests/run.mjs`) |

## Running things

```
node simulator/tests/run.mjs        # full simulator suite (1985 assertions)
cd simulator && npx tsc --noEmit    # type contract (must run from simulator/)
```

## Construction & controls

The engine needs the eight registries plus the Phase-6C `populationEngine`:

```js
const tum = new TumorResponseEngine({
  contextRegistry, responseRegistry, transitionsRegistry, modelRegistry,
  formulationRegistry, treatmentRegistry, evidenceRegistry, predictionRegistry,
  populationEngine, species: 'mouse',
});
tum.setSpecies('mouse');          // rebuilds; mouse -> canonical B16BL6 + cationic NLC
tum.setCellModel('B16');          // separate B16 profile (free tripterine)
tum.setFormulation('neutral_nlc');// change formulation (rebuilds the trajectory)
tum.setSchedule('untreated_control'); // untreated control (grows)
tum.setTreatment(true);           // manual treatment override (true/false/null=schedule)
tum.step(0.5);                    // one 0.5-h schematic step (call AFTER population.step)
tum.frame(); tum.stats(); tum.getHistory(); tum.getTimeline(); tum.responseCurve(); tum.validate();
```

Every context change — `setSpecies` / `setCellModel` / `setFormulation` / `setSchedule` /
`setTreatment` — calls `_build()`, fully clearing burden, treatment history, response state,
timeline, and history. In the full app the animator steps tumour **after** population, and
`app.setSpecies` cascades to `tumor.engine.setSpecies`.

## The model in one paragraph

Each step reads the population living/apoptotic fractions, resolves the treatment state (schedule
or manual override), computes **growth pressure** (baseline × viability × cycling × (1−suppression)
× resource limitation) and **loss pressure** (apoptotic coupling + scaled treatment-induced loss)
as two distinct paths, forms `net = growth − loss`, updates the bounded non-negative burden (with
a minimal-residual floor), partitions it into viable/apoptotic/terminal, advances the response FSM
one legal step, and appends a history entry. See `tumor-growth-regression-model.md`.

## Gotchas

- **Call order.** Step population first, then tumour — the tumour reads the current population
  drivers. The animator enforces this.
- **Population-gated.** If the population is idle, the tumour is idle. Human / rat are idle because
  their population is idle / NOT_REPORTED.
- **Two distinct treatment paths.** Never collapse growth suppression and loss induction into one
  effect — they enter growth pressure and loss pressure separately.
- **Living fraction ≠ proliferation.** It feeds *viability*, one input among several; don't equate
  it with the growth rate.
- **Strict FSM.** `transitionTo()` throws on illegal transitions. No regression from
  `untreated_growth`; no `cure` state. Regression only after `treatment_started`; rebound only
  after `treatment_ended`.
- **Gradual, bounded, non-negative.** Regression is gradual (bounded per-step change); burden never
  goes negative and holds at the minimal-residual floor rather than zero.
- **Untreated control.** When not treated, population apoptosis does NOT couple to loss and
  viability is the fully-viable reference (1.0) — so the control grows. Don't wire population death
  into the untreated arm.
- **No RNG.** Everything is deterministic; history / timeline / curve are byte-identical across
  runs.
- **No hardcoded science.** Thresholds, rates, ceilings, effect classes, schedules all come from
  the registries.
- **Scope.** Burden is normalized (never mm³); clinical / survival / RECIST / metastasis / immune /
  PK stay `NOT_EVALUATED`; `validate()` rejects forbidden clinical concepts, human experimental
  labels, and rat fallback.

## Extending toward Phase 7
Clinical response, RECIST, survival, metastasis, immune response, PBPK / clinical PK, toxicity, and
dose recommendation belong to a **new** layer that reads this one read-only — do not add them here.
