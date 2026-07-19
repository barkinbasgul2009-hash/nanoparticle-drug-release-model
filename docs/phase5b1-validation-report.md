# Phase 5B.1 Validation Report (Signal-Transduction Evidence & Graph Architecture)

Scope: **architecture + evidence + validation only**. No runtime signaling engine,
renderer, animation, or UI was built, so there is nothing to validate at runtime — the
validation targets the **data model** and the **graph validator**.

## 1. Test results

- `node simulator/tests/run.mjs` → **1449 passed, 0 failed** (Phase 5A baseline was
  1175; Phase 5B.1 adds the `signalGraph` suite).
- `npx tsc --noEmit` → clean (types-only contract compiles).
- Hidden/zero-width control-character scan of new artifacts → clean.
- Model identifier check on all pushed artifacts → absent.
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main` → **empty**.

## 2. What the `signalGraph` suite asserts

**Vocabulary (positive).**
- Exactly 9 `SIGNAL_EVIDENCE_LEVELS`, all present.
- `isSignalExperimental` / `isSignalPrediction` are disjoint; a prediction is never
  counted as experimental.
- `signalLevelAnimates` returns false for NOT_REPORTED and UNAVAILABLE.

**Real-registry validation (positive).**
- The six real registries validate with **0 errors and 0 warnings** (all evidence
  references resolve).
- `loadSignalGraph()` builds an equivalent graph.
- Contexts never mix species/cell models; molecular target is null and
  target_evidence NOT_REPORTED for all; human/mouse start = `drug_exposure`, rat =
  `none`.
- No node uses a forbidden type; every node evidence level is valid and unambiguous.
- Activity representation is `normalized_schematic_activity` (0.0–1.0) and explicitly
  forbids concentration/phospho-%/abundance/occupancy/therapeutic-effect.
- Nrf2 can reach a `nuclear_localized` state (transcription factor) — graph still stops
  before gene regulation.
- Every edge resolves its source/target, does not mix species/cell model, has a valid
  direction and an allowed relationship type; effect-strength vocabulary forbids
  numeric magnitude.
- 5B-H1/H2/M1 are ACCEPTED DAGs with start+stop conditions; 5B-R1 is NOT_REPORTED and
  empty; the H1 diamond (ROS → {ERK,p38} → Nrf2) is present.
- Evidence audit trail: `chen_2012` is the only VERIFIED_IN_FROZEN_PACKAGE source and
  explicitly supports no signaling; canonical keys are CANONICAL_GENERAL_BIOLOGY with
  no fabricated DOI; celastrol keys are UNVERIFIED_IN_REPO with no fabricated DOI; every
  audit entry resolves to a real reference and a real node/edge.
- Prediction registry: no silent human→mouse / mouse→rat / human→rat transfer; every
  prediction record carries a labelled prediction level.

**Negative tests (the validator must catch each violation).**
1. Orphan edge (missing target node) → caught.
2. Mixed species across an edge → caught.
3. Forbidden node type → caught.
4. Undeclared cycle (plain activation back-edge) → caught.
5. Invalid evidence level on a node → caught.
6. Cross-profile node claim → caught.
7. Non-empty NOT_REPORTED profile → caught.

**Positive control.** A cycle closed by a `negative_feedback` edge is **allowed** (no
"undeclared cycle" error), confirming the typed-feedback capability without asserting
any feedback in the shipped registries.

**Previous phases unchanged.** With the full app on species `rat`: transport still
EXPERIMENTAL, target engagement still NOT_REPORTED, and `app.signalTransduction` is
absent (no runtime signaling wired in 5B.1).

## 3. Scientific-integrity checklist

| Rule | Status |
|---|---|
| Frozen package authoritative; no signaling data invented | ✅ all signaling is prediction or NOT_REPORTED |
| NOT REPORTED stays NOT REPORTED | ✅ rat empty; magnitudes/timings NOT_REPORTED |
| No fabricated citations/DOIs | ✅ canonical = CANONICAL_GENERAL_BIOLOGY; celastrol = UNVERIFIED_IN_REPO |
| No species / cell-model mixing | ✅ enforced per edge + per profile |
| No silent cross-context transfer | ✅ transfer ledger = NONE/NOT_REPORTED |
| Experimental never conflated with prediction | ✅ disjoint classifiers |
| Schematic activity only (no concentration/phospho-%) | ✅ activity_representation.not |
| Graph stops before gene regulation / PD | ✅ forbidden node types absent |
| No hardcoded scientific values in source | ✅ all in registries |
| Production untouched; PR #3 not merged | ✅ empty production diff |

## 4. Freeze statement

The `SignalingNode`/`SignalingEdge` schemas, the nine-level evidence vocabulary, the
six-registry split, the DAG-with-declared-feedback semantics, and the validation rules
are **frozen** as the contract for Phase 5B.2 (runtime engine + renderer + UI).
