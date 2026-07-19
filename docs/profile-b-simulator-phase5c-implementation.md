# Profile-B Simulator — Phase 5C Implementation Report

**Phase 5C: Gene Regulation & Transcription Runtime.** The first biological **response**
downstream of signaling:

```
signal propagation → transcription-factor activation → nuclear translocation
  → DNA promoter binding → gene transcription → mRNA production   ⟂ STOP
```

This phase ends at **mRNA**. It does **not** implement translation, ribosomes, proteins,
enzymes, metabolism, apoptosis, proliferation, toxicity, immune response, PD, PK,
phenotype, or tissue response — those belong to later phases.

Everything is inside `simulator/`; Phases 1–5B.2, all previous registries/docs/tests, the
production app (`web`/`R`/`app`/`tests`) and CI are **untouched**; PR #3 is **not merged**.

## What was built

- `simulator/src/biology/transcriptionEngine.js` — the runtime engine. Reads the
  Phase-5B.2 `SignalPropagationEngine` (for TF activity) and the transcription registry
  **read-only**; modifies no upstream engine. Deterministic (pure arithmetic, no RNG).
- `simulator/src/biology/transcriptionObjects.js` — `TranscriptionFactor`,
  `PromoterRegion`, `Gene`, `MessengerRNA` (+ schematic helpers `snapExpression`,
  `copyState`).
- `simulator/data/transcription.registry.json` — species-keyed profiles. **Human HaCaT**
  is ACTIVE (labelled predictions); **mouse B16BL6** and **rat** are **NOT_REPORTED**
  (empty — no TF node, no evidence; nothing transferred from human).
- `simulator/src/types/transcription.ts` — the TypeScript contract.
- `simulator/src/evidence/evidenceEngine.js` — an **additive** `GENE_EVIDENCE_LEVELS`
  vocabulary (`EXPERIMENTAL`, `HIGH_CONFIDENCE`, `LITERATURE_DERIVED_PREDICTION`,
  `MECHANISTIC_PREDICTION`, `HYPOTHESIS`, `NOT_REPORTED`) + helpers. Earlier arrays are
  unchanged.
- `simulator/src/render/canvasRenderer.js` — `setTranscriptionEngine` + headless
  `lastTranscriptionFrame` (TFs, promoters, genes, mRNA) + a publication-style paint
  block (TF nuclear entry, promoter occupancy ring, gene-activation glow, emerging mRNA
  dots, prediction styling). No artistic DNA.
- Wiring: `transportAnimator` steps transcription **after** signal propagation; `main.js`
  exposes `app.transcription` and clears it on `setSpecies`; the evidence panel gains a
  **ninth** section (Gene Regulation) with a per-gene detail block.
- `simulator/tests/transcription.test.mjs` (registered in `run.mjs`).

## Runtime model (schematic, documented)

- **Transcription factors** inherit their activity from a signaling node (Nrf2 ←
  `h1_nrf2`, NF-κB ← `h2_nfkb`). State machine:
  `inactive → activated → cytoplasmic → nuclear → dna_bound → released/degraded`, gated by
  an activation threshold and **activation / translocation / binding delays**.
- **Promoter binding** — a nuclear TF binds an accessible promoter after the binding
  delay; occupancy = bound sites / total sites. One promoter may receive **multiple TFs**
  (activation + suppression = competition).
- **Gene expression** — driven by the net promoter drive **relative to each TF's
  baseline** (so an activated TF raises the gene above basal and a suppressed baseline TF
  lowers it below basal), gated by chromatin accessibility, delayed by the
  **transcription delay**, and snapped to a schematic level `{0, 25, 50, 75, 100}`.
  No fold-change is ever assigned.
- **RNA polymerase** — schematic states `not_recruited → recruiting → bound →
  transcribing → released`, following expression.
- **mRNA** — a schematic **copy state** (`none/low/moderate/high`); basal mRNA present at
  init; induction/birth recorded (with delay) when stimulated expression rises above
  basal; degradation when transcription stops. Half-life is **NOT_REPORTED** (schematic
  decay rate only). No molecule count is invented.

## The human cascade at runtime

- **Nrf2 → ARE → HMOX1 + NQO1** (one TF → multiple genes = branching): Nrf2 activates,
  imports to the nucleus, binds ARE, and — after the transcription delay — induces HMOX1
  and NQO1 from basal 25% → 50%, producing mRNA.
- **NF-κB → NF-κB RE → inflammatory gene** with **Nrf2 cross-repression** (multiple TFs /
  competition): the drug **suppresses** NF-κB (5B-H2), so the inflammatory gene falls
  from basal 50% → 25% and its mRNA degrades.
- As the upstream signal winds down, TFs release from DNA and expression relaxes back to
  basal — a transient response.
- **Mouse / rat:** idle (NOT_REPORTED).

## Scientific integrity

The frozen Profile-B package contains **no** transcription data. The hierarchy is intact:
Chen 2012 → target NOT_REPORTED (5A) → signaling partly predicted (5B) → gene regulation
**mostly predicted** (5C). Nothing is EXPERIMENTAL unless the registry carries a real
experimental reference (none does; the validator flags any EXPERIMENTAL claim as needing
a reference). No DOI, gene-expression value, fold-change, kinetics, transcription rate,
RNA copy number, or protein abundance is fabricated — unavailable quantities are
`NOT_REPORTED`. Predictions are labelled, visually distinct, and never overwrite
experimental relationships; experimental always takes priority.

## Verification

- `node simulator/tests/run.mjs` → **1611 passed, 0 failed** (Phase 5B.2 baseline 1536).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width char scan clean; **no model identifier** in any artifact.
- Production `web`/`R`/`app`/`tests`/CI diff vs `origin/main` → **empty**.
- Production tests green.

## Companion docs

`docs/gene-regulation-transcription.md` (architecture + runtime + registries + animation),
`docs/transcription-evidence-review.md` (evidence review + prediction policy),
`docs/phase5c-validation-report.md`, and the Phase-5C section of
`docs/profile-b-transport-architecture.md`.

## Explicitly NOT implemented (later phases)

Translation, ribosomes, protein synthesis, protein folding, enzymes, metabolism, cell
cycle, apoptosis, necrosis, proliferation, inflammation output, immune response, tissue
response, PK/PD, toxicity, phenotype.
