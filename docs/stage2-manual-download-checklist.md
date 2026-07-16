# Stage-2 Manual Download Checklist (for the user)

Lawful sources only. For each: where to get it and what to download. IDs map to
`data/stage2-source-acquisition-registry.json`.

## BATCH 1 — foundational (download first, ~8 items)
- **A4 Potts & Guy 1992** (Pharm Res 9:663–669; PMID 1608900) — *subscription/library*;
  the original QSAR paper (earlier upload was the wrong paper).
- **A5 Mitragotri 2011** (Int J Pharm 418:115–129) — skin-model equations — *library*.
- **E1 DOXIL FDA label + Clinical Pharmacology review** — Drugs@FDA (search "Doxil",
  NDA 050718) → download the **Label PDF** and the **Clinical Pharmacology/Biopharm
  review PDF** (two separate files).
- **E3 Barenholz 2012** (J Control Release 160:117–134) — *library/DOI
  10.1016/j.jconrel.2012.03.020 (confirm)*.
- **E5 Charrois & Allen 2004** (BBA 1663:167–177) — PLD release-rate→PK — *library*.
- **F1 ABRAXANE FDA label + Clinical Pharmacology review** — Drugs@FDA (NDA 021660).
- **C1 Chen 2024** (Small 20:2304693; DOI 10.1002/smll.202304693) **+ Supporting
  Information** (two files) — *library*.
- **B1 Tripterine NLC** (PMC3392146) — **open access at PMC** → download now.

## BATCH 2 — Profile B & C primaries (~7)
B2 celastrol-indomethacin NLC (10.1080/21691401.2018.1503599, library); B3 caffeic-acid
LNP (PMC7826983, open); B4 caffeine LNP Talanta 2015 (library); B6 NLC lidocaine depth
(PMC6681122, open); C2 spheroid transport model (library); C3 alt spheroid dataset
(library).

## BATCH 3 — Doxil official + primary (~4)
E2 Gabizon 2003 (PMID 12739982, library); E4 Charrois & Allen 2003 (BBA 1609:102–8,
library); E6 Caelyx/Doxil EMA EPAR (EMA site).

## BATCH 4 — Profile F comparison (~5)
F2 nab-paclitaxel crossover PK (PMC2661025, open); F3 Abraxane SmPC (emc 6438);
F4 Onivyde reverse-eng (PMC11791869, open); F5 free/total SN-38 method (library);
F6 Onivyde FDA label (NDA 207793).

## BATCH 5 — modeling/environment/validation (~7)
A6 Frasch/Barbero SC diffusivity; A7 Kretsos/Kasting dermal clearance; D2 Yuan 1995
(Cancer Res 55:3752); D3 Pluen 2001 (PNAS 98:4628, likely open); D4 Krol 1999
(Cancer Res 59:4136); D5 Yuan 2001 (Ann Biomed Eng 29:1150); D6 Matsumura & Maeda 1986
(Cancer Res 46:6387).

## Access types
- **OPEN/PMC (download now):** B1, B3, B6, C-none-open, F2, F4, D3(likely).
- **FDA/EMA (agency site, may be multiple PDFs):** E1, E6, F1, F6.
- **Subscription/library (USER_DOWNLOAD_REQUIRED):** A4, A5, A6, A7, B2, B4, C1(+SI),
  C2, C3, D2, D4, D5, D6, D7, E2, E3, E5, F3, F5.

---

## BATCH-1 INGESTED (2026-07-16) — remove from download list
- **B1** Chen 2012 tripterine/celastrol NLC (Int J Nanomedicine 2012;7:3023-3033, DOI 10.2147/IJN.S32476) — uploaded, fully extracted.
- **E1** Doxil FDA PI (DailyMed rev 3/2026) + NDA 050718/S-060 authorized-generic label + NDA 050718/S-050 approval package (incl. Clinical Pharmacology/Biopharmaceutics review) — uploaded, extracted.
- **E3** Barenholz 2012 (J Control Release 160:117-134, DOI 10.1016/j.jconrel.2012.03.020) — uploaded, extracted.

## NEXT DOWNLOAD BATCH (only what is still genuinely needed)
### Tier 1 — critical (unlock blocked modules)
| aid | file | why | access | suggested filename |
|---|---|---|---|---|
| E4/E8 | Doxil/PLD **intratumoral distribution** primary (spatial free/total doxorubicin in tumour; e.g. Laginha 2005-type) | ONLY missing piece to enable a Profile E tumour output (now disabled) | library/subscription | `E4_PLD_intratumoral_distribution.pdf` |
| E2 | Gabizon A et al. Clin Pharmacokinet 2003;42:419-436 (PMID 12739982) | primary free/encapsulated/tumour PK behind Barenholz's secondary numbers | library | `E2_Gabizon_2003_PLD_PK.pdf` |
| E5 | Charrois & Allen 2004, Biochim Biophys Acta 1663:167-77 | release-rate → PK/tumour coupling for PLD | library | `E5_Charrois_Allen_2004.pdf` |
| B2 | Celastrol+Indomethacin transdermal NLC (DOI 10.1080/21691401.2018.1503599) | INDEPENDENT NP-skin study to validate Profile B beyond one paper | library | `B2_celastrol_indomethacin_NLC.pdf` |

### Tier 2 — profile-completing
| aid | file | why | access |
|---|---|---|---|
| E9 | Jiang, Lionberger & Yu 2011, Bioanalysis 3(3):333-344 (DOI 10.4155/bio.10.204) | basis for ≥90% encapsulated + total/encapsulated/free assay methodology (cited by FDA S-050) | library |
| F1 | Abraxane SmPC/label + nab-paclitaxel PK primary | Profile F still search-summary only | FDA/EMA + library |
| C1 | Chen 2024 AuNP spheroid primary + SI (DOI 10.1002/smll.202304693) | upgrade Profile C from dossier-secondary to verified | library |

### Tier 3 — validation & uncertainty
| aid | file | why | access |
|---|---|---|---|
| A4 | Potts & Guy 1992 (PMID 1608900) | still-missing skin-permeability QSPR coefficients (earlier upload was the wrong paper) | library |
| D2 | independent tumour-vascular validation dataset | external validation for Profile D benchmark | library |
