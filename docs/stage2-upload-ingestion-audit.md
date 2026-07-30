# Stage-2 Batch-1 Upload Ingestion Audit

Every file below was opened and identified **from its internal title page / metadata**,
not its filename. Rule: a claim is VERIFIED only where read from an opened primary in
this project. Machine-readable copy: `data/stage2-upload-ingestion-registry.json`.

## 1. Upload inventory (one row per uploaded file)

| Uploaded filename | Verified identity | Type | Acq. ID | Profile | Status | Complete? |
|---|---|---|---|---|---|---|
| `4a5ec47c-j.jconrel.2012.03.020` | Barenholz Y. "Doxil® — the first FDA-approved nano-drug: lessons learned." **J Control Release 2012;160(2):117–134**. DOI 10.1016/j.jconrel.2012.03.020 | Review (by the inventor) | **E3** | E | CORRECT_PRIMARY_STUDY (review) | Yes (26 pp) |
| `50b51426-ijn73023.pdf` | Chen Y, Zhou L, Yuan L, Zhang Z-h, Liu X, Wu Q. "Formulation, characterization, and evaluation of in vitro skin permeation and in vivo pharmacodynamics of surface-charged tripterine-loaded nanostructured lipid carriers." **Int J Nanomedicine 2012;7:3023–3033**. DOI **10.2147/IJN.S32476**; PMC3392146 | Primary research | **B1** | B | CORRECT_PRIMARY_STUDY · CORRECT_SOURCE_DIFFERENT_FILENAME (filename "ijn73023" is a Dovepress article id, NOT the DOI) | Yes (11 pp) |
| `1e7ff6bb-20260318_917eddf91d3f4abe8c81d33b066e5bae.pdf` | **DOXIL** (doxorubicin HCl liposome injection) DailyMed **Prescribing Information**, Baxter Healthcare Corporation, **Revised 3/2026** | Official product label (current PI) | **E1** | E | CORRECT_OFFICIAL_DOCUMENT | Yes (37 pp, full text) |
| `b89f5b31-050718Orig1s060lbl.pdf` | FDA Drugs@FDA **NDA 050718/S-060** label — "Doxorubicin Hydrochloride Liposome Injection" (authorized-generic labeling under Doxil's NDA), **Revised 05/2022** | Official label (archived) | **E1** | E | CORRECT_OFFICIAL_DOCUMENT · DUPLICATE (content identical to E1 PI) | Yes (9 pp) |
| `5ca587c7-050718Orig1s050.pdf` | FDA Drugs@FDA **NDA 50-718/S-050 Approval Package**, Doxil (Janssen), approved **28 Dec 2015** — CMC manufacturing-site-change supplement incl. **bioequivalence study DOXILNAP1004** and **Clinical Pharmacology/Biopharmaceutics Review** (S. Subramaniam) | Official regulatory review package | **E1** (supplement) | E | CORRECT_OFFICIAL_DOCUMENT | Partial — text sections extracted; some tables scanned; in-vitro release numbers **redacted (b)(4)** |

## 2. Wrong / duplicate / incomplete files
- **Wrong source:** none. (Contrast: the earlier "07_Potts_Guy_1992" upload was Karadzovska 2013 — not repeated here.)
- **Duplicate:** `b89f5b31-...s060lbl` (authorized-generic label) carries the **same** composition and the **same** Table-8 PK values as the DailyMed Doxil PI (`1e7ff6bb`). Kept as an independent cross-validation of E1, not as new data.
- **Incomplete:** `5ca587c7-...s050` — the in-vitro release/dissolution **numeric values are redacted** as trade secret `(b)(4)`; only timepoints (0.5/1.5/3/6 h) and the f2-similarity methodology are readable.

## 3. Reconciliation against the 44-item acquisition package

| Uploaded file | Verified identity | Acq. ID | Tier | Expected contribution | Found | Gap status |
|---|---|---|---|---|---|---|
| Barenholz 2012 | Doxil lessons-learned review | E3 | 1 | definitive Doxil formulation/loading/release mechanism | formulation principles, remote ammonium-sulfate loading, koff role, EPR/passive targeting, ~100 nm size, secondary PK (2/45 h) and effusion 4–16× | **GAP_FULLY_RESOLVED** (E3) |
| Chen 2012 IJN | tripterine/celastrol NLC skin | B1 | 1 | NLC composition, size/PDI/zeta, EE, release curve, Franz permeation, retention, in vivo PD | **all present** (Tables 2–4, Figs) — full continuous chain in one paper | **GAP_FULLY_RESOLVED** (B1) |
| DailyMed Doxil PI | current official label | E1 | 1 | composition, PK, encapsulated fraction | Section 11 composition (DIRECT_EXACT) + Section 12.3 PK Table 8 (DIRECT_EXACT) + ≥90% encapsulated | **GAP_FULLY_RESOLVED** for E1 formulation+systemic-PK |
| NDA 050718/S-060 label | authorized-generic label | E1 | 1 | (cross-check) | identical composition + PK | DUPLICATE / cross-validated |
| NDA 50-718/S-050 package | approval package + BE + Clin Pharm review | E1 (supplement) | 1 | Clinical Pharmacology & Biopharmaceutics review | **present** — BE study (total + encapsulated dox), free-dox mass-balance caveat, bioanalytical LLOQ/QC, in-vitro release method (values redacted) | **OFFICIAL_LABEL_PRESENT** + review present; **tumour-distribution still STILL_MISSING** |

**Net result:** acquisition items **B1, E1 (incl. its Clin-Pharm supplement) and E3 are ACQUIRED_VERIFIED.** No file was the wrong document; one is a duplicate cross-check; one has a redacted release table.
