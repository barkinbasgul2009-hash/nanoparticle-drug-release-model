# Boundary Conditions & Release→Tissue Coupling (audit)

Status: **Phase-13 audit (pre-approval).** Documents how the release model is
currently coupled to the tissue model, whether that coupling is scientifically
valid, and what a more rigorous coupling would require. No parameters changed.

## Current coupling (as implemented)

Inner boundary of the tissue solver (particle surface, `x = r`):
```
C_surface(t) = C0 · f(t)
```
where `f(t)` is the cumulative fraction released from the selected Module-1 model
and `C0` is the drug-loading slider. Outer boundary: perfect sink (`C=0`) or
zero-flux. This is a **Dirichlet** condition driven by cumulative release.

## Is this valid? — honest assessment

**It is a defensible teaching-level approximation, not a rigorous coupling.**
Specific concerns:

1. **Cumulative fraction is dimensionless (0–1); using it as a concentration**
   via `C0·f(t)` conflates "how much has left the particle" with "concentration
   at the tissue interface". These are not the same quantity.
2. A mechanistic coupling should be driven by a **release flux** (mass/time) into
   a **donor compartment**, with an **interfacial partition** and possible
   **finite-donor depletion**, not by a prescribed surface concentration.
3. There is **no interface partition/permeability** term.
4. The current form has **no mass balance** linking particle, donor, tissue,
   clearance and outflux (see `docs/mass-balance.md`).

## What a rigorous coupling would need (post-approval, per qualified profile)

- release **flux** `J(t) = dM_released/dt` from Module 1;
- a donor/interface concentration state fed by `J(t)` and depleted by uptake;
- interfacial **partition coefficient** and/or **mass-transfer coefficient**;
- optional **finite-dose** vs **infinite-dose** donor handling;
- receptor **sink** conditions matched to the experimental setup being reproduced;
- explicit **units** on every state.

## Consequence

For the current **ILLUSTRATIVE_ONLY** generic-tissue model (and its animation),
the existing Dirichlet coupling is retained and clearly labeled illustrative.
Any **named-tissue quantitative profile** must specify and justify its coupling
here before activation, and reproduce the boundary setup of the datasets it is
calibrated/validated against.
