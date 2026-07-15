# User Guide

## Using the simulator today (unchanged)

The recommended way is the **browser tool** — no installation:
- Online: the GitHub Pages site (see README).
- Offline: open `web/index.html`.

Two tabs, both preserved:
- **Release comparison** — six release models drawn together for your
  nanoparticle design; move the sliders to explore.
- **Tissue penetration** — how far the released drug spreads into local tissue,
  with a live penetration-depth readout. Choose which release model drives the
  tissue source.

Developers can also use the R core, the Shiny app (`app/app.R`), and the Jupyter
notebook — see the README.

## Animated Tissue View (available — generic soft tissue, ILLUSTRATIVE ONLY)

A third tab, **Animated Tissue View**, is now available *alongside* the two
existing tabs (which are unchanged). It provides:
- a time-animated radial heatmap of the solver's concentration field `C(x,t)`,
  coloured directly from the computed values (no invented motion);
- play / pause / reset, a time scrubber, and a speed control;
- a synchronized concentration-vs-depth graph with a penetration-depth marker
  and an adjustable depth probe;
- readouts for simulation time, penetration depth, maximum concentration, probe
  concentration, and a tissue-drug-mass diagnostic;
- an **Evidence, Assumptions & Limitations** panel.

It is deliberately restricted to a **generic soft tissue** and marked
**ILLUSTRATIVE_ONLY**: it visualizes the same physics as the Tissue Penetration
tab and makes **no organ-specific or clinical claim**. The heatmap uses a
perceptual √ colour scale for visibility; the quantitative graph is linear.

Reduced-motion users: the animation never auto-plays; the scrubber gives the
identical results as a static, step-through view.

### Named-tissue profiles (skin, gut, tumour) — not yet available
Evidence-qualified tissue and administration-route selectors are **not** enabled
yet. They are gated on the scientific evidence review and approval
(`docs/search-protocol.md`, `docs/evidence-matrix.md`, `docs/model-scope.md`).
No tissue-specific predictive values exist until sources are verified and
approved.
