# Changelog

All notable changes to the isolated Profile-B `simulator/` build. Production (`web/`, `R/`,
`app/`, `tests/`) and CI are untouched throughout; the Stage-2 PR is not merged. Dates are
omitted in favour of phase ordering.

## Simulator — Phase 7A · Passive Tumor Microenvironment (latest)
Added the first tumour-microenvironment layer as a **passive modulator** that modifies drug
penetration (ECM / collagen / hyaluronic acid / interstitial space / oxygen / hypoxia /
mechanical barrier). It never replaces an upstream engine, alters upstream logic, or touches
intracellular signalling; its penetration modifier is advisory. New `MicroenvironmentEngine`
(deterministic, registry-driven), nine registries, runtime objects, `types/microenvironment.ts`,
an additive `MICROENVIRONMENT_EVIDENCE_LEVELS` (8 tiers, **no experimental tier**), a schematic
renderer diagram (ECM mesh + oxygen/hypoxia overlay + direct-vs-tortuous penetration path), a
fifteenth evidence-panel section, an eight-event evaluation timeline, `validate()` (registry +
consistency), and `microenvironment.test.mjs` (110 assertions). Mouse B16BL6 =
MECHANISTIC_PREDICTION (default); human = predictive-exploratory with its own distinct values;
rat = NOT_REPORTED. **STOP at penetration modification** — immune / vascular / remodeling /
metastasis stay NOT_EVALUATED. Config key `tmeSources` (distinct from the frozen Phase-4B
`microenvironmentSources`). Suite: 2095 passed, 0 failed; tsc clean; production diff empty.

## Simulator — Phase 6D · Tumor Growth, Regression & Treatment Response
Schematic normalized tumour burden + treatment-response FSM (untreated growth → regression →
minimal residual → rebound), population-gated, two distinct treatment paths (growth suppression +
loss). Experimental tumour tier grounded in Chen 2012 (direction + formulation ranking only).
Suite: 1985 passed.

## Simulator — Phase 6C · Cell Population Response
Schematic virtual-population composition (living / apoptotic / adapted / recovered fractions) +
strict state machine + deterministic replay history, derived from the single-cell apoptosis
trajectory. Suite: 1916 passed.

## Simulator — Phase 6B · Apoptosis Commitment & Execution
Single-cell apoptosis: persistent stress → irreversible commitment → mitochondrial + caspase/AIF
execution. Suite: 1842 passed.

## Simulator — earlier phases
6A protein function & early cellular response · 5D translation · 5C transcription · 5B.2 signal
propagation · 5B.1 signal graph · 5A target engagement · 4D/4C/4B/4 intracellular release /
endocytosis / passive uptake / release · 3.1/3 predictive & biological transport · 2.6/2.5/2
multi-species anatomy · 1 foundation. See `docs/profile-b-transport-architecture.md` for the full
layered architecture and per-phase implementation reports.
