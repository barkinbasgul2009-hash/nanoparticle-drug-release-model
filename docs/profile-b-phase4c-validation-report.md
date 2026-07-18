# Profile-B — Phase 4C Validation Report

Evidence that endocytosis + intracellular trafficking work, obey a strict FSM, stay separate from
the upstream engines, and stop at the lysosome (or a supported escape). All checks are in
`simulator/tests/endocytosis.test.mjs` (plus the retained Phase 1–4B suites); run via
`node simulator/tests/run.mjs`.

## Required checks — verified
| Requirement | Result | How verified |
|---|---|---|
| No uptake before membrane contact | ✅ | first endocytosis step: carriers are at most at Membrane Contact (no premature internalization); no state before carriers arrive |
| No endocytosis for free molecules | ✅ | endocytosis tracks only carrier ids; no molecule id ever has an endocytosis state |
| Correct pathway selection | ✅ | only clathrin / caveolae / macropinocytosis selected, from registry weights |
| Correct state transitions | ✅ | carriers progress through the FSM to the lysosome |
| Correct compartment sequence | ✅ | Early → Late endosome → Lysosome (gradual dwell; no jumps) |
| No illegal transitions | ✅ | FSM rejects Extracellular→Lysosome, Wrapping→Cytoplasm, Lysosome→Extracellular; `assertTransition` throws |
| Endosomal escape only when allowed | ✅ | B1 (escape UNAVAILABLE) → no escape / no cytoplasm; a patched escape-allowed formulation → cytoplasm |
| Evidence labels correct | ✅ | endocytosis + trafficking Predictive for all species; clearly labelled; no fabricated citation |
| Species switching works | ✅ | switching species clears carrier fates (only the selected species exists) |
| Previous phases unchanged | ✅ | full suite 906 passed, 0 failed |

## Strict finite-state machine
`EXTRACELLULAR → MEMBRANE_CONTACT → WRAPPING → INTERNALIZED → EARLY_ENDOSOME → LATE_ENDOSOME →
LYSOSOME → (ESCAPED → CYTOPLASM)`. Every carrier has exactly one state; illegal transitions throw;
terminal states are LYSOSOME and CYTOPLASM.

## Separation (five independent layers)
| Check | Result |
|---|---|
| Endocytosis reads carriers + cells read-only | ✅ modifies no upstream engine |
| Endocytosis never moves carriers | ✅ carrier positions owned by transport (unchanged) |
| Applies to carriers only | ✅ free drug molecules never endocytose |
| Per-carrier fate isolated in the endocytosis engine | ✅ keyed by carrier id |

## Full-chain (app)
`transport → release → free diffusion → passive uptake → endocytosis → early endosome →
late endosome → lysosome` runs end to end: carriers reach the lysosome, and the renderer produces
an endocytosis frame carrying compartment labels (vesicles).

## Evidence panel (five independent levels)
| Species | Transport | Release | Passive Uptake | Endocytosis | Intracellular Trafficking |
|---|---|---|---|---|---|
| Rat | Experimental | Experimental | Predictive | Predictive | Predictive |
| Human | Predictive | Predictive | Predictive | Predictive | Predictive |
| Mouse | Predictive | Predictive | Predictive | Predictive | Predictive |

## Suite results
- **Simulator suite: 906 passed, 0 failed** (`node simulator/tests/run.mjs`; was 847 after Phase 4B).
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  `types/endocytosis.ts`.
- **Registry:** `endocytosis.registry.json` valid — 3 pathways, 9 FSM states / 10 transitions,
  B1 escape `no_escape`, 32 forbidden structures.
- **Hidden-character guard:** clean.

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**; production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard
Only intracellular *entry* + trafficking were implemented. No receptor signalling, nucleus,
DNA/RNA, transcription/translation, apoptosis, immune response, complement, cytokines, PD, PK,
target interaction, tumour killing, blood circulation or efficacy. The phase ends at the lysosome
(or the cytoplasm after a supported escape).
