# Phase 6A Animation Specification (Protein Function & Early Cellular Response)

Rendering is derived entirely from the protein-function engine (read-only) and is
**publication quality and restrained** — no flames, explosions, danger animations,
dying-cell imagery, red flashing, gaming effects, or exaggerated glow.

## 1. Render frame (headless-testable)

`canvasRenderer.lastFunctionFrame = { functions, states, edges }`:
- **functions:** `{ id, proteinId, state, capacity, active, inhibited, predicted, evidenceLevel }`.
- **states:** `{ id, name, value, baseline, ordinal, changed('up'|'down'|'baseline'), predicted, evidenceLevel }`.
- **edges:** active functional edges `{ id, sign, predicted, feedback }`.

## 2. Animation chain

```
mature protein appears → protein becomes functionally eligible → functional state activates
→ functional edge becomes active → cellular-state variable changes gradually
→ feedback may occur → recovery or plateau → STOP
```

Deterministic; integrates with existing play / pause / restart / step / speed / timeline /
species-switch / prediction-toggle / evidence-overlay.

## 3. Visual language (restrained)

- **experimental relationship** — solid; **predictive** — dashed/outlined.
- **active functional protein** — filled; **inactive** — outlined; **inhibited** — muted.
- **cellular-state indicator** — a small bar with a baseline tick; the fill reaches the
  current value; a restrained upward (muted green) or downward (muted violet) tone marks
  change direction. No red-flash, no intensity spikes.
- **stress** — a scientifically muted intensity, never alarming.
- **recovery** — the bar gradually returns toward the baseline tick.
- A caption states: "Protein function → early cellular response (schematic, reversible;
  cell fate NOT evaluated)".

## 4. What is NOT drawn

Flames, explosions, danger/alarm imagery, dying cells, dramatic red flashing, gaming
effects, exaggerated molecular glow, clinical-success indicators, or any cell-fate/phenotype
visual.

## 5. Timeline events

`protein mature` (from 5D), `function eligible`, `function activated`, cellular-state
ordinal changes (e.g. `oxidative_stress_low`, `antioxidant_capacity_high`,
`survival_signaling_low`), feedback/recovery transitions. Biological seconds are never
displayed.
