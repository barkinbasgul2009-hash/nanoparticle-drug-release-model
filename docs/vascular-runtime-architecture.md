# Vascular Runtime Architecture (Phase 7B)

This document describes the software architecture of the Phase-7B tumour-vasculature layer: how
it reads context, how the vascular field + delivery modifier are computed, and how it stays an
advisory modulator.

## Position in the layer stack

The vascular engine is a separate, additive layer. Conceptually it sits between the Phase-7A
passive microenvironment and interstitial transport, but architecturally it never sits *in the
path* of an upstream engine: it reads registries + the active context (and the Phase-7A engine
read-only) and produces **advisory** modifiers. `TransportAnimator` steps it; because the
vascular field is static per context, stepping only advances its clock (replay-safe).

## Core principle: modify, never signal or replace

Blood vessels **modify** oxygen / nutrient / drug accessibility / penetration opportunity. They
never:
- signal (no VEGF / HIF / endothelial cascades),
- induce apoptosis,
- remodel (no ECM remodeling / angiogenic remodeling dynamics), or
- alter upstream biological logic.

`frame()` reports `modifiesDelivery: true`, `modifiesSignalling: false`,
`inducesApoptosis: false`, `remodels: false`. The delivery modifier is an advisory number a
downstream consumer *could* read; nothing upstream is mutated by Phase 7B.

## Inputs / outputs

**Inputs (read-only):** the nine Phase-7B registries + the active species / tumour model /
formulation, and optionally the Phase-7A `MicroenvironmentEngine`. **Outputs:** vessel density,
perfusion modifier, oxygen modifier, nutrient modifier, permeability modifier, a vascular
delivery modifier, an ordinal delivery state, a deterministic timeline, and a validation result.

## Object model (`vascularObjects.js`)

`VesselState` (angiogenic state / density / branching / organization / maturity),
`VascularNetwork`, `PerfusionState`, `OxygenSupply`, `NutrientEnvironment`, `PermeabilityState`,
`DeliveryModifier`, and a top-level `VascularState`. Every field is a schematic ordinal state or
a normalized 0–1 value — never a real vessel count, blood flow, pO₂, vascular diameter, or
perfusion rate.

## Vascular-field computation (`_compute`, deterministic)

1. **Vessel architecture** — the angiogenic state gives vessel density + branching + organization;
   the maturity state gives a delivery efficiency.
2. **Perfusion / oxygen / nutrient / permeability** — each ordinal state maps to a schematic 0–1
   value.
3. **Delivery modifier** — `deliveryModifier = clamp(w.perfusion·perfusionEff +
   w.permeability·permeability + w.vessel_density·vesselDensity + w.maturity_efficiency·maturityEff,
   floor, 1)`; the delivery state is derived from `deliveryModifier` against `state_thresholds`.

Pure arithmetic, no RNG. The field is computed once per context (`_build`); stepping does not
recompute it (no recalculation drift).

## Integration with Phase 7A

`effectiveDeliveryPenetration()` reads the Phase-7A `MicroenvironmentEngine.penetrationModifier()`
**read-only** and returns `deliveryModifier × penetrationModifier` — the combined vascular
delivery × passive penetration. If no Phase-7A engine is supplied, it equals the delivery
modifier. Neither engine is mutated.

## Timeline

`getTimeline()` returns eight vascular-evaluation milestones in order: `vascular_profile_loaded`,
`vascular_network_generated`, `perfusion_calculated`, `oxygen_supply_updated`,
`nutrient_environment_updated`, `permeability_applied`, `drug_delivery_modified`,
`transport_continues`. No downstream signalling events.

## Isolation guarantees

- Reads registries + context (+ Phase 7A) read-only; writes nothing upstream.
- Species / tumour-model / formulation changes fully rebuild the field (`_build`); an unsupported
  tumour model or species yields an idle engine (no fallback).
- Human values are distinct from mouse (not copied); no silent cross-species transfer.
- Every frame reports immune / VEGF / HIF / metastasis = `NOT_EVALUATED`.
