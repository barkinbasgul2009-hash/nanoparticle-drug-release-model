# Changelog

All notable changes to the isolated Profile-B `simulator/` build. Production (`web/`, `R/`,
`app/`, `tests/`) and CI are untouched throughout; the Stage-2 PR is not merged. Dates are
omitted in favour of phase ordering.

## Simulator — Phase 7B · Tumor Vasculature & Angiogenesis (latest)
Added the active vascular component of the tumour microenvironment as a **passive modulator** of
drug delivery (vessel architecture / density / maturity / organization, perfusion, oxygen +
nutrient supply, permeability). Blood vessels never signal, induce apoptosis, or remodel; the
delivery modifier is advisory. New `VascularEngine` (deterministic, registry-driven, optionally
reads the Phase-7A engine read-only for a combined delivery × penetration view), nine registries,
runtime objects, `types/vascular.ts`, an additive `VASCULAR_EVIDENCE_LEVELS` (8 tiers, **no
experimental tier**), a schematic renderer diagram (branching vessels + perfusion tint +
delivery-strength path), a sixteenth evidence-panel section, an eight-event evaluation timeline,
`validate()` (registry + consistency, e.g. rejects `very_high` oxygen + `very_low` perfusion and
an available rat vasculature), and `vascular.test.mjs` (108 assertions). Mouse B16BL6 =
MECHANISTIC_PREDICTION (default; abnormal melanoma vasculature — highly vascularized but immature,
poorly perfused, leaky); human = predictive-exploratory with its own distinct states; rat =
NOT_REPORTED. **STOP at delivery modification** — immune / VEGF / HIF / metastasis stay
NOT_EVALUATED. Config key `vascularSources`. Suite: 2203 passed, 0 failed; tsc clean; production
diff empty.

## Simulator — Phase 7A · Passive Tumor Microenvironment
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
