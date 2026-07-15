# Validation Report

Status: **Phase-1/12 baseline (pre-approval).** Records what has actually been
verified for the *existing* simulator and the planned validation for the
extension. Uses precise status terms — nothing here is called "validated" unless
it meets that bar.

## Status vocabulary (do not conflate)
- **code-verified** — unit tests pass; the code computes the intended formula.
- **numerically-verified** — solver stability/convergence/benchmark checks pass.
- **calibrated** — parameters fitted to a training dataset.
- **externally-validated** — predictions checked against an *independent*
  dataset, with reported error metrics.
- **literature-supported** — parameter values traceable to verified sources.
- **illustrative** — for teaching/demo; not predictive.

## Current status of the existing simulator

| Item | Status | Evidence |
| --- | --- | --- |
| Release models compute intended formulae | **code-verified** | 31 assertions in `tests/testthat/test_models.R` (bounds, analytic values, monotonicity, parameter recovery) |
| R ↔ JS numerical equivalence | **numerically-verified (CI-enforced)** | `tests/js/model.test.mjs` loads the actual core from `web/index.html` and checks it against the R-derived golden reference every CI run; at full precision release `max|Δ|≈1×10⁻¹⁶`, tissue `max|Δ|=0` |
| Animated Tissue View (generic) | **code-verified, ILLUSTRATIVE_ONLY** | Visualizes the same `C(x,t)`; browser-tested (all tabs, playback, no errors, subpath-safe); not a biological prediction |
| Explicit tissue solver stability | **numerically-verified (partial)** | Stability-limited `Δt`; test asserts finiteness/decay. Convergence not yet tested. |
| Regression baseline | **code-verified** | `tests/regression/baseline_test.R` (11 checks) locks current outputs |
| Tissue parameter values | **illustrative only** | Defaults are order-of-magnitude, not literature-qualified |
| Any tissue prediction | **NOT validated** | No calibration or external validation performed |

## Gaps / not yet done (to be addressed post-approval, Phase 12)
- Spatial-grid convergence (`n_x` refinement) and temporal convergence study.
- Analytical benchmark for the spherical solver (e.g. constant-surface Dirichlet
  sphere vs. series solution) — quantify error.
- Explicit **mass-balance residual** diagnostic (source − clearance − outflux −
  storage) surfaced in the UI.
- Explicit non-negativity assertion in the tissue solver.
- Dimensional-analysis check across all parameters.
- Sensitivity & parameter-uncertainty analysis.
- For any calibrated tissue: train/validation split, residual plots, disclosed
  fitted vs measured parameters, error metrics.

## Standing rule
"Unit tests pass" ≠ "validated". Each claim in the UI must carry its correct
status term from the vocabulary above.
