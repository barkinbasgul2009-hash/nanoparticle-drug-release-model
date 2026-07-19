# Profile-B Simulator — Phase 5B.1 Implementation Report

**Phase 5B.1: Signal-Transduction Evidence & Graph Architecture.** This phase is
**research, evidence modelling, registry design, graph architecture, and validation
ONLY**. It does **not** implement a runtime signaling engine, propagation, animation,
pathway rendering, phosphorylation dynamics, or any UI. It builds a scientifically
auditable, context-specific, registry-driven **directed signaling graph** with per-node
and per-edge evidence, then **freezes** that architecture for a future Phase 5B.2 to
consume.

Everything is inside `simulator/` plus supporting docs; every previous engine (Phases
1–5A) is **read-only and unchanged**; production `web`/`R`/`app`/`tests` and CI are
**untouched**; PR #3 is **not merged**.

## What was built (data + validator + types + tests only)

Six **separable** registries (one concern each), so context, nodes, edges, pathway
profiles, evidence records, and prediction records never blur together:

| Registry | Purpose |
|---|---|
| `simulator/data/signal-context.registry.json` | Biological contexts (species + cell model + disease + drug + formulation + molecular target). Contexts never mix species/cell models. |
| `simulator/data/signal-nodes.registry.json` | `SignalingNode` records (schematic activity only). |
| `simulator/data/signal-edges.registry.json` | `SignalingEdge` records (directed relationships). |
| `simulator/data/signal-pathways.registry.json` | Pathway **profiles** binding one context to a node/edge set; accept/defer/reject log. |
| `simulator/data/signal-evidence.registry.json` | Reference records (with `verification_status`) + an evidence **audit trail**. |
| `simulator/data/signal-prediction.registry.json` | Explicit predictive claims + a cross-context transfer ledger. |

Plus:

- `simulator/src/biology/signalGraph.js` — a **loader + VALIDATOR ONLY**. It assembles
  the six registries into an in-memory directed graph and checks the architecture. It
  **never** propagates, activates, inhibits, phosphorylates, animates, or renders.
- `simulator/src/types/signaling.ts` — the TypeScript interface contract
  (`SignalingNode`, `SignalingEdge`, `PathwayProfile`, evidence/prediction vocab types).
- `simulator/src/evidence/evidenceEngine.js` — `SIGNAL_EVIDENCE_LEVELS` (9 refined
  classifications) + helpers `isSignalEvidenceLevel`, `isSignalExperimental`,
  `isSignalPrediction`, `signalLevelAnimates`.
- `simulator/tests/signalGraph.test.mjs` — validates the real registries and includes
  negative tests (orphan edge, mixed species, forbidden node, undeclared cycle,
  duplicate/invalid level, cross-profile claim, non-empty NOT_REPORTED profile) and a
  positive declared-feedback test. Registered in `simulator/tests/run.mjs`.
- `simulator/src/config/app.config.js` — a `signalSources` block naming the six files.
  **No runtime engine is wired into `main.js`.**

## The honest evidence position

The frozen `data/profile-b-evidence-package.json` (Chen 2012) supports the **cell
models** (HaCaT human keratinocytes; B16BL6 murine melanoma) and rat ex-vivo skin
permeation, and reports **cellular uptake** — but reports **no signal-transduction
nodes or edges**, and Phase 5A established the **molecular target is NOT REPORTED**.

Therefore signaling here is modelled as **exposure-driven prediction**, never
target-mediated fact:

- **Canonical intracellular relationships** (ROS→MAPK, MAPK→Nrf2, Nrf2→ARE,
  NF-κB→inflammatory output, PI3K→AKT→mTOR) are `EXPERIMENTAL_PATHWAY_SPECIFIC`
  (established general biology, not this exact context) — carrying **no fabricated DOI**.
- **Drug-in-cell-model claims** (celastrol drives these in HaCaT/B16BL6) are
  `LITERATURE_DERIVED_PREDICTION` with `verification_status: UNVERIFIED_IN_REPO`.
- Nothing is `EXPERIMENTAL_FORMULATION_SPECIFIC`.
- **Rat signaling is NOT REPORTED** (empty profile) — no human/mouse pathway is
  silently transferred.

## Accept / defer / reject decisions

| Profile | Context | Axis | Decision |
|---|---|---|---|
| 5B-H1 | human HaCaT | ROS→ERK/p38→Nrf2→ARE→HO-1 (cytoprotective) | **ACCEPT** |
| 5B-H2 | human HaCaT | NF-κB suppression → ↓inflammatory output | **ACCEPT** |
| 5B-M1 | mouse B16BL6 | PI3K→AKT→mTOR survival suppression | **ACCEPT** |
| 5B-H3 | human HaCaT | additional stress axis (crosstalk) | **DEFER** (crosstalk beyond evidence) |
| 5B-R1 | rat skin | — | **NOT REPORTED** (empty; no cellular model) |

All accepted profiles are **DAGs**; feedback/crosstalk is **NOT REPORTED** in 5B.1 (the
validator supports declared typed-feedback cycles for a future phase).

## Verification

- `node simulator/tests/run.mjs` → **1449 passed, 0 failed**.
- `npx tsc --noEmit` → clean.
- No hidden/zero-width control characters in the new artifacts.
- Production `web`/`R`/`app`/`tests`/CI diff vs `origin/main` → **empty**.

## Companion docs

`docs/signal-transduction-evidence-review.md`,
`docs/signal-graph-architecture.md`,
`docs/signal-context-profiles.md`,
`docs/signal-node-edge-evidence-matrix.md`,
`docs/signal-prediction-framework.md`,
`docs/phase5b1-validation-report.md`,
`docs/phase5b2-ui-renderer-specification.md`,
and the Phase 5B.1 section of `docs/profile-b-transport-architecture.md`.

## Explicitly NOT implemented (frozen for later phases)

Runtime signaling engine, signal propagation, node/edge activation/inhibition at
runtime, phosphorylation dynamics, pathway rendering/animation, UI controls; and all
downstream biology — transcription, mRNA, gene regulation, translation, protein
synthesis, apoptosis, necrosis, proliferation, cell cycle, tumour killing, immune
response, toxicity, PK, clinical efficacy.
