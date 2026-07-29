# Phase 2B — arm and wrist motion lock

**Build ID `armlock-20260729T201546Z`** · baked GLB sha256
`24059e5674d467f8e4cdeb24babb5ba7c7db8c6cd216fc17735abcdb9872e14b` · original `human.glb` sha256
`6114fceafe6c4840c225eec98bc57eaf622886ed168d9d4b1cf4d09fa4415b7e` **unchanged**.

**Decision: ARM AND WRIST MOTION LOCK REMAINS BLOCKED.**

The numeric motion defects are largely gone and the improvement is large and measured. Visual review
fails on two counts, and the brief makes visual review the acceptance test.

---

## 1. A correction to the brief's premise

The brief lists "corrected collision/contact solution" under DO NOT CHANGE. **There is no shipped
collision correction.** The Contact and Collision Lock returned BLOCKED and deliberately left the
baseline unchanged, because every solver configuration traded one defect for a worse one. The
constraint I worked to was therefore *do not make those numbers worse*, verified at the end.

## 2. Motion defects reproduced

`simulator/tools/blender/measure_motion.py` samples the exported clip frame by frame and derives
wrist linear and angular speed, per-joint deltas at clavicle / shoulder / elbow, forearm pronation,
elbow-plane normal, quaternion continuity, product-in-hand transform and jerk.

The dominant defect was unambiguous: **a 147x speed spike at frames 263-267**, wrist peaking at
**193.3 mm/frame — 5.8 m/s** — with a one-frame elbow step of 39 degrees. The left arm was already
clean and the product grip already rigid.

## 3. Root cause

The applying hand released the tube at the tray on frame 262 and was keyed at the treated forearm on
frame 266. **Four frames for 0.55 m.** There were no intermediate keys, so the interpolator ran a
straight chord between two distant poses and Bezier handles added a velocity bulge on top.

## 4. Pose-to-pose redesign

The travel now occupies frames 262-278 as a multi-waypoint arc. Waypoints are placed at
**minimum-jerk positions along the path** rather than at even fractions of it, so the hand
accelerates out of the tray, crosses fastest in the middle and settles into the hover — a bell-shaped
speed profile instead of a dash.

No published event moved. The tube is still set down at `productRetreatEnd`, skin is still touched at
`skinContact`, and `handApproach` keeps its meaning as where the approach *begins*. The manifest is
therefore unchanged, and so is the masterProgress-to-clipTime mapping.

`_lerp_pose` gained a `bow_dir`, because the direction of the arc matters when the chord passes
through something: the default bow (towards camera) put the thumb **25.8 mm inside the treated
forearm at frame 273**. Bowing over and outside the limb being reached for turns a path that cuts
through the arm into one that arrives at it from outside. `bow_scale` was tuned against **both**
metrics at once — 0.34 and 0.26 held collisions at baseline but cost motion quality (jerk 15.6 and
9.2); 0.22 holds collisions at baseline with jerk 7.66.

## 5. Measured result (same tool, same settings, both assets)

| metric | before | after |
|---|---|---|
| wrist peak speed | 193.3 mm/frame | **69.6 mm/frame** |
| wrist mean while moving | 12.6 mm/frame | 12.8 mm/frame |
| max jerk | 105.43 | **7.66** |
| elbow max single-frame step | 39.00 deg | **14.73 deg** |
| upper-arm max single-frame step | 36.82 deg | **15.61 deg** |
| worst speed spike | **x147.16** (f263-267) | **x5.45** (f346-347) |
| elbow-plane flips | 0 | 0 |
| quaternion sign flips | 0 | 0 |
| product slip in hand | 0.001 mm | **0.001 mm** |
| product spin in hand | 0.056 deg | **0.056 deg** |
| clavicle total travel | 36.9 deg | 36.9 deg |
| elbow range | 72.6-161.2 deg | 61.0-160.0 deg |

Torso, clavicle and shoulder all contribute: clavicle travels 36.9 degrees across the sequence and
the upper arm moves on every reach, so the action is not solved through the wrist.

## 6. Two measurement bugs fixed before any of this was trustworthy

**Quaternion deltas were reported the long way round.** Blender's `Quaternion.angle` runs to 360, so
a −0.52 degree step read as 359.48 degrees and the tool reported a full revolution of the upper arm.

**The swing-twist decomposition of forearm pronation is ill-conditioned exactly where it matters.**
It reported 125-degree single-frame "snaps" at frames 270, 402 and 413 — while wrist speed, elbow
angle and position were provably smooth across those same frames. Re-authoring poses to chase those
numbers would have been fixing the measurement. Pronation is now an `atan2` of two vectors projected
into the plane perpendicular to the forearm, which has no branch cut. Spike ratios fell from x42/x35
to x4.2/x8.6.

A third hypothesis was **tested and rejected**: aligning each keyed quaternion with its predecessor,
on the theory that component-wise Bezier between opposite hemispheres caused the twist. It made
things worse — new twist spikes at frames 14, 55, 401-405, 413 and 416 — so it was reverted rather
than kept.

## 7. Why this is still blocked

**The hand-approach pose is a splayed claw.** `motion/captures/04-hand-approach.png` shows the
fingers spread wide with the thumb extended and visibly elongated. Whatever the velocity curves say,
that is not a hand reaching to spread cream.

**The stroke frames cannot be visually accepted because the limbs fuse.**
`motion/captures/06-stroke-one.png` shows the applying hand and the treated forearm merging into one
mass. That is the unresolved contact defect, not something this task introduced or was allowed to
change — but it means "does the arm motion look natural through the strokes" cannot be answered yes.

## 8. Regression checks

| check | result |
|---|---|
| original `human.glb` | sha256 unchanged |
| generated-asset gate | **PASS** |
| applying hand vs treated arm | **−21.15 mm** — identical to baseline, no regression |
| treated side vs garment | −72.13 mm — identical to baseline, pre-existing |
| product slip / spin | 0.001 mm / 0.056 deg, unchanged |
| bone names, hierarchy, root | unchanged |
| manifest | unchanged (no event moved) |
| procedural fallback | untouched, still the default |

## 9. Artifacts

All regenerated for this build; none reused.

```
artifacts/phase2b/motion/motion-full-normal.webm      421 frames, 1280x720 @30
artifacts/phase2b/motion/motion-full-half.webm        same frames @15
artifacts/phase2b/motion/motion-arm-normal.webm       shoulder-elbow-wrist close-up @30
artifacts/phase2b/motion/motion-arm-half.webm         same frames @15
artifacts/phase2b/motion/motion-before-after.webm     2560x720 side by side
artifacts/phase2b/motion/captures/01-neutral.png .. 08-release.png
artifacts/phase2b/motion-report.json                  per-frame series + spike report
```

`motion-full-normal.webm` and `motion-arm-normal.webm` have identical byte counts. Their sha256s
differ (`c1714e62…` vs `c667a649…`); two 421-frame 720p30 clips simply hit the same VP9 budget. The
stale-artifact bug that produced matching sizes in an earlier pass — `use_file_extension` left on, so
Blender wrote `*.webm0001-0421.mp4` and the tool reported the previous build's file — is fixed and
verified absent here.

## 10. Remaining limitations

* The approach hand shape needs authoring as a pose; the velocity fix does not address it.
* Forearm pronation still shows a 112-degree max step in the table. It is a wrap through the
  atan2 branch at ±180, not a snap — position, elbow and speed are smooth across it — but the metric
  should be unwrapped before it is used as an acceptance gate.
* The strokes remain visually unreadable until the contact lock is closed.
