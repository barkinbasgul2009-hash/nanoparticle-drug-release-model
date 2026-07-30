# Stage-2 Batch-2 Upload Ingestion Audit

Every file verified from internal content (title page, DOI, authors, journal), not
filename. Machine-readable copy: `data/stage2-batch2-upload-ingestion-registry.json`.

## 1. Upload inventory (one row per file)

| Uploaded filename | Verified identity | Type | Profile | Status | Complete? |
|---|---|---|---|---|---|
| `729ea011-fonc121070001.pdf` | Li Y, Qi L, Wang Y, Li Y, Lei C, Zhang Y, … Wang X. "A multicenter randomized trial to compare the bioequivalence and safety of a generic doxorubicin hydrochloride liposome injection with Caelyx® in advanced breast cancer." **Front Oncol 2022;12:1070001**. DOI **10.3389/fonc.2022.1070001** | Clinical trial (BE) | **E** | EXACT_MATCH | Yes (open access) |
| `33d94ac4-huang2012.pdf` | Huang K, Ma H, Liu J, Huo S, Kumar A, Wei T, Zhang X, Jin S, Gan Y, Wang PC, He S, Zhang X, Liang X-J. "Size-Dependent Localization and Penetration of Ultrasmall Gold Nanoparticles in Cancer Cells, Multicellular Spheroids, and Tumors in Vivo." **ACS Nano 2012;6(5):4483–4493**. DOI **10.1021/nn301282m** | Primary research | **C** | EXACT_MATCH | Yes (11 pp; SI referenced, not provided) |
| `3eed6093-ijn73023_2.pdf` | Chen Y et al., tripterine/celastrol NLC (Int J Nanomedicine 2012;7:3023–3033, DOI 10.2147/IJN.S32476) | Primary research | **B** | DUPLICATE (byte-identical extraction to batch-1 B1) | Yes |
| `1082d72c-050718s064lbl.pdf` | **DOXIL** label, FDA Drugs@FDA **NDA 050718/S-064**, Baxter Healthcare, **Revised 03/2026, Reference ID 5758049** | Official label | **E** | UPDATED_VERSION (current Drugs@FDA label; **supersedes S-060**; content matches batch-1 DailyMed PI) | Yes (30 pp) |
| `cd10eadf-cern2012.pdf` | Cern A, Golbraikh A, Sedykh A, Tropsha A, Barenholz Y, Goldblum A. "Quantitative structure–property relationship modeling of remote liposome loading of drugs." **J Control Release 2012;160(2):147–157**. DOI **10.1016/j.jconrel.2011.11.029** | Modeling/QSPR | **E (support)** | EXACT_MATCH | Yes (11 pp; per-drug data in SI, not provided) |

## 2. Notes
- **No wrong files.** One duplicate (Chen, re-mined for fuller formulation detail), one
  updated label version (S-064 supersedes S-060; both preserved in the audit).
- **Filenames distrusted:** `ijn73023_2` is again a Dovepress article id, not a DOI;
  `fonc121070001` compresses the real article number 1070001.

## 3. Role assignment (verify, not assume)
- **Li 2022 (fonc):** clinical **free-vs-encapsulated** doxorubicin PK — the key new
  Profile-E evidence. Free doxorubicin **directly assayed** (SPE separation), not
  mass-balance subtraction.
- **Huang 2012:** primary **intact-carrier** (gold) size-dependent spheroid/tumour
  penetration — Profile C. **No API, no drug release** — carrier transport only.
- **Chen 2012 (dup):** confirms & deepens Profile B (full Table-1 lipid composition,
  release method). Batch-1 values re-verified — **no corrections needed**.
- **S-064 label:** current official DOXIL label — confirms/updates E1 (Reference ID
  5758049); identical composition + PK Table 8 to the batch-1 DailyMed PI.
- **Cern 2012:** remote-loading **QSPR/modeling support only** (60 drugs, 366 loading
  experiments, 5-fold external validation). **NOT** direct evidence of Doxil release,
  plasma PK, tumour penetration, or intratumoral release. Classified MECHANISTIC_TRANSFER /
  MODELING_SUPPORT. Doxorubicin appears in the dataset but per-drug values are in the SI
  (not provided).
