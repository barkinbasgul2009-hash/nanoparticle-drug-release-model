# Profile-B Simulator — Phase 4D Implementation Report

**Phase 4D: Intracellular Drug Release Engine.** Models what happens after a carrier is already
inside the cytoplasm (post endosomal escape): intracellular payload release, intracellular free
drug, cytoplasmic diffusion, optional degradation, a schematic nucleus, and optional nucleus
targeting. All inside `simulator/`; production `web`/`R`/`app`/`tests` and CI **untouched**; PR #3
**not merged**. Every previous engine is read-only and unchanged — Phase 4D only adds a new layer.

Final chain, and it **stops here**:
```
topical → transport → extracellular drug release → free-drug diffusion → passive uptake
  → endocytosis → early endosome → late endosome → lysosome → endosomal escape (if supported)
  → INTRACELLULAR drug release → cytoplasmic diffusion → optional nucleus targeting  ⟂ STOP
```

**Forbidden and absent:** DNA/RNA binding, transcription, translation, protein synthesis, receptor
signalling, MAPK/PI3K/NF-κB, apoptosis, immune response, mitochondrial toxicity, PD, efficacy,
tumour response, toxicity, PK, cell death, cell cycle, nuclear pore/importin/exportin/Ran-GTP/NPC
transport, chromosomes/nucleolus/histones, gene regulation (registry `integrity.forbidden` = 30).

Companion docs: intracellular drug release (`docs/intracellular-drug-release.md`), evidence review
(`docs/intracellular-drug-evidence-review.md`), architecture update
(`docs/profile-b-transport-architecture.md`, Phase 4D section), validation
(`docs/profile-b-phase4d-validation-report.md`).

## Scientific basis & the honest B1 outcome
Chen 2012 reports only **in-vitro extracellular** release (first-order, Phase 4A). For the B1 NLC,
**intracellular release kinetics, degradation half-life and nucleus targeting are all NOT
REPORTED**, and endosomal escape is **Unavailable** (Phase 4C) — so **no carrier reaches the
cytoplasm**. The honest result: the intracellular stage is **idle / NOT REPORTED** for B1 (no
intracellular drug is produced, and the evidence panel says so). The full engine is built and
exhaustively tested via **test-only patched registries** (an evidence-supported hypothetical),
never committed as real evidence — the same pattern used for endosomal escape in Phase 4C. No
release constant, half-life, or targeting is ever invented.

## New modules (`simulator/src/biology/`)
| Module | Role |
|---|---|
| `intracellularReleaseModel.js` | Model math (burst / first-order / zero-order / Higuchi / Korsmeyer–Peppas); returns 0 when no model/params (NOT REPORTED). Pure. |
| `intracellularDrug.js` | **Intracellular free-drug** object — id, parent carrier, species, position, velocity, diffusion, release timestamp, compartment, alive flag, evidence level, target compartment. |
| `intracellularReleaseEngine.js` | Monitors cytoplasmic carriers; releases intracellular drug (evidence-gated); cytoplasmic diffusion; degradation; optional nucleus targeting. Reads endocytosis/uptake read-only. |
| `data/intracellular.registry.json` | Release models, degradation/targeting modes, molecule spec, schematic nucleus, per-formulation profile (B1 = NOT REPORTED), per-species evidence, integrity (30 forbidden). |
| `render/canvasRenderer.js` (extended) | Schematic nucleus (membrane + interior) + intracellular drug dots (degraded fade). |
| `biology/transportAnimator.js` (extended) | Steps the intracellular layer after endocytosis each tick. |
| `types/intracellular.ts` | TypeScript contract. |

Also: `NOT_REPORTED` added to the `EVIDENCE_LEVELS` vocabulary (distinct from `UNAVAILABLE`;
neither animates).

## Intracellular drug release (independent of extracellular)
A carrier whose endocytosis state is `CYTOPLASM` (post-escape) may release payload following the
formulation's own model — completely independent of the Phase-4A extracellular release. Released
drug becomes **independent** intracellular molecules (count = released fraction quantised); they
never merge back into the carrier. Models are supported **only if evidence exists**; otherwise the
model is `null` and nothing releases (NOT REPORTED stays NOT REPORTED).

## Cytoplasmic diffusion, degradation, nucleus
- **Diffusion:** Brownian, bounded steps (no teleport), **confined to the carrier's own cell** —
  never exits the cell, never enters a neighbouring cell.
- **Degradation:** `stable` / `partial` / `complete` — applied **only** when formulation evidence
  supports it (rate from evidence; half-life never fabricated). `alive + degraded = total`
  (conserved).
- **Nucleus:** schematic (membrane + interior + label) inside each cell — **no** DNA, chromosomes,
  nucleolus, histones, RNA or transcription machinery.
- **Targeting:** `none` / `passive` / `evidence_supported` — molecules drift toward the nucleus
  **only** when supported and **stop at the nuclear membrane**; they **never enter** (nuclear-pore
  transport is a later phase). With no evidence, drug remains in the cytoplasm.

## Evidence panel (six sections)
Transport / Release / Passive Uptake / Endocytosis / Intracellular Trafficking / **Intracellular
Release**, each Experimental / Predictive / Unavailable / **Not Reported** with a message. For B1
the intracellular-release level is **Not Reported**.

## Species behaviour
`app.setSpecies()` re-species the intracellular engine and **clears all intracellular molecules**
— no stale objects from another species remain.

## Tests & results
New `simulator/tests/intracellular.test.mjs`: all five models (evidence-gated, monotonic, bounded);
schematic nucleus with no forbidden structures; **B1 idle (NOT REPORTED)**; no release before
intracellular localization; no drug before release; carrier conserved; molecule count conserved;
degradation valid; diffusion inside cytoplasm only (no neighbour crossing); no automatic nuclear
entry; nucleus targeting only when enabled; species switching clears molecules; full-app chain +
renderer nucleus/drug frames; previous phases unchanged. **Simulator suite: 1100 passed, 0 failed**
(was 906; exceeds the 1000+ target). `tsc` compiles; hidden-char clean; production diff vs
`origin/main` **empty**; production tests green (**99 JS + 11 R**). PR #3 **not merged**.

---

**Stop.** Phase 4D ends at cytoplasmic diffusion, or (when targeting is supported) at the nuclear
membrane. No DNA/RNA interaction, transcription, translation, PD, PK, apoptosis, tumour killing,
immune response, or any downstream biology was implemented.
