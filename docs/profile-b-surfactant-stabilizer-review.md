# Profile B — Surfactant and Stabilizer Review

Machine-readable: `data/profile-b-formulation-components.json`.

## Verified (P1, Chen)
- **Surfactants/emulsifiers:** soybean lecithin (30 mg) + **TPGS** (d-α-tocopheryl PEG-1000
  succinate, 30 mg) + **Pluronic F68** (poloxamer 188, aqueous phase). Held **constant**
  across all three surface configurations.
- **Stabilizer:** TPGS/Pluronic F68 provide steric stabilization; lecithin emulsifies.
  Chen does **not** compare surfactants or stabilizers head-to-head.

## Comparative evidence
- **None** within a compatible celastrol system has been opened. Chen varies **charge/lipid**,
  not surfactant or stabilizer.
- Therefore a **surfactant selector** and a **stabilizer selector** are **not** justified.
  These components stay **preset-locked** inside P1.

## Consequence for the UI
Surfactants and stabilizers are **components of a preset**, not free menus. A comparative
surfactant/stabilizer study for celastrol (e.g. TPGS vs poloxamer vs Tween/Span, with
size/PDI/zeta/EE/release/permeation outcomes) would be required before exposing any such
choice — and none is verified here. See `docs/profile-b-remaining-source-gaps.md`.
