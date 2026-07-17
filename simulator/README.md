# Profile-B Simulator — Foundation (Phase 1)

This directory is the **software foundation** for the Profile-B animation simulator. It is
deliberately **infrastructure only**: there is **zero biological rendering, zero particles,
zero animation, zero shaders, zero skin/cells/microscopy, and no B1/B2/B3 scene
implementation**. Later phases build on top of this without changing its wiring.

It is completely separate from the project's production artifacts (`web/`, `R/`, `app/`,
`tests/`), which are untouched.

## Run it
- **Browser:** serve the repo root and open `simulator/index.html` (it loads real data from
  `../data/` via `fetch`). You'll see the empty panel layout; inspect `window.__SIM__` in the
  console for loaded presets, citations, scale levels, camera descriptor, and app state.
- **Headless (Node):** `node simulator/tests/run.mjs` boots the whole foundation with a
  filesystem fetcher and runs the architecture tests.
- **Type contract:** `npx tsc --noEmit -p simulator/tsconfig.json`.

## Architecture (clear responsibilities)
```
simulator/src/
  config/     app.config.js      # all wiring/config; NO hardcoded scientific values
  core/       logger, eventBus, state
  data/       jsonLoader (+ injectable fetcher), schema (shape validation)
  presets/    presetEngine        # B1/B2/B3 metadata (model/species/evidence/refs/permissions/limits)
  scene/      sceneManager        # register/lifecycle/transition/cleanup/shared state/metadata
  scale/      scaleSystem         # L1..L6 hierarchy (visible structures/labels/camera limits/transitions)
  camera/     cameraSystem        # perspective/ortho + clip-plane + nav-mode descriptors (no rendering)
  render/     renderer            # NullRenderer only (rendering boundary; WebGL deferred)
  evidence/   evidenceEngine      # confidence vocab + the canAnimate() gate
  references/ citationEngine      # reference/license index
  ui/         uiFramework, panels # 8 empty panel shells (Main/Nav/Evidence/Citation/Legend/Info/Timeline/Debug)
  debug/      debugTools          # status snapshot + optional FPS meter (browser)
  types/      *.ts                # TypeScript interface contract (biology/evidence/scene/preset)
simulator/tests/                  # zero-dependency architecture tests
```

## Design rules honored
- **No hardcoded scientific values** — all science is loaded at runtime from the frozen
  `data/profile-b-*.json` registries the previous phases produced.
- **Evidence gate is first-class** — `evidenceEngine.canAnimate()` blocks
  `NOT_REPORTED` / `UNSUPPORTED_DO_NOT_ANIMATE` / `NOT_APPLICABLE` so later phases cannot
  render unsupported claims by accident.
- **Rendering is a swappable boundary** — Phase 1 ships a `NullRenderer`; a real renderer
  slots in later without touching call sites.
- **Self-contained** — no external runtime dependencies; ES modules; Node-testable via an
  injected fetcher.

## Not in Phase 1 (by design)
Skin/anatomy/cells/nanoparticles/particle-simulation/diffusion/shaders/materials/lighting/
animation and any B1/B2/B3 scene. Those are Phase 2+.
