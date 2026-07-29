# Phase 2B completion — visual QA

This replaces the visual QA written for the first Phase 2B build. That review was rejected, and this
one is written on the understanding that **passing a measurement is not the same as looking right**.
Where a defect is still visible, or where the evidence does not settle it, that is what is written.

## How this review was performed

* Frame source: 421 frames per mode, captured from the real Three.js renderer by setting
  `masterProgress = i / 420` explicitly and drawing that value, so the sequence doubles as a seek
  test. Encoded with Blender's bundled FFmpeg.
* Numeric pass: `simulator/tools/blender/analyze_sequence.py`, mean absolute pixel difference on a
  160x90 downscale of every adjacent pair, flagged against a 15-frame rolling median.
* Hand pass: a dedicated close-up pack rendered through
  `phase2b-preview.html?closeup=<anchor>&dist=&az=&elev=&fov=`, which overrides the director's
  camera *after* it has run, so the animation and timeline are untouched and only the lens moves.
  Four angles x five moments, in `hand-review/`.

Stated plainly, as before: this is a frame-by-frame inspection of the exact image sequence the video
encodes, not a real-time playback impression. For the half-speed pass that is if anything the
stronger method, because half speed exists to expose discontinuities between adjacent frames and
adjacent frames are precisely what was compared.

**An encoder defect was found and fixed while producing these.** `encode_video.py` never disabled
`use_file_extension`, so Blender wrote `browser-baked-normal.webm0001-0421.mp4` and left the
requested path untouched; the tool's existence check then found the *previous build's* file at that
path and reported it as freshly encoded. Every video in this directory before that fix was stale.
They have all been re-encoded, and the normal and half-speed files now differ in size, which they
could not have done before.

---

## What the completion review reported, and where each item now stands

### A. Product-grip hand — **substantially fixed, measured**

The cause was singular and measurable: **the deform rig's `hand_*` bone basis is not anatomically
aligned — its local +Z sits 39.5 degrees away from the true palmar normal** — and both the finger
flexion hinges and the tube's placement were derived from it.

| symptom reported | measured cause | now |
|---|---|---|
| fingers form a cage; tube looks *inserted between* fingers | barrel seated 14-23 mm clear of the palm skin and tilted 39.5 deg out of the palm plane, so fingers reached *out* to it | barrel presses **2.5 mm into** the palm; whole-finger wrap error **0.00 mm** |
| fingers thick, cylindrical, excessively curved | flexion hinge 39.5 deg off, so flexion was largely twist; and joint shares were MCP-dominant and identical, which keeps the outer two-thirds of a finger straight | hinges from the measured palmar normal; per-finger PIP-led shares; four different curls (142 / 164 / 151 / 120 deg) |
| thumb opposition unconvincing; thumb interleaves with the tube | the thumb was hinged like a finger — the finger formula lands **110.5 deg** off the thumb's own chain plane — and the sign was inverted, so "flexion" extended it | thumb hinged on its own chain, pad contact 5.0 mm against 5.7 mm wanted |
| little finger does not reach the tube | reported "unreachable, closest approach 2.6 radii" | reaches; pad 3.2 mm against 3.3 mm wanted. **Not faked** — it has its own solved flexion (120 deg), not a copy of a neighbour's |
| knuckles / joint transitions weak; wrist-to-palm one block | no corrective deformation existed at all | five corrective shape keys per hand (ss8), visible as four separate knuckles in `hand-review/dorsal/` |

Measured pad clearance against what each finger's own soft tissue asks for, in millimetres from the
barrel surface (achieved / wanted): index 4.9 / 5.5, middle 4.3 / 4.5, ring 4.3 / 4.8, little
3.2 / 3.3, thumb 5.0 / 5.7. Penetration 0.00 mm.

A verification worth stating on its own, because it is what proved the hinge fix rather than assuming
it: on the rest skeleton, a 160-degree fist moved the middle fingertip to 57-62 mm of the palm centre
with the old hinges — a hand that never closes — and to 38-46 mm with the measured normal, reaching
8-29 mm at 200 degrees, while every fingertip stays within 1.2 mm of its own flexion plane.

**Still visible at close range:** there is no fingernail geometry and no pore or crease detail beyond
the authored correctives, so at the 0.30 m review distance the digits read as clean rather than
detailed. That is asset surface detail, not pose.

### B. Application hand — **NOT FIXED. Two further blocking defects found.**

The corrective keys apply to both hands and the mitten silhouette is reduced, so the *silhouette*
part of the report is improved. But re-framing the contact close-up — the first framing was too tight
to judge anything — surfaced two defects that no measurement in this build was looking for, and both
are worse than the one originally reported.

**B1. The applying hand interpenetrates the treated forearm at the strokes.**
`hand-review/application/09-stroke2.png` shows the applying hand curled into a loose fist with its
index and middle fingertips passing *through* the treated wrist. This is exactly the "reads as two
meshes overlaid" failure, and it is now visible rather than marginal. The build's own palm-contact
measurement reports -1.5 mm worst across the application keys, so **the measurement and the render
disagree** — the measurement tracks the palm's contact point against the forearm surface and says
nothing about the fingers, which are what is intersecting.

Also visible: the applying hand is *curled*, not open-palmed. Cream is spread with a flat palm; this
hand is pressing knuckles into the arm.

**B2. The applying hand passes through the torso at the hero moment.**
`hand-review/application/14-wide-hero.png` shows the retreated applying hand buried in the shirt
mesh. The first Phase 2B visual QA asserted "Does the hand avoid the torso? **Yes.** ... No frame
shows the hand inside the shirt silhouette." That assertion was wrong, and this frame is the
counter-example.

Neither of these is reclassified. Both are blocking.

### C. Arm and wrist motion — **NOT ADDRESSED**

No arm or wrist motion was re-authored in this pass. The numeric pass is reported for completeness
and is explicitly *not* offered as acceptance:

* median adjacent-frame delta **0.01133**, max 0.09837, **0 flicker candidates**, 4 near-static pairs
* **one run of 3 consecutive elevated pairs**, frames 396-399, peaking at **x9.04** — the applying
  arm's retreat after `releaseEnd`. A run of consecutive elevated pairs is the signature of fast
  motion rather than a snap, and there are **no isolated single-frame snaps** anywhere. But x9.04 is
  higher than the x7.9 the previous build reported for the same move, and no human review of the full
  arm trajectory has been done.

### D. Skin indentation — **improved, not visually verified**

The depression was three discrete morphs, so it was only exactly under the palm at three points on a
~110 mm stroke and the surface partly relaxed between them. It is now **seven stations**, generated
from the stroke's own start and end rather than hand-written, which puts a handover every ~18 mm
against a 46 mm dent radius, so consecutive dents overlap heavily.

Measured contact across the application keys: **-1.5 mm worst** (negative = compression), against a
7.0 mm authored depression.

**Not closed:** no close-up confirms the stepping is gone, for the framing reason under B, and the
1.5 mm hand-edge crease has not been re-measured against the new grip.

### E. Cream — **code changed, and the re-framed captures show NO CREAM AT ALL**

`band()` gained edge accumulation (cream pushed to the sides of the wipe and heaped where the stroke
stopped) and local thickness variation at two incommensurate frequencies in both directions, on top
of the existing directional stroke lines. All three are multiplied by the band's own shape function
so they still fall to zero at the film's border and cannot lift a hard rim off the skin — the failure
that once produced a 17 mm ragged shell.

**Worse than not closed.** The re-framed application captures
(`hand-review/application/07-contact.png` through `11-hero.png`) show the treated forearm during and
after both strokes with **no visible cream film on it**. Whether the film is failing to render, is
positioned off the visible forearm, or has weights that never rise, is not established here -- but
"cream dispensing and skin deformation are convincingly improved" cannot be claimed when the cream is
not visible in the shot that is supposed to show it. The edge-accumulation and thickness code is in
and is sound in principle; it is evidently not reaching the screen.

### F. Tube — **fixed, derived from the rig**

The barrel is now 102 mm rather than 88 mm, and the number came from the hand: the digits contact it
over 108 mm. An 88 mm barrel is shorter than the span it has to serve, which is why the thumb had
nothing to press on at its own end. 102 mm of body plus shoulder, neck and nozzle gives a 152 mm
tube — the ordinary size of a 30 g laminate cream tube, so measuring the hand moved the product
*towards* the real thing rather than away from it.

The barrel's angle in the palm is now searched with its seating and came out at **18 degrees**. That
is not a styling choice: the thumb's flexion plane runs nearly parallel to a barrel laid straight
across the palm, so curling the thumb sweeps its pad *alongside* the tube and it stalls ~23 mm out
however the joint angles are tuned.

**Not closed:** the squeeze morphs were carried over unchanged, have not been re-tuned for the longer
barrel, and are not verified visually here. *"The squeeze must visibly deform the tube"* is untested.

### G. Visual QA — **partly closed**

* Blender-authored preview video: **the route was found.** The first Phase 2B report said Cycles was
  unavailable in this container; that was wrong. `_cycles` is compiled into the `bpy` wheel and the
  engine registers as soon as `addon_utils.enable("cycles")` is called, which nothing in a background
  `bpy` session does for you. Cycles CPU renders the real scene — lights, camera, baked animation —
  at ~27 s/frame at 960x540, 24 adaptive samples with OpenImageDenoise. EEVEE Next remains unusable
  here for the reasons the first report gave (no GPU/EGL; llvmpipe tears geometry, softpipe aborts).
* Physical iPad / WebKit: **no device was accessed.** Nothing here is a claim about physical hardware.

---

## Defect classification

Nothing below is classified as cosmetic on the grounds that a test passes.

| defect | status |
|---|---|
| A. product-grip hand | **FIXED** for cage, penetration, thumb, little finger and knuckles; asset-level surface detail remains |
| B. application hand | **NOT FIXED.** Two further blocking defects found: fingers through the treated forearm at the strokes, and the hand through the shirt at the hero |
| C. arm and wrist motion | **NOT ADDRESSED** |
| D. skin indentation | **IMPROVED** (3 -> 7 stations); not visually verified |
| E. cream | **NOT FIXED.** Code changed, but no cream is visible on the forearm in the re-framed captures |
| F. tube | **FIXED**; squeeze not re-verified |
| G. visual QA | **PARTLY CLOSED**; Blender preview route working, no physical device |
