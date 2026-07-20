# Translation Developer Notes (Phase 5D)

Implementation notes for `simulator/src/biology/translationEngine.js` and friends.

## Data flow

`SignalPropagationEngine (5B.2)` → `TranscriptionEngine (5C)` → **`TranslationEngine (5D)`**.
The translation engine holds references to the transcription engine (for
`mrna(geneId)`/`gene(geneId)`) and optionally the signal engine (for signal-linked
capacity). It reads both **read-only** and never mutates the 5C `MessengerRNA` objects.

## Registries (three, separable concepts)

- `translation-context.registry.json` — species profiles, mRNA source, models, summaries,
  global capacity, excluded downstream.
- `translation-machinery.registry.json` — vocabularies + runtime dynamics defaults
  (delays, elongation rate, max units, polysome size, degradation-class hours, thresholds).
- `protein.registry.json` — protein identities, turnover, `protein_evidence` (with
  `verification_status`), `prediction_records`.

No parameter is hard-coded in the engine; everything comes from these registries.

## Determinism

Pure arithmetic, fixed-dt stepping, no RNG. `stepOnce(dt) × N === run(N, dt)`. If a future
version needs stochastic-looking visuals, use a seeded deterministic mechanism (mulberry32
already exists in `rng.js`) and document it — none is used here.

## Protein-unit conservation

Abundance is a queue of unit records `{state, bornAt, matureAt, degradeAt}`; counts are
derived each step. Because units only move between states (folding → mature → degrading →
degraded), `producedUnits === folding + mature + degrading + degraded` is invariant. New
production is gated by `activeUnits < round(maxUnits × mRNA level × gene efficiency)`, so
abundance tracks mRNA and turnover recycles units.

## Abundance tuning

`max_protein_units = 4` maps to the `{0,25,50,75,100}` ladder. Degradation-class hours
(slow/moderate/fast) are **schematic** simulation lifetimes, chosen so mature units persist
through the induction window and turn over on longer runs — labelled schematic, distinct
from a biological half-life (`NOT_REPORTED`).

## Polysomes

`polysome_size` (default 1) sets ribosomes per mRNA; each ribosome keeps independent
progress. Kept at 1 by default per the phase guidance; the multi-ribosome path is exercised
by construction (the loop iterates all ribosomes).

## Adding an output

1. Add a protein to `protein.registry.json` (+ evidence + prediction record).
2. Add an `outputs.*` entry to the species profile in `translation-context.registry.json`.
3. Ensure the `gene_id` matches a Phase-5C gene (the validator checks this).
4. Never set `EXPERIMENTAL_*` without a `VERIFIED_IN_FROZEN_PACKAGE` reference.

## Stop boundary

Protein `functionalState` must stay `not_evaluated`; the validator rejects anything else.
No downstream function/metabolism/phenotype/PK/PD is implemented here.
