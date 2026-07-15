# Boundary-Condition Candidate Analysis (design)

For each candidate: correct boundary state variable, units, BC class, data
availability, and missing data. All "available?" cells reflect the Stage-2 access
constraint (identified, not opened).

| Candidate | Boundary variable | Units | BC class | Required data | Available (full-text)? |
|---|---|---|---|---|---|
| Tumour depot (primary) | release flux; interstitial C | mass·time⁻¹; mass·vol⁻¹ | Neumann/Robin | release rate, D_interstitium, k_e | identified, not opened |
| Skin (fallback) | donor conc/flux; K at SC | mass·vol⁻¹; – | Robin+partition | K_SC/vehicle, D_SC, dose regime | identified, not opened |
| Bladder | luminal conc; urothelium P | mass·vol⁻¹; length·time⁻¹ | Robin | urothelium P, wall D | identified, not opened |

Robin (flux + partition) boundaries are generally more defensible than the current
Dirichlet for named tissues. Final choice pending sourced data.
