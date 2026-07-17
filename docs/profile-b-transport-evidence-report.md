# Profile-B — Transport Evidence Report (Phase 3)

Auditable mapping of every transport behaviour to its source. Authoritative source: the
**frozen** `data/profile-b-evidence-package.json` (Chen 2012 full text). Primary papers were
used over reviews. Where the frozen package says NOT REPORTED, nothing was invented.

## Step 1 — Literature identified (Profile B)
| Field | Value | Source | Confidence |
|---|---|---|---|
| Topical application | topical NLC on skin (Franz-cell donor) | Chen 2012 | QUALITATIVELY_SUPPORTED |
| Formulation | surface-charged NLC (cationic/neutral/anionic); TPGS + Pluronic F68; IPM/MCT lipids | Chen 2012 | QUANTITATIVELY_SUPPORTED |
| Nanoparticle type | nanostructured lipid carrier (NLC) | Chen 2012 | DIRECTLY_OBSERVED |
| Vehicle | aqueous surfactant dispersion | Chen 2012 | QUALITATIVELY_SUPPORTED |
| Particle size | 84.5–90.2 nm (neutral 84.5 ± 10.2; anionic 87.8 ± 7.4; cationic 90.2 ± 9.7) | Chen 2012 | QUANTITATIVELY_SUPPORTED |
| Tissue / barrier | full-thickness abdominal **rat** skin; sections 0–30/30–60/60–90 µm | Chen 2012 | DIRECTLY_OBSERVED |
| Transport observation | skin-permeation time series 1, 2, 4, 6, 8, 10, 12 h | Chen 2012 | QUANTITATIVELY_SUPPORTED |
| Barrier concept | stratum corneum = rate-limiting permeation barrier | consensus (StatPearls NBK537325; OpenStax A&P) | QUALITATIVELY_SUPPORTED |
| Charge effect | uptake order cationic > neutral > anionic (skin-permeation numbers not restated) | Chen 2012 | QUALITATIVELY_SUPPORTED (uptake); charge = label only for transport |

Primary paper: **Chen Y et al., Int J Nanomedicine 2012;7:3023-3033, DOI 10.2147/IJN.S32476.**
Review (`sun_2024`) used for discovery only, never as a transport source.

## Step 2 — Accepted vs rejected values
- **Accepted for transport:** topical application; NLC identity + size; rat full-thickness skin
  as the tissue; the 1–12 h time window; the depth sections 0–90 µm; the SC-as-rate-limiting
  barrier ordering (consensus).
- **Rejected / not used:** any numeric per-layer diffusion coefficient, flux, permeability, or
  lag time — **NOT REPORTED in the frozen package** → not encoded, not invented. Absolute timing
  is therefore schematic (anchored only to the reported 1–12 h window). Per-charge permeation
  speeds — not restated → charge is a **label**, not a speed.
- **Not transferred across species:** rat values are never copied to human/mouse.

## Species evidence gate (per the frozen package)
| Species | Reported use in Chen 2012 | Skin-permeation evidence | Engine |
|---|---|---|---|
| Rat (Sprague-Dawley) | skin permeation (ex vivo, full-thickness) | **YES** | animated (QUALITATIVELY_SUPPORTED) |
| Human | HaCaT keratinocytes — *cellular uptake* (in vitro) | **NO** (uptake ≠ permeation) | **blocked (NOT_REPORTED)** |
| Mouse (C57BL/6) | melanoma *pharmacodynamics* (in vivo) | **NO** | **blocked (NOT_REPORTED)** |

Uptake and pharmacodynamics are **later-phase** topics; using them as permeation evidence would
be a category error, so the gate blocks human and mouse. This is enforced by the Phase-1
`EvidenceEngine.canAnimate()` on the `NOT_REPORTED` confidence.

## Mechanism ↔ evidence
| Mechanism | Evidence basis | Confidence |
|---|---|---|
| Brownian motion | thermal diffusion of a ~85–90 nm carrier (physical principle applied to reported size) | MECHANISTIC_TRANSFER |
| Concentration gradient | time-increasing permeation (1–12 h series) implies net inward flux | QUALITATIVELY_SUPPORTED |
| SC barrier slowing | SC rate-limiting (consensus + Chen's enhancement rationale) | QUALITATIVELY_SUPPORTED |
| Post-SC mobility increase | tissue below SC less resistant to a small carrier | QUALITATIVELY_SUPPORTED |
| Active transport | none reported; not applicable to passive lipid-carrier permeation | NOT_APPLICABLE (excluded) |

## Key uncertainties recorded (not hidden)
1. **Intact NP vs released drug.** Chen measured *tripterine* permeation + depth distribution;
   intact-NLC dermal arrival is NOT REPORTED. The animation is a schematic carrier depiction.
2. **Absolute rates.** No flux/lag/D in the frozen package → timing is schematic.
3. **Human relevance.** No human skin-permeation data for this formulation → human is blocked.
4. **Charge-resolved permeation.** Numbers not restated → charge is a label only.

Every one of these is encoded in `transport.registry.json` (`integrity`, per-state/transition
`evidence`, `species_transport`) so another scientist can audit each decision against the frozen
package.
