# 3D Implementation Map — Phase 0 (Foundation Lock)

Locks the existing foundation and maps the Three.js work for Phases 1–7. Verified against the
repository at commit `a148c1c` (branch `stage2/deep-scientific-evidence-review`). Roadmap stays at
8 phases; no new phases.

## 1. Existing architecture summary

Zero-dependency vanilla **ES modules**, no bundler, no React, no `node_modules`, no lockfile.
Served as static files (GitHub Pages). Two front-ends exist:

| Surface | Path | Role |
|---|---|---|
| Public web tool | `web/index.html` | 4 tabs: Release comparison · Tissue penetration · Animated Tissue View · Nanoparticle Journey (2D canvas) |
| Simulator app | `simulator/index.html` + `src/main.js` | Phase 1–8A engine host; **non-rendering** by design |
| Immune demo | `simulator/teacher-demo.html` | Read-only Phase-7C canonical-frame view |

## 2. Reusable systems (DO NOT REBUILD)

| System | File | Classification |
|---|---|---|
| Renderer interface (`mount/setCamera/clear/dispose`) | `src/render/renderer.js` (`NullRenderer`) | **Directly reusable** — comment reserves WebGL/Three.js "behind this same interface" |
| Scene registry (register/activate/enter/exit/dispose) | `src/scene/sceneManager.js` | Directly reusable |
| Camera descriptor (position/target/up, persp/ortho, clip planes) | `src/camera/cameraSystem.js` | Directly reusable → drives `THREE.PerspectiveCamera` |
| Scale ladder L1–L6 + zoom→level mapping | `src/scale/scaleSystem.js`, `src/anatomy/zoomController.js` | Directly reusable = the human→cell scale ladder |
| Anatomy model / scenes / labels | `src/anatomy/*` | Reusable via adapter |
| Skin transport (layers, depth bands, barriers) | `src/biology/transportEngine.js`, `transportModel.js` | Directly reusable |
| Animation driver (`play/pause/reset/tick`, rAF + headless) | `src/biology/transportAnimator.js` | **Directly reusable — the master clock** |
| Release kinetics | `src/biology/releaseEngine.js`, `releaseModel.js`, `web/index.html` model core | Directly reusable |
| Uptake / endocytosis / intracellular / target engagement | `src/biology/{uptake,endocytosis,intracellularRelease,targetEngagement}*` | Reusable via adapter |
| Microenvironment (7A) + vascular (7B) | `src/biology/{microenvironment,vascular}Engine.js` | Reusable via adapter |
| Canonical ImmuneFrame builder (sole publisher) | `src/biology/immuneFrameBuilder.js` | Directly reusable — **read-only** |
| Timeline / replay | `src/render/immuneTimeline.js` (`ImmuneTimeline`, `ImmuneReplay`) | Directly reusable |
| Serialization / determinism | `src/biology/immuneSerialization.js` | Directly reusable |
| Transitions, evidence, prediction, confidence | `immuneTransitionPopulator.js`, `immuneEvidencePrediction.js`, `immuneConfidence.js` | Read-only inputs |
| Phase 8A adapter | `src/biology/immuneResistanceAdapter.js` | Read-only, untouched |
| 2D renderers / debugger / views | `src/render/{immuneRenderer,immuneDebugger,immuneViews,canvasRenderer}.js` | **Debug + scientific inspection — preserved** |
| Registries (115 JSON) | `simulator/data/*` | Directly reusable, unchanged |

**Missing / not modelled:** systemic PK. `transportEngine.js:61` — *"Target = centre of the dermis
band (topical target tissue; no systemic stage)"*; depth is clamped at the dermis. Capillary entry
and bloodstream transport are **NOT_MODELLED** for the topical route (consistent with the storyboard's
`NOT_APPLICABLE` S5). The 3D bloodstream scene is therefore a labelled **VISUAL_ONLY** sequence.

## 3. Current Three.js capability (audit result)

`three`, `@react-three/*`, GLTF/DRACO/KTX2/Meshopt loaders, `AnimationMixer`, `EffectComposer`,
existing Three.js scenes/render loops, shaders, post-processing: **NONE PRESENT** before this phase.
3D assets (`.glb/.gltf/.fbx/.obj/.hdr/.ktx2`): **NONE**. Images: 2 PNG chart exports only.

**Added in Phase 0:** `simulator/vendor/three/` — Three.js **r160** ESM (1.3 MB) + `GLTFLoader`,
`DRACOLoader`, `OrbitControls`, `BufferGeometryUtils` (1.4 MB total, MIT licence included). Addon
bare `'three'` imports rewritten to relative paths → **no import map, no CDN, no build step**.

## 4. Selected integration approach — **vanilla Three.js, locally vendored**

R3F is rejected: it needs React + JSX + a bundler, none of which exist — a framework migration
inside a 2-day deadline. Vanilla Three.js: zero build change, loads exactly like every other module,
deploys through the existing Pages workflow, and drops straight into the reserved `Renderer`
interface. Verified: real WebGL renders headless (canvas `data-engine="three.js r160"`).

## 5–8. Human asset assessment · face/hand/forearm quality · missing spec

**No human model exists** — nothing to assess for face, eyes, teeth, hair, hands, forearm topology,
UVs, skeleton, clips, morph targets or licence. No placeholder mannequin will be shipped as the
final human. Required asset (Phase 2 blocker), declared in `src/three/assetManifest.js`:

- **Format** GLB (glTF 2.0, Draco/Meshopt), **80k–150k tris**, PBR 2048² albedo/normal/roughness.
- **Rig** humanoid, Mixamo-compatible (`mixamorig:*` or `Hips/Spine/Shoulder/UpperArm/ForeArm/Hand`),
  separate thumb + 4 finger bones.
- **Face** believable proportions, correct eye placement, natural eyelids, no distorted mouth, no
  broken teeth, no empty sockets, no seams, no uncanny frozen expression, stable in close + medium shots.
- **Forearm** clean quad topology + even UVs (close-up + cream decal target).
- **Clips** idle · arm_raise/forearm_present · cream_application (hand rub) · neutral_reset. If absent:
  blend idle + procedural shoulder/elbow/wrist bone animation or a short two-bone IK reach (no full IK system).
- **Licence** redistribution-permitting attribution file.
- **Gate** Y-up, metre scale (~1.7 m), origin at feet, correct normals, textures resolve, skeleton binds,
  clips play, < 3 s load, disposes without leak. Loading ≠ approved.

Also missing (non-blocking): small 1k studio **HDR** (`RoomEnvironment` fallback acceptable).
Skin/capillary/tissue/particles are **procedural** — no assets needed.

## 9–10. Timeline + replay integration

**Authoritative narrative time = the existing simulation clock** (`transportAnimator` `timeH`/`step(dt)`
and engine `step/reset`; `ImmuneTimeline`/`ImmuneReplay` for frame-indexed seek). The 3D layer holds
**no** second scientific clock. `THREE.Clock` delta is used **only** for rendering mechanics
(`AnimationMixer`, particle smoothing) — never as narrative time.

`SceneDirector.update(visualState, renderDelta)` is a **pure function of `progress`**, so
play / pause / seek / reset / replay all follow one code path. Replay stays read-only: stored frames
are re-read, never recomputed.

## 11. Simulation → visual adapter mapping

`src/three/visualizationAdapter.js` (read-only). Every field carries provenance; absent values stay
`null` — **never 0**.

| Visual parameter | Source | Classification |
|---|---|---|
| progress | master timeline | SIMULATION_DERIVED |
| releasedFraction | `releaseEngine.stats` | SIMULATION_DERIVED |
| penetrationDepth, layerOccupancy | `transportEngine.stats` | SIMULATION_DERIVED |
| immuneControlState, frameAvailability | canonical ImmuneFrame | SIMULATION_DERIVED |
| particle speed / retention / diffusion rate | mapped from the above | EVIDENCE_BACKED_MAPPING |
| capillaryEntryFraction, bloodstreamFlowSpeed | — | **NOT_MODELLED** (null) |
| visibleParticleCount, RBC density, glow, camera speed | cinematography | **VISUAL_ONLY** |

Adapter never calculates biology, mutates frames/replay/registries/evidence/predictions, or zeroes
unavailable values (locked by 31 tests).

## 12–13. Scene architecture + scale strategy

`SceneDirector` (`src/three/sceneDirector.js`) — one render loop, one active scene, register/enter/
update/exit/dispose (mirrors `sceneManager.js`). Scenes: **HumanScene · SkinScene · BloodstreamScene ·
TissueScene** (cellular = a section of TissueScene).

**Scale strategy: separate scenes with controlled crossfades + staged camera transitions.** Each scene
uses its own local coordinate system at a comfortable scale; a full human, corneocytes and molecules
are **never** placed in one physically-scaled space (float precision + performance). Continuity comes
from matched crossfades and a continuous camera push, aligned to the existing L1–L6 ladder. Disposal
runs on every swap (`src/three/disposal.js`).

## 14. Camera shot plan (12 shots, contiguous 0→1)

| # | Shot | Scene | Progress | Target | Move |
|---|---|---|---|---|---|
| 1 | human_intro | human | 0.00–0.06 | head/torso | slow dolly-in |
| 2 | medium_body | human | 0.06–0.11 | upper body | arc |
| 3 | forearm_treat | human | 0.11–0.20 | forearm | push-in |
| 4 | cream_closeup | human | 0.20–0.26 | application site | macro push |
| 5 | skin_approach | skin | 0.26–0.32 | surface | dive |
| 6 | skin_section | skin | 0.32–0.46 | cross-section | lateral track |
| 7 | capillary_entry | bloodstream | 0.46–0.54 | capillary | enter |
| 8 | bloodstream_follow | bloodstream | 0.54–0.64 | lumen | follow |
| 9 | target_vessel | bloodstream | 0.64–0.70 | vessel wall | slow down |
| 10 | tissue_penetrate | tissue | 0.70–0.82 | ECM | push through |
| 11 | cellular_closeup | tissue | 0.82–0.94 | cell | orbit-in |
| 12 | final_outcome | tissue | 0.94–1.00 | cell | pull back |

## 15. Performance budget

Human ≤ 150k tris · skin scene ≤ 60k · tissue cells ≤ 120 (InstancedMesh) · RBCs ≤ 200 (Instanced) ·
drug particles ≤ 300 (one pooled InstancedMesh) · textures ≤ 2048² (1024² minor) · draw calls < 120 ·
lights ≤ 3 (1 shadow caster, 2048² map) · mixers ≤ 2 · post ≤ 1 pass (bloom, optional).
Techniques: InstancedMesh, shared geometry/materials, object pooling, explicit disposal, `pixelRatio ≤ 2`.

## 16. File map — Phases 1–7

**Phase 1 — 3D runtime shell + timeline bridge**
Reuse: `render/renderer.js`, `camera/cameraSystem.js`, `scene/sceneManager.js`, `transportAnimator.js`,
`immuneTimeline.js`. Extend: `src/three/sceneDirector.js`, `visualizationAdapter.js`.
New: `src/render/threeRenderer.js` (implements the `Renderer` interface), `src/three/runtime.js`
(canvas host + single loop + resize), `src/three/timelineBridge.js` (engine time → progress).
Tests: extend `tests/three3d.test.mjs` (bridge determinism, seek==play, dispose).

**Phase 2 — Real human + topical administration** *(BLOCKED on the human asset)*
New: `src/three/scenes/humanScene.js`, `src/three/assetLoader.js` (GLTF+Draco, cached, disposable),
`src/three/creamApplication.js`. Assets: `simulator/assets/human/human.glb` (+ licence), optional HDR.
Tests: asset gate (orientation/scale/normals/skeleton/clips), disposal.

**Phase 3 — 3D skin transport** New: `scenes/skinScene.js`, `particles/particleSystem.js` (pooled
InstancedMesh), `three/layerGeometry.js` (depth bands from the transport registry). Tests: layer depths
match the registry; particle count within budget; no biology in the scene.

**Phase 4 — Capillary + bloodstream** New: `scenes/bloodstreamScene.js`, `three/vesselPath.js` (Tube+
CatmullRom), `three/rbcInstances.js`. Tests: **stage renders with an explicit NOT_MODELLED/VISUAL_ONLY
label**; never presented as simulated PK.

**Phase 5 — 3D tissue penetration** New: `scenes/tissueScene.js`, `three/ecmField.js`,
`three/cellInstances.js`. Reuse: uptake/endocytosis/microenvironment outputs via the adapter.
Tests: unavailable→UNAVAILABLE (never 0); instance counts within budget.

**Phase 6 — Master cinematic sequence** Extend: `sceneDirector.js` (crossfades), new
`three/cameraDirector.js` (shot interpolation), `three/transitions.js`. Tests: 12 shots contiguous;
seek/reset/replay reproduce identical camera state.

**Phase 7 — Polish, QC, deployment** Extend: `web/index.html` (3D presentation ↔ 2D debug mode switch),
`.github/workflows/deploy-teacher-demo.yml` (ship `simulator/vendor/` + `assets/`),
`simulator/tools/verify-teacher-demo-site.mjs` (verify 3D assets in `_site`). Tests: full suite +
headless WebGL smoke + production diff.

**2D preserved throughout.** Existing renderers are reclassified as **debug / scientific inspection /
timeline + replay inspector / validation / fallback**, reachable via a mode switch; no redesign.

## 17. Known blockers

1. **Human GLB missing (blocks Phase 2 only).** Needs a licensed, presentation-quality rigged human
   per §5–8. Phases 1, 3, 4, 5 are unblocked.
2. Sandbox egress blocks CDNs (npm registry works) — assets must be vendored into the repo.
3. Systemic PK is not modelled — the bloodstream scene must stay explicitly labelled.

## 18. Phase 1 readiness

**READY.** Three.js r160 vendored + WebGL verified; SceneDirector, adapter, disposal, asset manifest
in place with 31 passing contract tests; the `Renderer` interface, camera system, scale ladder and
master clock are identified and unmodified. Phase 1 starts at `src/render/threeRenderer.js`.
