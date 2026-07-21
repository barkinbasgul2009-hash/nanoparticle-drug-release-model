# Population Animation Specification (Phase 6C)

This specifies the **restrained, publication-style** rendering of the population layer. The
goal is legibility and honesty: a viewer must instantly read the population composition and
its evidence mode, and must never be shown blood, destruction, or a real cell count.

## Explicitly forbidden visuals

**No** blood, explosions, gaming effects, particle destruction, dead-body graphics, real
pathology, or any sensational depiction. No population is ever shown as a literal count of
cells. Nothing implies a tumour, tissue, or body-level effect.

## Headless frame contract

`canvasRenderer` computes `lastPopulationFrame` every `draw()` even with no canvas (headless
tests read it directly). When the engine is idle (`NOT_REPORTED` / unavailable) the frame is
`{ available: false, populationState, cellModel }` and nothing is painted.

When available the frame carries the composition fractions, evidence flags, a
`compositionBar` layout, and a history `sparkline` (`points` = the apoptotic-fraction replay
trace), plus `tumourResponseEvidence` / `survivalEvidence` / `clinicalOutcomeEvidence` =
`NOT_EVALUATED`.

## Visual elements

### 1. Population composition bar (stacked, normalized)
A single horizontal bar whose segments sum to 1, in a muted, desaturated palette:

| Segment | Colour |
|---|---|
| Living | green (`#4b9e5f`) |
| Adaptive | cyan (`#3fb6c4`) |
| Recovered | blue (`#4b73ab`) |
| Apoptotic | orange (`#d08a3a`) |

Predicted runs render at slightly lower opacity than (hypothetical) experimental ones, so the
evidence mode is legible in the bar itself.

### 2. State + evidence label
`Population [<cellModel>] <populationState>` with a suffix `(context-transfer prediction)` for
B16BL6, `(predicted)` for other predictions, or nothing. The evidence mode is always visible;
a transfer is never shown as experimental.

### 3. Fraction read-out
`living X | apoptotic Y | adaptive Z | recovered W  (schematic population fraction; not cell
counts)`. The caveat is on screen, always. Fractions are the normalized `[0,1]` values.

### 4. History sparkline
A thin orange trace of the apoptotic fraction over the recorded history (deterministic replay
trace). This is the population viability/history visualization; it supports replay because the
history is byte-identical across runs.

### 5. Standing caveat
`tumour / survival / clinical outcome NOT evaluated` — printed under the diagram.

## Timeline (for a timeline/scrubber UI)

Events (schematic simulation time, or bucketed early / intermediate / late / terminal):
`population_initialized`, `stress_propagated`, `adaptive_response`, `recovery_initiated`,
`apoptosis_accumulating`, `population_composition_changed`, `population_stabilized`,
`terminal_population_state`, `prediction_activated`, `context_transfer_activated`. No
biological timestamps are shown.

## User controls (only if compatible with the existing UI)

The existing playback controls (restart / pause / play / step / speed) already drive the
animator, which steps the population layer after apoptosis; species and cell-model selection
rebuild the single active population. Prediction / experimental-only / combined overlays map
to the evidence-mode label and bar opacity. **Only one population exists at a time** — there
is no multi-population view.

## Placement
The diagram sits just below the Phase-6B apoptosis diagram (`y ≈ 16% H`, `x ≈ 8% W`, bar
width ≈ 40% W), above the evidence-mode and not-to-scale captions, so it never overlaps the
particle field or earlier overlays.
