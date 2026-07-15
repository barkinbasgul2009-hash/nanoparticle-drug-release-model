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

## Animated Tissue View (planned — not yet available)

An additional **Animated Tissue View** tab is planned. It will add, *alongside*
the existing tabs:
- an evidence-qualified tissue selector and administration-route selector,
- a time-animated heatmap of the solver's concentration field `C(x,t)`,
- synchronized quantitative graphs and a penetration-depth marker,
- an **Evidence, Assumptions & Limitations** panel and Simple/Scientific view
  modes.

It is intentionally **not implemented yet**: it is gated on the scientific
evidence audit and architecture review (see `docs/evidence-matrix.md`,
`docs/model-scope.md`, `docs/architecture.md`). No tissue-specific predictive
values exist until sources are verified and approved. Nothing about the current
tool changes in the meantime.
