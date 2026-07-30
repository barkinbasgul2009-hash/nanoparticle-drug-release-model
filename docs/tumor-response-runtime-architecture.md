# Tumor-Response Runtime Architecture (Phase 6D)

This document describes the software architecture of the Phase-6D tumour layer: how it reads
the population, how the burden / pressure model and the response FSM are structured, and how it
stays isolated from every upstream engine.

## Position in the layer stack

The tumour engine is the fourteenth separate layer. Each layer reads the layer(s) below it
**read-only** and modifies nothing upstream. `TransportAnimator.tick()` steps the tumour layer
**after** population:

```
… → apoptosis → population → TUMOUR RESPONSE
```

It reads exactly one upstream source: the **Phase-6C `PopulationEngine`** (`frame()`:
`livingFraction`, `apoptoticFraction`, `populationState`; and `getHistory()`). It never writes
to it. It is **population-gated**: if the population is idle (`isIdle()`), the tumour engine is
idle — there is no tumour response without population input.

## Object model (`tumorObjects.js`)

| Object | Responsibility |
|---|---|
| `TumorBurdenState` | normalized burden (baseline 1.0), viable/apoptotic/terminal partition, growth/loss/net pressure, response FSM state, evidence/prediction, timestamps |
| `TumorGrowthPressure` | proliferative drive (baseline × viability × cycling × (1−suppression) × resource limitation). Living fraction is a DISTINCT abstraction, never equated with proliferation |
| `TumorLossPressure` | reduced viable burden (apoptotic coupling + treatment-induced loss). NOT physical / immune clearance (`clearanceExcluded = true`) |
| `TumorTreatmentEvent` | a treatment event with an explicit `timingType` (reported_biological vs schematic_simulation — never blurred) |

Burden and pressures are schematic normalized values; no field is ever a real volume, rate, or
percentage.

## Response finite-state machine

States (from `tumor-response.registry.json`) and legal transitions (from
`tumor-transitions.registry.json`):

```
untreated_growth → treatment_started → growth_continues | growth_slowed → stable_burden
  → partial_regression → strong_regression → minimal_residual_burden
treatment_ended → stable_post_treatment | rebound_possible → rebound_in_progress
```

`transitionTo(next)` is **strict**: it throws on any transition not listed in
`legal_transitions`. The FSM forbids `untreated_growth → (partial|strong)_regression` (no
regression without treatment) and has **no** `cure` / `complete_response` / `clinical_remission`
state. Regression states are reachable only after `treatment_started`; rebound states only after
`treatment_ended`. The engine advances at most one legal step per tick from the current state +
the current pressure signals.

## Deterministic step (no RNG)

Each `step(dt)` (details in `tumor-growth-regression-model.md`):
1. read population drivers (living, apoptotic, population state);
2. resolve treatment state (schedule or manual override);
3. compute **growth pressure** and **loss pressure** as two distinct paths;
4. `net = growth − loss`; update the normalized burden (bounded, non-negative, minimal-residual
   floor);
5. partition the burden into viable / apoptotic / terminal;
6. advance the response FSM one legal step;
7. append a deterministic history entry + emit timeline milestones.

## Deterministic replay history + response curve

`this.history` records one entry per step; `getHistory()` and `responseCurve()` are
byte-identical across runs with the same inputs. The renderer's response curve reads this trace.

## Isolation guarantees

- Reads the population + eight registries read-only; writes nothing upstream.
- Owns all tumour state in its own objects; **only one tumour model runs at a time**.
- Any context change — species, cell model, formulation, schedule, or a treatment override —
  fully rebuilds the engine (`_build`), clearing burden, treatment history, response state,
  timeline, and history (no leakage across contexts).
- Every frame reports clinical / survival / RECIST / metastasis / immune / PK = `NOT_EVALUATED`.
