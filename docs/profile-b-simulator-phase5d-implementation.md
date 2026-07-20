# Profile-B Simulator — Phase 5D Implementation Report

**Phase 5D: Translation & Protein Synthesis Runtime.** Extends the biological chain from
the Phase-5C mRNA output to protein production:

```
mRNA availability → translation eligibility → ribosome recruitment → translation initiation
  → elongation → termination → nascent polypeptide → schematic folding / maturation
  → mature protein abundance → protein turnover   ⟂ STOP
```

This phase implements **only** translation and protein production. It does **not**
implement protein catalytic function, receptor activation, metabolism, apoptosis, cell
cycle, immune/tissue response, PK, PD, toxicity, or phenotype. `functional_state` stays
`not_evaluated`.

Everything is inside `simulator/`; Phases 1–5C, all previous registries/docs/tests, the
production app (`web`/`R`/`app`/`tests`) and CI are **untouched**; PR #3 is **not merged**.

## What was built

- `simulator/src/biology/translationEngine.js` — the runtime engine. Reads the Phase-5C
  `TranscriptionEngine` (for mRNA) and the translation + protein registries **read-only**;
  never mutates the 5C mRNA objects or any upstream engine. Deterministic (no RNG).
- `simulator/src/biology/translationObjects.js` — `Ribosome`,
  `TranslationInitiationComplex`, `NascentPolypeptide`, `Protein` (+ `snapAbundance`,
  `abundanceOrdinal`).
- Three separable registries (`simulator/data/`): `translation-context.registry.json`
  (species profiles: context + mRNA source + models + summaries), `translation-machinery.registry.json`
  (schematic vocabularies + runtime dynamics defaults), `protein.registry.json` (protein
  identities + turnover + `protein_evidence` + `prediction_records`). No parameter is
  hard-coded in the engine.
- `simulator/src/types/translation.ts` — the TypeScript contract.
- `simulator/src/evidence/evidenceEngine.js` — an **additive** `TRANSLATION_EVIDENCE_LEVELS`
  vocabulary (the 9 refined tiers + `HYPOTHESIS`) + helpers. Earlier arrays are unchanged.
- `simulator/src/render/canvasRenderer.js` — `setTranslationEngine` + headless
  `lastTranslationFrame` (mRNA strand, ribosome position, nascent chain, mature protein +
  abundance + turnover) and a publication-style paint block. No cartoon helices, no atomic
  ribosome structure.
- Wiring: `transportAnimator` steps translation **after** transcription; `main.js` exposes
  `app.translation` and clears it on `setSpecies`; the evidence panel gains a **tenth**
  section (Translation & Protein Synthesis) that separates mRNA / translation /
  protein-abundance / protein-function evidence.
- `simulator/tests/translation.test.mjs` (registered in `run.mjs`).

## Runtime model (schematic, documented)

- **mRNA gating** — translation begins only when a valid Phase-5C mRNA exists, is alive
  (level above threshold), is cytoplasmic, a profile allows it, evidence is not
  UNAVAILABLE/NOT_REPORTED, and global capacity exceeds threshold. Degraded / NOT_REPORTED
  / cross-species / cross-context mRNA is never translated.
- **Ribosome lifecycle** — `free → recruiting → initiating → elongating → terminating →
  released` (with `paused` / `suppressed` / `unavailable`). Recruitment, initiation, and
  maturation all have schematic delays, so protein never instantly equals mRNA.
- **Initiation complex** — schematic (`not_assembled → assembling → assembled →
  initiated`, or `failed`/`suppressed`); general machinery only, no quantitative factors.
- **Elongation** — deterministic schematic progress ∈ [0,1], rate = base × global capacity
  × gene efficiency; `paused`/`suppressed` halts progress and resumes from where it left.
- **Termination** — nascent polypeptide released, ribosome released, maturation begins.
- **Folding / maturation** — schematic `nascent → partially_folded → newly_synthesized →
  folding → mature`. No amino-acid interactions, energy landscapes, chaperone kinetics, or
  structure prediction.
- **Protein abundance** — a conserved pool of schematic **protein units** (max 4 → the
  `{0,25,50,75,100}` ladder). Production is capped by `round(maxUnits × mRNA level × gene
  efficiency)`, so abundance tracks mRNA, global capacity, gene efficiency, completed
  translations, and turnover — never instantly, never a molecule count.
- **Turnover** — mature units age and enter `degrading → degraded` on a **schematic**
  degradation-class lifetime (slow/moderate/fast). Biological half-life is **NOT_REPORTED**;
  the simulation decay class is labelled schematic. Conservation holds:
  `produced = folding + mature + degrading + degraded`.
- **Polysomes** — the engine supports N ribosomes per mRNA (independent progress); the
  default profile uses **one** schematic ribosome per active mRNA (documented decision).
- **Global vs gene-specific control** — global capacity (constitutive high for human;
  optionally signal-node-linked as a labelled prediction, not applied to the default human
  profile) is separate from per-gene efficiency.

## The human cascade at runtime

- **HMOX1 mRNA → HO-1 protein** rises to ~50% (transient, lagged) — labelled
  `LITERATURE_DERIVED_PREDICTION`.
- **NQO1 mRNA → NQO1 protein** rises (`MECHANISTIC_PREDICTION`).
- **Suppressed NF-κB-target mRNA → inflammatory protein** stays low (~25%), below HO-1 —
  reduced translation input from suppressed mRNA. HO-1 enzymatic activity / antioxidant
  phenotype / ROS reduction are **not** modelled.
- **Mouse / rat:** idle (NOT_REPORTED) — no Phase-5C mRNA; no human fallback.

## Scientific integrity

The frozen package has no translation dataset. Nothing is marked experimental: although
the general literature reports celastrol-induced HO-1 protein in HaCaT, the repo has **no
verified in-repo primary source**, so HO-1 protein is `LITERATURE_DERIVED_PREDICTION`
(upgradeable only when such a source is attached and verified). No translation rate,
ribosome count, amino-acid length, protein copy number, half-life, folding time, polysome
count, initiation probability, degradation constant, or fold change is fabricated —
unavailable values are `NOT_REPORTED`. Every output carries an evidence label, prediction
category, confidence, and rationale; experimental always takes priority; predictions are
programmatically + visually distinct. ICAM1 was **considered but not adopted** as a named
identity (no verified evidence maps to it); a schematic inflammatory protein is used
instead.

## Verification

- `node simulator/tests/run.mjs` → **1699 passed, 0 failed** (Phase 5C baseline 1611).
- `npx tsc --noEmit` → clean.
- Hidden/zero-width char scan clean; **no model identifier** in any artifact.
- Production `web`/`R`/`app`/`tests`/CI diff vs `origin/main` → **empty**.
- Production tests green.

## Companion docs

`docs/translation-protein-synthesis.md`, `docs/translation-evidence-review.md`,
`docs/protein-output-profiles.md`, `docs/translation-prediction-framework.md`,
`docs/phase5d-validation-report.md`, `docs/translation-animation-specification.md`,
`docs/translation-developer-notes.md`, and the Phase-5D section of
`docs/profile-b-transport-architecture.md`.

## Exact stop boundary

Stops after mature protein abundance + optional turnover. No protein catalytic effects,
enzyme activity, receptor function, metabolism, ROS/inflammatory phenotype, apoptosis,
necrosis, autophagy, cell cycle, proliferation, tumour/immune/tissue response, PK, PD, or
toxicity. Those belong to Phase 6 and later.
