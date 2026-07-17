# Profile-B — Transport Validation Report (Phase 3)

Evidence that the transport engine works and that nothing earlier regressed. All checks are in
`simulator/tests/transport.test.mjs` (plus the retained Phase 1/2/2.5/2.6 suites) and run via
`node simulator/tests/run.mjs`.

## Step 10 checklist
| Requirement | Result | How verified |
|---|---|---|
| Species switching | ✅ | engine + full-app switch human↔rat↔mouse; gate + barrier depths follow the species |
| Particle spawning | ✅ | `spawn(14)` creates 14 independent, uniquely-identified particles (rat) |
| Particle movement | ✅ | deterministic Brownian + drift; positions evolve each step under a fixed seed |
| Barrier transitions | ✅ | every rat particle **enters and exits** the stratum-corneum barrier (recorded crossings) |
| Layer transitions | ✅ | crossings are **monotonic** along formulation→…→target_region (no skipped-backward states) |
| Renderer | ✅ | `lastParticleFrame` has one flat-dot per particle, all inside the viewport; static anatomy still drawn beneath |
| Camera | ✅ | camera unchanged (Phase-2 clip plane assertion still passes) |
| Zoom | ✅ | particles map through the current zoom window (same depth mapping as the anatomy layout) |
| State engine | ✅ | `BiologicalStateMachine.validate()` = linear + covers all states + every transition cited |
| Existing anatomy | ✅ | full Phase 2/2.5/2.6 anatomy suite still passes; L1 exposes 5 layers; scenes/labels intact |

## Behavioural results
- **Rat:** 14/14 particles travel formulation → target region; every particle ends `arrived`;
  arrival + transition events emitted, each carrying evidence.
- **Human / mouse:** engine **blocked**; `spawn` and `step` are no-ops; **zero** particles; a
  human-readable block reason is exposed. No fallback to rat.
- **Determinism:** identical seed → identical arrival count and particle positions.
- **Animator:** `runHeadless()` drives all particles to arrival for rat and is a no-op (blocked)
  for human.

## Suite results
- **Simulator suite: 293 passed, 0 failed** (`node simulator/tests/run.mjs`; was 173 after Phase 2.6).
  - Phase-3 transport suite added ~120 assertions.
- **TypeScript contract:** compiles clean (`npx tsc --noEmit -p simulator/tsconfig.json`), incl.
  the new `types/transport.ts`.
- **Registry:** `transport.registry.json` valid JSON — 6 states, 5 transitions, 3 species, SC
  mobility 0.15.
- **Hidden-character guard:** clean (`python3 tools/check_hidden_chars.py`).

## Production untouched / CI
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**.
- Production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

## Scope guard (nothing beyond transport)
No drug release, payload, cell entry, endocytosis, lysosomes, nucleus, PK, PD, tumour/immune
response, circulation, lymphatics, or metabolism is present. The terminal state is
`target_region`; downstream biology is listed in `integrity.excluded_downstream` and is not
implemented.
