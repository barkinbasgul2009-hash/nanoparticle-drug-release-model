# Profile-B — Phase 5A Validation Report

Evidence that the target-engagement engine works, stays separate from the upstream engines, and
stops at target binding. All checks are in `simulator/tests/targetEngagement.test.mjs` (plus the
retained Phase 1–4D suites); run via `node simulator/tests/run.mjs`.

## Required checks — verified
| Requirement | Result | How verified |
|---|---|---|
| No binding before intracellular localization | ✅ | with no intracellular drug, `step()` produces no binding |
| No binding before encounter | ✅ | binding only within the reaction radius; every binding references a real target |
| Occupancy never exceeds capacity | ✅ | `occupied <= available` for every target |
| Irreversible never dissociates | ✅ | 0 dissociation events; occupancy non-decreasing across runs |
| Reversible may dissociate | ✅ | dissociation events emitted for reversible binding |
| Competition behaves correctly | ✅ | single-site targets hold ≤ 1 drug; extras keep diffusing |
| Saturation behaves correctly | ✅ | overall saturation reported in 0/25/50/75/100 buckets |
| Prediction labels visible | ✅ | evidence label is a prediction (`isPredicted`); labels vocabulary present |
| Evidence labels correct | ✅ | B1 rat/human/mouse target engagement = Not Reported (idle) |
| Previous phases unchanged | ✅ | full suite 1175 passed, 0 failed |
| No signalling / transcription / apoptosis / downstream | ✅ | registry `integrity.forbidden` (24) includes these |

## Nuclear gate
| Check | Result |
|---|---|
| Nuclear target unbound without Phase-4D targeting | ✅ occupancy 0 when targeting off |
| Nuclear target bindable once nucleus targeting has occurred | ✅ occupancy > 0 with targeting on |

## Affinity & kinetics
`Kd = koff/kon` and `residence time = 1/koff` verified; affinities are shown only when the rates
exist (else null / Not Reported) — no fabricated numbers.

## Separation (seven independent layers)
| Check | Result |
|---|---|
| Target engine reads intracellular/uptake read-only | ✅ modifies no upstream engine |
| Binding state isolated in the target engine | ✅ Phase-4D molecule never modified |
| Species switching clears drug/targets/binding/occupancy | ✅ no stale objects |

## The honest B1 outcome
| Check | Result |
|---|---|
| B1 target engagement evidence | **Not Reported** |
| B1 target engine | blocked (idle) |
| B1 targets placed / binding | none |

The full engine is exercised via **test-only patched registries** (evidence-labelled predictions),
never committed as real evidence.

## Evidence panel (seven independent levels)
Transport / Release / Passive Uptake / Endocytosis / Intracellular Trafficking / Intracellular
Release / **Target Engagement**. For rat: Experimental / Experimental / Predictive / Predictive /
Predictive / Not Reported / **Not Reported**.

## Suite results
- **Simulator suite: 1175 passed, 0 failed** (`node simulator/tests/run.mjs`; was 1100 after Phase 4D;
  exceeds the 1100+ target).
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  `types/targetEngagement.ts`.
- **Registry:** `target-engagement.registry.json` valid — 6 target types, B1 target evidence
  `NOT_REPORTED`, binding model null, 24 forbidden structures, 6 prediction labels.
- **Hidden-character guard:** clean.

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**; production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard
Ends at target binding / occupancy / optional dissociation. No signal transduction, kinase
cascades, MAPK/PI3K/AKT/mTOR/NF-κB, gene regulation, transcription, translation, protein synthesis,
apoptosis, proliferation, immune response, toxicity, efficacy, PK, PD downstream or tumour response.
