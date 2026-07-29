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

### B. Application hand — **partly fixed, not fully evidenced**

The same corrective keys apply to both hands, and the treated hand holds a low constant so four
separate fingers stay in its silhouette. The mitten silhouette is reduced.

**Not closed:** the close-up of the hand-on-forearm contact (`hand-review/contact/`) frames skin
without a clear read on the boundary between the two surfaces, so *"does the contact still read as
two meshes overlaid"* is **not answered by this evidence**. The framing needs redoing.

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

### E. Cream — **code changed, NOT visually verified**

`band()` gained edge accumulation (cream pushed to the sides of the wipe and heaped where the stroke
stopped) and local thickness variation at two incommensurate frequencies in both directions, on top
of the existing directional stroke lines. All three are multiplied by the band's own shape function
so they still fall to zero at the film's border and cannot lift a hard rim off the skin — the failure
that once produced a 17 mm ragged shell.

**Not closed:** no capture in this pack shows the cream at a distance where edge accumulation or
stroke detail could be judged. The claim *"no longer reads as a painted patch"* is **not supported by
evidence here and is not made**.

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
| B. application hand | **PARTLY FIXED**; contact read not evidenced |
| C. arm and wrist motion | **NOT ADDRESSED** |
| D. skin indentation | **IMPROVED** (3 -> 7 stations); not visually verified |
| E. cream | **CODE CHANGED**; not visually verified |
| F. tube | **FIXED**; squeeze not re-verified |
| G. visual QA | **PARTLY CLOSED**; Blender preview route working, no physical device |
