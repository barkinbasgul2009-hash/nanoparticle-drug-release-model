# Signal Propagation (Profile B, Phase 5B.2)

How the runtime engine (`simulator/src/biology/signalPropagationEngine.js`) turns the
frozen Phase-5B.1 directed graph into a live, deterministic signaling simulation. The
engine reads the six 5B.1 registries and the `signal-propagation.registry.json` runtime
registry **read-only** and modifies neither.

## 1. Inputs

- **Graph:** the frozen `SignalGraph` (contexts, nodes, edges, pathways). The engine runs
  the ACCEPTED, non-empty profiles for the active species (never mixing species).
- **Runtime registry:** per-node dynamics (threshold, decay rate, activation duration,
  `is_start`/`is_output`/`baseline_active`, layout), per-edge dynamics (delay class,
  attenuation, weight), global defaults, and toggleable predicted extensions.

## 2. Node runtime state

Each node stores: `activity ∈ [0,1]`, `state`
(`inactive`/`transitioning`/`partial`/`active`/`suppressed`/`degraded`),
`activationTimeH`, `remainingLifetime` (via `activeTimeH` vs `duration`), `confidence`,
frozen `evidenceLevel`, runtime `predictionLevel`, and `predicted` flag.

Two initial regimes:
- **Baseline-active** nodes (H2/M1: NF-κB, PI3K/AKT/mTOR, outputs) start ON
  (`activity = baseline = 0.8`, `state = active`). The drug **suppresses** them.
- **Activation-driven** nodes (H1 + start nodes) start OFF and are driven up by their
  inputs.

## 3. One propagation step (dt hours)

1. **Accumulate inputs per node** across all edges whose source has been active long
   enough to clear the edge's delay:
   - *Activation edge:* `contribution = (source.activity − source.baselineRef) · weight ·
     attenuation`. `baselineRef` = the source's baseline (0.8 for baseline-active nodes,
     else 0). A source held at baseline adds 0 (target maintained); a source suppressed
     below baseline subtracts (suppression propagates); a source rising from 0 drives the
     target up (forward activation).
   - *Inhibition edge:* `contribution = − source.activity · weight · attenuation`.
   - Multiple contributions **sum** (competition / convergence).
2. **Drive start nodes** toward the configured `start_activity` (ramp).
3. **Update each node:** relax toward `target = clamp(baseline + Σcontributions, 0, 1)`;
   apply natural decay to undriven non-baseline nodes; cross the activation threshold
   (record a timeline event); count active time and auto-deactivate past the lifetime
   (enter `degraded`, decay to `inactive`); flag baseline nodes `suppressed` when driven
   below baseline.
4. Advance `timeH`.

The step is pure arithmetic — identical inputs give identical outputs (determinism).

## 4. Activation / inhibition semantics

An edge records only the sign and type of a relationship. Activity is a **schematic
normalized value** (0–1); the engine never computes a concentration, phosphorylation %,
or rate constant. Amplification/attenuation is expressed via qualitative per-edge weights
and attenuation factors from the registry.

## 5. Delay, attenuation, threshold, lifetime, decay

- **Delay classes:** `fast` (0.5 h), `medium` (3 h), `slow` (8 h), or a custom number —
  all configurable in the registry.
- **Attenuation:** per-edge factor (< 1) so activity decreases while propagating.
- **Threshold:** per-node activation threshold (configurable).
- **Lifetime + decay:** per-node `activation_duration_h` and `decay_rate_per_hour` give
  finite pulses with automatic deactivation; nothing stays active forever.

## 6. Feedback

The frozen 5B.1 graph declares no feedback (feedback = NOT REPORTED, all DAGs). Phase
5B.2 adds a **labelled, predicted** negative-feedback edge (HO-1 ⊣ ROS,
`MECHANISTIC_PREDICTION`) in the runtime registry — never modifying the frozen graph. At
runtime it executes and measurably lowers cumulative ROS. Stability is guaranteed:
activity is clamped to [0,1], attenuation < 1, and negative feedback damps — there is no
oscillation explosion. The 5B.1 cycle-validation rules are respected (a cycle is only
permitted when closed by a declared typed-feedback edge).

## 7. Competition

A node with several incoming edges sums their (signed, weighted, attenuated)
contributions. Nrf2 converges from both ERK and p38; a mix of activation and inhibition
onto one node combines naturally.

## 8. Determinism & controls

- Deterministic: `stepOnce(dt)·N == run(N, dt)`; identical runs give identical stats and
  timelines.
- Controls: `restart`, `step`/`run`, `play`/`pause`, `setSpeed` (playback cadence only —
  never the per-step dt, preserving determinism), `stepOnce`.
- `setSpecies` rebuilds the graph for the new species and restarts (rat → idle).

## 9. Boundaries

The engine stops at signaling. It never models transcription, translation, protein
synthesis, gene regulation, apoptosis, proliferation, cell cycle, tumour killing, immune
response, PD, PK, toxicity, or phenotype.
