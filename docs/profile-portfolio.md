# Stage-2 Profile Portfolio (6 profiles)

Machine-readable: `data/profile-portfolio.json`. Module labels:
`data/evidence-labels.json`. Parameter provenance: `data/parameter-provenance.json`.

| # | Profile | API / carrier | Route / tissue | Level | Stage-3 ready? |
|---|---|---|---|---|---|
| A | Niacinamide human-skin released-API transport | niacinamide / none | topical / skin | **L2 submodel** | ✅ ready (labelled non-NP) |
| B | Celastrol/tripterine NLC skin | celastrol / NLC | topical / skin | L3 candidate (UNVERIFIED) | ⛔ needs primaries |
| C | AuNP tumour-spheroid carrier penetration | none / gold NP | in vitro / spheroid | L1 benchmark (UNVERIFIED) | ⚠ illustrative only until Chen primary |
| D | Dreher tumour vascular transport | none / dextran | IV / murine tumour | **L2 benchmark (PRIMARY VERIFIED)** | ✅ ready (benchmark, not a drug) |
| E | Doxil PEG-liposomal doxorubicin | doxorubicin / PEG-liposome | IV / systemic+tumour | L3 composite (UNVERIFIED) | ⛔ needs FDA label + PK primaries |
| F | nab-Paclitaxel (Abraxane) | paclitaxel / albumin NP | IV / systemic+tumour | L2 candidate (UNVERIFIED) | ⛔ needs label/PK primaries |

## Verified vs unverified (this project)
- **Primary-verified here:** A modules (Iliopoulos, Rothe, OECD) and D modules
  (Dreher, from user-provided page images) — real extracted values with provenance.
- **UNVERIFIED_SECONDARY (search/dossier only):** B (celastrol NLC), C (Chen AuNP),
  E (Doxil), F (Abraxane) — recorded with sources to open; NOT production data.

## Stage-3 readiness (block the claim, not the profile)
- **Ready now:** A (released-API skin submodel — must be labelled *not a
  nanoparticle model*); D (vascular-transport benchmark — must be labelled *dextran,
  murine, not a drug*).
- **Illustrative mechanism only:** C (size-dependent carrier penetration + uptake–
  return concept) until the Chen primary is verified.
- **Blocked pending sources:** B, E, F.
- **No profile is externally validated (L5) or clinically qualified (L6).**

## Portfolio outcome
**OUTCOME B** — a defensible portfolio of research-supported submodels/benchmarks,
not one complete externally-validated nanoparticle drug profile. This is scientifically
useful and Stage-3-actionable for the ready profiles, with unsupported outputs
disabled/labelled.
