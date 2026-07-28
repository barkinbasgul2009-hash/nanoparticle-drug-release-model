# Polyglot Architecture Lock

**Status:** AUTHORITATIVE — binding technical policy for all remaining work in this repository.
**Established:** 2026-07-28
**Scope of the establishing task:** documentation only. No runtime, asset, test or dependency file
was created or modified when this document was written.
**Supersedes:** nothing. It sits *above* `docs/architecture.md` (Phase-1 audit) and
`3D_IMPLEMENTATION_MAP.md` (3D phase record) as the governing ownership policy; both remain valid
as historical records.

This document exists so the architecture survives context resets, new sessions, new contributors,
and future implementation prompts. Treat it as policy, not as a conversational preference.

---

## 1. Status and authority

| Property | Value |
|---|---|
| Authority | Binding for layer ownership, asset ownership, timeline behaviour, provenance, testing and acceptance |
| Applies to | Phase 2B onward, and any future refactor of Phases 0–2 |
| Change procedure | Amend this document in a dedicated task; never by side effect of an implementation task |
| Conflicts | Recorded in §23, never silently resolved |
| Next locked task | **Phase 2B — Blender-Authored Realism Migration** (§21). Not started. |
| Phase 3 | BLOCKED until Phase 2B passes its acceptance gates |

### Evidence classification used throughout

| Label | Meaning |
|---|---|
| `EXISTING AND VERIFIED` | Inspected in this repository on 2026-07-28; path and behaviour confirmed |
| `EXISTING BUT NOT VERIFIED` | Present, but its behaviour was not re-tested in the establishing task |
| `PLANNED — NOT PRESENT` | Does not exist; a future task will create it |
| `DEPRECATED/FALLBACK` | Exists and must be kept, but is not the primary path |
| `OPEN DECISION` | Deliberately unresolved; see §22 |
| `PROHIBITED` | Must not be added under the current roadmap |

---

## 2. Verified repository baseline

Everything in this section was inspected directly on 2026-07-28.

### 2.1 Toolchain

| Tool | Status | Value |
|---|---|---|
| R | `EXISTING AND VERIFIED` | 4.3.3 (2024-02-29) |
| Node | `EXISTING AND VERIFIED` | v22.22.2 |
| Three.js | `EXISTING AND VERIFIED` | r160, vendored at `simulator/vendor/three/` (`REVISION = '160'`) |
| Python | `EXISTING AND VERIFIED` | 3.11.15, system interpreter — used for a static file server and inspection scripts only |
| Blender | `PLANNED — NOT PRESENT` | **not installed in this environment** (`which blender` → nothing) |
| glTF/GLB | `EXISTING AND VERIFIED` | 2.0, asset generator recorded as "Khronos glTF Blender I/O v4.5.51" |
| TypeScript | `EXISTING AND VERIFIED` | `simulator/tsconfig.json`, `noEmit`, `allowJs:false`, `checkJs:false`, includes `src/types/**/*.ts` only |

### 2.2 Dependency management

| Item | Status | Detail |
|---|---|---|
| `package.json` | `EXISTING AND VERIFIED` | `type: module`, single script `test`, **no dependencies block** |
| Lockfile | `PLANNED — NOT PRESENT` | no `package-lock.json`, `yarn.lock` or `pnpm-lock.yaml` |
| `node_modules/` | `PLANNED — NOT PRESENT` | absent by design; Three.js is vendored instead |
| `renv.lock` / `DESCRIPTION` | `PLANNED — NOT PRESENT` | R reproducibility is **not** currently managed |

**Consequence:** the JS runtime has *zero* installed third-party dependencies. Three.js is committed
into the tree. This is a deliberate, working property of the repository and must not be replaced with
an npm install step as a side effect of another task (§20).

### 2.3 Scientific (R) layer — `EXISTING AND VERIFIED`

| Path | Role |
|---|---|
| `R/release_models.R` | Release kinetics reference implementation |
| `R/tissue_diffusion.R` | Tissue transport reference implementation |
| `R/parameters.R` | Parameter definitions |
| `R/metrics.R` | Derived metrics |
| `app/app.R` | Shiny developer interface |
| `examples/run_example.R` | Example driver |
| `tests/run_tests.R` | R test entry point (31 assertions passing) |
| `tests/testthat/test_models.R` | Model unit tests |
| `tests/regression/baseline_test.R`, `capture_baseline.R` | Golden-reference regression |

10 `.R` files total. The R layer **is physically present** and is the scientific reference
implementation. A JS reimplementation of the same equations lives inline in `web/index.html` and is
checked against the R-derived golden reference by `tests/js/model.test.mjs`.

### 2.4 Browser runtime — `EXISTING AND VERIFIED`

| Path | Role |
|---|---|
| `simulator/src/render/renderer.js` | Renderer interface + factory (`null`, `canvas`, `three`) |
| `simulator/src/render/threeRenderer.js` | WebGL renderer shell (mount / setCamera / render / dispose) |
| `simulator/src/render/canvasRenderer.js` | 2D anatomy renderer |
| `simulator/src/three/sceneDirector.js` | Scene registry + shot table for the **whole future film** |
| `simulator/src/three/humanApplicationScene.js` | Phase-2 application scene; owns its own `PerspectiveCamera` |
| `simulator/src/three/applicationChoreography.js` | Pure Phase-2 sequence data (stages, shots, camera keys) |
| `simulator/src/three/applicationRig.js` | Posing, IK, contact + torso-clearance measurement |
| `simulator/src/three/twoBoneIK.js` | Analytic two-bone IK |
| `simulator/src/three/graspController.js` | Object-aware hand grasp |
| `simulator/src/three/creamLayer.js`, `creamDispenser.js`, `creamProduct.js` | Cream film, extrusion, NANODERM product |
| `simulator/src/three/skinDeformation.js` | Localized post-skinning skin compression |
| `simulator/src/three/humanPresentation.js` | Renderer-side material correction for the human GLB |
| `simulator/src/three/boneMap.js` | Role → bone-name resolution |
| `simulator/src/three/visualizationAdapter.js` | Simulation → visual state, carries provenance |
| `simulator/src/three/predictiveVisualizationModel.js` | Deterministic predicted-visual model |
| `simulator/src/three/disposal.js` | GPU resource disposal |
| `simulator/src/render/immuneTimeline.js` | Immune-phase timeline/replay |

### 2.5 Assets — `EXISTING AND VERIFIED`

| Path | Status | Detail |
|---|---|---|
| `simulator/assets/human/human.glb` | ORIGINAL SOURCE | 18.86 MB, 39,848 tris, 53 bones, 30 finger bones, 10 embedded textures, 0 clips |
| `simulator/assets/human/dev-rig/dev-rig-michelle.glb` | `DEPRECATED/FALLBACK` | development rig only, flagged not-for-publication |
| `simulator/assets/ASSET_LICENCES.json` | Provenance record | licence status of every vendored asset |
| `*.blend` | `PLANNED — NOT PRESENT` | no Blender sources exist yet |
| `simulator/artifacts/` | `PLANNED — NOT PRESENT` | QA artifact directory does not exist yet |

### 2.6 Tests and tooling — `EXISTING AND VERIFIED`

| Layer | Entry point | Scale |
|---|---|---|
| R | `Rscript tests/run_tests.R` | 31 assertions |
| Production JS | `npm test` → `tests/js/model.test.mjs` | 99 assertions |
| Simulator | `node simulator/tests/run.mjs` | 43 suites, 5,860 assertions |
| Types | `npx tsc --noEmit -p simulator/tsconfig.json` | `src/types/**/*.ts` only |
| GLB gate | `simulator/tools/verify-human-asset.mjs` | 11 automated checks |
| GLB inspector | `simulator/tools/inspect-glb.mjs` | headless glTF parse |
| Frame capture | `simulator/tools/capture-application.mjs` | CDP-driven PNG capture |
| Video capture | `simulator/tools/record-application.mjs` | CDP + MediaRecorder WebM |

### 2.7 Documentation convention — `EXISTING AND VERIFIED`

Governing/root-level documents live at the repository root (`README.md`, `CHANGELOG.md`,
`3D_IMPLEMENTATION_MAP.md`); 213 topic documents live in `docs/`. **This lock is placed at the root**
to match the convention for governing documents and to remain discoverable.

---

## 3. Layer ownership

### 3.1 R — scientific computation

**Owns:** scientific calculation, biological models, mathematical simulation, pharmacokinetics,
transport, prediction models, scientific analysis and validation, scientific tests, canonical
scientific output.

**Does not own:** human/hand/camera animation, rigging, tube deformation, cream extrusion, skin
indentation authoring, browser rendering, Three.js scene management, GPU effects.

**Guarantee:** the existing R runtime is preserved. It must **not** be rewritten in Python because
Python happens to be available (§20).

### 3.2 Blender + Blender Python — build-time asset authoring

**Owns:** human asset preparation; skeleton/rig authoring; natural shoulder/arm/wrist/hand/finger
animation; grasp animation; tube squeeze and deformation authoring; cream-extrusion geometry; local
skin indentation authoring; shape keys and morph targets; IK/constraint authoring **and baking**;
the editable `.blend`; baked GLB generation; automated asset validation; Blender preview renders.

**Does not own:** the browser runtime, scientific calculation, canonical simulation state, or any
independent narrative clock.

**Python is build-time tooling only.** No Python web server (§20).

### 3.3 JavaScript + Three.js — browser experience

**Owns:** GLB loading; manifest loading and validation; real-time scene management; master-timeline
integration; camera management; play/pause/reset/seek/reverse-seek/replay; scene transitions;
human→skin scale transition; particle visualization; rendering; UI; device compatibility; loading
states; disposal; runtime performance.

**Must not** recalculate or invent scientific biology. It visualizes scientific outputs, explicitly
predicted visual outputs, Blender-authored assets, and visual-only presentation effects.

### 3.4 GLSL — visual effects

**Owns:** skin surface detail; cream sheen/wetness/edge/thickness cues; roughness and specular
differences; nanoparticle effects; microscopic surface detail; tissue/cell density cues.

**Does not own:** scientific computation, canonical state, hidden scientific defaults, PK
calculation, or missing-data replacement.

### 3.5 Types and contracts

A full JS→TypeScript migration is **out of roadmap** (§20). For *new critical contracts*, choose the
best fit from: TypeScript declarations in `simulator/src/types/`, JSDoc type checking, JSON Schema,
or runtime validation.

Critical contracts: animation manifest; asset version; clip names; morph-target names; scene events;
camera events; provenance; availability; simulation→visual adapters; compatibility metadata.

**Verified constraint:** `simulator/tsconfig.json` currently sets `allowJs:false` and `checkJs:false`
and includes only `src/types/**/*.ts`. TypeScript therefore checks **declarations only** today. Using
JSDoc checking for a new contract would require a tsconfig change — that is an `OPEN DECISION`
(§22, OD-3), not an assumption.

---

## 4. Non-rewrite guarantees

The following must be preserved and must **not** be broadly rewritten. New systems are additive and
parallel.

| Preserved system | Location |
|---|---|
| R scientific runtime | `R/`, `app/app.R`, `tests/` |
| Biological engines, prediction, evidence/confidence, canonical frames, serialization | `simulator/src/**` |
| Master timeline / replay / seek / pause / reset | `simulator/src/render/immuneTimeline.js`, progress-driven scene code |
| 2D scientific/debug view | `simulator/src/render/canvasRenderer.js`, `web/index.html` |
| Three.js renderer foundation | `simulator/src/render/renderer.js`, `threeRenderer.js` |
| Original human GLB | `simulator/assets/human/human.glb` |
| Human asset verifier | `simulator/tools/verify-human-asset.mjs` |
| Procedural animation fallback | `applicationChoreography.js`, `applicationRig.js`, `graspController.js`, `twoBoneIK.js` |
| Camera foundation | `humanApplicationScene.js` camera + `applicationChoreography.js` camera keys |
| Test infrastructure | `simulator/tests/`, `tests/`, `tests/js/` |

If an existing system conflicts with this lock: **document the conflict (§23), identify the smallest
future migration, and do not silently rewrite it.**

---

## 5. Actual layer / file mapping

| Layer | Owns (verified paths) | Language |
|---|---|---|
| Scientific | `R/*.R`, `app/app.R`, `tests/testthat/`, `tests/regression/` | R |
| Scientific mirror | `web/index.html` inline model core (checked against R) | JS |
| Asset authoring | *(none yet)* → `simulator/assets/blender/` | Blender + Python |
| Runtime scene | `simulator/src/three/**` | JS |
| Renderer | `simulator/src/render/**` | JS |
| Shaders | `onBeforeCompile` injections in `creamLayer.js`, `skinDeformation.js`, `creamProduct.js` | GLSL |
| Contracts | `simulator/src/types/**/*.ts` | TypeScript (declarations) |
| Build/QA tooling | `simulator/tools/*.mjs` | JS (Node) |
| Static serving for QA | `python3 -m http.server` | Python (build-time only) |

---

## 6. Original / authoring / generated asset policy

| Category | Path | Status | May be committed? | Overwrite rule |
|---|---|---|---|---|
| **A. Original immutable source** | `simulator/assets/human/human.glb` | `EXISTING AND VERIFIED` | Already committed | **NEVER overwritten by generated output.** This is the rollback source. |
| **B. Editable authoring source** | `simulator/assets/blender/phase2_application_source.blend` | `PLANNED — NOT PRESENT` | Yes — it is the only way to re-derive the baked asset | Hand-authored; never machine-overwritten without intent |
| **C. Generated runtime asset** | `simulator/assets/human/human_application_baked.glb` | `PLANNED — NOT PRESENT` | `OPEN DECISION` (§22, OD-5) | Regenerated freely; must never be written to path A |
| **D. Generated runtime contract** | `simulator/assets/human/human_application_manifest.json` | `PLANNED — NOT PRESENT` | Yes — the runtime needs it | Regenerated with C, always as a matched pair |
| **E. Build tooling** | `simulator/tools/blender/build_phase2_realism.py`, `run_phase2_blender_build.bat` | `PLANNED — NOT PRESENT` | Yes | Hand-authored |
| **F. QA artifacts** | `simulator/artifacts/phase2-final-qa/` | `PLANNED — NOT PRESENT` | `OPEN DECISION` (§22, OD-6) | Regenerated freely |

**Naming note:** the paths above follow the repository's existing conventions
(`simulator/assets/<family>/`, `simulator/tools/<tool>`), which were verified. They may be adapted
with justification, **but the five ownership categories must remain physically separate.**

**Rollback source:** `simulator/assets/human/human.glb` plus the procedural fallback. Deleting every
generated artefact must leave a working system.

---

## 7. Master timeline invariant — NON-NEGOTIABLE

There is exactly **one** narrative/scientific time authority:

```
masterProgress ∈ [0.00, 1.00]
```

Every narrative visual state derives from it: baked animation time, camera, product visibility, tube
squeeze, cream extrusion, skin indentation, cream spread, scene transitions, nanoparticle
progression, scientific frame selection.

Baked-animation mapping:

```
clipTime = masterProgress × clipDuration
```

**Forbidden as narrative sources:**

- a second `THREE.Clock` treated as narrative time
- `mixer.update(delta)` as the authoritative narrative source (use `action.time = …` / `mixer.setTime(…)`)
- hidden elapsed-time accumulators
- `setInterval` / `setTimeout` as animation state
- unsynchronised per-scene timers
- independent animation loops per scene

Render delta may be used **only** for rendering mechanics that do not define canonical narrative
state (damping, smoothing that is re-derivable, FPS metering).

**Invariant:** a direct seek to any `masterProgress` must reconstruct the *same* visual state as
continuous playback to that value — forwards or backwards.

**Currently verified mechanism:** `ApplicationRig.restorePose()` resets every driven bone to its
captured rest transform at the start of each solve, making `solve(p)` pure in `p`. Any Phase-2B
system must preserve an equivalent guarantee.

---

## 8. Procedural / baked exclusivity

Exactly one presentation mode is active:

```
presentationMode = "blender-baked" | "procedural-fallback"
```

**Status:** `PLANNED — NOT PRESENT`. No `presentationMode` flag exists in the repository today
(verified). Do not implement it in an architecture task.

The two modes must **never** simultaneously drive the same: bones, skeleton, product object, cream
object, morph target, skin indentation, tube deformation, or camera channel (unless camera ownership
is explicitly separated *and* tested).

**Documented risks of dual ownership:** bone jitter; pose snapping; quaternion sign conflicts;
finger rotation conflicts; morph-target fighting; nondeterministic replay; frame-to-frame instability.

| Rule | Value |
|---|---|
| Safe default | `procedural-fallback` — the verified path |
| Activation | Only after the baked asset passes every gate in §16 and §17 |
| Fallback retention | Keep the procedural path until the project completes or it is separately retired |
| Rollback | Flip the flag back; no asset deletion required |

---

## 9. Manifest contract

One authoritative animation manifest. Blender, the Three.js runtime and camera choreography must not
maintain duplicated event timings in unrelated files. **This directly addresses conflict C-1 (§23).**

### 9.1 LOCKED NOW — field names, ownership, validation

| Field | Owner | Notes |
|---|---|---|
| `schemaVersion` | Contract | Increment on structural change |
| `assetVersion` | Blender build | Identifies the baked asset revision |
| `assetPath` | Blender build | Points at category C (§6) |
| `clipName` | Blender build | Must exist in the GLB |
| `fps` | Blender build | Authoring frame rate |
| `durationSeconds` | Blender build | Authoritative clip length |
| `morphTargets` | Blender build | Name → semantic role mapping |
| `events[]` | Blender build | `{ name, progress }`, progress ∈ [0,1] |
| `assetChecksum` | Blender build | Compatibility identity for the paired GLB |
| `boneMapVersion` | Contract | Skeleton compatibility (§11) |
| `provenance` | Contract | Per §12 |
| `minimumRuntime` | Contract | Three.js revision / WebGL requirements |
| `fallbackAvailable` | Contract | Whether `procedural-fallback` can serve this sequence |

### 9.2 GENERATED / CONFIRMED IN PHASE 2B

Actual duration, actual FPS, actual event progress values, actual clip name, actual morph-target
inventory, final checksum/version. **Do not invent these before the animation exists.**

### 9.3 Event taxonomy — CONTRACT CANDIDATES

`productEstablishStart`, `dispensePreparation`, `dispenseStart`, `creamContact`, `handApproach`,
`skinContact`, `spreadStart`, `releaseStart`, `heroStart`.

Treat as candidates until validated against repository conventions in Phase 2B. Note that the
existing procedural stage vocabulary (`neutral`, `present`, `product_raise`, `dispense_prep`,
`dispense`, `stow`, `contact`, `stroke_1`, `stroke_2`, `release`, `hold`) is close but **not
identical** — reconciling the two is Phase-2B work, recorded as OD-2 (§22).

### 9.4 Validation strategy

`OPEN DECISION` (OD-3). No JSON Schema validator exists in the repository (verified: no `ajv`, no
schema files, and no installed dependencies at all). Candidates: hand-written runtime validation in
plain JS (consistent with the zero-dependency policy), a TypeScript declaration plus runtime guard,
or adding a schema validator (which would require introducing dependency management — see OD-1).

---

## 10. Blender export policy

**A working Blender viewport is not acceptance.** The exported GLB is the only artefact that matters.

Phase 2B export must ensure:

- IK results **baked** to bone keyframes
- constraint results **baked** to bone/object keyframes
- tube squeeze as exportable shape keys / morph targets or baked transforms
- skin indentation as exportable shape keys / morph targets
- cream stages as exportable mesh / morph / transform animation
- glTF-compatible PBR materials only
- no Blender-only shader nodes required at runtime
- no control-rig helper objects in the runtime asset
- no runtime dependency on Blender physics
- no runtime dependency on Python

The exported GLB must be **independently validated** for: loadability, skeleton, hierarchy, bone
names, clip presence, clip duration, morph targets, textures, materials, scale, orientation, absence
of external references, and actual browser playback.

Blender-only constraints, drivers, cloth, soft-body, fluid, unsupported modifiers and procedural
materials **must be baked or converted** to glTF-compatible representations before export.

---

## 11. Skeleton compatibility

The generated GLB must preserve — unless a versioned migration is explicitly approved — bone names,
skeleton hierarchy, root structure, skin weights, bone-role compatibility, scale and orientation.

**Verified current skeleton** (Unreal/MakeHuman naming, resolved by `simulator/src/three/boneMap.js`):

| Role | Bone | Role | Bone |
|---|---|---|---|
| root | `Root` | upperArmL/R | `upperarm_l` / `upperarm_r` |
| spine | `spine_01` | forearmL/R | `lowerarm_l` / `lowerarm_r` |
| chest | `spine_02` | handL/R | `hand_l` / `hand_r` |
| neck | `neck_01` | shoulderL/R | `clavicle_l` / `clavicle_r` |
| head | `head` | fingers | `{index,middle,ring,pinky,thumb}_0{1,2,3}_{l,r}` |

Required role compatibility: root/hips, spine, chest, neck, head, shoulders, upper arms, forearms,
hands, finger chains.

`simulator/tools/verify-human-asset.mjs` **must be rerun on every generated asset.** If a bone-map
change becomes necessary: version the map, preserve original-asset compatibility, add tests, and
document the migration and fallback. **The bone map was not changed in the establishing task.**

---

## 12. Provenance policy

Every visual value carries exactly one classification:

| Class | Meaning | Example |
|---|---|---|
| `SIMULATION_DERIVED` | Supplied directly by the scientific runtime | Model-derived skin penetration depth |
| `PREDICTED_VISUAL` | Estimated from scientific inputs for presentation; **not** canonical output | Visually estimated bloodstream concentration |
| `VISUAL_ONLY` | Authored purely for visual communication | Decorative RBC count; camera speed; particle glow |

**Missing scientific data must never silently become zero. UNAVAILABLE is not zero.** Use explicit
states: `unavailable`, `not-modelled`, `predicted`, `simulation-derived`.

Three.js and GLSL must not fabricate canonical science.

**Where provenance belongs:** in the manifest (`provenance` field, §9.1); in
`simulator/src/three/visualizationAdapter.js` output (already carries provenance —
`EXISTING AND VERIFIED`); and enforced by runtime validation at the manifest-load boundary
(`PLANNED — NOT PRESENT`).

---

## 13. Version and reproducibility policy

| Item | Classification | Value |
|---|---|---|
| R | `VERIFIED CURRENT` | 4.3.3 |
| Node | `VERIFIED CURRENT` | v22.22.2 |
| Three.js | `VERIFIED CURRENT` | r160 (vendored) |
| glTF/GLB | `VERIFIED CURRENT` | 2.0 |
| Python | `VERIFIED CURRENT` | 3.11.15 (build-time only) |
| Blender | `TARGET` | 4.5.x LTS — **not installed here; not a repository fact** |
| Blender embedded Python | `UNKNOWN` | Determined by the Blender build once available |
| Node lockfile | `PLANNED VALIDATION` | none exists (OD-1) |
| R reproducibility | `PLANNED VALIDATION` | no `renv.lock`/`DESCRIPTION` (OD-4) |

Future Blender build tooling **must** check the Blender version, fail clearly on an unsupported
version, and never silently produce a materially different asset.

**Dependency policy:** the repository currently vendors Three.js and has **no installed npm
dependencies and no lockfile** (verified). Do not introduce npm dependency management merely to
satisfy a documentation or asset task. If a future task genuinely requires a dependency, that is a
scoped decision (OD-1), not a side effect.

**R policy:** `renv` was **not** initialised in the establishing task, per instruction. Recorded as a
future bounded decision (OD-4).

---

## 14. Performance and file-size policy

Phase-2B browser-delivery gates (thresholds to be set with real measurements in Phase 2B):

GLB size · texture dimensions · triangle count · draw calls · material count · animation-track count
· keyframe count · morph-target count · memory use · load duration · mobile Safari/iPad
compatibility · disposal/leak behaviour · fallback behaviour.

**Locked principles:**

- avoid unnecessary 4K textures; prefer 1K–2K where visually sufficient
- avoid unnecessary morph targets
- optimise animation tracks only *after* visual correctness
- never export helper geometry
- include loading states
- retain a low-power fallback
- test disposal
- **do not sacrifice scientific or visual correctness for premature micro-optimisation**

**Reference point:** the current original `human.glb` is 18.86 MB / 39,848 triangles / 10 textures.
A baked asset materially larger than this needs justification.

---

## 15. Future single-command build target

`PLANNED — NOT PRESENT`. Documented, not implemented.

| # | Step |
|---|---|
| 1 | R scientific validation |
| 2 | Blender version check |
| 3 | Blender Python asset build |
| 4 | Save source `.blend` |
| 5 | Export baked GLB |
| 6 | Generate manifest |
| 7 | Verify GLB |
| 8 | Verify skeleton / bone roles |
| 9 | Validate manifest |
| 10 | JavaScript / Three.js tests |
| 11 | Type checking |
| 12 | Browser preview |
| 13 | Visual capture / video |
| 14 | Final report |

Preferred entry point: `simulator/tools/blender/run_phase2_blender_build.bat` (or a
repository-conventional equivalent).

The pipeline must **stop on failure**, report the failing layer, never overwrite original assets,
preserve logs, and keep rollback possible.

---

## 16. Test ownership

| Layer | Responsibilities |
|---|---|
| **R** | Scientific model correctness; prediction correctness; formulas; biological invariants; availability; provenance of scientific output |
| **Blender asset** | Blender version; source file; generated GLB; skeleton; hierarchy; bone roles; clip; morph targets; tube squeeze; skin indent; cream stages; textures; local references; export cleanliness |
| **Three.js** | GLB loading; manifest loading and validation; clip lookup; `masterProgress → clipTime` mapping; deterministic replay; seek; reverse seek; reset; presentation-mode exclusivity; procedural fallback; disposal; loading-failure behaviour; provenance/availability validation |
| **Visual QA** | Natural shoulder motion; no elbow popping; no wrist snapping; no hand-through-torso; no finger/tube penetration; natural grasp; visible tube squeeze; visible nozzle extrusion; cream reaches skin; skin indentation visible; cream spread visible; camera smoothness; hero-shot readability |

**Technical tests are not a substitute for visual realism.** This repository has already produced
suites that passed while the rendered result was rejected; that outcome is the reason this rule is
locked.

---

## 17. Video-based acceptance policy — BLOCKING

Static screenshots alone are **insufficient** for major human-animation acceptance.

Phase-2B acceptance must include: a Blender authored-preview video; a final Three.js normal-speed
browser video; a half-speed browser video where practical; selected frame captures; a
procedural-versus-baked A/B comparison; desktop review; and mobile/iPad review where available.

**Without video QA, reports must not claim:** motion realistic · natural grip · no snapping · camera
smooth · cream clearly visible · no flicker.

**Known environmental risk (C-5, §23):** video capture has been attempted in this container and does
not complete at the required frame rate. `simulator/tools/record-application.mjs` is correct and
works at small scale, but SwiftShader software rendering plus software VP9 encoding could not produce
a full-length 30 fps clip. Phase 2B must plan for GPU-capable capture or an explicitly agreed reduced
spec. **This is a process blocker for Phase 2B acceptance, not a defect in the tooling.**

---

## 18. Feature-flag / A/B migration order

Documented; **not implemented**.

1. Preserve original `human.glb`
2. Produce Blender source separately
3. Produce generated baked GLB separately
4. Validate the generated asset in isolation
5. Add the presentation-mode feature flag
6. Keep the procedural fallback intact
7. Bind the baked clip to the master timeline
8. Compare procedural vs baked at matched progress points: neutral · product establish · dispense preparation · extrusion · contact · spread · hero
9. Normal-speed video QA
10. Half-speed video QA
11. Desktop test
12. Mobile/iPad test
13. Change the default **only** if baked is clearly superior and stable
14. Keep the fallback until the project completes or it is separately retired

---

## 19. Change-management checklist

Every broad technical task must answer these **before** starting:

1. Which layer owns this task?
2. Which existing system will it use?
3. Which systems must it not change?
4. What is the input contract?
5. What is the output contract?
6. How does it bind to the master timeline?
7. What is the fallback?
8. What is the test plan?
9. What is the visual acceptance plan?
10. Which files may change?
11. Which files must remain untouched?
12. What is the rollback plan?

No broad refactor begins without these answers.

---

## 20. Prohibited scope

**Prohibited for the current roadmap:** Rust · C++ · Unreal Engine · Unity · a separate Python web
server · microservice architecture · a real-time Blender↔browser connection · mass JS→TypeScript
migration · mass R→Python migration.

**Prohibited in the architecture-lock task specifically:** runtime refactoring · new renderer ·
new animation implementation · asset generation · Blender execution · build-script generation ·
feature-flag implementation · schema implementation · manifest implementation · GLB export ·
package-manager migration · Phase 2B implementation · Phase 3 work · automatic merge.

---

## 21. Phase 2B boundary

**Next locked roadmap task: Phase 2B — Blender-Authored Realism Migration.** Not started.

Its future scope: preserve original `human.glb`; create the Blender authoring source; author natural
body/arm/wrist/hand/finger motion; improve product grasp; create squeezable tube deformation; create
cream extrusion stages; create local skin indentation; improve cream spread; bake animation and
constraints; export the final GLB; generate the authoritative manifest; integrate with the Three.js
master timeline; keep the procedural fallback; A/B test; validate with browser video.

**Phase 3 remains blocked** until Phase 2B passes its acceptance criteria. The roadmap is not to be
altered and no new phase invented.

---

## 22. Open decisions

| ID | Decision | Blocking? | Recommended resolution | Resolve in |
|---|---|---|---|---|
| OD-1 | No Node lockfile / no installed dependencies | Non-blocking | Keep vendoring; introduce dependency management only if a future task genuinely needs a package | The task that first needs a dependency |
| OD-2 | Manifest event taxonomy vs existing procedural stage names differ | Non-blocking | Map procedural stages → manifest events; keep both, one canonical | Phase 2B |
| OD-3 | No manifest validation mechanism; `tsconfig` checks declarations only | Blocking for manifest load | Prefer hand-written runtime validation (zero-dependency) + a `.d.ts` contract | Phase 2B |
| OD-4 | No R reproducibility lock (`renv`/`DESCRIPTION`) | Non-blocking | Add `renv` in a dedicated scientific-reproducibility task | Separate task |
| OD-5 | Whether the generated baked GLB is committed | Blocking for Phase 2B repo hygiene | Likely commit (no build server exists), but confirm against repo size budget | Phase 2B start |
| OD-6 | Whether QA video artifacts are committed | Non-blocking | Likely commit small clips only; large clips referenced externally | Phase 2B |
| OD-7 | Blender executable path / availability | **Blocking for Phase 2B execution** | Owner supplies a Blender 4.5.x LTS environment, or Phase 2B runs on the owner's machine | Before Phase 2B |
| OD-8 | Camera ownership if baked clips carry camera tracks | Blocking for exclusivity | Keep camera in Three.js; do not export camera tracks unless separately tested | Phase 2B |

---

## 23. Conflict register

| ID | Conflict | Evidence | Layer | Blocking? | Recommended resolution | Resolve in |
|---|---|---|---|---|---|---|
| **C-1** | **Two different `SHOTS` tables both spanning progress 0.00–1.00.** `sceneDirector.js` defines 12 shots across `human/skin/bloodstream/tissue` for the whole future film; `applicationChoreography.js` defines 6 shots for the Phase-2 application act alone. Both claim the same normalized range. | `grep "export const SHOTS"` → both files | JS runtime | Non-blocking today (the Phase-2 preview drives `humanApplicationScene` directly and does **not** register it with `SceneDirector`; only `three-dev.html` imports the director) | Make the director's shot table the film-level index and the choreography's the act-level detail, with an explicit act→film progress mapping. Do not duplicate timings in a third place. | Phase 2B or the first multi-scene task |
| **C-2** | `humanApplicationScene.js` owns a `PerspectiveCamera` while `sceneDirector.js` also carries camera intent (`target`, `move`) per shot. | Both files inspected | JS runtime | Non-blocking today | Declare the scene the camera owner; the director supplies intent only. | Phase 2B |
| **C-3** | No `presentationMode` flag exists, so procedural/baked exclusivity is currently unenforceable. | `grep presentationMode` → no match | JS runtime | Blocking **for Phase 2B integration only** | Implement the flag as step 5 of §18 | Phase 2B |
| **C-4** | `simulator/artifacts/` does not exist, but §17 requires video artifacts there. | Directory listing | QA | Non-blocking | Create it in Phase 2B alongside the first artifact | Phase 2B |
| **C-5** | **Video QA cannot currently be produced at the required spec in this container.** | Full-length 30 fps capture attempted and did not complete; 11-frame capture succeeded in 7.4 s | QA / environment | **Blocking for Phase 2B acceptance** | GPU-capable capture environment, or an explicitly agreed reduced frame-rate spec | Before Phase 2B acceptance |
| **C-6** | Blender is not installed. | `which blender` → nothing | Asset authoring | **Blocking for Phase 2B execution** | See OD-7 | Before Phase 2B |
| **C-7** | `docs/architecture.md` describes a "target 4-layer architecture" from the Phase-1 audit that predates the 3D work and does not mention Blender, GLSL or asset authoring. | `docs/architecture.md` §1 | Documentation | Non-blocking | Retained as a historical Phase-1 record; **this lock governs where they differ**. No rewrite. | — |

No conflict above was silently resolved.

---

## 24. Rollback and fallback policy

| Scenario | Response |
|---|---|
| Baked asset is worse than procedural | Set `presentationMode = "procedural-fallback"`. No asset deletion needed. |
| Baked asset fails to load | Runtime must fall back automatically and surface a loading state — never a blank scene. |
| Manifest missing or invalid | Refuse the baked path, fall back, and report the validation failure. Do not guess values. |
| Generated GLB corrupt | Regenerate from the `.blend`; if that fails, fall back to `human.glb` + procedural. |
| Bone map incompatible | Fail loudly in `verify-human-asset.mjs`; do not auto-migrate. |
| Everything generated deleted | System must still run from `human.glb` + procedural fallback. **This is the definition of a safe rollback.** |

---

## Cross-references

- `3D_IMPLEMENTATION_MAP.md` — 3D phase-by-phase record (Phases 0–2). Historical; not superseded.
- `docs/architecture.md` — Phase-1 architecture audit. Historical; see C-7.
- `simulator/assets/ASSET_LICENCES.json` — asset provenance and licence status.
