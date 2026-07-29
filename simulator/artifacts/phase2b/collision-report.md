# Phase 2B — contact and collision lock

**Decision: CONTACT AND COLLISION LOCK REMAINS BLOCKED.**

Both defects were reproduced with measurements against the real exported geometry, both root causes
were found, and a solver was built and run. It is **not shipped**, because measurement shows every
configuration of it trades one defect for a worse one. The asset in the repository is unchanged in
collision behaviour from the state this task started in, and is not worse.

---

## 1. Defects reproduced

`simulator/tools/blender/measure_collisions.py` imports the exported GLB, evaluates the skinned and
morphed mesh through the dependency graph at each sampled frame, and reports signed clearance per
named surface. 211 frames sampled, every 2nd frame of 1–421.

| region | worst signed clearance | frame |
|---|---|---|
| `garment:treated_hand` | **−72.13 mm** | 45 |
| `contact:thumb` | **−21.15 mm** | 333 |
| `contact:applying_wrist` | **−21.01 mm** | 365 |
| `contact:palm_centre` | −19.15 mm | 397 |
| `contact:ring_side` | −18.26 mm | 235 |
| `contact:palm_heel` | −15.93 mm | 369 |
| `garment:treated_forearm` | −15.79 mm | 61 |
| `contact:pinky_side` | −13.48 mm | 109 |

Thirteen of the sixteen visible applying-hand regions penetrate the treated arm somewhere in the
sequence. Visual confirmation is in `collision-evidence/`:
`contact/f371-fingers-through-forearm.png` shows applying fingers entering the treated forearm and
emerging on the far side — the failure condition stated explicitly in the brief.

## 2. Three measurement bugs found first

None of the numbers above were available until these were fixed, and two of them would have made this
report confidently wrong.

**The sign test was invalid at range.** Taking the sign from the nearest surface normal reported a
hand 274 mm away across the body as 274 mm *inside* the forearm. Replaced with a geometric test: a
point is inside if a ray fired from it directly away from the limb's own axis still hits the limb.
Bounded additionally by the limb's half-thickness, since no point inside a ≤50 mm-radius forearm can
be 200 mm from its surface.

**The clip was being sampled past its end.** glTF stores animation in seconds and Blender's importer
places keys at the scene's frame rate, which defaults to 24. The 14-second clip therefore imported to
frames 0.8–336.8, and sampling 1–421 silently held the last frame for the final 85 — *the entire hero
section*, which is where one of the two defects lives. The tool now sets 30 fps before importing and
refuses to run if the imported action does not reach the requested end.

**Skin under clothing is not a collision.** The upper arm lives inside the sleeve by design. Counting
it reported a constant ~12 mm penetration for the whole sequence and buried the real defect in noise.
The exposed set is now computed once from the bind pose: whatever is already inside the garment when
nothing is animated is covered on purpose.

## 3. Root causes

**Contact.** The applying hand's placement was solved against a single palm-centre point and a
forearm radius profile. That constrains one point on one surface. It says nothing about the eight
other surfaces a viewer reads, and the fingers, thumb and wrist were free to cross the arm while the
palm-centre metric reported −1.5 mm and passed.

**Garment.** Nothing in the build ever tested skin against cloth. The treated arm's presented pose
was authored against the torso's *skin*, and the shirt sits several centimetres proud of it.

## 4. Why the solver is not shipped

`simulator/tools/blender/p2b_collision.py` measures each violation per frame, converts the worst into
a push along the outward direction of the surface being escaped, dilates and smooths that over time,
and adds it to the hand control's own animated value — so authored arcs, easing and timing survive.
It is complete, documented and runnable with `--resolve-collisions`.

Three configurations were built and measured. All three fail:

| configuration | garment | hand contact |
|---|---|---|
| baseline (shipped) | −72.13 mm | −21.15 mm |
| simultaneous | −22.90 mm | −28.78 mm |
| sequenced: garment, separate, contact | −2.00 mm | −28.66 mm |
| garment only | −11.48 mm | −29.51 mm |

**The two constraints are coupled through the treated arm, and translation cannot satisfy both.** The
treated arm is sandwiched: it must move away from the shirt it is inside, and it is the thing the
applying hand must be touching. Pushing it clear of cloth pushes it into the hand. Even the
garment-only pass, which improves clothing clearance six-fold, drives hand contact from −24.2 mm to
−29.5 mm.

The contact phase separately fails to converge for a reason worth recording. The blocking region is
the applying **wrist** at frames 367–371, where the applying *forearm* crosses the treated forearm.
Translating the hand's IK target rotates the hand without carrying the forearm clear, so the
requested push grows pass over pass — 30 mm, 34 mm — with no improvement.

## 5. What would close this

The applying arm's **approach** has to be re-authored so its forearm arrives from outside the treated
arm rather than across it, and the treated arm's presented pose has to clear the shirt in the same
pass rather than being pushed there afterwards. Both are pose changes, and the solver then becomes
what it should be: a small corrective on top of poses that are already nearly right, rather than an
attempt to fix a routing problem by sliding hands around.

## 6. State of the repository

* The build runs the resolver **only** with `--resolve-collisions`. Default output is unchanged.
* `human.glb` sha256 `6114fceafe6c4840c225eec98bc57eaf622886ed168d9d4b1cf4d09fa4415b7e`, unchanged.
* Generated-asset gate: **PASS**. Simulator tests: 44 files, 0 failed.
* Shipped collision numbers equal the pre-task baseline exactly: contact −21.15 mm, garment
  −72.13 mm. No regression and no improvement.

## 7. Acceptance artifacts NOT produced

The brief requires five videos and eight captures as visual acceptance. They were not produced,
because they would document an asset that still fails, and the brief's own failure conditions make
the outcome BLOCKED regardless. What exists is the before-state evidence in `collision-evidence/`
and the dense measurement in `collision-report.json`.
