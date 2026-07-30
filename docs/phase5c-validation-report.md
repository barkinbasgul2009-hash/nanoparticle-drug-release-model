# Phase 5C Validation Report (Gene Regulation & Transcription Runtime)

## 1. Results

- `node simulator/tests/run.mjs` → **1611 passed, 0 failed** (Phase 5B.2 baseline 1536;
  5C adds the `transcription` suite).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width control-character scan of new artifacts → clean.
- Model-identifier scan of all pushed artifacts → absent.
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main` → **empty**.
- Production tests green.

## 2. What the `transcription` suite asserts

**Vocabulary (additive).** `GENE_EVIDENCE_LEVELS` has 6 entries;
`isGeneExperimental`/`isGenePrediction` disjoint; `HYPOTHESIS` is a prediction.

**Schematic helpers.** `snapExpression` snaps to `{0,25,50,75,100}`; `copyState` maps to
`none/low/moderate/high`.

**TF state machine + translocation + binding (human).** Nrf2 activates, undergoes nuclear
import, binds DNA, and releases when the signal falls; state order is
`activated < nuclear < dna_bound`.

**Transcription delay.** HMOX1 mRNA induction lags Nrf2 DNA binding (no instant mRNA).

**Gene activation + branching.** HMOX1 and NQO1 both rise above basal (one TF → multiple
genes).

**mRNA birth + degradation.** HMOX1 mRNA has a birth/induction time; after the signal
falls, mRNA degrades / expression relaxes.

**Multiple TFs / competition / suppression direction.** The inflammatory promoter receives
two TFs (NF-κB activation + Nrf2 suppression); the inflammatory gene is driven **below**
basal (50% → 25%) because NF-κB is drug-suppressed.

**Occupancy.** The ARE promoter is occupied by Nrf2; occupancy never exceeds 1.

**Prediction labels.** No gene/TF is (falsely) experimental; every one carries a labelled
prediction level.

**NOT_REPORTED behaviour.** Mouse and rat transcription are idle (0 genes, NOT_REPORTED);
nothing is transferred from human.

**Species switching.** Switching human→mouse clears human genes and restarts time;
switching back rebuilds at basal.

**Determinism.** Identical runs give identical stats and timelines; `restart()` clears
time, timeline, TF state, and gene expression.

**Validation (positive + negative).** The real registry validates clean; the validator
catches missing promoter, missing TF, missing gene, duplicate gene symbol, invalid
evidence level, non-empty NOT_REPORTED profile, and a gene→TF cycle; an `EXPERIMENTAL`
gene is flagged as needing a reference.

**Full-app wiring + previous phases unchanged.** `app.transcription.engine` exists; the
renderer produces a non-empty transcription frame including predicted TFs; the panel shows
human Gene Regulation = Predictive and a populated gene-regulation section; signal
transduction still Predictive and target engagement still Not Reported; rat gene
regulation Not Reported with transport still Experimental.

## 3. Scientific-integrity checklist

| Rule | Status |
|---|---|
| No transcription data fabricated | ✅ all gene regulation is prediction or NOT_REPORTED |
| Nothing EXPERIMENTAL without a real reference | ✅ none is; validator warns on any EXPERIMENTAL claim |
| Hierarchy intact (target NR → signaling partly predicted → genes mostly predicted) | ✅ |
| Every element explicitly labelled | ✅ prediction level + confidence + rationale |
| Experimental takes priority; prediction never overwrites | ✅ disjoint classifiers; predictions distinct |
| No DOI / fold-change / kinetic / RNA copy number / protein abundance | ✅ schematic levels + copy states only; half-life NOT_REPORTED |
| No species mixing; species switch clears state | ✅ mouse/rat NOT_REPORTED; switch rebuilds |
| Deterministic | ✅ pure arithmetic, no RNG |
| Stops at mRNA | ✅ no translation/protein/PD/PK/apoptosis/etc. |
| Production untouched; PR #3 not merged | ✅ empty production diff |
