# Phase 6A Validation Report (Protein Function & Early Cellular Response)

## 1. Results

- `node simulator/tests/run.mjs` → **1773 passed, 0 failed** (Phase 5D baseline 1699).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width control-character scan of new artifacts → clean.
- Model-identifier scan of all pushed artifacts → absent.
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main` → **empty**.
- Production tests green.

## 2. What the `proteinFunction` suite asserts

**Vocabulary (additive).** `FUNCTION_EVIDENCE_LEVELS` has 10 entries; experimental /
prediction classifiers disjoint; UNAVAILABLE/NOT_REPORTED inactive; `stateOrdinal` maps
0-1 to very_low…very_high.

**Registry integrity.** Human ACTIVE; rat NOT_REPORTED; cell-fate evidence NOT_EVALUATED;
no function claimed experimental.

**Maturity gating.** No function before a mature protein; not active one step in
(maturity + delay gating).

**Function activation + delay.** Eligibility then activation events occur; activation lags
eligibility; HO-1 function reaches `active`.

**Cellular-state change (human).** Antioxidant capacity rises above baseline; oxidative
stress, inflammatory state, and adhesion readiness fall below baseline.

**Bounds + feedback stability.** Over 300 h all states stay within `[0,1]`; the declared
antioxidant↔oxidative-stress feedback edges are present; no oscillation explosion.

**Recovery.** Oxidative stress recovers toward baseline after the transient (reversible).

**Mouse early-response (signal-driven).** No functional proteins; not idle; survival
signaling reduced; oxidative stress raised; a preparatory stress-readiness state exists;
**no** apoptosis/cell-fate state anywhere.

**Rat idle.** NOT_REPORTED; no states.

**Human/mouse independence.** No shared cellular-state ids.

**Blocking.** UNAVAILABLE function evidence blocks activation.

**Evidence priority + prediction labels.** Every function/edge is a labelled prediction,
never experimental.

**Determinism.** Identical runs give identical stats and timelines.

**Restart + species/cell switch.** Switching rebuilds states and restarts time; switching
back resets to baseline.

**Validation (positive + negative).** Real registries validate clean; the validator catches
missing target state, baseline out of `[0,1]`, experimental-without-reference, a forbidden
cell-fate state concept, an undeclared cellular-state cycle, and a non-empty NOT_REPORTED
profile.

**Full-app wiring + previous phases unchanged.** `app.proteinFunction.engine` exists; the
renderer produces a function frame (3 functions, 4 states); the panel shows human Protein
Function = Predictive with a populated section (cell fate NOT_EVALUATED, schematic-timing +
schematic-state warnings); translation still Predictive, transport unchanged; rat Protein
Function Not Reported with transport still Experimental.

## 3. Scientific-integrity checklist

| Rule | Status |
|---|---|
| No functional dataset fabricated | ✅ all responses are prediction or NOT_REPORTED |
| Nothing EXPERIMENTAL without a verified in-repo reference | ✅ validator-enforced |
| Hierarchy intact through 6A | ✅ early response mostly predicted |
| Every relationship labelled (category + confidence + rationale + principle + limitations) | ✅ |
| Experimental takes priority; prediction never overwrites | ✅ disjoint classifiers |
| No kinetics / concentration / % / membrane potential / half-life / dose-response | ✅ schematic states + NOT_REPORTED |
| Cellular-state values schematic + bounded [0,1] + reversible | ✅ |
| Feedback declared, bounded, stable; no undeclared cycles | ✅ validator + [0,1] clamp |
| No species / cell-model mixing; switch clears state | ✅ human/mouse independent; rat idle |
| No apoptosis/caspase/cytochrome-c/AIF/necrosis; cell fate NOT_EVALUATED | ✅ validator-enforced |
| No mouse cell death (preparatory states only) | ✅ |
| Deterministic | ✅ no RNG |
| Stops before cell fate | ✅ |
| Production untouched; PR #3 not merged | ✅ empty production diff |
