# Organ / Environment Overview Panel — Specification (Stage-3 design)

When a user selects a tissue/route, the panel shows (content sourced, not guessed):

- schematic name + administration route
- relevant biological layers/structures
- environmental conditions (pH, fluids, enzymes, mucus/barrier) — sourced ranges
- dominant transport barrier(s)
- clearance mechanism(s)
- selected scenario (e.g. fasted/fed, intact/compromised)
- evidence grade + source-supported ranges + major variability
- key assumptions; what the model includes vs excludes

A stomach panel must explain fasted/fed pH, gastric fluid, enzymes, emptying, and
solubility/stability implications — not merely show an image. A skin panel must
explain SC barrier role, hydration, site variation, intact vs compromised barrier,
follicular pathway, and which processes are modelled.

Stage 2 delivers **structure + interaction requirements**, not production UI, and
not populated numbers. Machine-readable content skeleton:
`data/organ-environment-content.json`.
