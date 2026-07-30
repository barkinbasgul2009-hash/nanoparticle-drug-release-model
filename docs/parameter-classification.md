# Parameter Classification (design)

Every researched parameter is assigned a role (A–H). No factor becomes a slider
unless it (i) enters the selected model, (ii) has a supported direction/magnitude,
(iii) has a known valid range, (iv) keeps the profile meaningful, (v) allows
extrapolation detection.

| Parameter (example) | Role | Notes |
|---|---|---|
| Tissue diffusivity D | A MODEL INPUT / D USER-ADJUSTABLE (bounded) | direct equation term |
| Local clearance k_e | A MODEL INPUT / D USER-ADJUSTABLE (bounded) | removal term |
| Release rate / t50 | A MODEL INPUT | from formulation release data |
| Interface partition K | A MODEL INPUT / E LOCKED per profile | boundary coupling |
| Layer thicknesses (skin) | B SCENARIO PRESET / E LOCKED | anatomy per profile |
| Tissue pH, bile salts, mucus | B SCENARIO PRESET or G INFORMATIONAL | only A if they enter an equation |
| Particle diameter | A MODEL INPUT (via release) or G INFORMATIONAL | depends on model |
| Zeta potential, PEG density | G INFORMATIONAL or H UNSUPPORTED | rarely a direct equation term |
| Penetration threshold | D USER-ADJUSTABLE | endpoint definition |
| Uncertainty ranges | F UNCERTAINTY | propagation |

Roles are provisional until the selected model fixes which parameters are equation
terms. Machine-readable: `data/parameter-role-registry.json`. No decorative
controls: every future slider maps to a term in `parameter-to-equation-map.md`.
