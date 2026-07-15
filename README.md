# Nanoparticle Drug-Release & Tissue-Penetration Simulator

A computational simulator for nanoparticle-based drug-delivery systems. It couples
two physics modules so that different nanoparticle designs can be compared *in
silico* — before going to the bench — and packages the result as an interactive,
browser-based tool the community can use directly.

| Module | Question it answers | Physics |
| --- | --- | --- |
| **1 — Release** | How fast does drug leave the particle? | Higuchi, first-order, zero-order, Korsmeyer–Peppas, exact Fickian sphere (Crank), membrane-controlled core–shell |
| **2 — Tissue penetration** | How far does the released drug reach in tissue? | Fick's second law with first-order clearance, ∂C/∂t = D∇²C − kₑC, solved in spherical symmetry |

---

## Why this project (positioning against the state of the art)

The individual models here are textbook material, not new physics. Their value is in
how they are combined and delivered. Two references frame the field:

- **Siepmann, J. & Siepmann, F. (2008/2012).** *Mathematical modeling of drug
  delivery.* International Journal of Pharmaceutics — the standard review that
  catalogues Higuchi, Korsmeyer–Peppas, reservoir/membrane and Fickian models. Our
  Module 1 implements the models it treats as canonical.
- **Crank, J. (1975).** *The Mathematics of Diffusion*, 2nd ed., Oxford — the source
  of the exact spherical-release series solution used in `release_fickian_sphere()`
  and the reference against which the empirical models are compared.

Existing modeling work is typically published as *static figures* from a private
script (MATLAB/Python), tied to one formulation. Against that baseline, the
genuinely novel elements of this project are:

1. **A reusable interactive tool**, not a one-off script — anyone can explore
   designs in a browser without installing anything (`web/index.html`) or run the
   full R/Shiny app locally.
2. **Side-by-side model comparison on shared parameters** — the classic empirical
   models and the mechanistic Fickian solution plotted on one axis, so their
   agreement/divergence for a given design is visible at a glance.
3. **Fit-your-own-data with automatic model selection** — upload experimental
   release data, fit all empirical models, and rank them by AICc (corrected Akaike
   Information Criterion). This turns the tool from a demonstrator into something a
   lab can use on real measurements.

A machine-learning *surrogate* (predict release/penetration directly from design
parameters, skipping the PDE solve) is scoped as future work — see
[Roadmap](#roadmap).

---

## The models

Units are **micrometres (µm)** and **hours (h)** throughout; diffusion coefficients
are therefore in µm²/h. All release functions return the cumulative fraction
released, *f(t) ∈ [0, 1]*.

### Module 1 — release (`R/release_models.R`)

| Model | Equation | Notes |
| --- | --- | --- |
| Higuchi | f = k_H·√t | Diffusion-controlled matrix release |
| First-order | f = 1 − e^(−kt) | Rate ∝ drug remaining |
| Zero-order | f = k·t | Ideal constant-rate device |
| Korsmeyer–Peppas | f = k·tⁿ | n≈0.43 Fickian, n≈0.85 case-II relaxation |
| Fickian sphere | f = 1 − (6/π²)·Σ(1/n²)·e^(−D n²π²t/r²) | Exact Crank solution, mechanistic reference |
| Membrane core–shell | dM/dt = −A·D·K·Cs/h | Reservoir device; **release ∝ 1/h**, the shell-thickness design knob |

### Module 2 — tissue diffusion (`R/tissue_diffusion.R`)

Fick's second law with a first-order clearance term (metabolism/perfusion), in 1-D
spherical symmetry around the particle:

```
∂C/∂t = D · (1/x²) ∂/∂x( x² ∂C/∂x )  −  kₑ · C
```

Solved with a self-contained **explicit finite-difference scheme** (base R only, so
it always runs), honouring the stability limit Δt ≤ Δx²/(2D). The inner boundary
(particle surface) is driven by Module 1's release curve; the outer boundary is a
perfect sink or reflective. An optional `deSolve`/`ReacTran` backend is provided for
stiff problems. Derived metrics include the **penetration depth** (distance at which
C falls to 10 % of the surface value).

---

## Repository layout

```
R/
  release_models.R      Module 1: six release models + dispatcher
  tissue_diffusion.R    Module 2: spherical reaction-diffusion solver + metrics
  parameters.R          default parameter set + validation
  metrics.R             R², RMSE, AICc, and parameter fitting
app/
  app.R                 Shiny web application (the community tool, R-native)
web/
  index.html            zero-install browser tool (same models in JS, GitHub-Pages ready)
notebooks/
  nanoparticle_simulator.ipynb   Jupyter (R kernel) walkthrough
examples/
  run_example.R         worked example; writes comparison + tissue-profile PNGs
tests/
  run_tests.R           test entry point (62 assertions, no dependencies)
```

---

## Getting started

### 1. Run the core models (R, no packages needed)

```bash
Rscript tests/run_tests.R          # 62 assertions, all base R
Rscript examples/run_example.R     # writes examples/*.png and a fit demo
```

### 2. Zero-install browser tool

Open `web/index.html` in any browser, or publish the `web/` folder to GitHub Pages.
No R, no server, no dependencies — the models run client-side in JavaScript. This is
the fastest path for the wider community.

### 3. Full Shiny app (R-native, interactive)

```r
install.packages("shiny")                      # one-time
shiny::runApp("app", launch.browser = TRUE)
```

Tabs: **Release comparison**, **Tissue penetration** (with live penetration-depth
readout), and **Fit your data** (CSV upload → AICc model ranking). Deploy publicly
via [shinyapps.io](https://www.shinyapps.io/) or Posit Connect. The app depends only
on `shiny`; all plotting uses base graphics.

### 4. Develop / document in Jupyter

The R models run in a Jupyter notebook via the **IRkernel**:

```r
install.packages("IRkernel"); IRkernel::installspec()
```

Then open `notebooks/nanoparticle_simulator.ipynb`.

---

## Default parameters

| Parameter | Symbol | Default | Unit |
| --- | --- | --- | --- |
| Core radius | r | 0.10 | µm (100 nm) |
| Shell thickness | h | 0.02 | µm (20 nm) |
| Drug loading | C₀ | 100 | conc. |
| Matrix solubility | Cs | 20 | conc. |
| Shell/core partition | K | 0.5 | – |
| Drug diffusivity (particle) | D_release | 5×10⁻⁴ | µm²/h |
| Tissue diffusivity | D_tissue | 50 | µm²/h |
| Tissue clearance | kₑ | 0.1 | 1/h |
| Tissue radius | r_outer | 20 | µm |

Values are order-of-magnitude representative of a polymeric (e.g. PLGA)
nanoparticle; override them for a specific formulation.

---

## Roadmap

- **ML surrogate model** — a regression/neural-network layer that maps design
  parameters directly to a release/penetration summary, replacing the slow PDE solve
  for rapid design screening (aligns with the "future ML-optimization" goal).
- **2-D / anisotropic tissue** geometries.
- **Multi-drug and degradation-coupled** release (matrix erosion).

---

## References

1. Higuchi, T. (1961/1963). Rate of release of medicaments from ointment bases /
   Mechanism of sustained-action medication. *J. Pharm. Sci.*
2. Korsmeyer, R.W. et al. (1983). Mechanisms of solute release from porous
   hydrophilic polymers. *Int. J. Pharm.* **15**, 25–35.
3. Crank, J. (1975). *The Mathematics of Diffusion*, 2nd ed. Oxford Univ. Press.
4. Siepmann, J. & Siepmann, F. (2008). Mathematical modeling of drug delivery.
   *Int. J. Pharm.* **364**, 328–343.

---

## License

Released for educational and research use. Please cite this repository if the tool
supports your work.
