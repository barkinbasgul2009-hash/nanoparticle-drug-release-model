# Phase 2B — Blender-authored realism migration

**Blender 4.5.12 LTS** (`blender-v4.5-release`) · clip `phase2_application` · 14.000 s @ 30 fps ·
original `human.glb` sha256 `6114fceafe6c4840c225eec98bc57eaf622886ed168d9d4b1cf4d09fa4415b7e`
**unchanged**.

---

## 1. What was built

The Phase-2 presentation is now authored in Blender and baked onto the original deform skeleton. The
procedural implementation is preserved, still works, and remains the default until every acceptance
gate is signed off.

```
simulator/assets/human/human.glb                              IMMUTABLE INPUT (never written)
simulator/assets/blender/phase2_application_source.blend      editable authoring source
simulator/assets/human/human_application_baked.glb            generated runtime asset
simulator/assets/human/human_application_manifest.json        generated authoritative manifest
simulator/assets/human/human_application_manifest.schema.json published contract
```

## 2. Build

```
simulator\tools\blender\run_phase2_blender_build.bat            # Windows, one command

blender --background --python-exit-code 1 \                    # any platform
  --python simulator/tools/blender/build_phase2_realism.py -- --repo . [--preview]
```

The build is deterministic and idempotent: it always starts from an empty scene, imports the
original GLB, and rebuilds every authored object from code. It refuses to write `human.glb`, refuses
a Blender outside 4.5.x, and re-checks the original's checksum after the export.

Build time on this container: **21.5 s** (excluding the optional preview render).

## 3. Measured, not guessed

Three quantities that would normally be tuned by eye are solved against the real geometry at build
time and published in `build-report.json`.

| quantity | method | result |
|---|---|---|
| finger grip | scan each finger's flexion against the exported tube surface; `rn` = distance from the tube axis in cross-section radii, so 1.00 is exactly on the surface | index **1.01**, middle **0.96**, ring **1.10**, thumb **1.03**; whole-finger penetration **0.000** |
| tube seating in the palm | grid search over the barrel's position in hand space, scored on contact error + penetration + unreachable fingers | offset `(-30, 80, 41.5) mm` in hand-local space |
| IK pole angle | sweep 72 angles per arm, keep the one reproducing the rest elbow | residual **3.5 mm** both arms |
| palm-to-skin contact | evaluate the posed hand against the posed forearm at every application key | **−1.5 mm** worst (negative = compression) |
| forearm radius | 12-bin upper-quartile profile from the actual skin vertices | **49.7 mm** at the elbow → **26.7 mm** at the wrist |

The forearm radius profile is the one that mattered most. An earlier version used a single mean
radius (34.8 mm) for the deposit point, the palm targets and the indentation centres; because the
forearm tapers by nearly half, that drove the hand ~10 mm into the arm at one end of the stroke and
left it ~10 mm off the skin at the other. That was a genuine blocking defect, found by looking at
captured frames and fixed by measuring instead of averaging.

## 4. Animation

Pose-to-pose on a conventional authoring rig — two-bone IK per arm with a keyed pole, world-space
Copy Rotation for each wrist, FK on the spine chain and clavicles, per-joint finger keys — then
`nla.bake` with `visual_keying` onto the original deform bones and `clear_constraints`. The exported
GLB contains **53 bones, 531 curves, 223,551 keyframes** over frames 1–421, and no constraint,
control empty, light or camera.

Storyboard events are Blender timeline markers (`EVT_*`). The build converts marker frames into
normalized progress in the manifest; **no event timing is written by hand in JavaScript**, and the
Three.js camera shot list is keyed to event *names*, so re-timing the animation re-times the camera.

## 5. Product, cream and skin

* **NANODERM tube** — 138 mm overall over a 30.4 x 23 mm oval barrel, crimped tail, tapered shoulder,
  narrow neck, and a real recessed bore so the nozzle reads as open. The label is Blender-native
  typography converted to mesh and wrapped analytically onto the oval, then joined into the tube so
  the squeeze morphs carry it. The barrel is 88 mm — deliberately longer than this rig's 72 mm finger
  span, because a shorter barrel is entirely covered by the fist and the brand is never readable.
* **Cap** — separate, removed, resting on the tray beside the tube for the whole clip.
* **Tube morphs** — `TUBE_GRIP_COMPRESSION`, `TUBE_SQUEEZE`, `TUBE_DEPLETION`, `TUBE_CREASE`,
  `TUBE_RECOVERY`. Only the barrel moves; the nozzle, neck and crimp stay rigid.
* **Cream strand** — a unit-length mesh riding the nozzle, scaled per frame to the actual
  nozzle-to-deposit distance, with five morphs covering nozzle bead → short → extended → thinning →
  separated. Not a fluid simulation, and not described as one.
* **Cream film** — a patch cut from the treated forearm's own vertices, so it inherits the body's
  armature weights and cannot drift from the arm. Five morphs from contact bead to final film. Each
  is a pure bump that falls to zero at its own edges over a basis tucked 1.6 mm under the skin, which
  is what gives the film a soft organic border and lets crossfading keys sum without stacking.
* **Skin indentation** — `SKIN_INDENT_CONTACT_A/B/C` + `SKIN_INDENT_RELEASE` on both the body mesh
  and the cream film with identical maths, restricted to the surface facing the palm.

## 6. Runtime

One narrative clock. `clipTime = clamp(masterProgress, 0, 1) * clipDuration`, applied as
`action.paused = true; action.time = clipTime; mixer.update(0)`. No Clock, no interval, no
accumulator, no second timer; `mixer.update(delta)` is never a playback source.

`presentationMode` is `blender-baked` or `procedural-fallback`. `presentationMode.js` publishes an
ownership table per channel and `assertExclusive()` rejects any state where both systems drive a
channel or nobody does. A baked-asset load or validation failure falls back to procedural and reports
the reason; it never silently pretends baked mode is active.

## 7. Gates

| gate | result |
|---|---|
| generated-asset verification (`verify-baked-asset.mjs`) | **PASS** — 33 checks including bone-for-bone skeleton comparison against the original, finite/unit-quaternion animation values, morph-weight range, no leaked helpers, embedded textures, metric scale, origin at the feet |
| manifest validation | **PASS**, and 16 deliberately malformed manifests are rejected rather than defaulted |
| simulator test suite | **6,195 passed, 0 failed** |
| production JavaScript tests | **99 passed, 0 failed** |
| R validation suite | **31 passed, 0 failed** |
| `tsc --noEmit` | clean |
| original `human.glb` | byte-identical; checksum re-verified by the build, the gate and the test suite |

## 8. The Blender preview render could not be produced in this container

ss31 asks for a Blender-authored preview video. It is **not present**, and the reason is the
environment, not the animation.

EEVEE Next requires a working GPU/EGL context. This container has none, so Blender falls back to
Mesa software EGL, and the result is unusable:

* `llvmpipe` — renders, but the output is geometrically corrupted: torn surfaces, missing depth
  sorting, whole limbs shredded into overlapping shells. 89.9 s per frame at 1280x720 / 8 samples,
  with `EGL_BAD_MATCH` warnings on every context creation. A 105-frame preview would take ~2.6 h and
  be worthless.
* `softpipe` — aborts outright:
  `epoxy_get_proc_address: Assertion '0 && "Couldn't find current GLX or EGL context."' failed`.
* Cycles is not available: the `bpy` distribution ships the addon's Python but not its compiled
  kernel, so `CYCLES` never registers as a render engine.

What this does **not** mean: the animation was not reviewed. ss18 makes the browser result
authoritative, and the browser result exists at full length in four videos, 421 captured frames per
mode, and 17 named stills. The Blender preview would have been a lower-fidelity preview of the same
data.

To produce it, run the build with `--preview` on a machine with a GPU:

```
blender --background --python-exit-code 1 \
  --python simulator/tools/blender/build_phase2_realism.py -- --repo . --preview
```

The code path is implemented and wired to the `.bat`'s `--preview` flag; only the hardware is
missing.

## 9. Limitations carried forward

* **Little finger.** It cannot reach a 30 mm barrel from this rig's hand (closest approach 2.6 radii).
  It is posed on the natural cascade of its neighbours rather than clenched onto nothing, and the
  build reports this rather than hiding it.
* **Hand-edge contact crease.** Up to 1.5 mm of overlap where the hand's ulnar edge meets the
  forearm, against a 7.0 mm indentation. Classified NON-BLOCKING in `visual-qa.md`, with the reasoning
  and the three genuinely-blocking predecessors that were fixed.
* **Skin indentation is three discrete morphs**, so its centre migrates in steps along the stroke
  rather than continuously.
* **Asset-level limitations from Phase 0 are unchanged**: card-based hair, MakeHuman watermark in the
  garment texture. No shot frames the head above a medium.
* **Software rendering.** Every browser number here comes from headless Chromium on SwiftShader.
  They bound correctness, not real-world frame rate.

## 10. Rollback

Set `DEFAULT_PRESENTATION_MODE` in `simulator/src/three/presentationMode.js` to
`PRESENTATION_MODES.PROCEDURAL`, or pass `?presentationMode=procedural-fallback`. Nothing else
changes: the procedural path still loads `human.glb`, the baked asset is simply not loaded, and no
scientific code is involved either way. Generated assets do not need deleting and no revert of R or
biology code is required.
