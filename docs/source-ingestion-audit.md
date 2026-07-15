# Source-Ingestion Audit (uploaded PDFs)

Every file was opened and verified by its content (not its filename). PDF text
extracted with poppler `pdftotext`.

| Uploaded filename | Verified identity (from content) | Expected critical source | Match status | Type | Usable |
|---|---|---|---|---|---|
| 04_Rothe_2017_…Diffusion_Partition | Rothe H, Obringer C, Manwaring J, … Grégoire S. "Comparison of protocols measuring diffusion and partition coefficients in the stratum corneum." *J Appl Toxicol* 2017. DOI 10.1002/jat.3427 | Rothe 2017 (SC D/K) | **EXACT_MATCH** | primary (method+data) | Yes — K_SC/v, D_SC/H²_SC extracted |
| 03_Iliopoulos_2020_…Franz_Cell_Raman_IVIVC | Iliopoulos F, Caspers PJ, Puppels GJ, Lane ME. "Franz Cell Diffusion Testing and Quantitative Confocal Raman Spectroscopy: IVIVC." *Pharmaceutics* 2020, 12(9):887. DOI 10.3390/pharmaceutics12090887 | Pharmaceutics 2020 12(9):887 | **EXACT_MATCH** | primary (Communication) | Yes — IVIVC, flux, permeation extracted |
| 05_Sarfraz_2022_…Intravesical_Review | Sarfraz M, Qamar S, … Nazir I. "Nano-Formulation Based Intravesical Drug Delivery Systems." *Pharmaceutics* 2022, 14:1909. DOI 10.3390/pharmaceutics14091909 | intravesical review 2022 (PMC9501312) | **EXACT_MATCH** | **review (secondary)** | Partial — qualitative environment only; numbers must be traced to primaries |
| 02_OECD_TG428_Skin_Absorption(+Guidance) | OECD Guideline 428 "Skin Absorption: In Vitro Method", adopted 13 Apr 2004 | OECD TG 428 | **EXACT_MATCH** | regulatory guideline | Yes — method parameters extracted |
| 07_Potts_Guy_1992_…Predicting_Skin_Permeability | Karadzovska D, Brooks JD, Monteiro-Riviere NA, Riviere JE. "Predicting skin permeability from complex vehicles." *Adv Drug Deliv Rev* 2013, 65:265–277 | Potts & Guy 1992 (Pharm Res, PMID 1608900) | **WRONG_SOURCE** (filename says Potts&Guy 1992; content is Karadzovska 2013) | review (secondary) | As support only; does NOT contain Potts–Guy coefficients |

## Findings
- **4 of 5 uploads are the correct sources** (Rothe, Iliopoulos, Sarfraz, OECD).
- **1 upload is the wrong article** — the "Potts & Guy 1992" file is actually
  Karadzovska et al. 2013 (a QSPR/LFER review). It *cites* Potts & Guy but does not
  contain their regression coefficients, so it cannot substitute.
- Confirms the user's two hints: one wrong file (Potts&Guy), and missing sources.

## Still missing after this upload (see critical-paywalled-sources.md)
- **Potts & Guy 1992**, *Predicting Skin Permeability*, Pharm Res (PMID 1608900) —
  needed for the exact skin-permeability regression coefficients.
- **Dreher 2006** (JNCI, PMID 16507830) — tumour transport/penetration.
- **Chen 2024** spheroid penetration (Small, DOI 10.1002/smll.202304693).
