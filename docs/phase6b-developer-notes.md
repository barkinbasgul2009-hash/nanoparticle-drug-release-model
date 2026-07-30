# Phase 6B Developer Notes — Apoptosis Runtime

Practical notes for anyone extending or debugging the apoptosis layer.

## Files

| File | Role |
|---|---|
| `src/biology/apoptosisEngine.js` | the engine (FSM, pressure dynamics, execution, validate) |
| `src/biology/apoptosisObjects.js` | runtime objects (5 classes) |
| `data/apoptosis-dynamics.registry.json` | FSM + vocabularies + dynamics defaults |
| `data/apoptosis-context.registry.json` | per-species/cell-model profiles |
| `data/apoptosis-interventions.registry.json` | interventions per profile |
| `data/apoptosis-evidence.registry.json` | evidence + transfer + prediction records |
| `src/types/apoptosis.ts` | TypeScript contract |
| `tests/apoptosis.test.mjs` | behaviour suite (registered in `tests/run.mjs`) |

## Running things

```
node simulator/tests/run.mjs        # full simulator suite (1842 assertions)
cd simulator && npx tsc --noEmit    # type contract (must run from simulator/)
```

## Construction & controls

The engine needs the four registries plus the Phase-6A `proteinFunctionEngine` (and,
optionally, the Phase-5B `signalEngine` for provenance):

```js
const ap = new ApoptosisEngine({
  contextRegistry, dynamicsRegistry, interventionRegistry, evidenceRegistry,
  proteinFunctionEngine, signalEngine, species: 'mouse',
});
ap.setSpecies('mouse');          // rebuilds; mouse → canonical B16BL6 (context transfer)
ap.setCellModel('B16');          // switch to the experimental B16 profile
ap.setIntervention('ros_scavenger', true);
ap.step(0.5);                    // one 0.5-h schematic step
ap.frame(); ap.stats(); ap.getTimeline(); ap.validate();
```

`setSpecies` / `setCellModel` both call `_build()`, which rebuilds every runtime object and
the intervention set from the registries — there is no cross-run or cross-model state leakage.

## The two tuning knobs that matter (and why)

Survival signaling must be able to hold a cell back from the commitment gate even under
stress. Two dynamics-registry parameters make that work; both were validated against the real
6A trajectory (baseline mouse commits; a PI3K-rescued B16-F10 cell does not):

1. **`survival_counter_weight` (0.35)** — used in the net-pressure formula
   `netPressure = apoptoticPressure − survival_counter_weight × survivalPressure`. Note there
   is **no `(1−P)` dilution**: survival is a *persistent* offset, so strong survival keeps net
   pressure below the commitment threshold even when raw pressure is high. (An earlier version
   diluted survival by `(1−P)`, which made survival irrelevant once pressure saturated — that
   was the bug that let a PI3K-rescued cell drift across the gate.)

2. **`survival_accumulation_penalty` (0.1)** — pressure *accumulation* is gated on
   `effectiveStress = stressTarget − survival_accumulation_penalty × survival`. When survival
   is restored (PI3K activator), `effectiveStress` drops below the eligibility threshold, so
   the cell **relieves** pressure instead of accumulating it. This is the decisive mechanism
   for prevention, because once raw pressure saturates at 1.0 an offset alone cannot pull net
   pressure below the gate.

Do not re-introduce a `(1−P)` factor on the survival term, and keep both knobs in the
registry — never hardcode them in the engine.

## The commitment gate, step by step

1. `_stressInputs()` reads 6A states; applies upstream interventions (ROS scavenger scales
   oxidative stress down; PI3K activator scales survival up).
2. `stressTarget` = weighted combination (registry `pressure_weights`).
3. Accumulate/relieve `apoptoticPressure` gated on `effectiveStress` (reversible states only).
4. Reversible FSM up/down (`stressed ↔ apoptosis_eligible ↔ pre_commitment`).
5. In `pre_commitment`, `netPressure ≥ commitment_threshold` must persist for
   `commitment_persist_hours` → `commitment_threshold_reached` → `committed` (irreversible).
6. `_advanceExecution()` runs the mitochondrial → MOMP → branch → morphology → complete chain,
   all deterministic on time-since-commit + `stage_delay_hours`.

## Gotchas

- **Strict FSM.** `transitionTo()` throws on illegal transitions. If you add a state, add its
  legal transitions to the registry *and* classify it as recoverable or irreversible.
- **Irreversibility.** Never add a legal transition from an irreversible state to a
  recoverable one — `validate()` will fail (and it should).
- **AIF suppression threshold.** A knockdown silences the AIF branch only at "strong" strength
  or above (`aifKdStr >= _strength('strong')`). A partial knockdown attenuates but leaves the
  branch active — don't lower this to catch partials.
- **Caspase full inhibition** requires "complete" strength; the shipped caspase inhibitor is
  partial, so PARP caps at `partially_cleaved` and the cell still commits (AIF outlet).
- **No RNG.** Everything is deterministic arithmetic. Do not introduce randomness — commitment
  is never a coin flip.
- **Scope.** The cell object is never removed; `populationOutcomeEvidence` /
  `tumourResponseEvidence` must stay `NOT_EVALUATED`. `validate()` rejects forbidden
  downstream concepts in profile fields.

## Extending toward Phase 6C
Population-level effects, tumour response, immune involvement, and any other multi-cell or
tissue outcome belong to a *new* layer that reads this one read-only — do not add them here.
