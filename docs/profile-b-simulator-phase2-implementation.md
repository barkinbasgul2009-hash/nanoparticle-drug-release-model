# Profile-B Simulator — Phase 2 Implementation Report

**Phase 2: the anatomical world (static anatomy only).** Built entirely inside the isolated
`simulator/` directory; production `web`/`R`/`app`/`tests` and CI workflows are **untouched**;
PR #3 **not merged**. Phase-1 architecture is preserved (only additive wiring + two test
assertions updated for legitimate Phase-2 behavior).

## Success criteria (all met)
✔ loads successfully · ✔ renders the anatomical skin layers · ✔ correct layer ordering ·
✔ preserves biological proportions (ordinal, honestly labelled) · ✔ continuous zoom ·
✔ anatomical labels · ✔ clip-plane cross section · ✔ scene switching · ✔ all anatomy
loaded from registries · ✔ all tests pass.
Still contains **no** particles / diffusion / release / motion / cells / vessels / collagen /
lamellae / microscopy / animations / biological processes — **only anatomy**.

## Anatomical structures (exactly the five requested)
Air (ambient) → **Skin Surface → Stratum Corneum → Viable Epidermis → Dermis → Subcutaneous
Tissue**. Nothing else (no hair/follicles/glands/vessels/nerves/cells/ECM/lamellae).

## Scientific integrity (proportions)
Measured layer thicknesses are **NOT_REPORTED** in the frozen evidence — Chen's
0-30/30-60/60-90 µm are *sampling sections*, not thicknesses, and PMC5620574 gives only a
rodent-epidermis note. So the registry encodes the **correct ordering** (textbook consensus,
OpenStax CC BY / StatPearls) and **ordinal draw weights** (SC < viable epidermis < dermis;
subcutis orientation-only), with a repo-wide `not_to_scale: true` flag and a visible
"schematic - not to scale" caption. **No measured proportion is invented.**

## Modules created (`simulator/src/`)
| Area | Module | Role |
|---|---|---|
| Anatomy data | `anatomy/anatomyModel.js` | loads/normalizes the registry; ordering + weights + visibility accessors |
| Layout | `render/anatomyLayout.js` | **pure** cross-section band + label layout (headless-testable) |
| Renderer | `render/canvasRenderer.js` | static 2D bands + labels behind the Phase-1 `Renderer` interface |
| Renderer factory | `render/renderer.js` | `createRenderer` now selects `null` \| `canvas` (lazy import) |
| Zoom | `anatomy/zoomController.js` | continuous zoom → discrete scale level (no animation) |
| Labels | `anatomy/labelSystem.js` | anatomical names + non-overlap placement (data side) |
| Scenes | `anatomy/anatomyScenes.js` | registers 7 static anatomy scenes with the Phase-1 SceneManager |
| UI | `ui/panels/anatomyPanels.js` | fills panels: current layer, zoom level, evidence refs, scene selector, navigation |
| Data | `data/anatomy.registry.json` | the anatomy definition (layers/ordering/weights/scale-map/scenes/labels/palette) |

## Scale + scenes
- **ScaleSystem populated from the registry:** each of L1–L6 gets visible layers, allowed
  labels, and camera framing (depth window + clip). Deeper levels reveal fewer layers
  (L1 all five → L6 stratum corneum only), matching the zoom spec.
- **Scenes registered:** Overview Skin, Surface, Cross Section, SC Focus, Epidermis Focus,
  Dermis Focus, Subcutaneous Layer — each static, anatomy-only; entering a scene sets its
  scale level and redraws a static frame. Default scene: Cross Section.

## Camera / clip plane / zoom
- Static viewpoints only — no motion, orbit, flythrough, or camera paths.
- Clip-plane cross-section is **active** (config `clipPlanesEnabled: true`); the default view
  exposes all layers simultaneously and stays stable during zoom (no animated slicing).
- Continuous zoom drives visibility purely through the ScaleSystem + registry.

## Tests
New `simulator/tests/anatomy.test.mjs` covers: JSON loading, layer ordering, ordinal
proportions + not-to-scale flag, clip-plane (overview exposes all five layers, ordered +
non-overlapping), zoom transitions (fewer layers deeper; SC-only at max), label visibility +
non-overlap, ScaleSystem population, scene registration + static switching, camera framing,
and the canvas renderer producing a computed layout headless. Two Phase-1 assertions updated
for legitimate Phase-2 behavior (renderer kind is now config-driven `canvas`; clip plane is
now active). **Result: 109 passed, 0 failed** (`node simulator/tests/run.mjs`). tsc contract
compiles.

## Verification
- 109/109 simulator tests pass · tsc contract compiles · hidden-char guard clean ·
  production `web`/`R`/`app`/`tests` diff vs `main` **empty** · production tests still green
  (99 JS + 11 R).

## Remaining work before Phase 3
1. Real per-layer thickness data would require new primary evidence; until then the
   cross-section stays honestly ordinal / not-to-scale.
2. Optional WebGL/Three.js renderer behind the same interface (Canvas is sufficient for
   static anatomy).
3. Phase 3+ adds biology (cells/particles/diffusion) — none of which exists yet.

**Stop.** Phase 2 complete: a static, evidence-driven anatomical world.
