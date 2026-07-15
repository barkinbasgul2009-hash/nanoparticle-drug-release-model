# Architecture & Repository Audit

Status: **Phase-1 audit (pre-approval).** Documents the *existing* simulator as a
regression baseline and defines the target 4-layer architecture for the
Animated Tissue View extension. No biological/tissue parameters are introduced here.

---

## 1. Current architecture (as audited at commit `f7ca348`)

Two parallel implementations of the same model core, plus interfaces:

| Layer | Files | Role |
| --- | --- | --- |
| R model core | `R/release_models.R`, `R/tissue_diffusion.R`, `R/parameters.R`, `R/metrics.R` | Reference implementation (unit-tested) |
| JS model core | inline `<script>` in `web/index.html` | Browser reimplementation of the same equations |
| R interface | `app/app.R` (Shiny), `notebooks/…ipynb`, `examples/run_example.R` | Developer/interactive use |
| Web interface | `web/index.html` | Public GitHub-Pages tool (primary) |
| Tests | `tests/testthat/test_models.R`, `tests/regression/`, `tests/js/` | R core + regression baseline + genuine JS/R↔JS tests |
| CI/CD | `.github/workflows/tests.yml` (R job + Node job), `pages.yml` | Test on push; deploy `web/` to Pages |

### Extension added this phase (additive, existing tabs preserved)
- **Animated Tissue View** tab in `web/index.html`: a radial heatmap coloured
  directly from the solver's `C(x,t)`, synchronized graph, animation controls,
  penetration marker, depth probe, tissue-mass diagnostic, and an
  ILLUSTRATIVE_ONLY evidence panel. `solveTissue` gained a backward-compatible
  optional `nFrames` (adds animation frames + a tissue-mass integral); all
  existing outputs (`snaps`, `snapTimes`, `Cfinal`) are byte-for-byte unchanged.
- **Genuine JavaScript + R↔JS CI test** (`tests/js/model.test.mjs`,
  `extract-model.mjs`): loads the actual model core from `web/index.html` and
  checks it against the R-derived golden reference (`tests/regression/`), so
  drift fails CI. R↔JS agreement is exact (release ≈1e-16, tissue 0 at full
  precision).

### Data flow (both implementations)
```
parameters ──► Module 1 release model  f(t) ∈ [0,1]
                     │
                     ▼  surface concentration = C0 · f(t)   (approx/interp)
              Module 2 tissue solver  C(x,t)  ──► profiles, penetration depth
```

## 2. Numerical methods currently used
- **Release models:** closed-form expressions; the Fickian-sphere model is a
  truncated Crank series (50 terms) with `t=0` pinned to 0.
- **Tissue solver:** explicit finite-difference, 1-D spherical Laplacian
  (conservative flux form), first-order clearance sink term. Inner boundary =
  Dirichlet (surface concentration from release); outer boundary = perfect sink
  or reflective. Time step auto-selected from the stability limit
  `dt ≤ dx²/(2D)` (safety factor 0.4); R version emits a warning and refines if
  violated.

## 3. Audited findings (verified this session)

| Question (Phase 1) | Finding |
| --- | --- |
| Are all six release curves consistent between R and JS? | **Yes.** Cross-checked at t = {0,1,6,12,24,48} h; `max|R−JS| < 5×10⁻¹¹` for every model. |
| Is tissue diffusion actually driven by the selected release model? | **Yes** in all three interfaces (R example, Shiny app `drive_model`, web `drive` selector); the surface BC is `C0·f(t)` from the chosen model. |
| R vs JS tissue solver equivalence? | **Yes.** Final profile agrees to `max|Δ| < 5×10⁻⁵` absolute on a surface scale ≈100 (≈5×10⁻⁷ relative). |
| Non-negativity enforced? | Release fractions clamped to [0,1] (`.clamp_fraction`). Tissue: **not explicitly clamped**, but stays ≥0 in tested regimes because BCs and initial data are ≥0 and the scheme is stable. Recommend adding an explicit assertion. |
| Mass conservation enforced? | **Not applicable / not enforced.** The tissue model is an *open* system (Dirichlet source + clearance + outer sink); total mass is intentionally not conserved. There is currently **no mass-balance diagnostic**. A mass-balance residual is a Phase-12 deliverable. |
| Numerical stability enforced? | **Yes** (stability-limited `dt`; R warns and refines). Convergence in space/time is **not yet tested** (Phase 12). |
| Test coverage | 31 core assertions (bounds, analytic values, solver stability, parameter recovery) + 11 new regression checks. No spatial/temporal convergence or benchmark tests yet. |

## 4. Current assumptions & limitations
- Units are µm / h throughout; diffusion coefficients in µm²/h. Consistent but
  **not** tied to any specific validated formulation — defaults are
  order-of-magnitude illustrative (PLGA-like), **not** literature-qualified.
- Tissue geometry is 1-D spherical, homogeneous, isotropic, single-layer.
- Clearance is first-order and spatially uniform.
- No barrier/partition at the tissue interface beyond the Dirichlet surface value.
- The model represents **released-drug diffusion in local tissue only** — not
  carrier transport, not whole-body biodistribution, not cellular uptake
  (see `docs/model-scope.md`).

## 5. Regression baseline (preservation guarantee)
`tests/regression/baseline_test.R` + `baseline_release.json` capture the current
outputs of all six models and the tissue solver at fixed parameters. Any change
that alters existing behaviour fails these checks. The existing website,
controls, tabs, graphs, tests and deployment are **preserved unchanged**; the
extension is additive.

## 6. Target architecture for the extension (4 layers)

```
1. Scientific model layer   R/ + web/ model core  (existing, unchanged) +
                            new solvers ONLY if a qualified tissue needs them
2. Evidence & parameter     data/source-registry.json  (verified sources)
   layer                    data/tissue-profiles.json  (schema; populated only
                            after eligibility gate + approval)
3. Visualization layer      existing tabs (unchanged) + new "Animated Tissue
                            View" (heatmap from C(x,t), synced graphs, controls)
4. Validation layer         tests/ (existing) + regression/ + planned
                            convergence/benchmark/mass-balance tests
```

**Invariant:** every tissue-specific number rendered in the UI must be
retrievable from `data/source-registry.json` via a `source_id`. No biological
value may be hard-coded in rendering code.
