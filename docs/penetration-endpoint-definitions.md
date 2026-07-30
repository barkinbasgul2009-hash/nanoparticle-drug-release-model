# Penetration Endpoint Definitions

"Penetration" is ambiguous and must be pinned per dataset. Distinct endpoints:

| Endpoint | Meaning | Measures | Matches current tool output? |
|---|---|---|---|
| Cumulative amount permeated | mass through membrane over time | API (usually) | indirectly |
| Permeability coefficient k_p | steady-state flux / donor conc | API | no (would need flux BC) |
| Steady-state flux J_ss | mass·area⁻¹·time⁻¹ | API | no |
| Lag time | time to steady state | API | no |
| Depth above threshold | deepest x with C ≥ θ·C_ref | API or carrier | **yes (current penetration-depth metric)** |
| Concentration profile C(x) | full spatial profile | API or carrier | **yes** |
| Tissue retention / AUC | integral in tissue | API or carrier | derivable |
| Whole-organ accumulation / %ID | fraction of dose in organ | often carrier | no (not spatial) |

Rules: state whether the endpoint measures **API or carrier**; record detection
limit, tissue resolution, threshold, and uncertainty. The tool's current
"penetration depth" = *depth above threshold*, threshold user-visible.
Machine-readable: `data/endpoint-registry.json`.

---

## Stage-2 CONTINUATION — endpoints actually measured in opened sources
- Iliopoulos 2020: **cumulative amount permeated** (µg/cm²) and **steady-state flux**
  (µg/cm²/h) across skin, plus **in vivo SC amount per area** (Raman). These are
  API (small-molecule) endpoints, not carrier.
- Rothe 2017: **partition K_SC/v** and **diffusion D_SC/H²_SC** (not a penetration
  depth per se) — the fundamental transport coefficients.
- Neither reports the tool's native "depth above threshold" directly; mapping to it
  requires the multilayer model. Bladder/tumour depth endpoints remain unsourced.
