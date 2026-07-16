# Stage-2 Profile-Completion Matrix

Status codes: VERIFIED_COMPLETE · VERIFIED_PARTIAL · SOURCE_IDENTIFIED_NOT_ACQUIRED ·
UNVERIFIED_SECONDARY · NO_SOURCE_IDENTIFIED · NOT_APPLICABLE.

Status codes also used below: **VERIFIED_COMPLETE**, **VERIFIED_PARTIAL** (primary opened
this batch), SOURCE_ACQUIRED_NOT_EXTRACTED, SRC_IDENTIFIED (= SOURCE_IDENTIFIED_NOT_ACQUIRED),
UNVERIFIED_SECONDARY, NO_SOURCE_IDENTIFIED, N/A.

| Module | A (skin API) | B (NLC skin) | C (spheroid) | D (vascular) | E (Doxil) | F (Abraxane) |
|---|---|---|---|---|---|---|
| API physchem | VERIFIED_PARTIAL | **VERIFIED (B1)** | N/A (no API) | N/A | **VERIFIED (E1)** | SRC_IDENTIFIED |
| Exact formulation | N/A (vehicle) | **VERIFIED_COMPLETE (B1 Table 1)** | **VERIFIED (Huang: Au@tiopronin)** | N/A | **VERIFIED_COMPLETE (E1/S-064)** | SRC_IDENTIFIED (F1) |
| Size/PDI/zeta | N/A | **VERIFIED_COMPLETE (B1)** | **VERIFIED (2.6/6.1/14.8 nm)** | VERIFIED (radius) | **VERIFIED (E3 ~100nm; label omits)** | SRC_IDENTIFIED |
| Loading/EE/free fraction | N/A | **VERIFIED (EE; loading not in text)** | N/A (no API) | N/A | **VERIFIED (>=90% encap; free directly assayed, Li 2022)** | SRC_IDENTIFIED |
| Release curve | N/A | **VERIFIED (B1 first-order; dialysis-apparent)** | N/A | N/A | UNVERIFIED (label redacted; Cern = mechanism only) | SRC_IDENTIFIED |
| Tissue permeability/diffusivity | VERIFIED_PARTIAL (Rothe) | **VERIFIED (B1 flux/Kp, rat skin)** | **VERIFIED (semi-quant penetration)** | **VERIFIED_COMPLETE (Table 1)** | N/A (systemic PK, not local) | SRC_IDENTIFIED |
| Partition | VERIFIED_PARTIAL | VERIFIED_PARTIAL (via Kp) | N/A | VERIFIED (Kav refs) | N/A | SRC_IDENTIFIED |
| Depth/penetration profile | VERIFIED_PARTIAL (IVIVC) | **VERIFIED (cumulative µg/cm²)** | **VERIFIED_PARTIAL (imaging ranking, not conc-vs-radius)** | **VERIFIED_COMPLETE** | **INSUFFICIENT (no tumour spatial)** | SRC_IDENTIFIED |
| Tissue retention | SRC_IDENTIFIED | **VERIFIED (skin deposition)** | **VERIFIED (ICP-MS uptake)** | VERIFIED (AUC) | INSUFFICIENT | SRC_IDENTIFIED |
| Cellular uptake | N/A | **VERIFIED (HaCaT/B16BL6)** | **VERIFIED (Huang ICP-MS)** | N/A | SRC_IDENTIFIED | SRC_IDENTIFIED |
| Clearance | UNVERIFIED (assumed) | SRC_IDENTIFIED | N/A | VERIFIED (plasma t1/2) | **VERIFIED (E1 CL 0.041; Li 2022 free/encap CL)** | SRC_IDENTIFIED |
| Systemic PK | N/A | N/A | **VERIFIED_PARTIAL (in-vivo accumulation)** | N/A | **VERIFIED_COMPLETE (E1 Table 8 + Li 2022 free/encap)** | SRC_IDENTIFIED |
| Biological environment | VERIFIED_PARTIAL | VERIFIED_PARTIAL | **VERIFIED (MCF-7 spheroid/tumour)** | VERIFIED_PARTIAL | VERIFIED_PARTIAL | SRC_IDENTIFIED |
| Model equations | VERIFIED_PARTIAL (A5) | **VERIFIED (first-order release + Fick)** | **BENCHMARK (size-dependent; not fitted)** | **VERIFIED (Kedem-Katchalsky)** | VERIFIED_PARTIAL (bi-exp PK) | SRC_IDENTIFIED |
| Calibration data | VERIFIED_PARTIAL | VERIFIED_PARTIAL (within-study) | VERIFIED_PARTIAL (within-study) | VERIFIED_PARTIAL | VERIFIED_PARTIAL (label PK + Li 2022) | SRC_IDENTIFIED |
| Independent validation | NO_SOURCE_IDENTIFIED | **SRC_IDENTIFIED (B2; none yet)** | SRC_IDENTIFIED (Chen-2024 alt) | SRC_IDENTIFIED (D2) | **PARTIAL (Li 2022 Caelyx BE - product, not model)** | SRC_IDENTIFIED |

**Batch-2 change:** **C** upgraded from illustrative-only to **primary-verified LEVEL-2 benchmark**
(Huang 2012: Au@tiopronin 2.6/6.1/14.8 nm, ICP-MS uptake + imaging penetration + in-vivo tumour).
**E** free-vs-encapsulated now **directly assayed** (Li 2022, SPE; reference=Caelyx) and remote-loading
mechanism supported (Cern 2012 QSPR); E1 confirmed by current **S-064** label. **B** formulation now
VERIFIED_COMPLETE with full Table-1 lipid composition; release re-labelled **dialysis-apparent** (not
pure carrier release). Five of six profiles now primary-verified; **no** profile has an independent
model-validation dataset (Li 2022 is a product bioequivalence study, not a mechanistic validation set).

**Batch-1 change:** B and E move from source-identified to **primary-verified**. B is now
VERIFIED_COMPLETE on formulation/size/release/permeation (single study, rat skin). E is
VERIFIED_COMPLETE on formulation + systemic PK, but its **tumour depth/penetration and
tissue retention are INSUFFICIENT** (no spatial primary) and its **release curve is
UNVERIFIED** (label numbers redacted). D remains VERIFIED_COMPLETE (vascular benchmark);
A remains VERIFIED_PARTIAL (small-molecule skin). No profile has an INDEPENDENT external
validation dataset (B has within-study comparators only; E-S-050 is site-to-site BE).
