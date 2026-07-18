# Profile-B Simulator — Phase 3.1 Implementation Report

**Phase 3.1: Predictive Human & Mouse Transport Mode.** An extension of Phase 3 that adds a
scientifically transparent **Predictive Mode** for human and mouse, without weakening the
evidence-gated architecture. **Rat remains the experimental reference implementation, unchanged.**
All inside `simulator/`; production `web`/`R`/`app`/`tests` and CI **untouched**; PR #3 **not
merged**. Still transport only — no drug release, cellular uptake, endocytosis, payload, PK, PD,
immune response, or tumour killing.

Companion docs: predictive model (`docs/profile-b-predictive-transport.md`), evidence
justification (`docs/profile-b-predictive-evidence-justification.md`), architecture updates
(`docs/profile-b-transport-architecture.md`, Phase 3.1 section), validation
(`docs/profile-b-phase3.1-validation-report.md`).

## What changed
Phase 3 blocked human and mouse (no formulation-specific permeation evidence). Phase 3.1
reframes the choice from **available / blocked** to an **Evidence Level**:

| Level | Species | Animates? | Confidence (existing vocabulary) |
|---|---|---|---|
| **EXPERIMENTAL** | rat | yes | `QUALITATIVELY_SUPPORTED` (Chen 2012) |
| **PREDICTIVE** | human, mouse | yes | `MECHANISTIC_TRANSFER` |
| **UNAVAILABLE** | any species with no profile | no (blocked) | `NOT_REPORTED` |

The key design fit: **Predictive = `MECHANISTIC_TRANSFER`**, a confidence the Phase-1 gate
already permits to animate — distinct from rat's experimental confidence, and distinct from the
blocked `NOT_REPORTED`. So the three modes map onto the existing evidence gate with no weakening.

## How predictions stay honest
- **No rat parameters copied.** Human/mouse transport uses **their own anatomy depth bands**
  (Phase 2.6) — the species difference comes entirely from anatomy, never from fabricated
  per-species mobility. The barrier *ordering* (SC rate-limiting) is general, species-independent
  skin biology (consensus), not a rat-derived value.
- **No experimental claim.** Predictive species carry **zero permeation references** (never
  Chen 2012) — only `principle_refs` (human/mouse skin barrier biology + general passive-transport
  principles). Confidence is `MECHANISTIC_TRANSFER`, never `QUALITATIVELY_SUPPORTED`.
- **No quantitative claims.** Movement is schematic; no timing, concentration, diffusion-
  coefficient, or penetration-depth numbers are asserted (unchanged from Phase 3).
- **Experimental priority preserved.** Each species owns its evidence level; the active species
  selects its own level, so experimental (rat) and predictive (human/mouse) **never mix**, and
  rat's experimental record is never overwritten by a prediction.
- **Always visible to the user.** The renderer draws **filled** dots for experimental and
  **outlined** dots for predictive, plus an `Evidence: Experimental|Predictive` caption; the
  information panel carries the full evidence-level message.

## Files touched (all in `simulator/`)
| File | Change |
|---|---|
| `data/transport.registry.json` | `evidence_levels` vocabulary; `species_transport` gains `evidence_level` + `message` + `principle_refs`; human/mouse now PREDICTIVE; integrity `predictive_mode` + `experimental_priority`; barriers noted species-independent |
| `src/evidence/evidenceEngine.js` | `EVIDENCE_LEVELS` constant + `levelAnimates()` (available throughout) |
| `src/biology/transportModel.js` | `evidenceLevelFor()`, `isExperimental/isPredictive/isUnavailable`, `canAnimateSpecies()`, `messageFor()`; `evidenceForSpecies()` returns level + predictive flag + principle refs (no rat fallback) |
| `src/biology/transportEngine.js` | carries `evidenceLevel`; `evidenceLevelName()`, `isPredictive/isExperimental()`, `message()`; gate uses `canAnimateSpecies` |
| `src/render/canvasRenderer.js` | predictive = outlined dots, experimental = filled; evidence-level caption |
| `src/ui/panels/anatomyPanels.js` | information panel exposes `transportEvidence` (level + message) |
| `src/main.js` | passes transport to panels; refreshes evidence label on `setSpecies`; `app.transport.evidenceLevel()/message()/isPredictive()` |
| `src/types/transport.ts` | `EvidenceLevel` type + fields |

## Engine rules (three modes; future-proof)
The engine derives its mode from `transportModel.evidenceLevelFor(species)`, which reads the
registry (`evidence_level`, defaulting a record-less species to `UNAVAILABLE`). Any future
species automatically uses the same architecture: add a `species_profiles` entry (anatomy) + a
`species_transport` entry with an `evidence_level`, and the engine + gate + renderer handle it.

## Tests & CI
`simulator/tests/transport.test.mjs` updated: evidence-level classification; gate allows
experimental + predictive, blocks unavailable; predictive confidence = `MECHANISTIC_TRANSFER`
with no permeation references; human/mouse animate to arrival via their own anatomy; UNAVAILABLE
(third mode) blocks; rat unchanged; species switching never mixes modes; panel labels correct.
**Simulator suite: 315 passed, 0 failed** (was 293). `tsc` compiles; hidden-char clean.
Production diff vs `origin/main` **empty**; production tests green (**99 JS + 11 R**). PR #3 **not
merged**.

---

**Stop.** Phase 3.1 complete: human and mouse animate in clearly-labelled Predictive mode; rat
stays Experimental; experimental and predictive never mix. No downstream biology implemented.
