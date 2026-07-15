# Mass Balance (audit + plan)

Status: **Phase-13 audit (pre-approval).**

## Current state
The existing tissue model is an **open system**: a Dirichlet source at the
particle surface, first-order clearance, and an outer sink. Total drug mass is
**not** conserved by design, and there is currently **no explicit mass-balance
diagnostic** in the code. The Animated Tissue View now computes a **tissue drug
mass** integral `M_tissue(t) = Σ_i C_i · 4π x_i² · Δx` (spherical shells) purely
as a *diagnostic* readout; it is not a closed balance.

## Target closed balance (for qualified profiles)
A defensible named-tissue profile should track, with units, and report a residual:

```
M_particle(t)      drug remaining in nanoparticle(s)     [mass]
M_donor(t)         drug at/near the interface (donor)     [mass]
M_tissue(t)        drug in tissue = ∫ C dV               [mass]
M_cleared(t)       cumulative first-order clearance       [mass]
M_outflux(t)       cumulative loss across outer boundary  [mass]
M_degraded(t)      drug lost to degradation (if modelled) [mass]

residual(t) = M_dosed − [M_particle + M_donor + M_tissue + M_cleared
                          + M_outflux + M_degraded]
```
with `|residual| / M_dosed` reported and required below a tolerance in tests.

## Plan
- Add a numerical mass-balance test (source influx = storage + clearance +
  outflux, within tolerance) — `docs/numerical-verification.md`.
- Surface the residual in the Scientific View for qualified profiles.
- Keep the current diagnostic mass readout labelled illustrative until then.
