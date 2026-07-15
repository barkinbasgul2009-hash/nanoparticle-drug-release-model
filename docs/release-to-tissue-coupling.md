# Release-to-Tissue Coupling (audit + candidate analysis)

## Current assumption (audited)
`C_surface(t) = C0 · f(t)` (loading × cumulative fraction released). This conflates
a **dimensionless cumulative fraction** with a **boundary concentration** and omits
flux, partition, donor depletion, and interfacial resistance. It is acceptable only
for the generic ILLUSTRATIVE_ONLY view.

## Preferred coupling for a named-tissue profile
Drive Module 2 by a **release flux** into a donor/interface state, not by cumulative
fraction:
  Q_release(t) = dM_released/dt   (mass/time)
  interface: partition K and/or mass-transfer coefficient h_m
  finite donor: donor depletes as drug transfers to tissue
This gives a Neumann/Robin inner boundary with correct units.

## Per-candidate correct boundary quantity
| Candidate | Boundary state | BC type | Data needed |
|---|---|---|---|
| Tumour depot (primary) | release flux → interstitial C | Neumann/Robin | release rate; interstitial D; k_e |
| Skin (fallback) | donor conc / flux at SC surface | Robin (+partition) | K_SC/vehicle; D_SC; dose type |
| Bladder | luminal conc → urothelium flux | Robin | urothelium permeability; wall D |

## Status
Design only. The correct coupling for the selected candidate will be fixed in
Stage 3 once release and interface data are sourced.
