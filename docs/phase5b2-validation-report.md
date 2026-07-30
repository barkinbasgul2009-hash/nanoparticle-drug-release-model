# Phase 5B.2 Validation Report (Signal Propagation Engine)

## 1. Results

- `node simulator/tests/run.mjs` → **1536 passed, 0 failed** (Phase 5B.1 baseline 1449;
  5B.2 adds the `signalPropagation` suite).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width control-character scan of new artifacts → clean.
- Model-identifier scan of all pushed artifacts → absent.
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main` → **empty**.
- Production tests green.

## 2. What the `signalPropagation` suite asserts

**Runtime vocabulary (additive).**
- The frozen 5B.1 `SIGNAL_EVIDENCE_LEVELS` is unchanged (still 9).
- `SIGNAL_PREDICTION_LEVELS` has 5 entries including `HYPOTHESIS`;
  `isRuntimeExperimental`/`isRuntimePrediction` are disjoint; `HYPOTHESIS` is a
  prediction.

**Node activation + edge propagation.**
- Every H1 node (ROS, ERK, p38, Nrf2, ARE, HO-1) activates at runtime.
- Signal propagates downstream (ROS activates before HO-1).
- A one-step check confirms far-downstream nodes are still below threshold while the
  start node is already driven.

**Thresholds + delay.**
- Threshold gating verified; ROS (fast entry) reaches `active` before ARE (slow-delayed).

**Competition.**
- Nrf2 receives combined input from ERK + p38 (convergent weighted sum).

**Suppression cascades.**
- 5B-M1: PI3K/AKT/mTOR/survival all go from `active` to `suppressed`; suppression events
  are recorded.
- 5B-H2: NF-κB and inflammatory output suppressed.

**Decay + auto-deactivation.**
- ROS decays below 0.05 after its activation lifetime; a `deactivated` event is recorded.

**Feedback stability.**
- Over 250 h, `maxActivity ≤ 1.0` (no oscillation explosion).
- The predicted HO-1 ⊣ ROS negative-feedback edge is present (sign −1, `predicted`), and
  enabling predictions measurably lowers cumulative ROS.

**Prediction propagation + toggling.**
- STIM1 → Orai1 → SOCE → Ca²⁺ nodes are present, flagged `predicted`, carry a rationale,
  and each activates at runtime; STIM1 is a `MECHANISTIC_PREDICTION`.
- `setPredictionsEnabled(false)` removes prediction nodes; frozen nodes remain.
  Toggling on restores them.

**Evidence overlays (data never mutated).**
- `experimental` overlay hides all predictions but keeps experimental nodes; `prediction`
  shows only predictions; `combined` shows all; switching overlay does not change node
  activity.

**Timeline + determinism.**
- Timeline events are time-ordered.
- Two identical runs give identical stats and timelines; `stepOnce×40 == run(40)`.
- `restart()` clears time, timeline, and node state.

**Species switching.**
- Rat is idle (0 nodes, no active nodes); switching human→mouse rebuilds the graph and
  restarts time; human→rat goes idle.

**Full-app wiring + previous phases unchanged.**
- `app.signalPropagation.engine` exists; the renderer produces non-empty
  `lastSignalFrame` / `lastSignalEdgeFrame` including prediction nodes.
- Panel: human Signal Transduction = Predictive; rat = Not Reported.
- Previous phases unchanged: human transport still Predictive, target engagement still
  Not Reported.

## 3. Scientific-integrity checklist

| Rule | Status |
|---|---|
| No experimental signaling data fabricated | ✅ all signaling is prediction or NOT_REPORTED |
| Existing evidence labels unchanged | ✅ 5B.1 registries + `SIGNAL_EVIDENCE_LEVELS` untouched |
| Every prediction explicitly labelled | ✅ `predictionLevel`, `rationale`, `confidence` on each |
| Experimental takes priority; prediction never overwrites | ✅ predicted nodes are separate; `experimental` overlay hides them |
| STIM1/Orai1 mechanistic prediction, never experimental | ✅ `MECHANISTIC_PREDICTION` + "no Profile-B evidence" |
| Feedback stable (no explosion) | ✅ bounded; activity ≤ 1 |
| Cycle validation from 5B.1 respected | ✅ feedback only via a declared typed-feedback edge |
| Schematic activity only (no concentration/phospho-%) | ✅ activity ∈ [0,1] |
| Deterministic | ✅ pure arithmetic; identical runs identical |
| Stops before transcription/PD/PK/apoptosis/etc. | ✅ forbidden downstream absent |
| Production untouched; PR #3 not merged | ✅ empty production diff |
