# Phase 5D Validation Report (Translation & Protein Synthesis Runtime)

## 1. Results

- `node simulator/tests/run.mjs` → **1699 passed, 0 failed** (Phase 5C baseline 1611).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width control-character scan of new artifacts → clean.
- Model-identifier scan of all pushed artifacts → absent.
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main` → **empty**.
- Production tests green.

## 2. What the `translation` suite asserts

**Vocabulary (additive).** `TRANSLATION_EVIDENCE_LEVELS` has 10 entries;
experimental/prediction classifiers disjoint; UNAVAILABLE/NOT_REPORTED are inactive.

**Schematic helpers.** `snapAbundance` snaps to `{0,25,50,75,100}`; `abundanceOrdinal`
maps to none/low/moderate/high.

**Registry integrity.** Human ACTIVE; mouse/rat NOT_REPORTED; HO-1 not falsely
experimental; HO-1 biological half-life NOT_REPORTED; every protein `functional_state =
not_evaluated`.

**mRNA gating.** No protein before stepping; no mature protein one step in (translation
delay).

**Machinery pipeline.** Events `recruited → initiation_complete → nascent_protein_released
→ maturation_started → mature_protein_produced` all occur, with ordered elongation
milestones; maturation follows initiation (no instant protein).

**Abundance.** HO-1 rises to ≥50% (induced) and exceeds the suppressed inflammatory
protein, which stays ≤25%.

**Turnover + conservation.** Degradation occurs; `produced = folding + mature + degrading +
degraded` for every protein.

**Multiple mRNAs / genes.** Three protein outputs (HO-1, NQO1, inflammatory).

**Global capacity + gene efficiency.** Human capacity high; gene efficiencies differ;
elongation progress stays within [0,1].

**Signal-linked capacity (test-only).** A patched profile tying capacity to a signal node
resolves to a bounded value — exercised only via a test registry.

**Suppressed / unavailable.** An UNAVAILABLE output produces no protein.

**Evidence priority.** Every output is a labelled prediction, never experimental;
`functionalState` not evaluated.

**NOT_REPORTED behaviour.** Mouse and rat translation idle (0 outputs, NOT_REPORTED); no
transfer.

**Species switching + restart.** Switching clears state and restarts time; restart clears
time/timeline/produced units.

**Determinism.** Identical runs give identical stats and timelines.

**Validation (positive + negative).** Real registries validate clean; the validator
catches missing protein, experimental-without-reference, experimental-with-unverified-
reference, cross-species protein, protein-function set, and non-empty NOT_REPORTED; a
numeric half-life is warned.

**Full-app wiring + previous phases unchanged.** `app.translation.engine` exists; the
renderer produces a three-output translation frame flagging predicted outputs; the panel
shows human Translation = Predictive with a populated section (protein function
NOT_EVALUATED, schematic-timing warning); gene regulation still Predictive, transport
unchanged; rat translation Not Reported with transport still Experimental.

## 3. Scientific-integrity checklist

| Rule | Status |
|---|---|
| No translation dataset fabricated | ✅ all protein output is prediction or NOT_REPORTED |
| Nothing EXPERIMENTAL without a verified in-repo reference | ✅ HO-1 = LITERATURE_DERIVED_PREDICTION; validator enforces |
| Hierarchy intact (target NR → signaling → gene → protein mostly predicted) | ✅ |
| Every output labelled (category + confidence + rationale + principle + limitations) | ✅ |
| Experimental takes priority; prediction never overwrites | ✅ disjoint; predictions distinct |
| No rate/count/length/copy-number/half-life/folding-time/polysome/constant/fold-change | ✅ schematic units + `NOT_REPORTED` half-life |
| Biological half-life distinct from simulation decay class | ✅ panel separates them |
| Protein FUNCTION never evaluated | ✅ `functional_state = not_evaluated` |
| Conservation (produced = folding+mature+degrading+degraded) | ✅ tested |
| No species mixing; species switch clears state | ✅ mouse/rat NOT_REPORTED |
| Deterministic | ✅ no RNG |
| Stops at protein + turnover | ✅ no function/metabolism/phenotype/PK/PD |
| Production untouched; PR #3 not merged | ✅ empty production diff |
