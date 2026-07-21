# Phase 6D Animation Specification — Tumor Growth & Treatment Response

This specifies the **restrained, publication-style** rendering of the tumour layer. The goal is
legibility and honesty: a viewer must read the relative burden, the treatment state, and the
evidence mode at a glance — and must never be shown a realistic tumour, blood, or a clinical scan.

## Explicitly forbidden visuals

**No** realistic human tumour, surgical anatomy, ulceration, blood, necrotic debris, dramatic
destruction, clinical scan, patient body, or sensational cancer imagery. The burden is a schematic
normalized value, never a literal tumour.

## Headless frame contract

`canvasRenderer` computes `lastTumorFrame` every `draw()` even with no canvas (headless tests read
it directly). When the engine is idle (`NOT_REPORTED` / `UNAVAILABLE`) the frame is
`{ available: false, responseState, cellModel }` and nothing is painted.

When available the frame carries the burden + pressures, evidence flags, a `burdenBar` layout
(with `scale = upper_bound`, `viable`, `apoptotic`), and a normalized response `curve` (`points` =
the relative-burden replay trace), plus clinical / survival evidence = `NOT_EVALUATED`.

## Visual elements

### 1. Relative-burden bar
A horizontal bar (scaled to `upper_bound`) partitioned into **viable** (slate `#5b6b86`) and
**apoptotic** (orange `#d08a3a`), with:
- a **baseline (1.0) reference tick** (violet), so growth above vs regression below baseline is
  legible;
- a **treatment-on indicator** (green tab) when treatment is active.
Predicted (non-experimental) runs render at slightly lower opacity.

### 2. State + evidence label
`Tumour [<cellModel> / <formulation>] <responseState>` with a suffix `(experimental direction)`,
`(context-transfer)`, or `(predicted)`. The evidence mode is always visible; a prediction is never
shown as experimental.

### 3. Pressure read-out
`rel. burden X | growth G | loss L | net N  (normalized schematic; not mm³)`. The caveat is on
screen, always.

### 4. Normalized response curve
A thin slate trace of the relative burden over the recorded history (deterministic replay trace),
scaled to `upper_bound`. This is the response curve: burden vs schematic simulation time. It is
labelled with the evidence level, prediction status, `quantitativeStatus = NOT_REPORTED`, and a
simulation-time warning, and is never presented as extracted experimental data. Growing burden
rises, regression falls, stable is flat, rebound rises again.

### 5. Standing caveat
`clinical / RECIST / survival / metastasis / PK NOT evaluated` — printed under the diagram.

## Response-curve overlays

Only curves supported by the active evidence / prediction configuration are shown — the active
formulation's trajectory (and, where a compatible control is configured, an untreated-control
reference). Comparison is only within the same species / cell model / route / experiment context;
only one tumour model runs at a time.

## Timeline

Events (schematic simulation time, or bucketed early / intermediate / late / terminal):
`tumour_model_initialized`, `treatment_started`, `formulation_applied`, `growth_pressure_reduced`,
`loss_pressure_increased`, `growth_slowed`, `stable_burden_reached`, `regression_started`,
`strong_regression_state_entered`, `minimal_residual_burden_reached`, `treatment_ended`,
`rebound_possible`, `rebound_started`, `post_treatment_state_stabilized`, plus `prediction_activated`
/ `context_transfer_activated` / `experimental_evidence_active`. No fabricated biological days.

## User controls (only if compatible with the existing UI)

Species / cell-model / formulation / schedule selection and treatment on/off map to the engine's
`setSpecies` / `setCellModel` / `setFormulation` / `setSchedule` / `setTreatment` — each fully
rebuilds the single active trajectory. The existing playback controls (play / pause / step /
restart / speed) drive the animator, which steps the tumour layer after population.

## Placement
The diagram sits below the Phase-6C population diagram (`y ≈ 27% H`, `x ≈ 8% W`, bar width ≈ 40% W),
above the evidence-mode and not-to-scale captions, so it never overlaps the particle field or
earlier overlays.
