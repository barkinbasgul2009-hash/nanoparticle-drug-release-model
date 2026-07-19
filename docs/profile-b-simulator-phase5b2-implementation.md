# Profile-B Simulator — Phase 5B.2 Implementation Report

**Phase 5B.2: Signal Propagation Engine.** The transition from the static Phase-5B.1
signaling graph to a **runtime signaling simulation**. Signals now propagate through the
graph over simulated time: nodes activate, activity travels across edges with delay and
attenuation, thresholds gate activation, activity decays and auto-deactivates,
baseline-active pathways get suppressed, multiple inputs compete, feedback loops execute
(bounded), and labelled **prediction** extensions propagate too.

Everything is inside `simulator/`; every previous engine, registry, doc, test, and the
production application (`web`/`R`/`app`/`tests`) and CI are **untouched**; PR #3 is **not
merged**. The engine **stops at signaling** — no transcription, translation, apoptosis,
immune response, tumour killing, PD, PK, toxicity, or phenotype.

## What was built

- `simulator/src/biology/signalPropagationEngine.js` — the runtime engine. Consumes the
  frozen 5B.1 graph (via `SignalGraph`) **read-only** and the new runtime registry
  **read-only**, and modifies neither. Deterministic (pure arithmetic, no RNG,
  fixed-dt). Public API: `step`/`run`/`restart`, `frame`, `getTimeline`, `stats`,
  `setSpecies`, `setOverlayMode`, `setPredictionsEnabled`, `setSpeed`, `play`/`pause`/
  `stepOnce`, `summaryLevel`/`summaryMessage`.
- `simulator/data/signal-propagation.registry.json` — runtime **dynamics** (thresholds,
  delay classes, attenuation, decay, activation lifetimes, layout) keyed to the frozen
  5B.1 node/edge ids, plus clearly-labelled **predicted extensions**: a mechanistic
  negative-feedback edge (HO-1 ⊣ ROS) and the `STIM1 → Orai1 → SOCE → Ca²⁺` prediction
  pathway. No experimental data is added; no scientific value is hardcoded in source.
- `simulator/src/types/signalPropagation.ts` — the TypeScript contract.
- `simulator/src/evidence/evidenceEngine.js` — an **additive** runtime prediction
  vocabulary `SIGNAL_PREDICTION_LEVELS` (`EXPERIMENTAL`, `HIGH_CONFIDENCE_PREDICTION`,
  `LITERATURE_DERIVED_PREDICTION`, `MECHANISTIC_PREDICTION`, `HYPOTHESIS`) with helpers.
  The frozen 5B.1 `SIGNAL_EVIDENCE_LEVELS` array is **unchanged**.
- `simulator/src/render/canvasRenderer.js` — `setSignalPropagationEngine` +
  headless-testable `lastSignalFrame` / `lastSignalEdgeFrame` and a publication-style
  paint block (activity glow, suppressed fade, edge illumination while flowing, dashed
  predicted edges, prediction badges). No gaming effects.
- Wiring: `transportAnimator` steps the signal layer **after** target engagement;
  `main.js` exposes `app.signalPropagation` and clears it on `setSpecies`; the evidence
  panel gains an **eighth** section (Signal Transduction).
- `simulator/tests/signalPropagation.test.mjs` (registered in `run.mjs`).

## Runtime model (schematic, documented)

Each node carries `activity` (0–1), a runtime `state`
(`inactive`/`transitioning`/`partial`/`active`/`suppressed`/`degraded`), activation
time, remaining lifetime, confidence, the frozen evidence level, and a runtime
prediction level.

- **Activation edges** drive the target relative to the source's baseline reference, so
  the same mechanism produces both **forward activation** (H1: a source rising from 0
  drives its target up) and **suppression propagation** (H2/M1: a baseline-active source
  driven *below* baseline pulls its target down).
- **Inhibition edges** deliver negative drive proportional to the source's activity
  (the exposure-driven entry edges in H2/M1).
- **Delay** — each edge transfers only after its `delay_class` (fast/medium/slow or a
  custom number) has elapsed since the source activated.
- **Attenuation** — activity is multiplied by a per-edge factor (< 1) as it propagates.
- **Threshold** — a node becomes `active` only above its threshold.
- **Lifetime / decay** — an activated node accumulates active time; past its
  `activation_duration_h` it enters `degraded` and decays monotonically to `inactive`
  (automatic deactivation). Undriven non-baseline nodes decay by their decay rate.
- **Competition** — a node's incoming contributions are a weighted sum (Nrf2 converges
  from ERK + p38).
- **Feedback** — the predicted HO-1 ⊣ ROS negative-feedback edge executes at runtime and
  measurably lowers cumulative ROS; the system stays bounded (activity ∈ [0,1], no
  oscillation explosion).

## The three cascades at runtime

- **5B-H1 (human HaCaT, activation):** exposure → ROS → {ERK, p38} → Nrf2 → ARE → HO-1
  all light up over ~1–30 h, then auto-deactivate — a transient cytoprotective pulse.
- **5B-H2 (human HaCaT, suppression):** exposure ⊣ NF-κB → inflammatory output; both
  driven from active to **suppressed**.
- **5B-M1 (mouse B16BL6, suppression):** exposure ⊣ PI3K → AKT → mTOR → survival output;
  suppression propagates the whole chain.
- **Rat:** idle (NOT REPORTED) — no signaling nodes; no silent transfer.

## Predictions (labelled, toggleable, never overwriting experimental)

- Prediction nodes/edges are **separate** from frozen nodes and always flagged
  `predicted` with a `predictionLevel`, `confidence`, and `rationale`.
- The `STIM1 → Orai1 → SOCE → Ca²⁺` pathway (deferred in 5B.1) is implemented as a
  **mechanistic prediction** (entry edge = HYPOTHESIS), explicitly "no Profile-B
  evidence; general calcium-signaling literature; prediction only" — never experimental.
- `setPredictionsEnabled(false)` removes all predicted nodes/edges; frozen nodes remain.
- Evidence overlay modes (`experimental`/`prediction`/`combined`/`unavailable`/
  `not_reported`) change only visibility, never the underlying data.

## Verification

- `node simulator/tests/run.mjs` → **1536 passed, 0 failed** (Phase 5B.1 baseline 1449).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width char scan clean; **no model identifier** in any artifact.
- Production `web`/`R`/`app`/`tests`/CI diff vs `origin/main` → **empty**.
- Production tests green.

## Companion docs

`docs/signal-propagation.md`, `docs/signal-animation.md`, `docs/signal-timeline.md`,
`docs/phase5b2-validation-report.md`, the Phase-5B.2 section of
`docs/signal-graph-architecture.md` and `docs/profile-b-transport-architecture.md`, and
the runtime section of `docs/signal-prediction-framework.md`.
