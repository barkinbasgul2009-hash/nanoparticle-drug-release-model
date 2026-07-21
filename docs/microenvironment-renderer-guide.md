# Microenvironment Renderer Guide (Phase 7A)

The Phase-7A renderer visualizes the passive tumour microenvironment **schematically** and
**scientifically** — never photorealistically. It emphasizes interpretation over artistic
appearance.

## Headless frame contract

`canvasRenderer` computes `lastMicroenvironmentFrame` every `draw()` even with no canvas
(headless tests read it directly). When the engine is idle the frame is
`{ available: false, microenvironmentState, tumourModel }` and nothing is painted. When available
it carries the ECM / diffusion / mechanical / oxygen / hypoxia / penetration data, evidence
flags, a `field` layout, and the passive-modulator flags (`modifiesTransport`,
`replacesTransport`, `modifiesSignalling`).

## Visual elements

### 1. ECM mesh (density → spacing + opacity)
A grid whose spacing shrinks and opacity rises with ECM density / penetration resistance —
denser ECM reads as a tighter, darker mesh. Loose / moderate / dense / highly-dense ECM are
distinguished by spacing and opacity, **not** by molecular-scale detail. Collagen is implied by
the structural grid (orientation / packing / relative density), never as individual molecules or
cross-link chemistry. Hyaluronic acid is implied by the gel-like fill, never as a molecular
concentration.

### 2. Oxygen / hypoxia overlay
A darkening overlay scaled by hypoxia severity — hypoxic regions are slightly darker. Oxygen is
qualitative (normoxic → severe); no concentration values are shown. Hypoxia modifies scene
appearance only — there is no signalling animation.

### 3. Drug-penetration path
A path that is **direct** when the microenvironment is permissive and becomes **tortuous**
(higher-amplitude, decaying) as combined restriction rises. This makes the passive effect on
penetration legible: denser ECM / more hypoxia / stiffer barrier → a more tortuous path.

### 4. Labels
`TME [<tumourModel>] <microenvironmentState>` with `(predicted)` / `(context-transfer)` suffix;
a read-out line (`ECM <collagen>/<HA> | O2 <state> | penetration <modifier>` with the "schematic;
modifies penetration only" caveat); and the standing caveat *"immune / vascular / remodeling /
metastasis NOT evaluated"*.

## Forbidden visuals
No photorealism, blood vessels / vasculature, immune cells, necrotic debris, clinical scans,
surgical anatomy, or sensational imagery. The passive field is drawn as an interpretable
schematic only.

## Placement + determinism
The diagram is drawn in the right column (`x ≈ 55% W`, `y ≈ 8% H`) so it does not overlap the
left-column cellular-outcome stack (apoptosis / population / tumour). The frame is deterministic
(derived from the static passive field), so replay reproduces the exact renderer state.

## User controls
Optional controls select **supported registry entries only** — microenvironment profile (species
/ tumour model), formulation (`setFormulation`, restricted to `supported_formulations`), and (via
the registry) ECM density / mechanical barrier / hypoxia / oxygen variants. Users can never enter
arbitrary unsupported values; the engine ignores an unsupported formulation and idles on an
unsupported tumour model.
