# Translation & Protein Synthesis (Profile B, Phase 5D)

Architecture and runtime for `simulator/src/biology/translationEngine.js`. It consumes the
Phase-5C mRNA output and the translation + protein registries **read-only** and drives:

```
mRNA → ribosome recruitment → initiation → elongation → termination → nascent polypeptide
  → schematic folding/maturation → mature protein abundance → turnover   ⟂ STOP
```

## 1. Objects (`translationObjects.js`)

- **`Ribosome`** — id, cellId, species, state, boundMrnaId, positionOnMrna,
  translationProgress, currentProteinId, evidenceLevel, active, start/completion time.
  Schematic restrained complex; NOT atomic structure.
- **`TranslationInitiationComplex`** — id, mrnaId, ribosomeId, state, capDependent,
  initiationCapacity, evidence/prediction level, confidence, rationale. General machinery
  only; no quantitative initiation factors.
- **`NascentPolypeptide`** — id, proteinId, sourceMrnaId, ribosomeId, progress (schematic
  0–1), lengthState, foldingState, maturationState, alive, evidence/prediction level,
  created/completed time. No sequence, no residue count.
- **`Protein`** — id, canonicalName, geneId, species, compartment, state, unit pools
  (folding/mature/degrading/degraded/produced), abundanceFrac/State, turnoverState,
  halfLifeH (`NOT_REPORTED`), degradationClass, evidence/prediction level, confidence,
  `functionalState` (always `not_evaluated`).

## 2. mRNA eligibility

Translation begins only when: mRNA exists AND alive (level > threshold) AND cytoplasmic
AND a translation profile exists AND evidence ≠ UNAVAILABLE/NOT_REPORTED AND global
capacity > threshold. Never translated: degraded / NOT_REPORTED / unavailable / cross-species
/ cross-cell / out-of-context mRNA. Species switching clears all translation state.

## 3. Ribosome lifecycle & delays

`free → recruiting → initiating → elongating → terminating → released` with `paused`,
`suppressed`, `unavailable`. Recruitment, initiation, and maturation delays (from the
machinery registry) ensure protein never instantly equals mRNA. Initiation may succeed,
delay, be suppressed (low capacity), or be unavailable (evidence).

## 4. Elongation, termination, folding, maturation

- **Elongation** — deterministic schematic progress ∈ [0,1]; rate = base × global capacity
  × gene efficiency; paused/suppressed halts and resumes from the same progress.
- **Termination** — at progress = 1: nascent released, ribosome released, maturation begins.
- **Folding/maturation** — schematic `nascent → partially_folded → newly_synthesized →
  folding → mature`. No molecular dynamics, chaperone kinetics, or structure prediction.

## 5. Global capacity vs gene-specific efficiency

- **Global translation capacity** — normalized 0–1 (ordinal suppressed/low/moderate/high),
  the cell's schematic synthesis ability. Constitutive high for human HaCaT. A
  signal-node-linked capacity (e.g. mTOR suppression → reduced capacity) is architecturally
  supported **only where a profile declares it**, as a labelled prediction — never applied
  automatically. It is not a measured translation rate.
- **Gene-specific efficiency** — per-mRNA normalized 0–1, separate from global capacity.
  Not ribosomes-per-mRNA or proteins-per-minute.

## 6. Protein abundance & turnover (conserved)

Abundance is a pool of schematic **protein units** (max 4 → `{0,25,50,75,100}`).
Production is capped by `round(maxUnits × mRNA level × gene efficiency)`, so abundance
depends on available mRNA, capacity, efficiency, completed translations, and degradation —
never instant, never a molecule count. Turnover ages mature units into `degrading →
degraded` on a **schematic** degradation-class lifetime; biological half-life is
`NOT_REPORTED`. Conservation always holds:
`produced = folding + mature + degrading + degraded`. No unit disappears without a
documented degradation state.

## 7. Polysomes

The engine supports N ribosomes per mRNA (independent progress). The default profile uses
**one** schematic ribosome per active mRNA; polysome counts / density / spacing are never
invented. Enabling >1 is a schematic architectural option only.

## 8. Determinism & controls

Pure arithmetic, no RNG. `step`/`run`/`restart`/`stepOnce`; `setSpecies` rebuilds and
restarts (mouse/rat idle). Timing is simulation units, explicitly "not a validated
biological timescale".

## 9. Boundaries

Stops at mature protein + turnover. Protein catalytic FUNCTION is never evaluated. No
enzyme activity, receptor function, metabolism, phenotype, apoptosis, PK, or PD.
