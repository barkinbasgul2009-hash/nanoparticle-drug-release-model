# Profile-B — Phase 4 Validation Report

Evidence that drug release works, is separate from transport, and stops at empty. All checks are
in `simulator/tests/release.test.mjs` (plus the retained Phase 1/2/2.5/2.6/3/3.1 suites); run via
`node simulator/tests/run.mjs`.

## Required sequence — verified end to end
| Step | Result | How verified |
|---|---|---|
| Nanoparticle arrives | ✅ | transport delivers particles (`arrived` = spawn count) before any release |
| Drug begins to release | ✅ | on the first step after arrival, `releaseState: loaded → releasing`, `release_start` emitted |
| Drug inside decreases | ✅ | `payloadFraction` drops from 1 monotonically toward 0 |
| Released amount increases | ✅ | `releasedFraction` rises from 0 toward 1; `payload + released = 1` |
| Release curve updates | ✅ | curve accumulates points, rises monotonically, reaches full release |
| Particle becomes empty | ✅ | `releaseState → empty`, `payloadFraction = 0`, `release_complete` emitted; `allEmpty()` true |

## Separation (transport ≠ release)
| Check | Result |
|---|---|
| Release does NOT start before arrival | ✅ no release state created while particles are still moving |
| Release does NOT move particles | ✅ particle `x`, `d`, and `transportStatus` unchanged across a full release run |
| Release state kept off the transport particle | ✅ held in `ReleaseEngine.states` (by id) |

## Scientific integrity
| Check | Result |
|---|---|
| Model = first-order (evidence-selected) | ✅ `modelId() === 'first_order'`, cites Chen 2012 |
| Rate constant k schematic (NOT REPORTED) | ✅ `rateIsReported() === false`; registry `rate_constant.status = NOT REPORTED`; evidence flags it |
| Mass conservation | ✅ `payload + released = 1` at every checkpoint |
| Formulation-level (no per-species k) | ✅ human/mouse release with the same model; confidence unchanged |
| Downstream biology excluded | ✅ registry lists 21 excluded processes (uptake, endocytosis, PK, PD, apoptosis, …) |
| Determinism | ✅ identical seed → identical empty count + mean release |

## Integration & regression
| Check | Result |
|---|---|
| Animator drives transport → arrival → release → empty | ✅ `untilReleased` run empties all carriers |
| Renderer shows payload emptying | ✅ full-app frame: every particle `payload ≈ 0`, `releaseState = 'empty'` |
| Info panel exposes the release model | ✅ `information.release.model === 'first_order'` |
| Static anatomy unchanged | ✅ layout still renders ≥ 5 bands beneath particles |
| Transport / Phase 3.1 unchanged | ✅ full transport suite still passes (rat experimental, human/mouse predictive) |

## Suite results
- **Simulator suite: 769 passed, 0 failed** (`node simulator/tests/run.mjs`; was 315 after Phase 3.1).
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  the new `types/release.ts`.
- **Registry:** `release.registry.json` valid — first-order model, k = null (NOT REPORTED),
  states loaded→releasing→empty, 21 excluded downstream processes.
- **Hidden-character guard:** clean.

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**; production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard
Only drug release was implemented. No cellular uptake, membrane crossing, receptor binding,
endocytosis, endosome/lysosome, cytoplasm/nucleus, intracellular trafficking, degradation, PK,
PD, circulation, immune system, toxicity, tumour killing, apoptosis, or pharmacology. The
lifecycle ends at `empty`.
