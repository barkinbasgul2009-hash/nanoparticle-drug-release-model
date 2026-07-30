# Passive Microenvironment Model (Phase 7A)

This document specifies the deterministic arithmetic that turns the passive ECM / diffusion /
mechanical / oxygen / hypoxia descriptors into a single schematic drug-penetration modifier.
Every quantity is a schematic ordinal state or a normalized 0–1 value; nothing here is a real
ECM density, collagen mass, interstitial pressure, oxygen concentration, or diffusion
coefficient.

## Supported passive components

| Component | Represented as | NOT represented |
|---|---|---|
| Collagen | density / alignment / packing → porosity + penetration effect (ordinal) | biosynthesis, degradation, fibroblast activity |
| Hyaluronic acid | hydration / diffusion / interstitial-resistance modifier | enzymatic degradation, HAS enzymes, hyaluronidase |
| Proteoglycan | schematic mesh resistance | molecular chemistry |
| Extracellular fluid | porosity | fluid dynamics |
| Interstitial space | available volume, path length, mobility, diffusion resistance | interstitial-flow / CFD |
| Mechanical barrier | ordinal (soft / moderate / dense / highly_dense) | Young's modulus, absolute pressure |
| Oxygen | qualitative (normoxic … severe hypoxia) + availability | pO₂ value, vasculature |
| Hypoxia | severity + penetration / effectiveness / stress-susceptibility modifiers | signalling (HIF-1α) — Phase 7A excludes it |

## The combination model

```
ecmResistance      = w_col·collagen.penetration_effect + w_ha·HA.interstitial_resistance
                   + w_pg·proteoglycan.resistance + w_fluid·(1 - fluid.porosity)   // ecm_composite weights
diffusionResistance= interstitial.diffusion_resistance
mechanicalScore    = barrier_state.score
hypoxiaSeverity    = hypoxia_state.severity

combined_restriction = w.ecm·ecmResistance + w.diffusion·diffusionResistance
                     + w.mechanical·mechanicalScore + w.hypoxia·hypoxiaSeverity   // penetration.combination_weights
penetration_modifier = clamp(1 - combined_restriction, penetration_floor, 1)
effective_availability = penetration_modifier × hypoxia.drug_effectiveness_modifier
```

- `penetration_modifier = 1` means no restriction (full penetration); lower means reduced
  effective penetration, bounded below by `penetration_floor`.
- The drug-penetration modifier influences **effective extracellular drug availability /
  penetration probability / intracellular exposure** only. It **never** modifies drug chemistry,
  binding affinity, protein interactions, or genetic regulation.

## Microenvironment states

`combined_restriction` maps to an ordinal state via `state_thresholds`:
`permissive → slightly_restrictive → moderately_restrictive → highly_restrictive →
extremely_restrictive`. No additional biological meaning is attached.

## Monotonicity (verified in tests)

- Denser collagen → higher ECM penetration resistance → lower penetration modifier.
- More hypoxia → lower oxygen availability + lower penetration modifier.
- Denser mechanical barrier → lower penetration modifier.
- Loose ECM + normoxia → `permissive`; dense ECM + severe hypoxia → `extremely_restrictive`.

## Hypoxia is passive

Hypoxia modifies penetration, drug-effectiveness, cell-stress susceptibility, and prediction
confidence. It does **not** activate signalling pathways (HIF-1α, etc.) in Phase 7A — that
belongs to later phases.

## Honesty boundaries

All values are schematic ordinal / 0–1. No oxygen concentration, ECM fibre density, collagen
mass, interstitial pressure, absolute diffusion coefficient, or penetration rate is claimed
(all `NOT_REPORTED`). The model stops at penetration modification.
