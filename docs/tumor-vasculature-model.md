# Tumor Vasculature Model (Phase 7B)

This document specifies the deterministic arithmetic that turns the vascular architecture /
perfusion / oxygen + nutrient supply / permeability descriptors into a single schematic
drug-delivery modifier. Every quantity is a schematic ordinal state or a normalized 0–1 value;
nothing here is a real vessel count, blood flow, pO₂, vascular diameter, or perfusion rate.

## Supported vascular components

| Component | Represented as | NOT represented |
|---|---|---|
| Vessel architecture | angiogenic state → density / branching / organization (ordinal) | individual endothelial cells, capillary ultrastructure |
| Vessel maturity | immature / developing / mature / stable → delivery efficiency | endothelial junctions |
| Perfusion | very_low … very_high → efficiency (ordinal) | blood pressure, flow vectors, blood rheology |
| Oxygen supply | very_low … very_high → supply (independent from the ECM oxygen field) | pO₂, vasculature geometry |
| Nutrient | limited / restricted / adequate / abundant | metabolite simulation |
| Permeability | low … very_high (abstracted leakiness / EPR) | endothelial junction / pore-size model |

## Angiogenic + maturity states

Angiogenic state progression: `poorly_vascularized → moderately_vascularized →
highly_vascularized → hypervascular` (deterministic; vessel density rises). Vessel maturity:
`immature → developing → mature → stable` (delivery efficiency rises). Tumour vasculature is
typically abnormal — hypervascular but immature/chaotic and leaky — so high density can coexist
with poor perfusion and low maturity (the "tumour paradox").

## The delivery-modifier combination model

```
vesselDensity      = angiogenic_state.vessel_density
maturityEfficiency = vessel_maturity.delivery_efficiency
perfusionEff       = perfusion_state.efficiency
permeability       = permeability_state.value

delivery_modifier = clamp(w.perfusion·perfusionEff + w.permeability·permeability
                        + w.vessel_density·vesselDensity + w.maturity_efficiency·maturityEfficiency,
                        delivery_floor, 1)
```

- `delivery_modifier = 1` means unrestricted vascular delivery; lower means poorer delivery,
  bounded below by `delivery_floor`.
- The delivery modifier influences **effective drug arrival / extracellular availability /
  delivery opportunity** only. It **never** modifies drug chemistry, drug release, protein
  interactions, or gene regulation.

## Delivery states

`delivery_modifier` maps to an ordinal state via `state_thresholds`: `poor_delivery →
limited_delivery → moderate_delivery → good_delivery → excellent_delivery`.

## Monotonicity (verified in tests)

- Higher perfusion → higher delivery modifier.
- Higher permeability → higher delivery modifier.
- Higher vascularization (density) → higher delivery modifier.
- More mature vessels → higher delivery modifier.
- Higher oxygen-supply state → higher oxygen supply value.

## Independence + integration

Vascular oxygen supply is represented **independently** from the Phase-7A passive ECM oxygen
field. The engine also exposes a combined `deliveryModifier × penetrationModifier` (reading the
Phase-7A engine read-only) so a downstream consumer could reason about vascular delivery *and*
passive penetration together — advisory only.

## Honesty boundaries

All values are schematic ordinal / 0–1. No blood flow, vessel count, pO₂, vascular diameter, or
perfusion rate is claimed (all `NOT_REPORTED`). The model stops at delivery modification.
