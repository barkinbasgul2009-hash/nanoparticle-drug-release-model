# Microenvironment Runtime Architecture (Phase 7A)

This document describes the software architecture of the Phase-7A passive tumour-microenvironment
(TME) layer: how it reads context, how the passive field is computed, and how it stays a
strictly passive modulator.

## Position in the layer stack

The microenvironment engine is a separate, additive layer. Conceptually it sits between skin
penetration and cellular uptake in the biological chain, but architecturally it never sits *in
the path* of an upstream engine: it reads registries + the active context and produces
**advisory** modifiers. `TransportAnimator` steps it alongside the other layers; because the
passive field is static per context, stepping only advances its clock (replay-safe).

## Core principle: modify, never replace

The microenvironment **modifies** transport / uptake / penetration. It never:
- replaces an upstream engine,
- alters upstream biological logic, or
- directly modifies intracellular signalling.

The engine's `frame()` reports `modifiesTransport: true`, `replacesTransport: false`,
`modifiesSignalling: false`. Its penetration modifier is an advisory number a downstream
consumer *could* read; nothing upstream is mutated by Phase 7A.

## Inputs / outputs

**Inputs (read-only):** the nine Phase-7A registries + the active species / tumour model /
formulation. **Outputs:** passive transport / oxygen / diffusion / penetration / stiffness /
hypoxia modifiers, an ordinal microenvironment state, a deterministic timeline, and a validation
result.

## Object model (`microenvironmentObjects.js`)

`ECMState` (with `CollagenNetwork` + hyaluronic acid / proteoglycan / fluid sub-states),
`InterstitialSpace`, `DiffusionBarrier`, `OxygenEnvironment`, `HypoxiaState`,
`MechanicalBarrier`, `PenetrationModifier`, and a top-level `MicroenvironmentState`. Every field
is a schematic ordinal state or a normalized 0–1 value — never a real ECM density, collagen
mass, interstitial pressure, oxygen concentration, or diffusion coefficient.

## Passive-field computation (`_compute`, deterministic)

1. **ECM composite** — collagen penetration effect, hyaluronic-acid interstitial resistance,
   proteoglycan resistance, and (1 − fluid porosity), weighted by `ecm_composite.composite_weights`
   → `ecmResistance`.
2. **Interstitial / diffusion** — the chosen interstitial variant's `diffusion_resistance` →
   `diffusionResistance`.
3. **Mechanical** — the ordinal barrier state's `score` → `mechanicalScore`.
4. **Oxygen / hypoxia** — the chosen oxygen + hypoxia states → availability + severity + the
   hypoxia modifiers.
5. **Penetration** — `combinedRestriction = w.ecm·ecmResistance + w.diffusion·diffusionResistance
   + w.mechanical·mechanicalScore + w.hypoxia·hypoxiaSeverity`; `penetrationModifier =
   clamp(1 − combinedRestriction, floor, 1)`; `effectiveAvailability = penetrationModifier ×
   hypoxia.drugEffectivenessModifier`; the microenvironment state is derived from
   `combinedRestriction` against `state_thresholds`.

Pure arithmetic, no RNG. The passive field is computed once per context (`_build`); stepping
does not recompute it (no recalculation drift).

## Timeline

`getTimeline()` returns eight passive-evaluation milestones in order: `microenvironment_loaded`,
`ecm_evaluated`, `interstitial_resistance_calculated`, `hypoxia_evaluated`,
`oxygen_environment_updated`, `penetration_modifier_applied`, `drug_transport_updated`,
`transport_continues`. No downstream biology.

## Isolation guarantees

- Reads registries + context read-only; writes nothing upstream.
- Species / tumour-model / formulation changes fully rebuild the passive field (`_build`); an
  unsupported tumour model or species yields an idle engine (no fallback).
- Human values are distinct from mouse (not copied); no silent cross-species transfer.
- Every frame reports immune / vascular / remodeling / metastasis = `NOT_EVALUATED`.
