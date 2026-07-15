# Stage-3 Recommendation (REVISED after full-text upload)

## Scientific decision: OUTCOME B — partially sufficient (selection only)
Full texts are now available for the **skin** methodology/parameter sources (Rothe
2017, Iliopoulos 2020, OECD TG 428) and one **bladder** review (Sarfraz 2022). The
**tumour** quantitative sources (Dreher 2006, Chen 2024) and **Potts & Guy 1992**
remain **missing** (the "Potts & Guy" upload was the wrong paper — Karadzovska 2013).

The evidence — not the existing code — drives this revision. The only candidate with
**verifiable, extracted transport parameters** is now the skin released-API
diffusion sub-model; the previously-primary tumour candidate **cannot be
parameterized** (its sources are unavailable). No candidate reaches **QUALIFIED**.

## Revised primary (for parameterizable work now)
**Topical skin — released small-molecule API diffusing through a multilayer stratum
corneum / viable epidermis / dermis slab; human (pig surrogate acceptable) skin;
in vitro Franz-cell context (OECD TG 428); nanoparticle treated as a surface/
follicular reservoir (carrier transport NOT modelled).**

- **Sourced parameters (small molecule):** SC partition K_SC/v and diffusion
  D_SC/H²_SC (Rothe 2017, Table 2 — caffeine 2.68 / 0.21 h⁻¹; resorcinol 5.35 /
  0.19 h⁻¹; 7-EC 39.5 / 0.030 h⁻¹, human, Protocol 1); split-thickness geometry
  200–400 µm and 32±1 °C (OECD TG 428); IVIVC R²=0.98 and flux (Iliopoulos 2020,
  niacinamide).
- **Grade:** RESEARCH_SUPPORTED **for the released-API skin-diffusion sub-model
  (small molecule)** — NOT a validated nanoparticle profile.
- **Hard caveats:** every sourced value is for a **small-molecule API, not a
  nanoparticle**; intact NPs are retained in SC/follicle; no dermal-clearance value
  and no absolute D (cm²/s) without H_SC; requires new multilayer-slab geometry.

## Fallback (blocked)
**Solid tumour — local released-drug radial diffusion.** Best geometric fit to the
current solver, but **cannot advance**: Dreher 2006 and Chen 2024 are still not
available. Remains fallback pending those PDFs.

## What is required to reach a genuine nanoparticle profile
A nanoparticle-formulation primary with BOTH in vitro release AND skin-penetration
depth data (identified, not yet provided): tripterine NLC (PMC3392146), caffeic-acid
lipid NP (PMC7826983), or caffeine lipid NP (Talanta 2015). Without one of these,
the skin profile models released small-molecule diffusion only — it is not a
nanoparticle product model.

## What Stage 3 MAY implement (after approval + the NP primary)
A RESEARCH_SUPPORTED, clearly-labelled **educational** multilayer-skin released-API
diffusion profile, parameterized from the sourced small-molecule values, with the
nanoparticle as a surface reservoir and explicit uncertainty/extrapolation warnings.

## What Stage 3 MUST NOT claim
QUALIFIED status; that it represents a specific nanoparticle product; carrier
penetration; human clinical outcome; or validity beyond the small-molecule,
in vitro, SC-diffusion evidence actually sourced.

## Maximum defensible grade today: RESEARCH_SUPPORTED (skin sub-model). No QUALIFIED profile is possible without an NP-formulation primary + independent validation.
