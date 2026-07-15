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
