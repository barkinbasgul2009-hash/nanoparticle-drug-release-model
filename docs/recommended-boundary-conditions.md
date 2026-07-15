# Recommended Boundary Conditions (design)

## Primary (tumour, radial)
- **Inner (x=r):** release-flux (Neumann/Robin) preferred over the current
  Dirichlet C0·f(t). Flux Q_release(t) from the depot; optional interfacial
  partition. Rationale in `release-to-tissue-coupling.md`.
- **Outer (x=R):** far-field sink (C→0) or zero-flux depending on domain size.

## Fallback (skin, slab)
- **Surface:** finite-dose depleting reservoir, or fixed donor concentration
  (infinite dose), matching the OECD TG 428 experimental setup being reproduced.
- **Interfaces:** flux continuity + partition (Robin-type).
- **Deep (receptor/dermis):** sink (receptor compartment) or clearance term.

## Standing rule
The boundary condition must reproduce the boundary setup of the dataset used for
calibration/validation. Choosing Dirichlet vs Neumann vs Robin is itself a
modelling decision to be justified per candidate (see
`boundary-condition-candidate-analysis.md`).
