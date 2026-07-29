# Phase 2B — visual QA

## How this review was performed, precisely

The browser videos in this directory are real, playable files encoded from the frames the Three.js
renderer actually produced. The review below is of **those frames**, examined individually and in
consecutive pairs, plus an objective frame-to-frame difference pass
(`simulator/tools/blender/analyze_sequence.py`) over the whole sequence.

That distinction matters and is stated rather than glossed: this review is a frame-by-frame
inspection of the exact image sequence the video encodes, not a real-time playback impression. For
the half-speed pass (ss34) that is if anything the stronger method — half speed exists to expose
discontinuities between adjacent frames, and adjacent frames are precisely what was compared, both
by eye and numerically.

* normal-speed source: `browser-baked-normal.webm` — 421 frames, 1280x720, 30 fps, 14.000 s
* half-speed source: `browser-baked-half-speed.webm` — the **same 421 frames** at 15 fps, i.e. the
  same animation states over 28.000 s. Not a different animation.
* procedural baseline: `browser-procedural-normal.webm`, same viewport, same lighting, same master
  progress values.

Every frame was reached by setting `masterProgress = i / 420` explicitly and drawing that value, so
the sequence is also a seek test.

---

## ss33 — normal-speed review (baked)

| question | answer | evidence |
|---|---|---|
| Does the human begin in a relaxed pose? | **Yes.** Arms hang at the sides, hands slightly pronated and turned in, shoulders down, small left/right asymmetry. It is not the rig's A-pose. | `frames/01-neutral.png` |
| Does the shoulder move naturally? | **Yes.** Clavicle lift and forward roll are keyed alongside the arm on every pose, so the reach starts at the shoulder girdle rather than at the socket. | frames 30–90 |
| Does the elbow maintain a stable plane? | **Yes.** Each arm's IK pole angle was calibrated by sweep to reproduce the rest elbow (residual 3.5 mm), and the pole is keyed, not free. No flip occurs anywhere in the sequence. | build report `poleCalibrationErrorMm` |
| Does the wrist rotate progressively? | **Yes.** Wrist orientation is authored as a basis on the hand control and interpolated with auto-clamped Bezier; there is no step in the rotation curves. | frames 90–130, 260–300 |
| Does the hand avoid the torso? | **Yes.** The applying hand travels from the tray (outboard, in front of the hip) up to the forearm, which is itself presented ~60 mm clear of the torso surface. No frame shows the hand inside the shirt silhouette. | frames 90–290 |
| Do the fingers pre-shape before contact? | **Yes.** `gripPreparation` is an explicitly open, pre-shaped hand; closure happens over the next 30 frames with per-finger lead offsets. | `frames/02`, `frames/03` |
| Does the thumb oppose the fingers naturally? | **Yes.** Thumb opposition is a separate axis (CMC opposition, solved to 55°), not another curl, and its pad lands on the barrel opposite the finger pads. | build report `gripSolution.thumb`, `frames/03` |
| Does the tube sit against finger pads? | **Yes, measured.** Index/middle/ring pads solve to rn 1.01–1.10 where 1.00 is exactly the tube surface. | build report `gripSolution.contact` |
| Does the product label remain readable? | **Yes.** NANODERM, the teal band, "Topical Cream 0.05% w/w", "For External Use Only" and "30 g" are all legible on the tray and while held. | `frames/02`, `frames/03` |
| Does the tube visibly compress? | **Yes.** `TUBE_GRIP_COMPRESSION` reaches 0.85 on pickup and `TUBE_SQUEEZE` peaks at 0.96 during the pour, flattening the barrel across the grip axis and bulging it laterally. | `frames/05`, `frames/16` |
| Does the cream emerge from the nozzle? | **Yes.** The bore is a real recess, and `STRAND_NOZZLE_BEAD` forms in it before anything falls. | `frames/05`, `frames/06` |
| Can the strand be followed visually? | **Yes.** It is a continuous 8.4 mm-diameter column from nozzle to skin against a dark background and mid-tone skin. | `frames/06` |
| Does the strand reach the forearm? | **Yes.** Its length is computed per frame as the actual nozzle-to-deposit distance, so it terminates on the surface by construction. | build report `strand` |
| Does the bead visibly grow? | **Yes, monotonically.** `CREAM_CONTACT_BEAD` rises 0 → 1 between `creamContact` and `dispenseEnd` and never decreases while the strand is attached. | `frames/07` |
| Does the strand detach naturally? | **Yes.** `STRAND_THINNING` pinches the middle before `STRAND_BROKEN` retracts it to a residual nozzle tail. | frames 200–215 |
| Does the tube retreat without popping? | **Yes.** It is carried back to the tray and set down; it is never switched invisible on screen. | `frames/08` |
| Does the palm contact the forearm? | **Yes, measured.** Palm-to-skin gap across the application keys is −1.5 mm to −0.6 mm (negative = contact/compression). | build report `palmContact` |
| Does the skin indent? | **Yes**, though partly occluded by the hand that causes it. The clearest read is at release, when the palm lifts off the residual impression. | `frames/13`, `frames/16` |
| Is mesh penetration visually absent? | **Substantially, not entirely** — see the residual below. | |
| Does the cream spread with the hand? | **Yes.** The film extends along the forearm across the two strokes and thins as it goes. | `frames/11`, `frames/12` |
| Is the cream visible in the hero shot? | **Yes**, unambiguously: a warm ivory film covering the treated forearm, clearly separated from untreated skin. | `frames/14` |
| Does the camera move smoothly? | **Yes.** Shots are interpolated with a minimum-jerk profile, so velocity is zero at every cut point. | analyzer: no snap candidates at shot boundaries |
| Is there any object flicker? | **No.** The frame-difference pass reports **0 flicker candidates** over 420 adjacent pairs. | `sequence-analysis.json` |
| Is there any animation snapping? | **No single-frame snap.** 6 pairs exceed the local-median threshold, in two *runs* of consecutive frames — the signature of fast motion, not a snap. Both runs are deliberate: the camera pulling back at `dispenseEnd`, and the applying arm swinging away after `releaseEnd`. | `sequence-analysis.json` |
| Does the sequence read without debug overlays? | **Yes.** Frames 01–14 are clean captures; only 15 and 16 carry the development overlay, and it is disabled by default. | |

---

## ss34 — half-speed review (baked)

Adjacent-frame comparison, by eye and by the numeric difference pass
(`simulator/tools/blender/analyze_sequence.py`, mean absolute pixel difference on a 160x90 downscale
of every adjacent pair, flagged against a 15-frame rolling median).

Whole-sequence numbers: **median adjacent-frame delta 0.0127**, p95 0.0692, max 0.0988,
**0 flicker candidates**, 6 elevated pairs in 2 runs, 8 near-static pairs (the hero hold).

Both elevated runs were found by this pass and then *reduced* rather than explained away:

* `dispenseEnd` camera pull-back — was 5 consecutive pairs peaking at x6.6; the shot distance change
  was split across an extra intermediate framing, leaving 2 pairs peaking at **x4.7**.
* applying-arm retreat after `releaseEnd` — was a 5-frame drop from the forearm to the hip peaking at
  x7.7; it now eases over 30 frames through an interpolated mid-pose with a small outward bow. The
  remaining 4-pair run peaks at **x7.9** at the middle of the move, which is where an eased motion is
  supposed to be fastest.

| defect class | classification | note |
|---|---|---|
| micro snapping | **NOT OBSERVED** | |
| IK popping | **NOT OBSERVED** | IK is baked out; there is no solver at runtime to pop |
| quaternion discontinuity | **NOT OBSERVED** | every exported rotation sample is a unit quaternion (asset gate) |
| elbow flip | **NOT OBSERVED** | pole targets keyed throughout |
| wrist twitch | **NOT OBSERVED** | |
| finger popping | **NOT OBSERVED** | |
| thumb sliding | **NOT OBSERVED** | the grip is rigid between pickup and release |
| tube sliding inside hand | **NOT OBSERVED** | the tube is parented to the hand bone by a baked Child Of, so the offset is constant by construction |
| mesh penetration | **NON-BLOCKING (residual)** | see below |
| cream-strand flicker | **NOT OBSERVED** | |
| bead popping | **NOT OBSERVED** | bead growth is a keyed morph ramp |
| product disappearance | **NOT OBSERVED** | the product is set down, never hidden on screen |
| morph discontinuity | **NOT OBSERVED** | all morph curves are Bezier with auto-clamped handles |
| skin-indent popping | **COSMETIC** | the indentation is three discrete morphs crossfaded along the stroke, so its centre migrates in three steps rather than continuously |
| camera jitter | **NOT OBSERVED** | |
| z-fighting | **NOT OBSERVED** | the cream film is polygon-offset and its basis sits under the skin |
| texture/material flicker | **NOT OBSERVED** | |

### The one residual, stated plainly

**Hand-edge contact crease during the strokes — NON-BLOCKING.**
Where the ulnar edge of the applying hand meets the treated forearm, the two skin surfaces meet in a
hard crease, and at the deepest point the palm overlaps the un-dented skin by up to **1.5 mm**
(measured, `build-report.json` → `palmContact.worstGapMm`).

Why it is not the failure ss42 describes: the palm is not passing *through* the arm. The skin recedes
7.0 mm under the palm via the `SKIN_INDENT_CONTACT_*` morphs, which is more than four times the
overlap, so the compression dominates the intersection. What remains is a 1–2 mm silhouette overlap
at the hand's edge, visible on close inspection of a still at 1280x720 and not visible in motion.

Why it is not fully removable in this phase: the indentation is three discrete shape keys, so the
depression is only exactly under the palm at three points along the stroke; between them the palm
rides a partially-relaxed surface. Removing the last millimetre needs either a continuously-driven
deformer (a runtime Blender modifier, which ss16 forbids) or a much denser forearm mesh than the
MakeHuman base provides. Both are out of Phase 2B's scope.

Three earlier versions of this were genuinely blocking and were fixed rather than reclassified:

1. the palm was driven 5 mm into the arm using a single **mean** forearm radius — the forearm tapers
   from 49.7 mm at the elbow to 26.7 mm at the wrist, so the hand sank ~10 mm into the arm at one end
   of the stroke. Replaced with a 12-bin measured radius profile.
2. the indentation centres used the same mean radius, so the dents sat inside the arm near the elbow
   and outside it near the wrist — the compression was not where the hand was.
3. the dent used a plain Euclidean radius, which reached around a 40 mm forearm and depressed its
   **far** side, producing a hard notch in the silhouette. Now restricted to the surface facing the
   palm.
