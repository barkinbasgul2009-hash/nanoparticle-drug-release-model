# Profile-B — Phase 4D Validation Report

Evidence that the intracellular drug release engine works, stays separate from the upstream
engines, and stops at cytoplasmic diffusion / the nuclear membrane. All checks are in
`simulator/tests/intracellular.test.mjs` (plus the retained Phase 1–4C suites); run via
`node simulator/tests/run.mjs`.

## Required checks — verified
| Requirement | Result | How verified |
|---|---|---|
| No intracellular release before intracellular localization | ✅ | with escape supported but endocytosis not yet run, `step()` produces no molecules |
| No drug before release | ✅ | before F(t)>0 the molecule count is 0 |
| Carrier conserved | ✅ | transport particle count + ids unchanged across an intracellular run |
| Molecule count conserved | ✅ | `alive + degraded == total` |
| Degradation valid | ✅ | `partial` degrades some and keeps a residual alive |
| Diffusion inside cytoplasm only | ✅ | every molecule stays within its own cell |
| No neighbouring-cell crossing | ✅ | molecules confined to their parent cell |
| Nucleus targeting only when enabled | ✅ | targeting `none` → 0 reach the nuclear membrane; `evidence_supported` → some do |
| No automatic nuclear entry | ✅ | no molecule is ever inside the nucleus radius |
| No DNA objects | ✅ | molecules have no DNA/RNA fields; nucleus geometry has no DNA/chromosome/etc. |
| No transcription / receptor signalling / apoptosis | ✅ | registry `integrity.forbidden` (30) includes these |
| Previous phases unchanged | ✅ | full suite 1100 passed, 0 failed |

## The honest B1 outcome
| Check | Result |
|---|---|
| B1 intracellular release evidence | **Not Reported** |
| B1 intracellular engine | blocked (idle) |
| B1 intracellular drug produced | none (no escape + NOT REPORTED) |

The full engine is exercised via **test-only patched registries** (an evidence-supported
hypothetical: escape efficient + intracellular first-order + degradation + targeting), never
committed as real evidence.

## Release models
All five models (burst / first-order / zero-order / Higuchi / Korsmeyer–Peppas) are evidence-gated
(return 0 without a model/rate), and each rate-based model is **monotonic non-decreasing and
bounded in [0,1]** across a 0–60 h sweep.

## Separation (six independent layers)
| Check | Result |
|---|---|
| Intracellular engine reads endocytosis/uptake read-only | ✅ modifies no upstream engine |
| Intracellular molecules isolated in the engine | ✅ not on the carrier or the passive-uptake molecule |
| Species switching clears intracellular molecules | ✅ no stale objects |

## Evidence panel (six independent levels)
Transport / Release / Passive Uptake / Endocytosis / Intracellular Trafficking / **Intracellular
Release**. For rat: Experimental / Experimental / Predictive / Predictive / Predictive / **Not
Reported**.

## Suite results
- **Simulator suite: 1100 passed, 0 failed** (`node simulator/tests/run.mjs`; was 906 after Phase 4C;
  exceeds the 1000+ target).
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  `types/intracellular.ts`.
- **Registry:** `intracellular.registry.json` valid — 5 models, B1 intracellular release
  `NOT_REPORTED`, targeting `none`, 30 forbidden structures.
- **Hidden-character guard:** clean.

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**; production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard
Ends at cytoplasmic diffusion / the nuclear membrane. No DNA/RNA interaction, transcription,
translation, protein synthesis, receptor signalling, PD, PK, apoptosis, tumour killing, immune
response, cell death or any downstream biology.
