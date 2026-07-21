# Evidence Architecture (modular)

Stage 2 replaces the previous **all-or-nothing** candidate logic (which blocked a
whole profile unless one paper supplied the entire chain) with a **modular**
architecture: each profile is decomposed into modules (A–T), and **every module and
parameter carries its own evidence label** (`data/evidence-labels.json`).

## Why
Real nanoparticle DDS evidence is modular: formulation, release, tissue transport,
environment, PK, and validation typically come from different papers. Absence of a
single perfect end-to-end validated dataset does **not** mean there is no useful,
defensible model — it means the model is a transparent composite with per-module
grades.

## Component labels (module/parameter level)
DIRECT_EXACT · DIRECT_PARTIAL · API_SPECIFIC · CARRIER_SPECIFIC · TISSUE_SPECIFIC ·
MECHANISTIC_TRANSFER · BENCHMARK · CALIBRATED · INFERRED · ASSUMED ·
ILLUSTRATIVE_COUPLING · EXTERNALLY_VALIDATED · UNVERIFIED_SECONDARY ·
INSUFFICIENT_EVIDENCE.

## Profile levels
LEVEL 0 ILLUSTRATIVE_ONLY → LEVEL 1 MECHANISTIC_BENCHMARK → LEVEL 2
RESEARCH_SUPPORTED_SUBMODEL → LEVEL 3 RESEARCH_SUPPORTED_COMPOSITE → LEVEL 4
FORMULATION_SPECIFIC_CALIBRATED → LEVEL 5 EXTERNALLY_VALIDATED → LEVEL 6
CLINICALLY_QUALIFIED.

## Stage-3 rule
Stage 3 may proceed with LEVEL 1–4 profiles **if** limitations are explicit and
unsupported outputs are disabled/labelled. **Block the unsupported claim/output, not
the whole profile.** Every cross-study bridge is recorded explicitly in
`evidence-bridge-tables.md`; every parameter in `data/parameter-provenance.json`.

## Non-combination rule (unchanged)
Distinct systems (skin released-API · AuNP spheroid carrier · dextran vascular ·
liposomal/protein clinical NPs) are **never silently merged**. Any transfer is an
explicit, labelled bridge with a stated mismatch and uncertainty direction.

## Simulator per-layer evidence vocabularies (additive)
The isolated `simulator/` build layers additive, per-phase evidence vocabularies on top of
this architecture (each new array leaves all earlier arrays unchanged): transport
`EVIDENCE_LEVELS`; signal `SIGNAL_EVIDENCE_LEVELS`; gene `GENE_EVIDENCE_LEVELS`; translation
`TRANSLATION_EVIDENCE_LEVELS`; protein function `FUNCTION_EVIDENCE_LEVELS`; apoptosis
`APOPTOSIS_EVIDENCE_LEVELS` (11 tiers, incl. `CONTEXT_TRANSFER_PREDICTION`); and — Phase 6C —
`POPULATION_EVIDENCE_LEVELS` (8 tiers). The population vocabulary deliberately has **no
experimental tier**: the frozen package holds no measured population composition, so a
population relationship is only ever a labelled prediction (`MECHANISTIC_PREDICTION` /
`CONTEXT_TRANSFER_PREDICTION`) or `NOT_REPORTED`. The non-combination rule is enforced at the
cell-model level too: population behaviour never transfers across cell models without an
explicit `CONTEXT_TRANSFER_PREDICTION` record (validator-enforced), and `NOT_REPORTED`
single-cell contexts (HaCaT, rat) yield `NOT_REPORTED` populations — no human/rat fallback.
The simulator stops at population composition; tumour / survival / clinical outcome stays
`NOT_EVALUATED`. See `population-prediction-policy.md` and `population-evidence-review.md`.
