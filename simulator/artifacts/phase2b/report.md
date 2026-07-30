# Phase 2B completion and visual-realism remediation

**Blender 4.5.12 LTS** (`blender-v4.5-release`) · clip `phase2_application` · 14.000 s @ 30 fps ·
original `human.glb` sha256 `6114fceafe6c4840c225eec98bc57eaf622886ed168d9d4b1cf4d09fa4415b7e`
**unchanged** · production default: **`procedural-fallback`**.

This is not a new phase. It completes the locked Phase 2B roadmap item after the completion review
rejected the visual result. The verdict is at the bottom, and it is **PHASE 2B REMAINS BLOCKED** —
not because nothing was achieved, but because three of the seven reported defects are not closed and
one of those was not touched at all.

---

## 1. The safety action, first

`DEFAULT_PRESENTATION_MODE` was restored to `PRESENTATION_MODES.PROCEDURAL` before any other edit,
and it stays there. `blender-baked` remains fully built, fully tested and one query parameter away
(`?presentationMode=blender-baked`). Nothing about the baked implementation has been weakened, and
the rollback path is still a single constant in `simulator/src/three/presentationMode.js`.

## 2. One cause behind three reported defects

The completion review listed the grip cage, the cylindrical fingers and the unconvincing thumb as
separate problems. They have a single measurable cause.

**The deform rig's `hand_*` bone basis is not anatomically aligned.** On this skeleton its local +Z
sits **39.5 degrees** away from the true palmar normal. Both the finger flexion hinges
(`u x palm_normal`) and the product grip were derived from that basis, so both inherited the error:
flexion was largely twist, and the barrel hung 14-23 mm clear of the palm, tilted out of its plane,
with the fingers reaching *out* to it. A hand closed around something it is not touching is a cage.

`p2b_rig.hand_frame()` now measures the frame from landmarks that mean something anatomically — the
hand bone's own direction, the index-to-little knuckle line, and a palmar sign voted on by all four
fingers' resting flexion (all four agree, -13.3 mm to -5.1 mm, so the vote is not marginal).

The check that proved it rather than assuming it, on the rest skeleton:

| total flexion | old hinges | measured hinges |
|---|---|---|
| 160 deg | 57-62 mm fingertip-to-palm-centre — a hand that never closes | **38-46 mm** |
| 200 deg | — | **8-29 mm** — a real fist |
| lateral drift | — | **< 1.2 mm**, i.e. a true planar hinge |

## 3. Everything else that was measured rather than judged by eye

| finding | measurement |
|---|---|
| Hand topology is dense enough | 1.0-2.3 mm per edge loop, **12-24 loops per phalanx**, 248 verts across the palm, 1,839 verts per hand |
| Joint shares were backwards | MCP-dominant (0.45/0.35/0.20) keeps the outer two-thirds of a finger straight; a closing hand bends hardest at the PIP |
| The thumb is not a finger | the finger hinge formula lands **110.5 deg** off the thumb's own chain plane; and the sign was inverted (`u x a` instead of `a x u`), so "flexion" extended it |
| Contact was scored at the bone | a fingertip driven to the barrel surface buries **5-8 mm** of pad inside it; every acceptance test is now millimetres of clearance against soft tissue measured from the skinned vertices |
| The barrel was too short | the digits contact it over **108 mm**; it was 88 mm, so the thumb had nothing at its own end |
| The barrel's angle matters | the thumb's flexion plane runs nearly parallel to a barrel laid straight across the palm, so its pad sweeps *alongside* and stalls ~23 mm out; the searched angle is **18 degrees** |
| The thumb IP needs its own freedom | on a shared total the thumb contacts with its **middle** phalanx and leaves the pad 25 mm out, because the distal phalanx is 40 mm against a 23-30 mm cross-section |
| The seat search ignored the thumb | it optimised four fingers, then handed the thumb an unreachable target; it now scores all five digits and the palm gap |
| The video encoder was reporting stale files | `use_file_extension` was never disabled, so Blender wrote `*.webm0001-0421.mp4` and the existence check found the *previous build's* file at the requested path |
| Cycles is available after all | `_cycles` is compiled into the `bpy` wheel; the engine registers as soon as `addon_utils.enable("cycles")` is called. The first Phase 2B report was wrong to say otherwise |

## 4. The hand-topology decision (ss6)

**A. CURRENT HAND TOPOLOGY IS SUFFICIENT WITH CORRECTIVES.**

Chosen on measurement, not to avoid work. Each phalanx carries 12-24 edge loops at 1.0-2.3 mm
spacing and the palm carries 248 vertices; that is enough resolution to bend and to hold a knuckle.
The mitten appearance was fully explained by the 39.5-degree hinge error and a barrel the fingers
could not reach, both of which are now fixed and visibly so. What linear-blend skinning genuinely
cannot do — knuckle bulge, thumb-web bunching, palm arch, joint creases — is exactly the class of
deformation corrective shape keys exist for, and ten of them (five per hand) now do it.

Had the loops been sparse, or had the correctives failed to produce visible knuckles, the answer
would have been B.

## 5. Measured grip result

Pad clearance from the barrel surface, achieved against what each digit's own soft tissue asks for:

| digit | achieved | wanted | flexion |
|---|---|---|---|
| index | 4.9 mm | 5.5 mm | 142 deg |
| middle | 4.3 mm | 4.5 mm | 164 deg |
| ring | 4.3 mm | 4.8 mm | 151 deg |
| little | **3.2 mm** | 3.3 mm | 120 deg |
| thumb | 5.0 mm | 5.7 mm | oppose 14 / flex 6 / IP 69 deg |

Whole-finger wrap error **0.00 mm**; penetration **0.00 mm**; barrel pressed **2.5 mm into** the palm
skin; barrel angle **18 deg**. The little finger reaches on its own solved flexion — it is not a copy
of a neighbour's rotation.

## 6. Corrective shape keys (ss8)

`HAND_*_KNUCKLES`, `HAND_*_FINGER_ROOTS`, `THUMB_*_WEB`, `PALM_*_ARCH`, `HAND_*_JOINT_CREASE`, per
hand. Every centre and radius is read off the rest skeleton and the measured soft tissue. They are
driven by what the hand is doing — the applying hand's follow its closure, hold, release and press;
the treated hand holds a low constant — which is what makes them corrective rather than decorative.
Each is a pure bump falling to zero at its own edges, so crossfading sums only where profiles overlap.

## 7. Skin indentation (ss18)

Three discrete stations became **seven**, generated from the stroke's own start and end. Handovers
now fall every ~18 mm against a 46 mm dent radius, so consecutive dents overlap heavily instead of
letting the surface relax between them. Measured palm-to-skin contact across the application keys is
**-1.5 mm worst** (negative = compression) against a 7.0 mm authored depression.

## 8. Cream (ss17/ss20)

`band()` gained edge accumulation and local thickness variation at two incommensurate frequencies in
both directions, on top of the existing stroke lines, all multiplied by the band's own shape function
so nothing can lift a hard rim off the skin. **The film renders and is driven correctly, and still
does not read on screen** — see ss11.

## 9. Blender-authored preview video (ss23)

The routes were attempted in the order the brief specifies. Route 2 works.

| route | result |
|---|---|
| Official Windows Blender 4.5.12 executable | not applicable; this is a headless Linux container |
| **Cycles CPU** | **WORKS.** ~27 s/frame at 960x540, 24 adaptive samples, OpenImageDenoise, rendering the real scene — lights, preview camera, baked animation |
| Low-sample Cycles CPU with denoise | this is the configuration used |
| Workbench / other offline route | not needed |
| EEVEE Next | still unusable: no GPU/EGL. llvmpipe tears geometry at 90 s/frame; softpipe aborts |

`render_preview()` now enables the add-on, selects Cycles CPU and tone-maps with AgX — a Cycles
render is scene-referred and blows out to white under the Standard transform used when *encoding*
already display-referred browser captures. The preview camera is also pulled back 2.1x, because the
Three.js shot distances put the offline lens so close that whole shots resolve to a patch of forearm.

## 10. Gates

| gate | result |
|---|---|
| generated-asset verification | **PASS** — 32 checks including bone-for-bone skeleton comparison, unit quaternions, morph-weight range, no leaked helpers, metric scale, origin at the feet |
| manifest validation | **PASS** |
| simulator test suite | **44 files, 0 failed** |
| production JavaScript tests | **99 passed, 0 failed** |
| R validation suite | **31 passed, 0 failed** |
| `tsc --noEmit` | clean |
| original `human.glb` | byte-identical, re-verified by the build and the gate |
| production diff (`web`, `R`, `app`, `tests`, `.github`, `package.json`) | **empty** |

Asset: 45,680 tris · 15 meshes · 53 bones · **18 morph slots** · 1 clip · 168 channels · 19.36 MB.
Baked action: 53 bones, 531 curves, 223,551 keyframes over frames 1-421.

## 11. What is NOT done

Stated without softening, because these are the reasons for the verdict.

1. **Arm and wrist motion (defect C) was not addressed at all.** No trajectory was re-authored and no
   human review of the full arm motion was performed. The frame-difference pass reports 0 flickers, 0
   isolated snaps, and one run of 3 consecutive elevated pairs peaking at **x9.04** at the post-release
   retreat — higher than the x7.9 the previous build reported for the same move. Frame-difference
   metrics are not visual acceptance and are not offered as such.
2. **The cream (defect E) renders correctly and still does not read.** Probing the live scene at the
   second stroke shows `CREAM_film` present, visible, opaque and driven -- `CREAM_SPREAD_PRIMARY`
   0.997, `CREAM_SPREAD_SECONDARY` 0.412, `CREAM_FINAL_FILM` 0.133 -- so nothing in the pipeline is
   broken. A 1.3-2.2 mm layer of warm ivory on light skin under this lighting simply has almost no
   luminance separation from the skin beneath it and casts no shading of its own at that thickness.
   The problem is contrast, not form, which is why adding edge accumulation and local thickness
   variation did not change what is on screen. Closing this needs the film's material and thickness
   reconsidered against the skin it sits on.
3. **Two further blocking defects were found once the contact close-up was re-framed** (defect B, now
   worse than reported). The applying hand's index and middle fingertips pass *through* the treated
   wrist during the strokes, and the retreated applying hand is buried in the shirt mesh at the hero
   moment. The build's palm-contact measurement reports -1.5 mm worst and misses both, because it
   tracks the palm's contact point and says nothing about the fingers or the torso. The first Phase 2B
   visual QA asserted "No frame shows the hand inside the shirt silhouette"; that was wrong, and
   `hand-review/application/14-wide-hero.png` is the counter-example. The applying hand is also curled
   rather than open-palmed, which is not how cream is spread.
4. **The tube squeeze (defect F, second half) was not re-tuned** for the 102 mm barrel and is not
   verified visually.
5. **The skin indentation improvement (defect D) is not visually confirmed** — only measured.
6. **No physical iPad or WebKit device was accessed.** Every browser number here comes from headless
   Chromium on SwiftShader software WebGL, which bounds correctness, not real-world frame rate.
7. Asset-level limitations from Phase 0 are unchanged: card hair, MakeHuman watermark in the garment
   texture, no fingernail geometry, no skin pore detail.

## 12. Rollback

Unchanged and untouched: set `DEFAULT_PRESENTATION_MODE` in
`simulator/src/three/presentationMode.js`, or pass `?presentationMode=procedural-fallback`. It is
already on the procedural fallback and stays there until visual acceptance passes.

---

## Verdict

**PHASE 2B REMAINS BLOCKED.**

Defects A and F are fixed and measured, and the fixes are substantial: a single 39.5-degree error in
the hand's assumed frame was found, corrected and verified, and the grip now measures a genuine
five-digit hold with zero penetration. D is improved. G is partly closed, and the Blender preview
route the first report declared impossible turns out to work.

But **C was not addressed at all**, **E still does not read on screen**, and **B is worse than
reported** -- re-framing its close-up exposed fingers passing through the treated wrist and a hand
buried in the shirt. All three were listed as blocking with an explicit instruction not to reclassify
them because technical tests pass. Independently, ss27 forbids an unconditional pass without a
physical device, and no device was accessed.

The honest summary is that the hands and the product grip are convincingly improved and the
application is not.
