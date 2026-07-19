# Signal Timeline & Playback (Profile B, Phase 5B.2)

The propagation engine records an ordered timeline of signaling events and exposes
deterministic playback controls.

## 1. Timeline

`engine.getTimeline()` returns a time-ordered list of first-occurrence events:

```
{ timeH, nodeId, event: 'activated' | 'suppressed' | 'deactivated', activity, predicted, predictionLevel }
```

- `activated` — a non-baseline node first crosses its activation threshold.
- `suppressed` — a baseline-active node is first driven below baseline.
- `deactivated` — an activated node passes its activation lifetime and begins to degrade.

Example (human, 5B-H1 activation cascade), schematic hours:

```
t = 0.0 h   h1_exposure activated
t = 1.0 h   h1_ros activated
t = 5.0 h   h1_erk activated
t = 5.0 h   h1_p38 activated
t = 9.5 h   h1_nrf2 activated
t = ~18 h   h1_are activated
t = ~26 h   h1_ho1 activated
t = ~33 h   h1_ros deactivated  (lifetime elapsed; cascade winds down)
```

`timeH` is **schematic simulation time** (accumulated dt), not a biological timestamp —
consistent with the 5B.1 rule that `temporal_order`/timing is schematic unless a
`delay_basis` is reported (all NOT_REPORTED here).

## 2. Playback controls

- **Play / Pause** — `play(dt)` / `pause()` drive a `requestAnimationFrame` loop in the
  browser (headless code uses `step`/`run`).
- **Restart** — `restart()` resets `timeH`, the timeline, and all node state.
- **Step** — `stepOnce(dt)` advances exactly one deterministic step.
- **Speed** — `setSpeed(multiplier)` changes how many steps run per animation frame
  (playback cadence only). It never changes the per-step `dt`, so a run is **bit-for-bit
  deterministic** regardless of speed: `stepOnce(dt)` repeated N times equals
  `run(N, dt)`.

## 3. Determinism guarantees (tested)

- Two identical runs produce identical `stats()` and identical timelines.
- `stepOnce(dt) × N === run(N, dt)`.
- Species switching restarts time to 0 and rebuilds the graph.

## 4. Species behaviour

- Human runs 5B-H1 + 5B-H2 (+ the predicted SOCE pathway when predictions are on).
- Mouse runs 5B-M1.
- Rat is idle (NOT REPORTED): the timeline stays empty; `isIdle()` is true.
