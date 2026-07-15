# Model Scope

Status: **Phase-4 scope definition (pre-approval).** Defines exactly which
biological processes the simulator does and does not represent, so the animation
visualizes only what the model computes.

## The nine processes (do not conflate)

| # | Process | Modelled today? | Notes |
| --- | --- | --- | --- |
| 1 | Drug release from the nanoparticle | **Yes** | Module 1 (six models) |
| 2 | Movement of the nanoparticle carrier | **No** | Carrier position is not tracked |
| 3 | Diffusion of *released* drug through local tissue | **Yes** | Module 2 (spherical reaction-diffusion) |
| 4 | Systemic biodistribution between organs | **No** | Would require a PBPK model (e.g. OSP) |
| 5 | Transport across epithelial / vascular barriers | **No** | No barrier/partition sub-model |
| 6 | Cellular uptake | **No** | — |
| 7 | Intracellular trafficking | **No** | — |
| 8 | Metabolism | **Partial** | Only as a lumped first-order clearance term |
| 9 | Elimination / clearance | **Partial** | First-order, spatially uniform |

## What the current model IS
A **local tissue-scale continuum model** of the concentration of *released free
drug* diffusing outward from a single nanoparticle (or a co-located population
treated as a point/spherical source), with first-order local clearance.

## What the current model is NOT
- Not a whole-body pharmacokinetic (PBPK) / biodistribution model.
- Not a model of nanoparticle carriers physically travelling through tissue,
  blood vessels, or into cells.
- Not a barrier-crossing (skin stratum corneum, gut epithelium, tumour vascular
  wall) transport model.

## Consequence for the animation (Phase 8–9)
The Animated Tissue View must render the solver's concentration field `C(x,t)`
of **released drug** — e.g. a heatmap/diffusion front coloured directly from
`C`. It must **not** depict:
- nanoparticles entering cells,
- carriers crossing a membrane or moving through vessels,
- accumulation in a named organ,

unless and until a corresponding process above is explicitly added to the model
and backed by qualified evidence. If only released-drug concentration is
modelled, only released-drug concentration is animated.

## Administration route (Phase 5)
Local tissue exposure is uninterpretable without a route. Routes will be an
explicit selector, and a tissue profile is only valid for the route(s) its
evidence supports. Incompatible pairings (e.g. "IV → tumour penetration" vs
"intratumoral injection") are treated as distinct profiles, never interchanged.
Route options remain **disabled** until a route+tissue profile passes the
eligibility gate.
