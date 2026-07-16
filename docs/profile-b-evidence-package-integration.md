# Profile B — Frozen Evidence-Package Integration

**The user-provided `Profile_B_Evidence_Package.pdf` is now the authoritative, frozen
source of truth for Profile B.** This document records how it was integrated. Machine-
readable capture: `data/profile-b-evidence-package.json`; simulator presets:
`data/profile-b-simulator-presets.json`; animation presets: `data/profile-b-animation-presets.json`.

**No production code changed · Stage 3 not started · PR #3 not merged · no animation
implemented · no outside knowledge used · no values invented.**

## What the package contains (opened this run, per the package)
| Preset | Source | Evidence level | Role |
|---|---|---|---|
| **B1** | Chen 2012 (Int J Nanomedicine 2012;7:3023–3033; DOI 10.2147/IJN.S32476) | FULL_TEXT_PRIMARY | Active primary preset |
| **B2** | Wang 2025 (J Adv Res 2025;71:585–601; DOI 10.1016/j.jare.2024.06.011) | PRIMARY_ARTICLE_PREVIEW | Research preset (mechanism-rich, abstract-supported) |
| **B3** | Shukla 2020 (J Mol Liquids 2020;318:113936; DOI 10.1016/j.molliq.2020.113936) | PREVIEW; **NON-NANOPARTICLE** | Comparator module (not an NP preset) |
| review | Sun 2024 (Front Pharmacol 2024;15:1137289; DOI 10.3389/fphar.2024.1137289) | REVIEW | Discovery only |

**Review-identified only (not selectable presets):** Yang 2019 (10.1080/10717544.2019.1636423),
Yin 2017 (10.1080/10717544.2017.1410260), Zhao 2018 (10.1080/10717544.2018.1425778),
Zhou 2019 (10.1166/jbn.2019.2739).

## Evidence-confidence per simulator state
- **B1:** HIGH — full-text primary. Reportable: size (cationic 90.2±9.7 / anionic 87.8±7.4 /
  neutral 84.5±10.2 nm), EE (64.3 / 67.8 / 72.5 %), first-order release, sampling schedules,
  0–30/30–60/60–90 µm depth layers, uptake rank cationic>neutral>anionic, amorphous state.
  **NOT REPORTED:** PDI, zeta, drug-loading %, PK, storage time-series, precipitation/aggregation.
- **B2:** MODERATE — abstract level. All physicochemical fields **NOT REPORTED**; only the ICD
  mechanism chain is supported.
- **B3:** MODERATE — preview; non-nanoparticle. Supports celastrol poor solubility/instability
  and SBE-βCD 30-fold solubility + stability + intestinal-permeability gains only.

## Reconciliation with prior project extraction (important)
Earlier this session I opened Chen 2012 **Table 2/4** directly and recorded PDI (0.109–0.116),
zeta (+26.4/−2.7/−24.3 mV), and release/permeation percentages. **The frozen package
deliberately restricts to abstract/line-cite level and marks PDI, zeta, and release-% as
`NOT REPORTED`.** Per the package's priority rule:

- The **simulator database uses the package values** — including `NOT REPORTED` for PDI/zeta.
- There is a **size/EE ordering difference**: the package (abstract) assigns anionic 87.8 nm /
  neutral 84.5 nm and EE cationic 64.3 %, whereas my Table-2 reading assigned neutral 87.8 /
  anionic 84.5 and EE cationic 69.3. **The package is authoritative;** the earlier
  table-level file (`data/profile-b-preset-library.json`) is retained for traceability with a
  `SUPERSEDED_NOTICE` and is no longer the simulator source.
- Prior candidate presets **P2 (celastrol+indomethacin NLC), P4, P5** are **deactivated** —
  the package explicitly lists "P2-like indomethacin NLC numeric extraction" and
  "P4/P5-like unresolved candidate presets as active options" as **not supported**. Prior
  **P3** is corrected to **Wang 2025 = B2**.

## Animation integration (per the package's spec)
- **B1 — animate only:** topical application, delayed release, rat-skin permeation, depth-layer
  deposition, HaCaT/B16BL6 uptake ranking, antimelanoma endpoint.
- **B1 — `UNSUPPORTED — DO NOT ANIMATE`:** precipitation, aggregation, intracellular
  degradation, metabolic conversion, blood-vessel extravasation, ECM traversal.
- **B2:** ER-targeting / ER-stress / immune-activation scenes as *abstract-supported* — no
  sliders, numeric labels, or deterministic timing.
- **B3:** solubility/stability/permeability as an info/comparator panel — no precipitation,
  aggregation, or particle-growth animation.

## Claim boundaries (verbatim from the package)
- **Supported:** Chen 2012 topical NLC behavior; Wang 2025 ER-targeting melanoma ICD mechanism;
  Shukla 2020 celastrol–SBE-βCD solubility/stability/permeability improvement; Sun 2024 study
  identities + DOIs.
- **Not supported:** P2-like indomethacin NLC numeric extraction; P4/P5-like unresolved
  candidate presets as active options; deterministic precipitation/aggregation times; storage
  stability kinetics; independent validation; human prediction outside the reviewed tissue models.

## Frozen-package discipline
This package is **frozen**. Future work must **extend** it (new sources, new presets), never
rewrite or replace the evidence captured here.
