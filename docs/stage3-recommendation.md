# Stage-3 Recommendation (modular portfolio; after Dreher primary verified)

## Decision: OUTCOME B — a portfolio of research-supported submodels/benchmarks
Under the modular evidence architecture (`evidence-architecture.md`), Stage 2 delivers
a 6-profile portfolio (`profile-portfolio.md`, `data/profile-portfolio.json`). No
single profile is externally validated (L5) or clinically qualified (L6), but several
are Stage-3-actionable at LEVEL 1–2 with explicit labels. **Block unsupported outputs,
not whole profiles.**

## Stage-3-ready now
- **Profile A — niacinamide human-skin released-API transport (LEVEL 2).** All modules
  primary-verified here (Iliopoulos 2020, Rothe 2017, OECD TG 428). Implement as a
  multilayer released-API skin engine, labelled *"RESEARCH_SUPPORTED released-API skin
  submodel — NOT a nanoparticle release model."*
- **Profile D — tumour vascular transport benchmark (LEVEL 2).** **Primary now
  verified from user-provided Dreher 2006 page images** (Kedem–Katchalsky; P_app
  3.3 kDa=154 / 40 kDa=9.5 / 2 MDa=1.7 ×10⁻⁷ cm/s; albumin 4.9×10⁻⁷; t½ 3.8/19.6 min;
  penetration >35/15/5 µm). Implement as a mechanistic benchmark, labelled *"dextran,
  murine — NOT a nanoparticle drug."*

## Ready as illustrative mechanism only
- **Profile C — AuNP spheroid carrier penetration.** Use the size-dependent
  penetration + **uptake–return (M_cell)** concept as an illustrative mechanism; do
  NOT use Chen quantitative values until the primary is opened (currently
  UNVERIFIED_SECONDARY from the external dossier).

## Blocked pending sources (identified, not opened)
- **Profile B — celastrol/tripterine NLC skin** (strongest genuine NP-skin chain):
  need PMC3392146 / 10.1080/21691401.2018.1503599.
- **Profile E — Doxil**: need FDA label + Gabizon 2003 (PMID 12739982).
- **Profile F — nab-paclitaxel (Abraxane)** (or Onivyde alt): need SmPC/label + PK primary.

## Calibration / validation (endpoint-specific)
No profile has an independent external validation set. Endpoint status:
- A: permeation/IVIVC = calibrated-quality (Iliopoulos), external validation = none.
- D: permeability/PK/penetration = directly measured (single primary); external
  validation = none (benchmark).
- B/C/E/F: unverified pending primaries.

## Stage-3 entry conditions
Stage 3 may start on **A and D** now (with the mandatory labels above) and add C as an
illustrative mechanism; B/E/F require the listed PDFs/labels. Any composite (e.g. E)
must use the explicit bridges in `evidence-bridge-tables.md` and disable unsupported
outputs.

## MUST NOT
Claim L5/L6/clinical/patient-specific; present A as a nanoparticle model or D as a
drug; use Chen/Doxil/Abraxane search values as production data; bridge distinct systems
without an explicit labelled ILLUSTRATIVE_COUPLING.

---

## BATCH-1 UPDATE (primaries opened — B and E now Stage-3-ready)

Two genuine-nanoparticle profiles moved from *blocked* to *primary-verified*:

- **Profile B — celastrol/tripterine NLC skin (now LEVEL 3, PRIMARY VERIFIED).**
  `chen-2012-tripterine-nlc` (Int J Nanomedicine 2012;7:3023–3033, DOI 10.2147/IJN.S32476)
  supplies the **complete chain in one paper**: NLC size/PDI/zeta/EE (Table 2), **first-order
  release** (r²≈0.95–0.96), Franz permeation on rat skin (flux 0.91–1.26 µg/cm²/h, Kp
  1.5–2.1×10⁻³ cm/h; Table 4), skin deposition, and in-vivo antimelanoma PD (mouse).
  **This is the first VERIFIED genuine-nanoparticle profile.** Implement as a
  release→skin submodel labelled *"single study, rat skin, celastrol NLC — not
  externally validated."* Residual: absolute D needs skin thickness; independent
  validation wants aid B2.

- **Profile E — Doxil (formulation + systemic PK now DIRECT_EXACT; tumour transport still
  disabled).** `doxil-fda-pi` (DailyMed PI + NDA 050718/S-060 authorized-generic label,
  identical values) gives composition (HSPC 9.58 / chol 3.19 / MPEG-DSPE 3.19 mg/mL;
  ammonium-sulfate loading; ≥90% encapsulated) and PK Table 8 (total dox: Cmax 4.12/8.34,
  AUC 277/590, λ2 t½ 52–55 h). `doxil-nda050718-s050` (Clin-Pharm/Biopharmaceutics review)
  establishes the **total/encapsulated/free** methodology and the FDA position that **free
  doxorubicin is not reliably measurable**. `barenholz-2012` gives mechanism (remote
  loading, koff, EPR, ~100 nm). Implement as a **systemic-PK + formulation** submodel.
  **Tumour-penetration outputs MUST stay disabled** — no spatial tumour concentration
  exists in any uploaded document, and the in-vitro release curve is redacted `(b)(4)`.
  Residual: Gabizon 2003 (aid E2), Charrois & Allen 2004 (aid E5), an intratumoral-
  distribution primary (aid E4/E8), and Jiang 2011 (aid E9, methodology).

**Revised Stage-3-ready set: A, D, B, E** (each with mandatory labels above); **C** as
illustrative mechanism; **F** still search-summary only. Still **no** profile with an
independent external validation dataset → OUTCOME B stands. Stage 3 remains **not started**.
