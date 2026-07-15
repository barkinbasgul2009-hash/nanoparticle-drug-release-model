# Numerical Verification

Status: partial (existing solver) + plan (extension).

## Done (verified this session)
- **Unit/formula correctness:** 31 R core assertions.
- **R↔JS equivalence:** enforced in CI — JS (from web/index.html) vs R-derived
  golden reference; release worst |Δ| ≈ 1e-16, tissue |Δ| = 0 at full precision
  (see tests/js/model.test.mjs, tests/regression/).
- **Stability:** explicit scheme uses dt ≤ 0.4·dx²/D; R warns+refines on violation.
- **Bounds/non-negativity (release):** clamped to [0,1] and tested.
- **Regression baseline:** 11 checks lock existing behaviour.

## Planned (post-approval, per task Section 20)
- dimensional analysis across all parameters;
- explicit tissue non-negativity assertion;
- **spatial-grid convergence** (refine n_x) and **temporal-step convergence**;
- **analytical benchmark** for the spherical solver (quantified error);
- **mass-balance residual** test (docs/mass-balance.md);
- boundary-/initial-condition tests;
- sensitivity, identifiability, uncertainty propagation.

## Status terms (kept distinct)
code-verified · numerically-verified · calibrated · internally-validated ·
externally-validated · literature-supported · illustrative.
