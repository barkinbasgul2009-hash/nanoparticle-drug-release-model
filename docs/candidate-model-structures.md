# Candidate Model Structures

Selection is by mechanism, not by what is already coded. Units are illustrative
placeholders until sourced.

## A. Solid tumour — local depot (PRIMARY)
- **Structure:** spherical reaction–diffusion of released free API.
  ∂C/∂t = D·(1/x²)∂/∂x(x²∂C/∂x) − k_e·C, with a release-driven inner source.
- **State variables:** C(x,t) free API in interstitium; M_carrier(t) in depot.
- **Geometry:** radial (matches current solver).
- **Clearance k_e:** lumps perfusion/lymphatic/interstitial removal.
- **Data needs:** interstitial D of the API in tumour; effective k_e; release curve.
- **Numerics:** existing explicit FD is adequate; browser-feasible.
- **Excluded:** carrier transport, cellular uptake, vascular source geometry.

## B. Topical skin — multilayer slab (FALLBACK)
- **Structure:** 1-D multilayer diffusion with interfacial partition:
  ∂C_i/∂t = D_i·∂²C_i/∂x², layers = SC / viable epidermis / dermis, with partition
  K at each interface and a dermal-clearance sink in the dermis.
- **Geometry:** planar slab (NEW — not yet implemented).
- **Source:** nanoparticle reservoir at the surface releasing API (finite/infinite
  dose per OECD TG 428).
- **Data needs:** layer thicknesses; D_i and K_i per layer; dermal clearance.
- **Numerics:** 1-D multilayer FD with flux-continuity interfaces; browser-feasible.

## C. Intravesical bladder wall — slab (THIRD)
- **Structure:** 1-D diffusion from luminal surface through urothelium barrier +
  deeper wall, with the urothelium as a high-resistance layer.
- **Geometry:** planar slab (NEW).
- **Data needs:** urothelium permeability; wall D; depth–concentration profile.

## Cross-cutting
Each structure must declare state variables, geometry, ICs, BCs, parameters,
units, identifiability, numerical method, and excluded processes before Stage-3
implementation. See `recommended-model-equations.md` and
`recommended-boundary-conditions.md`.

---

## Stage-2 CONTINUATION — spheroid carrier model (from dossier, Chen 2024)
For intact-carrier penetration in a tumour spheroid, pure Fickian diffusion is
**insufficient** (active/energy-dependent uptake observed). Candidate structure:
  dC_np/dt = div(D_eff grad C_np) - k_u*C_np + k_r*C_cell
  dC_cell/dt = k_u*C_np - k_r*C_cell - k_loss*C_cell
where C_np = extracellular intact carrier, C_cell = cell-associated carrier, D_eff =
effective (paracellular) diffusion, k_u uptake, k_r return, k_loss sequestration.
This adds an intracellular state (M_cell) to the mass balance. Size-dependence cannot
be inferred from reported peak positions alone — raw/digitized spatial profiles from
the Chen primary (not opened) would be required. Kept SEPARATE from the skin submodel
and the dextran vascular benchmark.
