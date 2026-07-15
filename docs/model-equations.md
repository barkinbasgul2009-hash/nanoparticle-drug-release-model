# Model Equations (current implementation)

Status: **documents the existing verified code** (`R/release_models.R`,
`R/tissue_diffusion.R`). Symbols use µm / h; diffusion coefficients µm²/h. All
release functions return cumulative fraction released `f(t) ∈ [0,1]`.

## Module 1 — release

| Model | Equation | Parameters |
| --- | --- | --- |
| Higuchi | `f = k_H·√t` | `k_H` |
| First-order | `f = 1 − e^(−k t)` | `k` |
| Zero-order | `f = k·t` | `k` |
| Korsmeyer–Peppas | `f = k·tⁿ` | `k`, `n` |
| Fickian sphere (Crank) | `f = 1 − (6/π²)·Σ_{n=1..50} (1/n²)·e^(−D n²π² t / r²)` | `D`, `r` |
| Membrane core–shell | `dM/dt = −A·D·K·Cs/h`, `A = 4πr²`, `M_tot = (4/3)πr³C0` ⇒ `f = A·D·K·Cs·t / (h·M_tot)` (with `Cs = C0` by default) | `D`, `r`, `h`, `K`, `C0` |

All are clamped to `[0,1]`; the Fickian series pins `f(0)=0` (truncation guard).

## Module 2 — tissue diffusion

1-D spherical reaction–diffusion for released-drug concentration `C(x,t)`:

```
∂C/∂t = D · (1/x²) ∂/∂x( x² ∂C/∂x )  −  k_e · C
```

**Discretisation** (explicit finite difference, conservative flux form):
```
lap_i = [ x²_{i+½}(C_{i+1}−C_i) − x²_{i−½}(C_i−C_{i−1}) ] / (x_i² · Δx²)
C_i^{n+1} = C_i^n + Δt·( D·lap_i − k_e·C_i^n )
```

**Boundary conditions**
- Inner (`x = r_inner`, particle surface): Dirichlet, `C = surface_conc(t)`,
  where `surface_conc(t) = C0 · f(t)` from the selected release model.
- Outer (`x = r_outer`): `sink` (Dirichlet `C=0`) or `reflect` (zero-flux).

**Stability:** explicit scheme requires `Δt ≤ Δx²/(2D)`; the solver picks
`Δt = 0.4·Δx²/D` (R version warns and refines if a caller-supplied `Δt`
violates the limit).

**Derived metric — penetration depth:** the distance from the particle surface at
which `C` first falls below `threshold · C_surface` at the final time
(default `threshold = 0.1`). The threshold is user-visible (Phase 11).

## Verified equivalence
R and JavaScript implementations of every equation above agree numerically
(release `max|Δ| < 5×10⁻¹¹`; tissue `max|Δ| < 5×10⁻⁵` absolute). See
`docs/validation-report.md`.

## Not yet in the model
Barrier/partition at the tissue interface, multi-layer tissue, spatially varying
`D` or `k_e`, carrier transport, and whole-body distribution are **not**
represented. Any of these would be a new, separately-verified model component.
