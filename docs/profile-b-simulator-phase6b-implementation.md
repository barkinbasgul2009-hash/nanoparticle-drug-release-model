# Profile-B Simulator — Phase 6B Implementation Report

**Apoptosis Commitment & Execution Runtime**

Phase 6B extends the Profile-B mechanistic chain from the Phase-6A *early cellular
response* to the first phase in which a single cell may enter an **irreversible death
program**. It is a strictly single-cell, intracellular apoptosis runtime. It never removes
the cell object and never evaluates any population-, tumour-, tissue-, or immune-level
outcome.

```
persistent cellular stress (6A)
  → apoptosis eligibility
    → reversible pre-commitment
      → commitment gate  ── IRREVERSIBLE ──▶
        → mitochondrial apoptotic transition (ΔΨm loss, MOMP)
          → cytochrome-c release  ┬─▶ caspase-dependent branch
          → AIF release           └─▶ AIF-associated (caspase-independent) branch
            → apoptotic morphology
              → apoptotic cell state   [STOP — single cell only]
```

## Scope discipline (what Phase 6B is and is NOT)

**IS:** intracellular, single-cell apoptosis — eligibility, a reversible pre-commitment
window, an irreversible commitment gate, the mitochondrial apoptotic transition, and two
parallel execution branches (caspase-dependent and AIF-associated) with partial pathway
dependence, plus target-isolated, timing-sensitive interventions.

**IS NOT** (deferred to Phase 6C+ or permanently out of scope): population-level cell loss,
proliferation, cell-cycle arrest *execution*, migration, invasion, metastasis, tumour
shrinkage / volume dynamics, tissue regression, immune clearance / recruitment, cytokine
secretion, necrosis, necroptosis, pyroptosis, ferroptosis, autophagic cell death,
angiogenesis, wound healing, systemic toxicity, PK, PD efficacy, or clinical outcomes.

The cell object is **never removed**. `populationOutcomeEvidence` and
`tumourResponseEvidence` remain `NOT_EVALUATED` in every frame. A `validate()` guard rejects
any profile field that names a forbidden downstream concept.

## What was added

### Engine + objects
- `simulator/src/biology/apoptosisEngine.js` — `ApoptosisEngine`. Reads the Phase-6A
  `ProteinFunctionEngine` cellular-stress states and the Phase-5B
  `SignalPropagationEngine` **read-only**, plus the four Phase-6B registries. Modifies
  nothing upstream. Deterministic (pure arithmetic, **no RNG — no random death
  probabilities**). Strict finite-state machine; irreversible after the commitment gate.
- `simulator/src/biology/apoptosisObjects.js` — `ApoptosisState`,
  `MitochondrialApoptosisState`, `CaspaseCascadeState`, `AIFExecutionState`,
  `ApoptosisIntervention`.

### Registries (four separable, all under `simulator/data/`)
- `apoptosis-dynamics.registry.json` — the finite-state machine (states, irreversible vs
  recoverable sets, legal transitions), ordinal vocabularies (membrane potential, Bax/Bcl-2,
  MOMP, cytochrome-c, caspase, PARP, AIF, morphology) and the schematic dynamics defaults
  (pressure weights, accumulation/relief rates, eligibility / pre-commitment / commitment
  thresholds, commitment persistence, survival counter-weight, survival accumulation penalty,
  stage delays).
- `apoptosis-context.registry.json` — per-species/cell-model profiles: `mouse_b16_apoptosis`
  (experimental reference), `mouse_b16bl6_apoptosis` (**CONTEXT_TRANSFER_PREDICTION**,
  default mouse runtime), `mouse_b16f10_apoptosis` (separate experimental reference, carries
  the PI3K-activator intervention), `human_hacat_apoptosis` (NOT_REPORTED),
  `rat_skin_apoptosis` (NOT_REPORTED).
- `apoptosis-interventions.registry.json` — per-profile interventions (ROS scavenger,
  caspase inhibitor, AIF knockdown, PI3K activator) with target, effect, strength class and
  timing ("acts before commitment" vs "acts during execution").
- `apoptosis-evidence.registry.json` — evidence records (all qualitative,
  `citation: NOT_REPORTED`), one context-transfer record (B16 → B16BL6), prediction records.

### Evidence vocabulary (additive)
`evidenceEngine.js` gains `APOPTOSIS_EVIDENCE_LEVELS` (11 tiers, including
`CONTEXT_TRANSFER_PREDICTION`) plus `isApoptosisEvidenceLevel`, `isApoptosisExperimental`,
`isApoptosisPrediction`, `isApoptosisTransfer`, `apoptosisLevelActive`. Every earlier
evidence array (transport → 6A) is left **unchanged**.

### Wiring
- `types/apoptosis.ts` — full TypeScript interface contract (checked by `tsc --noEmit`).
- `config/app.config.js` — `apoptosisSources` + `apoptosis.dtHours`.
- `render/canvasRenderer.js` — `setApoptosisEngine` + headless `lastApoptosisFrame` and a
  **restrained** paint block (commitment bar with a locked marker, caspase/AIF branch
  indicators, mitochondrial/MOMP/morphology labels). No explosions/flames/skulls/blood/
  red-flash.
- `biology/transportAnimator.js` — steps the apoptosis layer **after** protein function.
- `main.js` — constructs the engine, wires the renderer, exposes the `app.apoptosis` facade,
  and rebuilds it on `app.setSpecies`.
- `ui/panels/anatomyPanels.js` — a **twelfth** evidence-panel section (Apoptosis Commitment
  & Execution) with `populationOutcomeEvidence` / `tumourResponseEvidence` = `NOT_EVALUATED`.

### Tests
`simulator/tests/apoptosis.test.mjs` (registered in `tests/run.mjs`).

## Behaviour summary

- **Mouse (default B16BL6, CONTEXT_TRANSFER_PREDICTION):** persistent 6A stress accumulates
  apoptotic pressure; the cell becomes eligible, enters reversible pre-commitment, then — if
  net pressure stays above the commitment threshold for the persistence window — crosses the
  irreversible commitment gate, undergoes the mitochondrial transition and MOMP, releases
  cytochrome-c and AIF, executes both branches, and reaches the apoptotic / execution-complete
  state.
- **Human HaCaT & rat:** `NOT_REPORTED` → idle. The cell never commits.
- **Determinism:** identical inputs give identical trajectories (no RNG).

## Quality control
- Full simulator suite: **1842 passed, 0 failed** (`node simulator/tests/run.mjs`).
- `npx tsc --noEmit` (run from `simulator/`): clean.
- Hidden / zero-width character scan: clean. Model-id scan: clean.
- Production diff (`web/`, `R/`, `app/`, `tests/`, CI) vs `origin/main`: **empty**.
- Production tests: 99 JS + 31 R, all green.

## Documentation set
`profile-b-simulator-phase6b-implementation.md` (this file), `apoptosis-runtime-architecture.md`,
`apoptosis-evidence-review.md`, `mitochondrial-apoptosis-pathway.md`,
`caspase-and-aif-execution-model.md`, `apoptosis-intervention-model.md`,
`apoptosis-context-transfer-policy.md`, `phase6b-validation-report.md`,
`phase6b-animation-specification.md`, `phase6b-developer-notes.md`, plus the architecture and
README appends.
