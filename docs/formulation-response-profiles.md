# Formulation-Response Profiles (Phase 6D)

Phase 6D keeps the surface-charged tripterine-loaded NLCs, free tripterine, and a vehicle
control as **separate** formulation profiles — never merged into one universal NLC. Effect
magnitudes are ordinal, evidence- or prediction-labelled; no exact effect difference,
percentage, or tumour-volume gap is invented.

## Profiles (`tumor-formulation.registry.json`)

| Formulation | Growth suppression | Loss induction | Effect rank | Evidence level |
|---|---|---|---|---|
| Cationic tripterine-NLC | high | high | 4 | EXPERIMENTAL_FORMULATION_SPECIFIC |
| Anionic tripterine-NLC | moderate | moderate | 2 | EXPERIMENTAL_FORMULATION_SPECIFIC |
| Neutral tripterine-NLC | moderate | moderate | 2 | EXPERIMENTAL_FORMULATION_SPECIFIC |
| Free tripterine (celastrol) | low | low | 1 | EXPERIMENTAL_DRUG_CELL_SPECIFIC |
| Vehicle / untreated control | none | none | 0 | EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC |

Effect classes map to schematic values via `effect_class_values`
(`none 0 · minimal 0.15 · low 0.3 · moderate 0.5 · high 0.8`).

## Supported ranking (Chen 2012, B16BL6)

The Chen study supports, qualitatively:

- **cationic NLC → strongest** supported antimelanoma direction;
- **anionic / neutral NLC → lower** relative antimelanoma direction;
- **NLC formulations > free tripterine** where reported;
- **vehicle control** has no treatment effect.

What is **not** asserted: the anionic-vs-neutral strict ordering, any exact effect difference,
percentage, or tumour-volume gap. The `validate()` ranking check enforces
`cationic > anionic`, `cationic > neutral`, `cationic > free`, and `vehicle = 0`, but does not
force an anionic/neutral order.

## Cell-model scope

The formulation ranking is **B16BL6-specific**. B16 and B16-F10 profiles carry only
`free_tripterine` + `vehicle_control` (their evidence is free celastrol, not the NLC
formulations); the NLC ranking is not transferred to them without an explicit context-transfer
label.

## Comparison rules

Formulation comparison is valid **only within the same compatible species, cell model, route,
and experiment context** (all B16BL6 topical here). Only one tumour model runs at a time; the
renderer's response curve can show the active formulation's trajectory, and switching formulation
fully rebuilds the trajectory. The engine never compares across incompatible experiments and
never presents a synthetic curve as extracted experimental data (every curve is labelled with
its evidence level, prediction status, quantitative status = `NOT_REPORTED`, and a
simulation-time warning).

## Behaviour

Under the schematic model, a stronger formulation (higher loss induction + growth suppression)
produces deeper, faster regression toward the minimal-residual floor; the vehicle control grows
above baseline. This ordering reflects the supported ranking direction only — the *magnitudes*
are schematic, not measured.
