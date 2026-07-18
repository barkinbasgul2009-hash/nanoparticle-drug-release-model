# Profile-B Simulator — Phases 1–4C

This directory is the Profile-B animation simulator. It is completely separate from the
project's production artifacts (`web/`, `R/`, `app/`, `tests/`), which are untouched.

- **Phase 1 — Foundation (infrastructure only):** config, logging, events, state, JSON
  loading + validation, preset/scene/scale/camera systems, evidence + citation engines, UI
  framework, debug tools, and the TypeScript interface contract. No rendering.
- **Phase 2 — Anatomical world (static anatomy only):** the five skin layers rendered as an
  evidence-driven cross-section with a clip plane, continuous zoom, scene switching, and
  anatomical labels. **Still zero biology**: no particles, diffusion, motion, cells, vessels,
  collagen, lamellae, microscopy, animation, shaders, or lighting.
- **Phase 2.5 — Anatomical scale validation (registry only):** the layer draw weights were
  upgraded from **purely ordinal** to **evidence-anchored schematic** using located
  literature (`draw_weight = log10(representative µm)` for the layers with real thickness
  evidence). Per-species profiles (human / rat / mouse) are kept separate — **no universal
  average is invented** — and the cross-section stays **`not_to_scale`**. Registry + tests +
  evidence doc only; no rendering or biology added.
- **Phase 2.6 — Multi-species anatomy architecture (registry + engine):** the anatomy engine is
  now **species-driven** with **independent** human / mouse / rat profiles (`species_profiles`).
  The active profile **always follows the selected species** and there is **no silent fallback
  to human** — an unsupported species is an error. Human stays evidence-anchored; mouse/rat use
  an evidence-supported **ordinal prominence ladder** (per-layer rodent µm are not established).
  `app.setSpecies()` + `state.species` prepare a future Species selector **without redesigning
  the UI**. Still zero biology. Audit: `docs/profile-b-multi-species-anatomy.md`.
- **Phase 3 — Biological transport engine (first biology):** passive transport of the topical
  NLC carrier **through the skin** (Topical Formulation → Skin Surface → Stratum Corneum →
  Viable Epidermis → Dermis → Target Region). A cited **biological state machine**, passive
  **mechanisms** (Brownian + concentration drift + SC barrier slowing; active transport
  **excluded**), evidence-based per-layer **mobility**, independent **particle objects**, a flat-
  dot renderer overlay (no glow/FX), and a deterministic engine. **Evidence-gated + species-
  driven with no fallback:** only **rat** has topical-permeation evidence (Chen 2012), so human
  and mouse are **blocked (NOT REPORTED)**. **Transport only** — no drug release, cell entry,
  uptake, payload, PK or PD. Docs: `docs/profile-b-simulator-phase3-implementation.md`,
  `docs/profile-b-transport-architecture.md`, `docs/profile-b-biological-transport.md`,
  `docs/profile-b-transport-evidence-report.md`, `docs/profile-b-transport-validation-report.md`.
- **Phase 3.1 — Predictive human & mouse transport (Evidence Level system):** an **Evidence
  Level** (Experimental / Predictive / Unavailable) replaces available/blocked. **Rat stays
  Experimental** (unchanged). **Human and mouse now animate in Predictive mode** — via their
  **own** anatomy + general passive-transport principles (`MECHANISTIC_TRANSFER`), clearly
  labelled, **not** experimentally validated, with **no rat parameters copied** and no
  quantitative claims. Predictive particles render as **outlined** dots (experimental = filled) +
  an evidence caption; experimental data is never replaced by a prediction. Docs:
  `docs/profile-b-simulator-phase3.1-implementation.md`, `docs/profile-b-predictive-transport.md`,
  `docs/profile-b-predictive-evidence-justification.md`, `docs/profile-b-phase3.1-validation-report.md`.
- **Phase 4 — Drug release engine (separate process):** after a particle **arrives**, its payload
  releases by the evidence-**selected first-order** model (`F(t)=1−e^(−k·t)`; Chen 2012) — drug
  inside decreases, released amount increases, a release curve updates, and the carrier eventually
  **empties**. Release is **completely separate** from transport (reads, never writes, transport
  state; never moves particles; release begins only after arrival). The rate `k` is **schematic**
  (NOT REPORTED); the model is **formulation-level** (no per-species k). The particle glyph gains
  an inner **payload disc** that shrinks to empty. **Release only** — no uptake, membrane
  crossing, endocytosis, PK, PD, etc. Docs: `docs/profile-b-simulator-phase4-implementation.md`,
  `docs/profile-b-drug-release.md`, `docs/profile-b-release-evidence-report.md`,
  `docs/profile-b-phase4-validation-report.md`.
- **Phase 4B — Cellular microenvironment & passive uptake (separate layer):** the released payload
  becomes independent **free drug molecules** that diffuse (Brownian) through the extracellular
  space and **passively** cross the membrane of schematic **cells** (membrane + cytoplasm only)
  into the cytoplasm, where they keep diffusing. Molecule count equals the released payload;
  molecules enter the cytoplasm **only after membrane contact** (no teleport). Cell uptake is
  **Predictive for all species** (passive free-drug crossing is a general principle, not the
  measured carrier uptake); the evidence panel now shows **three** independent levels
  (Transport / Release / Cell Uptake). **Passive entry only** — no receptors, endocytosis,
  organelles, nucleus, PK or PD. Docs: `docs/profile-b-simulator-phase4b-implementation.md`,
  `docs/profile-b-cellular-microenvironment.md`, `docs/profile-b-passive-uptake-evidence-report.md`,
  `docs/profile-b-phase4b-validation-report.md`.
- **Phase 4C — Endocytosis & intracellular trafficking (separate layer):** carrier nanoparticles
  contact a cell membrane and are internalized via **clathrin / caveolae / macropinocytosis**
  (registry-selected), then traffic a strict FSM **Membrane Contact → Wrapping → Internalized →
  Early Endosome → Late Endosome → Lysosome → (Escaped → Cytoplasm, only if the formulation
  evidence supports escape)**. Illegal transitions are rejected; maturation is gradual. Endocytosis
  applies to **carriers only** (free molecules stay free). Endocytosis + trafficking are
  **Predictive for all species** (pathway unresolved); escape is **Unavailable** for the B1 NLC
  (NOT REPORTED). The evidence panel now shows **five** levels (Transport / Release / Passive
  Uptake / Endocytosis / Intracellular Trafficking). **Intracellular entry only** — no nucleus,
  receptor signalling, PD, PK, apoptosis, immune response, etc. Docs:
  `docs/profile-b-simulator-phase4c-implementation.md`, `docs/profile-b-endocytosis-evidence-review.md`,
  `docs/profile-b-intracellular-trafficking.md`, `docs/profile-b-phase4c-validation-report.md`.

## Phase 2 + 2.5 + 2.6 at a glance
- **Anatomy is data, not code:** `simulator/data/anatomy.registry.json` defines the five
  layers, their biologically-correct ordering, **independent per-species draw-weight profiles
  (evidence-anchored schematic, explicitly `not_to_scale`)**, the scale-level -> visibility
  mapping, scenes, labels, and an illustrative palette. The code hardcodes **no** biological
  values.
- **Species-driven (Phase 2.6):** `species_scope` lists the supported species and the boot
  selection; `AnatomyModel` tracks an `activeSpecies` and refuses unsupported species (no silent
  fallback to human). `computeAnatomyLayout` reads `model.weights()`, so the cross-section
  follows the selected species automatically.
- **Scientific honesty:** Phase 2 encoded the correct **ordering** with **ordinal** weights
  because measured thicknesses are `NOT_REPORTED` in the frozen Profile-B evidence (Chen's
  0-30/30-60/60-90 µm are *sampling sections*, not thicknesses). Phase 2.5 then located
  general anatomical thickness literature (Sandby-Møller 2003 for human SC/epidermis; a
  flagged 1–3 mm dermis range; rodent epidermis ~20 µm) and replaced the ordinal ranks with
  **log-compressed, evidence-anchored** draw weights — still schematic, still
  "schematic - not to scale", every value with provenance and confidence. Rat/mouse per-layer
  µm were **not located**, so those profiles stay ordinal and flagged `INCOMPLETE` rather than
  invented. Full audit trail: `docs/profile-b-anatomy-scale-validation.md`. Ordering
  provenance: OpenStax CC BY / StatPearls.
- **Renderer:** `CanvasRenderer` (static 2D bands) behind the Phase-1 `createRenderer`
  interface. A pure `computeAnatomyLayout()` engine computes bands/labels and is unit-tested
  headless (no canvas needed).

## Original Phase-1 note
The foundation remains **infrastructure**; Phase 2 adds only static anatomy on top of it
without changing its wiring.

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
