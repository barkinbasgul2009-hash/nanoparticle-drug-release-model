# Population Developer Notes — Phase 6C

Practical notes for anyone extending or debugging the population layer.

## Files

| File | Role |
|---|---|
| `src/biology/populationEngine.js` | the engine (fractions, FSM, history, timeline, validate) |
| `src/biology/populationObjects.js` | `PopulationState` (normalized fractions only) |
| `data/population-context.registry.json` | per-species/cell-model profiles |
| `data/population-state.registry.json` | state vocabulary + composition thresholds |
| `data/population-transitions.registry.json` | FSM + dynamics defaults |
| `data/population-evidence.registry.json` | evidence + transfer records |
| `data/population-prediction.registry.json` | labelled prediction records |
| `data/population-interventions.registry.json` | upstream-applied intervention echo policy |
| `src/types/population.ts` | TypeScript contract |
| `tests/population.test.mjs` | behaviour suite (registered in `tests/run.mjs`) |

## Running things

```
node simulator/tests/run.mjs        # full simulator suite (1916 assertions)
cd simulator && npx tsc --noEmit    # type contract (must run from simulator/)
```

## Construction & controls

The engine needs the six registries plus the Phase-6B `apoptosisEngine`:

```js
const pop = new PopulationEngine({
  contextRegistry, stateRegistry, transitionsRegistry,
  evidenceRegistry, predictionRegistry, interventionRegistry,
  apoptosisEngine, species: 'mouse',
});
pop.setSpecies('mouse');       // rebuilds; mouse -> canonical B16BL6 (context transfer)
pop.setCellModel('B16');       // switch to the separate B16 prediction profile
pop.step(0.5);                 // one 0.5-h schematic step (call AFTER apoptosis.step)
pop.frame(); pop.stats(); pop.getHistory(); pop.getTimeline(); pop.validate();
```

`setSpecies` / `setCellModel` both call `_build()`, which rebuilds the runtime object and
clears fractions, history, timeline, and milestone flags — no cross-run / cross-model leakage.
In the full app the animator steps population **after** apoptosis, and `app.setSpecies`
cascades to `population.engine.setSpecies`.

## The model in one paragraph

Each step reads the single (modal) cell's apoptotic pressure / commitment / execution drive
and: (1) accumulates the apoptotic fraction monotonically toward `susceptible_ceiling`;
(2) adapts surviving cells in the stress window; (3) recovers surviving cells while stress is
falling; (4) clamps `adapted + recovered ≤ living`; (5) advances the FSM one legal step toward
the composition target; (6) appends a history entry. See `population-response-model.md`.

## Gotchas

- **Call order.** Step apoptosis first, then population — the population reads the *current*
  single-cell drivers. The animator already enforces this.
- **Conservation is sacred.** `livingFraction = 1 − apoptoticFraction` always; never set
  living independently. `conservationOk()` / `validate()` guard it.
- **Apoptotic is monotonic.** Never decrease `apoptoticFraction` — apoptotic cells never
  resurrect. Recovery touches only `recoveredFraction` within living.
- **Strict FSM.** `transitionTo()` throws on illegal transitions. If you add a state, add its
  legal transitions to the registry and classify it recoverable or irreversible; never add a
  recovery edge out of an irreversible state (`validate()` will fail, and it should).
- **Recovery is relief-driven.** It fires only while schematic stress is falling, so a
  never-stressed population does not "recover" at t=0. Don't reintroduce a static low-stress
  recovery term.
- **No RNG.** Everything is deterministic arithmetic; history/timeline are byte-identical
  across runs. Do not introduce randomness.
- **No hardcoded science.** Thresholds, rates, ceilings, and windows all come from the
  registries.
- **Scope.** Normalized fractions only — never a cell count. `tumourResponseEvidence` /
  `survivalEvidence` / `clinicalOutcomeEvidence` must stay `NOT_EVALUATED`; `validate()`
  rejects forbidden downstream concepts in profile fields.

## Extending toward Phase 6D
Tumour response, tissue remodelling, immune involvement, PK/PD, and clinical outcome belong
to a **new** layer that reads this one read-only — do not add them here.
