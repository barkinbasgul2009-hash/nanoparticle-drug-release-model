# Evidence Bridge Tables

Every cross-study transfer used by a composite profile is recorded here (§13).

## Profile A (niacinamide skin) — bridges
| Component | Source | Source system | Target | Rationale | Mismatch | Uncertainty | Label |
|---|---|---|---|---|---|---|---|
| SC partition/diffusion | Rothe 2017 | caffeine/resorcinol/7-EC, human/pig SC | niacinamide in human skin | same tissue (SC), Fickian transport | different permeant (MW/logP differ) | moderate (compound-specific) | MECHANISTIC_TRANSFER / TISSUE_SPECIFIC |
| Geometry/method | OECD TG 428 | in vitro skin method | model geometry | standard split-thickness | study-dependent thickness | low | DIRECT_PARTIAL |
| Permeation/IVIVC | Iliopoulos 2020 | niacinamide, human skin | same | exact API+tissue | vehicle-specific | low-moderate | DIRECT_EXACT |

## Profile D (Dreher vascular) — no cross-study bridge
All modules from the single primary (Dreher 2006), verified from user images. Bridge
to *nanoparticle drugs* is **not made** — dextran is a benchmark macromolecule.

## Profile E (Doxil) — planned modular composite (all currently UNVERIFIED)
| Component | Intended source | Label (now) | Needed to upgrade |
|---|---|---|---|
| Formulation | Doxil FDA label | UNVERIFIED_SECONDARY | open label |
| Systemic PK | Gabizon 2003 / label | UNVERIFIED_SECONDARY | open primary |
| Tumour accumulation | dedicated primary | INSUFFICIENT_EVIDENCE | find/open primary |
| Local intratumoural transport | **MECHANISTIC_TRANSFER from Dreher-type benchmark** | (planned) | explicit bridge + mismatch note (dextran≠doxorubicin; carrier≠free) |
| Local release | — | ASSUMED/CALIBRATED | data or calibration |

## Prohibited bridges (enforced)
- Rothe/Iliopoulos (skin small molecule) ✗→ any nanoparticle release.
- Chen AuNP (carrier) ✗→ API release or free-drug concentration.
- Dreher dextran ✗→ exact nanoparticle drug product.
- Systemic PK ✗→ local tissue-transport validation.
Each such link, if ever used, must be an explicit ILLUSTRATIVE_COUPLING with warnings.
