# Profile-B Simulator — Phase 6A Implementation Report

**Phase 6A: Protein Function & Early Cellular Response Runtime.** The first phase where a
newly synthesized protein produces a functional cellular consequence:

```
mature protein → functional eligibility → functional activation/inhibition
  → early biochemical cellular-state change → homeostatic / early stress response
  → reversible adaptation   ⟂ STOP (before cell fate)
```

Everything is inside `simulator/`; Phases 1–5D, all previous registries/docs/tests, the
production app (`web`/`R`/`app`/`tests`) and CI are **untouched**; PR #3 is **not merged**.
The phase stops **before** cell fate: no apoptosis, caspases, Bax/Bcl-2, cytochrome-c,
AIF, necrosis, cell-cycle execution, proliferation, migration, tumour killing, immune
recruitment, cytokine secretion, tissue response, PK, PD, or toxicity. Cell-fate evidence
stays `NOT_EVALUATED`.

## What was built

- `simulator/src/biology/proteinFunctionEngine.js` — the runtime engine. Reads the
  Phase-5D `TranslationEngine` (mature proteins) and the Phase-5B `SignalPropagationEngine`
  (accepted signaling) plus the Phase-6A registries **read-only**; modifies nothing
  upstream. Deterministic (no RNG).
- `simulator/src/biology/proteinFunctionObjects.js` — `FunctionalProteinState`,
  `CellularStateVariable`, `FunctionalEdge` (+ `stateOrdinal`).
- Four separable registries (`simulator/data/`): `protein-function-context.registry.json`
  (function profiles), `cellular-state.registry.json` (reversible state variables),
  `functional-edges.registry.json` (edges + declared feedback + dynamics),
  `functional-evidence.registry.json` (evidence + prediction records). No parameter is
  hard-coded in the engine.
- `simulator/src/types/proteinFunction.ts` — the TypeScript contract.
- `simulator/src/evidence/evidenceEngine.js` — an **additive** `FUNCTION_EVIDENCE_LEVELS`
  vocabulary (the 9 refined tiers + `HYPOTHESIS`) + helpers. Earlier arrays unchanged.
- `simulator/src/render/canvasRenderer.js` — `setProteinFunctionEngine` + headless
  `lastFunctionFrame` (functional proteins, cellular-state bars with a baseline tick,
  restrained up/down change) and a publication-style paint block. No flames/explosions/
  danger/red-flash/dying-cell imagery.
- Wiring: `transportAnimator` steps protein function **after** translation; `main.js`
  exposes `app.proteinFunction` and clears it on `setSpecies`; the evidence panel gains an
  **eleventh** section (Protein Function & Early Cellular Response) that separates
  protein-abundance / protein-function / cellular-response / cell-fate evidence.
- `simulator/tests/proteinFunction.test.mjs` (registered in `run.mjs`).

## Runtime model (schematic, reversible, documented)

- **Function gating** — a protein affects cellular state only when it exists, is mature
  (from Phase 5D), not degraded, in the active species/cell, has a compatible profile, and
  evidence ≠ UNAVAILABLE. Nascent/folding/degraded/cross-species/cross-cell proteins never
  activate function.
- **Functional protein state** — `unavailable → eligible → activating → active`
  (with `partially_active`/`inhibited`/`recovering`/`inactive_after_degradation`), gated by
  an activation delay; functional capacity mirrors the mature-protein abundance.
- **Cellular-state variables** — schematic, reversible, bounded `[0,1]` (ordinal
  very_low…very_high), **never** a concentration/biomarker/activity %. Each has a baseline
  and relaxes toward `baseline + Σ(edge contributions)`.
- **Functional edges** — from a protein function / signaling node / cellular state to a
  target state, with a typed relationship (sign), qualitative strength class, delay class,
  and reversibility. Baseline-relative sources capture suppression (a suppressed NF-κB /
  mTOR / ICAM1-like input lowers its target below baseline).
- **Feedback** — registry-declared, typed, bounded, stable. A homeostatic negative-feedback
  loop (antioxidant capacity ↔ oxidative stress) is declared; the validator requires any
  cellular-state cycle to be broken by a declared feedback edge, and values stay in `[0,1]`
  (no oscillation explosion).
- **Reversibility / recovery** — as upstream signaling winds down and proteins turn over,
  states relax back toward baseline (recovery, possibly incomplete).

## The human HaCaT cascade at runtime

- **Mature HO-1 → antioxidant capacity ↑, inflammatory state ↓** (labelled prediction).
- **Predicted NQO1 → antioxidant capacity ↑** (mechanistic prediction).
- **ROS signaling → oxidative stress ↑**, counteracted by antioxidant capacity (declared
  feedback) → oxidative stress falls and recovers.
- **NF-κB suppression → inflammatory state ↓**; **suppressed inflammatory (ICAM1-like)
  protein → adhesion readiness ↓** (stops at readiness; no monocytes/recruitment).
- All reversible; states recover toward baseline as the transient resolves.

## Mouse & rat

- **Mouse B16BL6 (signal-driven, no protein output from 5D):** PI3K/AKT/mTOR suppression →
  survival signaling ↓; celastrol exposure → oxidative stress ↑; converging stress →
  mitochondrial-stress readiness and a **preparatory, reversible stress-readiness** state.
  Explicitly **NOT** apoptosis — no cell dies. Independent from human; no transfer.
- **Rat:** NOT_REPORTED (idle) — no Phase-5D protein and no validated functional response;
  no human/mouse fallback.

## Scientific integrity

The frozen package has no functional dataset. Nothing is EXPERIMENTAL: although celastrol/
HO-1 anti-inflammatory activity is described in the literature, no primary source is
verified in-repo, so functional relationships are `LITERATURE_DERIVED_PREDICTION` /
`MECHANISTIC_PREDICTION` (the validator rejects any EXPERIMENTAL claim). No enzyme kinetics,
Km/Vmax, ROS/GSH/cytokine concentration, adhesion %, membrane-potential value, activity %,
half-life, or dose-response value is fabricated — unavailable values are `NOT_REPORTED` and
cellular states are schematic. Cell-fate evidence is `NOT_EVALUATED`; no apoptosis/caspase/
cytochrome-c/AIF/necrosis concept is representable (validator-enforced).

## Verification

- `node simulator/tests/run.mjs` → **1773 passed, 0 failed** (Phase 5D baseline 1699).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width char scan clean; **no model identifier** in any artifact.
- Production `web`/`R`/`app`/`tests`/CI diff vs `origin/main` → **empty**.
- Production tests green.

## Companion docs

`docs/protein-function-runtime.md`, `docs/protein-function-evidence-review.md`,
`docs/early-cellular-response-profiles.md`, `docs/functional-prediction-framework.md`,
`docs/phase6a-validation-report.md`, `docs/phase6a-animation-specification.md`,
`docs/phase6a-developer-notes.md`, and the Phase-6A section of
`docs/profile-b-transport-architecture.md`.

## Exact stop boundary

Stops after reversible early cellular-state responses. No cell death, cell-cycle
execution, proliferation/migration outcome, tumour/immune/tissue response, PK, PD, or
toxicity — those belong to Phase 6B and later.
