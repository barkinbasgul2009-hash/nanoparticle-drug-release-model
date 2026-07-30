# Production note — Phase 2B preview is live with known visual defects

The live site currently boots the **Blender-authored human application sequence**
(`blender-baked`) by default. It is published as a **preview**, under an explicit, temporary
authorisation from the repository owner, **while the defects below are still open**.

This note exists so that nobody — reviewer, teacher, examiner, or future maintainer — mistakes the
deployment for an acceptance.

## What was NOT done to make this possible

* **No acceptance report was edited.** All three Phase-2B locks still declare their blocked status,
  in their own words, in their own files:
  * `simulator/artifacts/phase2b/collision-report.md` — `CONTACT AND COLLISION LOCK REMAINS BLOCKED`
  * `simulator/artifacts/phase2b/motion-report.md` — `ARM AND WRIST MOTION LOCK REMAINS BLOCKED`
  * `simulator/artifacts/phase2b/report.md` — `PHASE 2B REMAINS BLOCKED`
* **No defect was deleted, softened or hidden.** The visual-QA evidence, the measured clearances and
  the frame captures are all still in the repository.
* **The CI/CD gate was not weakened.** `simulator/tools/check-acceptance.mjs` is byte-identical to
  the version on `main`. It still classifies `simulator/src/three/**`, `simulator/assets/**` and the
  Blender tooling as `phase2b-animation`, still requires all three locks for any change to them, and
  therefore **still fails on this very commit**. That red check is the honest record of the override.
* **Auto-merge was not used.** The merge was performed manually as an owner decision. The automation
  refused it, correctly, and was left refusing it.

## Known unresolved visual defects — scheduled for correction

| # | defect | evidence |
|---|---|---|
| 1 | **Applying-hand / treated-forearm intersection** — the applying hand and the treated forearm merge into one mass through the stroke frames. Measured at **−21.15 mm** at the worst point. | `artifacts/phase2b/collision-report.md`, `motion/captures/06-stroke-one.png` |
| 2 | **Treated-hand / shirt collision** — the treated hand and wrist sit inside the shirt geometry. Measured at **−72.13 mm**. Pre-existing; every solver configuration tried made some other region worse. | `artifacts/phase2b/collision-report.md` |
| 3 | **Arm and wrist motion realism** — the numeric defects are largely fixed (peak wrist speed 193.3 → 69.6 mm/frame, max jerk 105.43 → 7.66, worst speed spike ×147 → ×5.45), but the treated hand's approach pose is still a splayed claw and the strokes cannot be read while the limbs fuse. | `artifacts/phase2b/motion-report.md` |
| 4 | **Cream visibility and readability** — the deposited and spread cream is not yet clearly legible against the skin at presentation camera distances. | `artifacts/phase2b/visual-qa.md` |
| 5 | **Physical iPad / WebKit verification** — never performed. Everything to date is headless Chromium plus SwiftShader. No claim is made about Safari or about any physical tablet. | — |

## Rollback

Fastest first. None of these requires a rebuild.

1. **Per-viewer, instant** — append `?presentationMode=procedural-fallback` to the page URL. The
   procedural path is fully built and tested and takes over immediately.
2. **Site-wide, one line** — set `DEFAULT_PRESENTATION_MODE` back to `PRESENTATION_MODES.PROCEDURAL`
   in `simulator/src/three/presentationMode.js`, then push to `main`.
3. **Whole-site** — run the **rollback production deployment** workflow with the last known-good
   commit SHA, which every `verify production deployment` run records as `rollback_target_sha` in its
   `deployment-record.json` artifact.

There is also an automatic safety net that needs no human at all: if the baked GLB fails to load,
`resolvePresentationMode` falls back to `procedural-fallback` and reports the reason rather than
pretending baked mode is active.

## When this note goes away

When the three locks declare PASSED on their own merits, and the acceptance gate goes green without
an override. Not before.
