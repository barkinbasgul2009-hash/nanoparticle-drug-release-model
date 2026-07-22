# Vascular Renderer Guide (Phase 7B)

The Phase-7B renderer visualizes the tumour vasculature **schematically** and **educationally** —
never photorealistically, and never with anatomical realism beyond supported evidence.

## Headless frame contract

`canvasRenderer` computes `lastVascularFrame` every `draw()` even with no canvas (headless tests
read it directly). When the engine is idle the frame is `{ available: false, tumourModel }` and
nothing is painted. When available it carries the vessel / perfusion / oxygen / nutrient /
permeability / delivery data, evidence flags, a `field` layout, and the modulator flags
(`modifiesDelivery`, `modifiesSignalling`).

## Visual elements

### 1. Simplified branching vessels
A set of simplified vessel "trees" whose **count and branch amplitude track vessel density** and
whose **opacity tracks maturity** (immature vessels are fainter). This distinguishes poorly /
moderately / highly vascularized / hypervascular states and immature → stable maturity — without
individual endothelial cells, blood cells, capillary ultrastructure, or flow vectors.

### 2. Perfusion tint
A background fill whose intensity tracks perfusion efficiency (more perfused → warmer/brighter),
distinguishing perfused vs hypoperfused regions qualitatively — no quantitative perfusion map.

### 3. Oxygen / nutrient (labels)
Oxygen supply and nutrient states are surfaced as qualitative labels; oxygen is emphasized as a
supply state rather than a numeric value. No unsupported numerical oxygen values are shown.

### 4. Drug-delivery path
A path whose **thickness and opacity track the delivery modifier** — demonstrating why identical
formulations may produce different exposure when vascular delivery differs (a permissive, well-
perfused, permeable network gives a strong delivery path; a poorly perfused immature network gives
a weak one).

### 5. Labels
`Vasculature [<tumourModel>] <angiogenicState> / <deliveryState>` with `(predicted)` /
`(context-transfer)` suffix; a read-out line (`perfusion … | O2 … | perm … | delivery …` with the
"schematic; modifies delivery only" caveat); and the standing caveat *"immune / VEGF / HIF /
metastasis NOT evaluated"*.

## Forbidden visuals
No photorealism, individual endothelial or blood cells, capillary ultrastructure, blood pressure,
or flow vectors. The vasculature is drawn as an interpretable schematic only.

## Placement + determinism
The diagram is drawn in the right column (`x ≈ 55% W`, `y ≈ 34% H`), below the Phase-7A passive-TME
diagram, so it does not overlap the left-column cellular-outcome stack. The frame is deterministic
(derived from the static vascular field), so replay reproduces the exact renderer state.

## User controls
Optional controls select **supported registry entries only** — vascular profile (species / tumour
model), formulation (`setFormulation`, restricted to `supported_formulations`), and (via the
registry) vessel density / perfusion / permeability / oxygen supply / nutrient states. Users can
never enter arbitrary numerical input; the engine ignores an unsupported formulation and idles on
an unsupported tumour model.
