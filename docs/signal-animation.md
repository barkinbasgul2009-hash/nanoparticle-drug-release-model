# Signal Animation (Profile B, Phase 5B.2)

The first signaling animations. Rendering is derived entirely from the propagation
engine (read-only) and is **publication quality** — Nature Reviews / Cell schematic
style, no gaming effects, no exaggerated particles.

## 1. Render frames (headless-testable)

`canvasRenderer.draw()` computes two frames every tick, independent of whether a canvas
context exists:

- `lastSignalFrame` — one entry per node: `{ id, x, y, label, nodeType, activity, state,
  glow, predicted, predictionLevel, evidenceLevel, confidence, visible, isOutput, r }`.
- `lastSignalEdgeFrame` — one entry per edge: `{ id, x1, y1, x2, y2, relationship, sign,
  flowing, active, predicted, visible }`.

Nodes are laid out on a schematic `col/row` grid (from the registry) in a reserved band
so the pathway diagram never overlaps the anatomy scene.

## 2. Visual language

- **Active node** — filled glyph; opacity/glow scales with `activity`.
- **Suppressed node** — muted grey fill (a baseline pathway driven down).
- **Degraded node** — faded warm tone (auto-deactivated).
- **Output node** — slightly larger glyph.
- **Prediction node** — drawn **hollow with a violet outline** and an `⌁` badge before
  the label, so it is unmistakably distinct from experimental nodes.
- **Edge (activation)** — green line; **edge (inhibition/feedback)** — red line.
- **Flowing edge** — brighter and thicker while signal is actively propagating across it;
  dim otherwise.
- **Predicted edge** — dashed.
- **Confidence** — carried in the frame for a future colour/opacity encoding.

## 3. Overlay-driven visibility

The evidence overlay mode sets each element's `visible` flag (data is never mutated):
- `experimental` — only experimental (non-predicted) nodes/edges.
- `prediction` — only predictions.
- `combined` — everything.
- `unavailable` / `not_reported` — only nodes at that evidence tier.

Predictions are always visually distinguishable and can be toggled off entirely
(`setPredictionsEnabled(false)`).

## 4. Scientific-honesty rules

- No animation implies a measured quantity: activity is schematic (0–1), never a
  concentration or phosphorylation %.
- A prediction never renders as experimental; the badge, hollow glyph, and dashed edge
  make the tier obvious at a glance.
- Rat renders an explicit idle/NOT-REPORTED state rather than an empty canvas.
- No motion blur, trails, sparks, or particle bursts — schematic glyphs and illuminated
  edges only.

## 5. What is not animated

Nothing downstream of signaling: no transcription/translation/protein-synthesis, no
apoptosis/proliferation, no tumour/immune/PD/PK visuals. Those belong to later phases.
