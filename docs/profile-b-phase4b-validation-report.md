# Profile-B — Phase 4B Validation Report

Evidence that the cellular microenvironment + passive uptake work, stay separate from
transport/release, and stop at cytoplasmic diffusion. All checks are in
`simulator/tests/uptake.test.mjs` (plus the retained Phase 1–4A suites); run via
`node simulator/tests/run.mjs`.

## Required checks — verified
| Requirement | Result | How verified |
|---|---|---|
| No drug molecules before release | ✅ | uptake stepped while release un-stepped → 0 molecules, expected 0 |
| Drug molecules appear only after release | ✅ | molecules appear once release begins |
| Drug count equals released payload | ✅ | `molecules.length === expectedMoleculeCount()` mid- and full-release; full → `moleculesPerCarrier`×carriers |
| Molecules diffuse independently | ✅ | molecules move each step and occupy distinct positions |
| Molecules remain outside until membrane contact | ✅ | non-contacted molecules are all extracellular |
| Passive uptake occurs only after contact | ✅ | every cytoplasm molecule has `contacted === true` |
| Molecules never teleport | ✅ | max per-step displacement < 0.06 (bounded Brownian + small crossing step) |
| Cells contain only membrane and cytoplasm | ✅ | cell objects have only `id/x/u/radius`; cell defs contain no organelle terms |
| No forbidden intracellular structures exist | ✅ | registry `integrity.forbidden` lists 31 items; `uptake_model.mechanism === 'PASSIVE'` |
| Rat/Human/Mouse evidence levels remain correct | ✅ | transport rat=Experimental, human/mouse=Predictive; uptake=Predictive for all |
| Predictive mode remains clearly labeled | ✅ | uptake messages contain "Predictive"; predictive uptake carries no permeation citation |
| Phases 1–4A unchanged / all previous tests pass | ✅ | full suite 847 passed, 0 failed |

## Separation (transport / release / diffusion / uptake)
| Check | Result |
|---|---|
| Uptake reads, never writes, transport/release | ✅ molecule state kept in the uptake engine, not on the particle |
| Uptake never moves carriers | ✅ carriers driven only by transport (unchanged) |
| Molecules independent of the carrier | ✅ never merged back; carrier stays a visible (empty) shell |
| Only the selected species exists | ✅ all molecules carry the selected species; species switch clears molecules |

## Full-chain (app)
`transport → release → free diffusion → passive membrane crossing → cytoplasmic diffusion`
runs end to end: molecule count equals released payload, some molecules reach the cytoplasm, and
the renderer produces both a cell frame and a molecule frame inside the viewport.

## Evidence panel (three independent levels)
| Species | Transport | Release | Cell Uptake |
|---|---|---|---|
| Rat | Experimental | Experimental | Predictive |
| Human | Predictive | Predictive | Predictive |
| Mouse | Predictive | Predictive | Predictive |

## Suite results
- **Simulator suite: 847 passed, 0 failed** (`node simulator/tests/run.mjs`; was 769 after Phase 4A).
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  `types/uptake.ts`.
- **Registry:** `microenvironment.registry.json` valid — 4 cells, PASSIVE uptake model, all species
  Predictive, 31 forbidden downstream/intracellular structures.
- **Hidden-character guard:** clean.

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**; production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard
Only passive entry + cytoplasmic diffusion were implemented. No nucleus, DNA/RNA, lysosome,
endosome, endocytosis, clathrin, caveolae, macropinocytosis, receptors, target proteins, enzymes,
metabolism, PK, PD, immune response, tumour killing, apoptosis, exocytosis, or intracellular
trafficking. The phase ends with molecules diffusing in the cytoplasm.
