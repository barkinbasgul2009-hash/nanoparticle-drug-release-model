# Phase 6A Developer Notes

Implementation notes for `simulator/src/biology/proteinFunctionEngine.js` and friends.

## Data flow

`SignalPropagationEngine (5B)` + `TranslationEngine (5D)` → **`ProteinFunctionEngine (6A)`**.
The engine reads `translation.protein(id)` (mature abundance / state) and
`signal.node(id)` (activity / baseline) **read-only**; it never mutates them.

## Registries (four, separable concepts)

- `protein-function-context.registry.json` — function profiles (protein identity ref,
  functional eligibility, function type/direction, target states, evidence, stop boundary,
  excluded downstream).
- `cellular-state.registry.json` — reversible cellular-state variables (type, baseline,
  evidence, reversibility).
- `functional-edges.registry.json` — edges (source → target state, relationship, strength/
  delay class, reversibility, baseline_relative, source_reference, feedback) + `dynamics`.
- `functional-evidence.registry.json` — evidence records (verification_status) + prediction
  records.

No parameter is hard-coded in the engine.

## Determinism

Pure arithmetic, fixed-dt, no RNG. `stepOnce(dt) × N === run(N, dt)`.

## Source-value semantics (the key trick)

Edge contribution = `sign(relationship) × strength(class) × sourceValue`. For a
baseline-active signal source (NF-κB, mTOR survival output) set `baseline_relative: true`,
so `sourceValue = activity − baseline` — a suppressed input drives its target **below**
baseline. For an abundance-driven protein source that should push a target below baseline
when suppressed (ICAM1-like → adhesion), set `baseline_relative` + a `source_reference`
(the "normal" abundance). Non-baseline-relative sources (HO-1 → antioxidant) simply add.

## Feedback + cycle validation

Feedback edges are marked `feedback: true` (or use a feedback relationship type). The
validator builds a state→state adjacency **excluding** feedback edges and detects any
surviving cycle → an undeclared cycle is an error. Values are clamped `[0,1]`, so declared
negative feedback (antioxidant ↔ oxidative stress) damps and never explodes.

## Adding a state / edge / function

1. Add a state to `cellular-state.registry.json` (baseline in `[0,1]`; no cell-fate name).
2. Add a protein function to `protein-function-context.registry.json` (or drive from a
   signal for a signal-only species like mouse).
3. Add an edge in `functional-edges.registry.json` (+ an evidence + prediction record).
4. Never set `EXPERIMENTAL_*` without a `VERIFIED_IN_FROZEN_PACKAGE` reference.
5. Any new state→state cycle must be closed by a declared feedback edge.

## Stop boundary

`functionalState` never becomes a cell-fate state; cellular-state ids/types are validated
against a forbidden list (apoptosis/caspase/cytochrome/AIF/necrosis/…); cell-fate evidence
stays `NOT_EVALUATED`. No downstream function/metabolism/phenotype/PK/PD.
