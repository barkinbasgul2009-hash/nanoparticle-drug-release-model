# Stage-3 Recommendation (REVISED after external-dossier ingestion)

## Scientific decision: OUTCOME B — partially sufficient; complete NP profile = INSUFFICIENT_EVIDENCE
Consistent with the external dossier and our own primary-source review. No profile is
QUALIFIED. The evidence supports several **separate** submodels/benchmarks, not one
continuous, externally-validated API–nanoparticle–route–tissue profile.

## Verified vs candidate (do not conflate)
- **Most VERIFIED submodel (opened primaries):** released **small-molecule** API
  through human skin — niacinamide permeation/IVIVC (Iliopoulos 2020) + SC K/D
  (Rothe 2017) + method (OECD TG 428). This is a **released-API skin submodel**, and
  **niacinamide is NOT a nanoparticle**.
- **Strongest EXACT NANOPARTICLE candidate (UNVERIFIED, web-blocked):**
  **celastrol/tripterine-loaded NLC, topical skin** — appears to have formulation
  characterization + controlled release + Franz permeation + in vivo PD (search-level
  only; PDFs needed to verify/extract and to confirm independent validation).

## Two SEPARATE tumour benchmarks (dossier-reported, UNVERIFIED; must NOT be bridged)
- **Chen 2024** — intact AuNP (15/22/60 nm) penetration in MDA-MB-231 spheroids
  (carrier only, no API/release). Indicates carrier transport needs an
  **uptake–return intracellular state**, not pure Fickian diffusion.
- **Dreher 2006** — dextran vascular permeability/penetration (model macromolecule,
  IV, murine). Vascular-to-interstitium benchmark only.
Values are secondary (from the external dossier); primaries were not opened here.

## Recommended Stage-3 direction (only after approval + PDFs)
1. **Implement the released-API multilayer human-skin transport engine** (SC / viable
   epidermis / dermis; finite donor; Robin/flux coupling; optional binding & dermal
   clearance), parameterized from the **verified** small-molecule values, clearly
   labelled *"RESEARCH_SUPPORTED released-API skin submodel — NOT a nanoparticle
   release model."*
2. **Pursue the celastrol/tripterine NLC skin primaries** to upgrade this into a real
   nanoparticle profile (needs the PDFs).
3. **Keep Chen and Dreher as two separate, clearly-labelled benchmarks** (verify
   against primaries before any quantitative use).

## Release-to-tissue coupling & mass balance
Robin/flux boundary (not `C0·f(t)`); for a spheroid carrier model add an intracellular
`M_cell` uptake–return state (see `mass-balance-candidate-design.md`). Coupling per
candidate in `release-to-tissue-coupling.md`.

## Calibration / validation
**No adequate independent external validation dataset exists for any candidate**
(niacinamide: other vehicles in the same paper are not independent; Chen vs Dreher are
incompatible systems). Maximum grade therefore **RESEARCH_SUPPORTED**, never QUALIFIED.

## Stage-3 entry conditions
(1) user selects direction; (2) provide celastrol-NLC skin primaries (and/or Chen 2024,
Dreher 2006, Potts & Guy 1992 PDFs) so parameters are extracted with provenance and
independence checked; (3) confirm Outcome B and the "no complete NP profile" limit.

## MUST NOT (Stage 3)
Claim QUALIFIED/clinical/patient-specific; present the skin submodel as a nanoparticle
model; bridge the three separate systems; use cumulative-release-fraction as surface
concentration; infer free API from carrier-only data; generalize pig→human or
spheroid→human tumour without qualification.
