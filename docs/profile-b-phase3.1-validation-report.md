# Profile-B — Phase 3.1 Validation Report

Evidence that Predictive Mode works, Experimental (rat) is unchanged, and the two never mix. All
checks are in `simulator/tests/transport.test.mjs` (plus the retained Phase 1/2/2.5/2.6/3
suites); run via `node simulator/tests/run.mjs`.

## Requested checks
| Requirement | Result | How verified |
|---|---|---|
| Rat still behaves exactly as before | ✅ | rat = Experimental (`QUALITATIVELY_SUPPORTED`, cites Chen 2012); 14/14 particles traverse formulation→target in order while crossing the SC barrier (unchanged Phase-3 assertions) |
| Human animates in Predictive mode | ✅ | human engine not blocked; `evidenceLevelName()`=`PREDICTIVE`; 12/12 particles arrive via the human anatomy bands |
| Mouse animates in Predictive mode | ✅ | mouse engine not blocked; `PREDICTIVE`; 12/12 particles arrive via the mouse anatomy bands |
| Evidence labels appear correctly | ✅ | model messages: rat "Experimental", human/mouse "Predictive … not experimentally validated"; info panel `transportEvidence.message` matches the active species |
| Experimental & Predictive never mix | ✅ | each species owns its level; switching human→rat→mouse flips the level correctly; rat's record/refs never change; predictive `referenceIds=[]` (no Chen 2012) |
| No rat parameters copied | ✅ | predictive species use their **own** dermis depth (differs from rat by >1e-3); predictive references empty; only `principle_refs` present |
| Three confidence modes | ✅ | Experimental + Predictive animate; a patched **UNAVAILABLE** species blocks (spawn no-op, animator no-op) |
| No production code touched | ✅ | production diff vs `origin/main` empty; production tests green |

## Behavioural results
- **Rat (Experimental):** 14/14 arrive; filled dots; confidence `QUALITATIVELY_SUPPORTED`; cites
  Chen 2012.
- **Human (Predictive):** 12/12 arrive; outlined dots; confidence `MECHANISTIC_TRANSFER`; zero
  permeation references; own anatomy depths.
- **Mouse (Predictive):** 12/12 arrive; outlined dots; confidence `MECHANISTIC_TRANSFER`; zero
  permeation references; own anatomy depths.
- **Unavailable (third mode):** blocked; spawn and animator are no-ops.
- **Full app:** default human → Predictive; `setSpecies('rat')` → Experimental; `setSpecies('mouse')`
  → Predictive; info-panel evidence label follows the species every time.

## Suite results
- **Simulator suite: 315 passed, 0 failed** (`node simulator/tests/run.mjs`; was 293 after Phase 3).
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  the new `EvidenceLevel` type.
- **Registry:** `transport.registry.json` valid — evidence levels EXPERIMENTAL/PREDICTIVE/
  UNAVAILABLE; rat EXPERIMENTAL, human/mouse PREDICTIVE, human `referenceIds` empty.
- **Hidden-character guard:** clean.

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**; production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard
Only Predictive Mode was implemented. No drug release, cellular uptake, endocytosis, payload
release, PK, PD, immune response, or tumour killing. The terminal state remains `target_region`.
