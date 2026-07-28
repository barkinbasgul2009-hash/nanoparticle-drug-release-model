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

## 5–8. Human asset assessment · face/hand/forearm quality · licence

**RESOLVED — the final human is present at `simulator/assets/human/human.glb`** (supplied by the
project owner, exported from Blender on 2026-07-28). It replaces nothing: every earlier candidate was
rejected and no placeholder was ever shipped. Full provenance in `assets/ASSET_LICENCES.json`;
acceptance record in `src/three/assetManifest.js` (`ASSETS.human.accepted`).

### Measured statistics (from the real file)

| | |
|---|---|
| generator | Khronos glTF Blender I/O v4.5.51 (glTF 2.0, uncompressed) |
| geometry | **39,848 triangles**, 9 meshes, 9 materials |
| textures | 10 textures / 10 images, **all embedded** (2048² skin + hair + suit, 1024² eye/shoes/tongue, 512² brows/lashes) |
| skeleton | 1 skin, **53 bones**, all 9 meshes skinned, **30 finger bones** (5 digits × 3 joints × 2 hands) |
| clips | **0** — motion is procedural (see below) |
| morph targets | 0 |
| size | 17.98 MB, **0 external references**, no required extensions |
| bounds | Y-up, **≈1.78 m**, origin at the feet, centred on X |

### Skeleton naming — bone map extended

The rig uses **Unreal/MakeHuman naming**, not Mixamo. `src/three/boneMap.js` was extended so all
13 roles resolve; the Mixamo dev rig still resolves 13/13 (no regression):

`Root · pelvis · spine_01..03 · clavicle_l/r · upperarm_l/r · lowerarm_l/r · hand_l/r · {index,middle,ring,pinky,thumb}_0{1,2,3}_{l,r} · neck_01 · head · thigh/calf/foot/ball_l/r`

| role | bone | role | bone |
|---|---|---|---|
| root | `Root` | upperArmL/R | `upperarm_l` / `upperarm_r` |
| spine | `spine_01` | forearmL/R | `lowerarm_l` / `lowerarm_r` |
| chest | `spine_02` | handL/R | `hand_l` / `hand_r` |
| neck | `neck_01` | shoulderL/R | `clavicle_l` / `clavicle_r` |
| head | `head` | | |

`tools/inspect-glb.mjs` previously carried a **duplicate** copy of the pattern table and rejected this
rig while the runtime would have accepted it. It now imports `buildBoneMap` from `boneMap.js`, so the
CLI gate and the runtime can never disagree again.

### Visual review (7 rendered views, headless WebGL, inspected)

Full-body front · medium upper body · face + eyes · hand + fingers · bare forearm · skeleton debug ·
cream-application pose @ 0.70.

**Clean:** face proportions, eyes (brown irises correctly placed, natural lids, no empty sockets),
closed undistorted mouth, ears, no facial texture seams, matte non-plastic skin, **all ten fingers
separate** with believable proportions, undeformed wrists, connected clothing with no clipping,
correct skeleton deformation at shoulders/elbows, correct scale and orientation.

**Treatment site:** the figure wears a **short-sleeve t-shirt**, so the forearm is continuous bare
skin from the sleeve hem through elbow, wrist and hand — exactly what the topical application needs.

**Limitations (non-blocking, recorded honestly):**
1. The afro hair is **card-based** and shows shell banding plus a lighter fringe band at face-close
   range. It never occludes the face or the treatment area.
2. The MakeHuman **watermark is baked into the t-shirt and hair textures** and is legible in medium
   shots. Cosmetic; flagged for the owner before public release.
3. **Licence not independently verified** — see `ASSET_LICENCES.json`; redistribution is held pending
   the owner's confirmation.

### Renderer-side correction (the asset itself is untouched)

The export declares **`alphaMode: BLEND` on all 9 materials** — a Blender exporter default — even
though the skin, suit and tongue textures have **no alpha channel at all** (plain RGB). In three.js
that sets `transparent = true`, which disables depth writing, so:

* the face stopped occluding the teeth/tongue → the head rendered as a **gaping mouth full of teeth**;
* the hair/brow/lash cards drew as unsorted **black slabs across the eyes and forehead**;
* forcing the eye fully opaque hid the iris behind MakeHuman's transparent **cornea shell**.

`src/three/humanPresentation.js` fixes this purely in the renderer: genuine cut-outs (hair, brows,
lashes, eyes) become **alpha-TESTED** (glTF `MASK`) and everything else becomes properly **opaque**,
plus sRGB/linear map tagging and skin/eye/hair surface response. No geometry, UV, skeleton, biology,
timeline or replay code was touched.

### Animation

The GLB ships **zero clips**, so `ASSETS.humanAnimations` is `PROCEDURAL`:
`HumanAnimationController.apply(progress)` drives 8 bones (both arms' shoulder / upperArm / forearm /
hand) as a **pure function of master-timeline progress** — verified at 0.70 with **8 driven, 0 skipped**
on this skeleton, and bit-identical across play / pause / seek / reset / replay.

Known gap for Phase 2: flexion is driven about X only, so the applying hand does not yet **contact**
the opposite forearm. Closing that is scene work (reach offset or two-bone IK), not an asset gap.

**Environment: RESOLVED.** `RoomEnvironment` is vendored locally and applied through `PMREMGenerator`
with ACES tone mapping + sRGB output and a soft key/fill/rim rig — believable skin and readable eyes
with **no runtime CDN and no HDR file to licence**. Skin/capillary/tissue/particles and the cream
container remain **procedural** — no assets needed.

**Drop-in path preserved:** any compliant humanoid GLB at `simulator/assets/human/human.glb` still
loads with no code changes; `node simulator/tools/verify-human-asset.mjs <file>` gates it.

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

## 16b. Predictive visualization (completion patch)

The scientific runtime stops at the dermis, so everything downstream is produced by
`src/three/predictiveVisualizationModel.js` (read-only, deterministic) with parameters in
`src/three/predictiveVisualConfig.js` (`pvm-1.0.0`). Outputs: `relativePlasmaConcentration`,
`bloodstreamParticleDensity`, `systemicArrivalProgress`, `remainingApplicationSiteFraction`,
`predictedTargetArrival`, `predictedExtravasatedFraction`, `predictedInterstitialConcentration`,
`predictedPenetrationDepth`, `predictedECMRetention`, `predictedCellularUptake`.

Every output is tagged **PREDICTED_VISUAL** with value / confidence / assumptions / modelVersion /
inputSources / unavailableReason. Normalized first-order absorption–elimination (analytic ka≈ke limit);
**no clinical units**; missing inputs stay `null` (a real zero dose is distinct from unavailable). The
conservation chain is enforced by construction: systemic ≥ arrival ≥ extravasation ≥ interstitial ≥
{penetration, uptake}. `buildCombinedVisualState()` keeps `simulation` and `prediction` in separate
branches so scenes can never present a prediction as a measurement. Skin transport represents
**released API**, not intact carrier — carried in `particleIdentity` and required in labels.

## 17. Known blockers

1. ~~Human GLB missing (blocks Phase 2 only).~~ **CLEARED 2026-07-28** — the owner supplied
   `simulator/assets/human/human.glb`; it passes the automated gate and the visual review (§5–8).
   Two follow-ups remain, neither blocking Phase 1: **licence confirmation** before public
   redistribution, and the **MakeHuman watermark** baked into the t-shirt/hair textures.
2. Sandbox egress blocks CDNs (npm registry works) — assets must be vendored into the repo.
3. Systemic PK is not modelled — the bloodstream scene must stay explicitly labelled.

## 18. Phase 1 readiness

**READY.** Three.js r160 vendored + WebGL verified; SceneDirector, adapter, disposal and the asset
manifest are in place; the `Renderer` interface, camera system, scale ladder and master clock are
identified and unmodified. The final human is present, gated and animation-controller-compatible, so
**Phase 2 is no longer asset-blocked either** (`missingFor(2)` is now empty).

Test coverage at Phase-0 close: **3,976** simulator assertions pass (including 110 asserted directly
against the real `human.glb`), plus 99 production-JS and 31 R assertions, with `tsc --noEmit` clean.
Phase 1 starts at `src/render/threeRenderer.js`.
