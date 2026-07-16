# Stage-2 Profile-Completion Matrix

Status codes: VERIFIED_COMPLETE · VERIFIED_PARTIAL · SOURCE_IDENTIFIED_NOT_ACQUIRED ·
UNVERIFIED_SECONDARY · NO_SOURCE_IDENTIFIED · NOT_APPLICABLE.

Status codes also used below: **VERIFIED_COMPLETE**, **VERIFIED_PARTIAL** (primary opened
this batch), SOURCE_ACQUIRED_NOT_EXTRACTED, SRC_IDENTIFIED (= SOURCE_IDENTIFIED_NOT_ACQUIRED),
UNVERIFIED_SECONDARY, NO_SOURCE_IDENTIFIED, N/A.

| Module | A (skin API) | B (NLC skin) | C (spheroid) | D (vascular) | E (Doxil) | F (Abraxane) |
|---|---|---|---|---|---|---|
| API physchem | VERIFIED_PARTIAL | **VERIFIED (B1)** | N/A (no API) | N/A | **VERIFIED (E1)** | SRC_IDENTIFIED |
| Exact formulation | N/A (vehicle) | **VERIFIED_COMPLETE (B1)** | SRC_IDENTIFIED (C1) | N/A | **VERIFIED_COMPLETE (E1)** | SRC_IDENTIFIED (F1) |
| Size/PDI/zeta | N/A | **VERIFIED_COMPLETE (B1)** | UNVERIFIED_SECONDARY | VERIFIED (radius) | **VERIFIED (E3 ~100nm; label omits)** | SRC_IDENTIFIED |
| Loading/EE/free fraction | N/A | **VERIFIED (EE; loading not in text)** | N/A | N/A | **VERIFIED_PARTIAL (>=90% encap; free unreliable)** | SRC_IDENTIFIED |
| Release curve | N/A | **VERIFIED_COMPLETE (B1, first-order)** | N/A | N/A | UNVERIFIED (label values redacted (b)(4)) | SRC_IDENTIFIED |
| Tissue permeability/diffusivity | VERIFIED_PARTIAL (Rothe) | **VERIFIED (B1 flux/Kp, rat skin)** | UNVERIFIED_SECONDARY | **VERIFIED_COMPLETE (Table 1)** | N/A (systemic PK, not local) | SRC_IDENTIFIED |
| Partition | VERIFIED_PARTIAL | VERIFIED_PARTIAL (via Kp) | N/A | VERIFIED (Kav refs) | N/A | SRC_IDENTIFIED |
| Depth/penetration profile | VERIFIED_PARTIAL (IVIVC) | **VERIFIED (cumulative µg/cm²)** | UNVERIFIED_SECONDARY | **VERIFIED_COMPLETE** | **INSUFFICIENT (no tumour spatial)** | SRC_IDENTIFIED |
| Tissue retention | SRC_IDENTIFIED | **VERIFIED (skin deposition)** | UNVERIFIED_SECONDARY | VERIFIED (AUC) | INSUFFICIENT | SRC_IDENTIFIED |
| Cellular uptake | N/A | **VERIFIED (HaCaT/B16BL6)** | SRC_IDENTIFIED (C2) | N/A | SRC_IDENTIFIED | SRC_IDENTIFIED |
| Clearance | UNVERIFIED (assumed) | SRC_IDENTIFIED | N/A | VERIFIED (plasma t1/2) | **VERIFIED (E1 CL 0.041 L/h/m²)** | SRC_IDENTIFIED |
| Systemic PK | N/A | N/A | N/A | N/A | **VERIFIED_COMPLETE (E1 Table 8)** | SRC_IDENTIFIED |
| Biological environment | VERIFIED_PARTIAL | VERIFIED_PARTIAL | SRC_IDENTIFIED | VERIFIED_PARTIAL | VERIFIED_PARTIAL | SRC_IDENTIFIED |
| Model equations | VERIFIED_PARTIAL (A5) | **VERIFIED (first-order release + Fick)** | SRC_IDENTIFIED (C2) | **VERIFIED (Kedem-Katchalsky)** | VERIFIED_PARTIAL (bi-exp PK) | SRC_IDENTIFIED |
| Calibration data | VERIFIED_PARTIAL | VERIFIED_PARTIAL (within-study) | SRC_IDENTIFIED | VERIFIED_PARTIAL | VERIFIED_PARTIAL (label PK) | SRC_IDENTIFIED |
| Independent validation | NO_SOURCE_IDENTIFIED | **SRC_IDENTIFIED (B2; none yet)** | SRC_IDENTIFIED (C3) | SRC_IDENTIFIED (D2) | **SRC_IDENTIFIED (E2/E5; S-050 BE = site-to-site only)** | SRC_IDENTIFIED |

**Batch-1 change:** B and E move from source-identified to **primary-verified**. B is now
VERIFIED_COMPLETE on formulation/size/release/permeation (single study, rat skin). E is
VERIFIED_COMPLETE on formulation + systemic PK, but its **tumour depth/penetration and
tissue retention are INSUFFICIENT** (no spatial primary) and its **release curve is
UNVERIFIED** (label numbers redacted). D remains VERIFIED_COMPLETE (vascular benchmark);
A remains VERIFIED_PARTIAL (small-molecule skin). No profile has an INDEPENDENT external
validation dataset (B has within-study comparators only; E-S-050 is site-to-site BE).
