# Profile B — Biological Storyboard

Design only. Scene records mirror `data/profile-b-scene-evidence-map.json` and
`data/profile-b-biological-scenes.json`. Each scene names its **exact evidence context and
model** — the four B1 contexts (ex vivo rat skin / in vitro HaCaT / in vitro B16BL6 / in vivo
mouse) are **separate labelled scenes**, never one composite specimen.

## Scale system
`L1` body orientation (no systemic journey) · `L2` skin surface · `L3` tissue cross-section
· `L4` cellular microenvironment · `L5` cell-membrane interaction · `L6`
intracellular/molecular (**only where supported — B2 ER, not B1**).

## B1 storyboard (topical celastrol NLC)

**S1 — Application-site orientation** · L1–L2 · CONTEXTUAL_ANATOMY.
Show a skin site + topical dosage form. **Exclude:** mouth, stomach, GI transit, IV
injection, bloodstream.

**S2 — Formulation on skin surface** · L2 · QUALITATIVELY_SUPPORTED.
Surface reservoir with the **~85–90 nm particle class** and the selected charge state.
**Exclude:** three distinct size choices; scale mismatch without a scale indicator.

**S3 — Stratum-corneum barrier** · L3–L6 · QUANTITATIVELY_SUPPORTED (permeation) +
CONTEXTUAL_ANATOMY (structure) · model = **EX VIVO RAT SKIN**.
Corneocyte stacks (anucleate) + lipid lamellae; released-API diffusion; barrier-limited.
If the source doesn't distinguish intact carrier from released API, **label that limitation**
and don't show unsupported intact-particle deep transport. **Exclude:** nuclei/vessels in SC.

**S4 — Depth-layer deposition** · L3 · DIRECTLY_OBSERVED · model = **EX VIVO RAT SKIN
(0–30 / 30–60 / 60–90 µm)**.
Relative deposition by band. **Exclude:** fabricated continuous concentration field;
hypodermis penetration.

**S5 — Epidermal cell environment** · L4 · CONTEXTUAL_ANATOMY.
Keratinocyte arrangement + basal melanocyte (context). **Exclude:** vessels in epidermis;
decorative immune cells.

**S6 — Cellular uptake comparison** · L4–L5 · QUALITATIVELY_SUPPORTED · model = **IN VITRO
HaCaT + B16BL6 as separate labelled insets**.
Ordinal uptake cationic > neutral > anionic. **Mandatory note:** charge **and** lipid both
changed — not a pure charge effect. **Exclude:** quantitative ratios; endocytosis machinery.

**S7 — Melanoma context** · L4 · QUALITATIVELY_SUPPORTED · model = **MURINE B16BL6 / C57BL/6
mouse**. **Exclude:** human clinical invasive-melanoma histology as this model.

**S8 — Therapeutic effect** · L4 · QUALITATIVELY_SUPPORTED (endpoint) · model = **IN VIVO
MOUSE**.
Qualitative tumor-reduction cue + model label + uncertainty. **Exclude:** exact shrinkage %,
survival, metastasis prevention, immune-pathway activation (that is B2).

**S9 — Limitation panel** · overlay.
Rat skin; murine melanoma; single study; no systemic PK; no external validation; no
time-resolved aggregation/precipitation; charge/lipid confound.

## B2 (abstract) and B3 (comparator)
- **B2** (Wang 2025, systemic mouse melanoma): orientation → tumor-cell arrival → uptake/**ER
  localization** → ER stress/CRT-HMGB1-ATP → DC/CD8+ immune activation → limitation panel.
  All `ABSTRACT_SUPPORTED`; **no numeric labels/timing**; ER close-up allowed **for B2 only**.
- **B3** (Shukla 2020, non-NP): a **comparator info panel** (30-fold solubility, stability,
  intestinal permeability) — not a body-travel animation; no particle morphology/growth.

## Time compression
Release (min–h) → seconds; permeation (≤24 h) → short sequence; efficacy (days) → separate
outcome timeline. Never imply all processes share one rate; label each timescale.
