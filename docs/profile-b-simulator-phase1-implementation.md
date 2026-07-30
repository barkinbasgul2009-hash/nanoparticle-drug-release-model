# Profile-B Simulator — Phase 1 Implementation Report

**First implementation phase: software foundation only.** Built in a **new, isolated
`simulator/` directory**; the production website/model (`web/`, `R/`, `app/`, `tests/`) and CI
workflows are **untouched**, and **PR #3 is not merged**.

## Success criteria (all met)
✔ A running application (browser `simulator/index.html`; headless Node bootstrap) ·
✔ Zero biological rendering · ✔ Zero particles · ✔ Zero animations · ✔ Zero shaders ·
✔ Zero skin · ✔ Zero cells · ✔ Zero microscopy · ✔ Zero B1/B2/B3 scene implementation.
Only infrastructure.

## Architecture (modules created)
| Responsibility | Module | What it does (Phase 1) |
|---|---|---|
| Config | `config/app.config.js` | all app wiring; **no hardcoded scientific values** |
| Logging | `core/logger.js` | structured, category+level, buffered |
| Events | `core/eventBus.js` | pub/sub decoupling |
| State | `core/state.js` | observable global `AppState` + transitions + history |
| Data | `data/jsonLoader.js`, `data/schema.js` | load + auto-validate JSON; injectable fetcher |
| Presets | `presets/presetEngine.js` | B1/B2/B3 metadata (model/species/evidence/refs/permissions/limits) |
| Scenes | `scene/sceneManager.js` | register/lifecycle/transition/cleanup/shared state/metadata (no scenes) |
| Scale | `scale/scaleSystem.js` | L1–L6 hierarchy with per-level slots + transition rules |
| Camera | `camera/cameraSystem.js` | perspective/ortho + clip-plane + nav-mode **descriptors** (no rendering) |
| Rendering | `render/renderer.js` | **NullRenderer** boundary (WebGL deferred) |
| Evidence | `evidence/evidenceEngine.js` | confidence vocabulary + `canAnimate()` gate |
| Citations | `references/citationEngine.js` | reference/license index |
| UI | `ui/uiFramework.js`, `ui/panels/basePanel.js` | 8 empty panel shells |
| Debug | `debug/debugTools.js` | status snapshot + optional FPS meter |

## Folders created
`simulator/` with `src/{config,core,data,presets,scene,scale,camera,render,evidence,references,ui/panels,debug,types}`,
`tests/`, plus `index.html`, `tsconfig.json`, `README.md`.

## Interfaces created (TypeScript contract, `src/types/`)
- `biology.ts` — `Confidence`, `Representation`, `Species`, `Experiment`, `Layer`, `Cell`,
  `Particle`, `MicroscopyFeature`, `Atlas`.
- `evidence.ts` — `Reference`, `Citation`, `EvidenceDescriptor`.
- `scene.ts` — `ScaleLevel`, `CameraDescriptor`, `ClipPlane`, `SceneMeta`, `Scene`, `AnimationTrack`.
- `preset.ts` — `PresetMeta`, `VisualizationPermissions`, `AppState`.
- Verified with `tsc --noEmit -p simulator/tsconfig.json` (contract compiles).

## Tests added (`simulator/tests/`, zero-dependency, Node)
`configLoading`, `jsonValidation`, `preset`, `sceneRegistration`, `stateTransitions`,
`cameraInit`, `bootstrap` (headless full-wiring). Runner: `node simulator/tests/run.mjs`.
**Result: 68 passed, 0 failed.** The bootstrap test loads the real frozen `data/profile-b-*`
files, builds B1/B2/B3, a 17-entry citation index, and confirms the NullRenderer + 8 panels +
0 scenes + the working evidence gate.

## Key design guarantees
- **No hardcoded scientific values** — science is loaded from the frozen `data/` registries.
- **Evidence gate is first-class** — blocks `NOT_REPORTED` / `UNSUPPORTED_DO_NOT_ANIMATE` /
  `NOT_APPLICABLE` so later phases cannot render unsupported claims.
- **Rendering is a swappable boundary** — real renderer slots behind the same interface.
- **Compatible with all prior documentation** — config points at the exact registry files the
  research phases produced.

## Verification
- 68/68 foundation tests pass · tsc contract compiles · hidden-char guard clean over the whole
  repo · production `web`/`R`/`app`/`tests` diff vs `main` **empty** · production tests still
  green (99 JS + 11 R).

## Remaining work before Phase 2 (Anatomy)
1. **CI wiring (optional):** add a job to run `simulator/tests/run.mjs` (not done — avoids
   touching production CI this phase).
2. **Renderer selection:** introduce a real (Three.js/Canvas) renderer behind `createRenderer`.
3. **Scale-level population:** feed `scaleSystem` the per-level visible-structure lists from
   the biological registries at boot.
4. **Panel bodies:** replace empty shells with the evidence/citation/legend/navigation content
   (still no biology until Phase 2 anatomy).
5. **Scene registration API:** Phase 2 registers the first anatomy scene(s) through the
   existing `SceneManager` contract.

**Stop.** Foundation complete; ready for Phase 2 (Anatomy).
