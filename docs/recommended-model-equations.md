# Recommended Model Equations (design)

Placeholders for symbols; all parameter *values* pending sourced extraction.

## Primary (solid tumour, radial)
Interstitial free API:
  ∂C/∂t = D·(1/x²) ∂/∂x( x² ∂C/∂x ) − k_e·C ,  r ≤ x ≤ R_domain
Depot mass balance (source):
  dM_depot/dt = − Q_release(t) ;  inner BC couples Q_release(t) to C(r,t)
Penetration endpoint: depth where C = threshold·C_ref (threshold user-visible).

## Fallback (skin, multilayer slab)
Per layer i (SC, viable epidermis, dermis):
  ∂C_i/∂t = D_i ∂²C_i/∂x²   (dermis adds − k_clear·C)
Interface (x = a between layers i,i+1):
  flux continuity  −D_i ∂C_i/∂x = −D_{i+1} ∂C_{i+1}/∂x
  partition        C_i(a⁻) = K_{i,i+1} · C_{i+1}(a⁺)
Surface: finite-dose reservoir (depleting) or infinite-dose (fixed).

## Notes
- Symbols and structure are defensible from standard transdermal/tumour transport
  theory; **numeric coefficients are not asserted here** because they require
  full-text sources (`critical-paywalled-sources.md`).
- The primary structure reuses the current solver; the fallback needs new
  multilayer-slab geometry.
