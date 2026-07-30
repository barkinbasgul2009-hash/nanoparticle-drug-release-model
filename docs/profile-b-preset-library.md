# Profile B — Celastrol Nanoparticle Preset Library

**Stage-2 research artifact. Not a Stage-3 implementation. No production code changed.**

Machine-readable: `data/profile-b-preset-library.json`.

## Architecture decision: presets, not free ingredient menus
Profile B uses a **formulation-preset** architecture. A preset is a complete,
experimentally-defined formulation package. Users select among a small number of
scientifically grounded presets; they do **not** independently pick API / carrier /
lipid / surfactant / stabilizer / coating / charge / size / method from unrestricted
menus (the literature does not support the resulting untested combinations).

## Particle-size decision (Chen 2012)
The three Chen measurements — 84.5, 87.8, 90.2 nm — are **too close to be distinct
"small/medium/large" choices**. They are presented as a **single ~85–90 nm region**,
with **surface charge** as the principal experimentally-varied property. There is **no
user-facing size selector** for these three near-identical values. A size selector would
require real formulations occupying genuinely different size regions (P2 ≈27 nm and
P4 ≈120 nm are such systems, but they are different formulations, not size-variants of P1).

## The preset library

### P1 — Surface-charged topical celastrol NLC (Chen 2012) — **VERIFIED (full text)**
The anchor. One preset **family** with three surface-charge **configurations**
(cationic / neutral / anionic). Full composition, ~85–90 nm, first-order (dialysis-
apparent) release, rat-skin Franz permeation, amorphous celastrol (DSC), B16BL6
melanoma efficacy. **Rat skin, single study, charge confounded with lipid identity.**

### P2 — Celastrol + Indomethacin transdermal NLC (RA) — *identified, unopened*
DOI 10.1080/21691401.2018.1503599. Much smaller (~27 nm, search-reported), a
**combination** drug, different disease (rheumatoid arthritis). Distinct size region.

### P3 — ER-targeting celastrol PLGA/DSPE-PEG nanoparticle (melanoma) — *identified, unopened*
Bioactive Materials 2024 (S2090123224002480). **Polymeric** carrier, TSE ER-targeting
ligand, immunogenic-cell-death mechanism, **systemic** route. Same disease (melanoma),
different carrier + route.

### P4 — HA redox-responsive celastrol micelle + folic acid (breast) — *identified, unopened*
ScienceDirect S014181302507922X. **Hyaluronic-acid coating**, redox-responsive,
folic-acid targeting, ~120 nm (search-reported), systemic.

### P5 — Celastrol polymeric mixed micelle (breast, 4T1) — *identified, unopened*
ScienceDirect S037851732400468X. Distinct micelle carrier, systemic.

### Supporting (not a delivery preset)
Celastrol–β-cyclodextrin inclusion complex (S0167732220338319) — a solubility/stability
**enhancer**, informs the precipitation registry, not a nanoparticle preset.

## Selection outcome (honest)
- **Verified, usable presets: 1** (P1, with three surface configurations).
- **Identified candidate presets: 4** (P2–P5) — the literature **genuinely supports the
  existence of ≥5 distinct celastrol nanoparticle systems**, but only P1 is full-text
  verified in this project. **P2–P5 numbers are search-reported and must not be used as
  data until their PDFs are opened.**

This satisfies the "at least three, preferably ~five" target at the level of *identified
real systems*, while being explicit that only one is verified. Presets were **not**
padded with fictional systems.
