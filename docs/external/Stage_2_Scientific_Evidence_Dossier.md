# STAGE 2 SCIENTIFIC EVIDENCE DOSSIER  
## Nanoparticle Drug-Release and Tissue-Penetration Simulator

**Status:** Stage 2 completed as an evidence-selection phase, with an **OUTCOME B/C boundary conclusion**: the available evidence supports several mechanistic submodels, but it does **not** yet support a complete, externally validated, exact API–nanoparticle formulation–route–tissue production profile.

**Terminology:** In this dossier, API means **Active Pharmaceutical Ingredient** only.

---

## 1. Executive scientific decision

The evidence currently available can support three distinct scientific modules:

1. **Released small-molecule transport through skin**
   - Supported by experimentally measured stratum-corneum partition/diffusion parameters and quantitative human-skin permeation data.
   - Suitable for a multilayer skin transport submodel.
   - Does not, by itself, establish nanoparticle release.

2. **Intact nanoparticle penetration in a tumor-spheroid model**
   - Supported by quantitative studies of 15, 22, and 60 nm gold nanoparticles in MDA-MB-231 spheroids.
   - Suitable for mechanistic education about size-dependent carrier penetration and transcellular/paracellular pathways.
   - Does not contain a therapeutic API, formulation release curve, or clinical dose.

3. **Tumor vascular permeability and macromolecule penetration**
   - Supported by dextran studies measuring apparent permeability, extravascular accumulation, and distance from vessels.
   - Suitable for benchmarking vascular-to-interstitium transport.
   - Dextran is a model macromolecule, not a complete therapeutic nanoparticle formulation.

These modules must **not** be joined as though they describe one formulation. Doing so would create an evidence bridge across incompatible APIs, carriers, tissues, routes, and experimental systems.

### Final Stage-2 classification

| Candidate profile | Maximum defensible grade | Reason |
|---|---:|---|
| Generic current tissue animation | ILLUSTRATIVE_ONLY | Mathematical visualization only |
| Human-skin released-API transport | RESEARCH_SUPPORTED as a submodel | Quantitative human-skin data exist, but no exact nanoparticle formulation-release chain |
| Gold-nanoparticle tumor-spheroid penetration | RESEARCH_SUPPORTED as a carrier-transport submodel | Quantitative intact-carrier penetration exists, but no API or release |
| Dextran tumor transport | RESEARCH_SUPPORTED as a vascular transport benchmark | Model macromolecule, not a therapeutic nanoparticle |
| Complete API–nanoparticle–tissue production profile | INSUFFICIENT_EVIDENCE | Exact release-to-tissue chain plus independent validation is absent |

**No profile is QUALIFIED.**

---

## 2. Uploaded-source audit

### 2.1 Chen et al. — tumor-spheroid nanoparticle penetration

**Verified identity**

Wenjing Chen et al.  
“Size-Dependent Penetration of Nanoparticles in Tumor Spheroids: A Multidimensional and Quantitative Study of Transcellular and Paracellular Pathways.”  
*Small* 2024;20:2304693.  
DOI: **10.1002/smll.202304693**

**Scientific system**

- Carrier: quasi-spherical gold nanoparticles
- Nominal sizes: 15, 22, and 60 nm
- Surface charge: approximately −35 mV
- Tissue model: MDA-MB-231 breast-cancer spheroids
- Exposure: 1 μg/mL nanoparticles
- Duration: 12 h for principal spheroid exposure
- Carrier endpoint: intact gold concentration/distribution
- API: none
- Release: none

**Key quantitative observations**

- AuNP-22 produced the highest reported XFM concentration peak: about 924 ppm.
- AuNP-60 produced the lowest reported peak: about 187 ppm.
- Peak locations were approximately:
  - AuNP-15: 21 μm
  - AuNP-22: 22 μm
  - AuNP-60: 15 μm
- The study reported different dominant pathways:
  - 15 nm: mainly energy-independent transcellular
  - 22 nm: mixed transcellular and paracellular
  - 60 nm: mainly energy-dependent transcellular
- Sodium azide was used to inhibit energy-dependent uptake.

**Permitted use**

- Carrier-size/penetration educational module
- Tumor-spheroid carrier-transport benchmark
- Evidence that particle diameter alone does not create a monotonic penetration relationship

**Prohibited use**

- API release parameterization
- Human tumor prediction
- Intravenous biodistribution prediction
- Free-drug concentration prediction
- Clinical dose selection

---

### 2.2 Dreher et al. — vascular permeability and tumor penetration

**Verified identity**

Matthew R. Dreher et al.  
“Tumor Vascular Permeability, Accumulation, and Penetration of Macromolecular Drug Carriers.”  
*Journal of the National Cancer Institute* 2006;98:335–344.  
DOI: **10.1093/jnci/djj070**  
PMID: **16507830**

**Scientific system**

- Model carriers: fluorescent dextrans and albumin
- Molecular weights: 3.3, 10, 40, 70 kDa and 2 MDa
- Animal model: nude mice with FaDu tumors in dorsal skin-fold window chambers
- Route: intravenous
- Observation period: principal high-resolution imaging over 30 min
- API: none
- Release: none

**Selected quantitative results**

Apparent permeability, expressed as \(10^{-7}\) cm/s:

| Carrier | Apparent permeability |
|---|---:|
| 3.3 kDa dextran | 154 (95% CI 134–174) |
| 10 kDa dextran | 32 (24–39) |
| 40 kDa dextran | 9.5 (7.5–11.4) |
| 70 kDa dextran | 9.8 (7.1–12.4) |
| 2 MDa dextran | 1.7 (0.7–2.6) |

Reported spatial behavior:

- 3.3 and 10 kDa dextrans penetrated beyond 35 μm and approached a relatively homogeneous distribution.
- 40 and 70 kDa dextrans remained more concentrated near vessels; substantial concentration was mainly within roughly 15 μm.
- 2 MDa dextran was detected mainly within roughly 5 μm of the vascular surface after 30 min.
- Maximum whole-tumor accumulation and maximum penetration were not the same endpoint.

**Permitted use**

- Vascular permeability benchmark
- Vascular-to-interstitial boundary-condition research
- Demonstration of the accumulation-versus-penetration trade-off
- External benchmark for a macromolecular transport solver under the original experimental context

**Prohibited use**

- Direct parameterization of an exact nanoparticle product
- Conversion of dextran molecular weight into nanoparticle diameter without a validated mapping
- Use as a therapeutic release curve
- Human prediction

---

### 2.3 Rothe et al. — stratum-corneum diffusion and partitioning

**Verified identity**

H. Rothe et al.  
Study of stratum-corneum partition and diffusion parameters.  
*Journal of Applied Toxicology* 2017.  
DOI: **10.1002/jat.3427**

**Scientific system**

- Permeants: caffeine, resorcinol, 7-ethoxycoumarin
- Biological material: human and pig stratum corneum/skin
- Endpoint classes:
  - stratum-corneum/vehicle partition parameter
  - diffusion parameter normalized by squared SC thickness
  - permeability-related experimental parameters
- API release from a nanoparticle: not measured

**Key methodological implications**

- Hydration changes measured or corrected partition parameters.
- Sink-condition assumptions and binding assumptions affect interpretation.
- Values derived from penetration kinetics are not interchangeable with direct partition measurements.
- Pig skin may be a surrogate but must not be labelled human data.
- \(D/H^2\) may be more directly identifiable than \(D\) when thickness uncertainty is material.

**Permitted use**

- Skin partition/diffusion parameterization for the exact tested permeants
- Model-structure selection
- Uncertainty design around skin thickness and hydration

**Prohibited use**

- Generalization to unrelated APIs without evidence
- Nanoparticle release parameterization
- Treating pig and human values as interchangeable

---

### 2.4 Iliopoulos et al. — niacinamide Franz-cell and Raman IVIVC

**Verified identity**

Fotis Iliopoulos et al.  
“Franz Cell Diffusion Testing and Quantitative Confocal Raman Spectroscopy: In Vitro-In Vivo Correlation.”  
*Pharmaceutics* 2020;12(9):887.  
DOI: **10.3390/pharmaceutics12090887**

**Scientific system**

- API: niacinamide
- Formulations/vehicles:
  - Transcutol P
  - propylene glycol/propylene glycol monolaurate mixtures
  - propylene glycol/propylene glycol monolaurate/isopropyl myristate mixtures
- Human skin
- Finite-dose context
- No nanoparticle carrier

**Selected reported results**

- PG:PGML and PG:PGML:IPM produced about 100.3–106.7 μg/cm² cumulative in-vitro permeation at 24 h.
- Transcutol P produced about 1.3 μg/cm².
- Linear-regression IVIVC reported \(R^2=0.98\).
- Correlation between cumulative in-vitro permeation and total niacinamide in the SC reported Pearson \(R^2=0.94\).

**Permitted use**

- Human released-API skin transport calibration/validation research
- Vehicle-effect demonstration
- Educational explanation that formulation vehicle changes the boundary condition and effective delivery

**Prohibited use**

- Nanoparticle release
- Carrier penetration
- Treating one vehicle as another
- Treating correlation as universal validation for all APIs

---

### 2.5 OECD TG 428 and associated skin-absorption guidance

**Scientific role**

- Methodological standard for in-vitro skin absorption
- Supports:
  - receptor-fluid design
  - skin preparation
  - finite/infinite dose distinctions
  - temperature control
  - sampling/replacement
  - recovery and mass-balance expectations
  - reporting requirements

**Typical conditions appearing in the uploaded material**

- Skin-surface temperature around 32 ± 1 °C
- Diffusion-cell sampling with replacement fluid
- Explicit recovery/mass-balance analysis
- Split-thickness skin commonly within a defined study-dependent range

**Permitted use**

- Experimental-method anchors
- Data-quality and applicability assessment
- Design of simulator metadata and warnings

**Prohibited use**

- API-specific diffusivity
- API-specific partition coefficient
- API-specific release curve

---

### 2.6 Sarfraz et al. — intravesical nanoformulations review

**Verified identity**

Sarfraz et al.  
*Pharmaceutics* 2022;14:1909.  
PMCID: **PMC9501312**

**Scientific role**

- Secondary source
- Useful for:
  - urothelial anatomy
  - GAG/mucin barrier
  - intravesical retention
  - mucoadhesive carrier candidate discovery
  - identification of primary studies

**Limitations**

- Quantitative model parameters must be traced to primary studies.
- Review statements must not be treated as directly measured values.
- The review does not itself provide an independently validated exact API–formulation transport dataset.

---

### 2.7 Additional skin-modeling review

The uploaded additional source contains a valuable model map covering:

- multilayer diffusion
- binding/unbinding
- metabolism
- dermal vascular clearance
- appendageal pathways
- finite donor conditions
- compartmental approximations
- parameter estimation

It supports model design but is not a substitute for API/formulation-specific primary data.

---

## 3. Candidate landscape

The broad candidate landscape was evaluated according to whether an evidence chain could be constructed:

\[
\text{exact formulation}
\rightarrow \text{release}
\rightarrow \text{free API at interface}
\rightarrow \text{tissue transport}
\rightarrow \text{measured output}
\rightarrow \text{calibration}
\rightarrow \text{independent validation}
\]

### 3.1 Candidate categories screened

| Candidate category | Strongest available evidence | Principal break in the chain |
|---|---|---|
| Pegylated liposomal doxorubicin, IV tumor | Regulatory/PK/biodistribution | Local free-API depth and independent local validation |
| Albumin-bound paclitaxel, IV tumor | Regulatory/PK | Albumin complex dissociation and depth-resolved free API |
| Liposomal irinotecan, IV tumor | Regulatory/PK | Local released irinotecan/SN-38 penetration |
| Gold nanoparticles in tumor spheroids | Intact carrier penetration | No therapeutic API or release |
| Dextrans in murine tumor | Vascular permeability and penetration | Not an exact nanoparticle drug product |
| Niacinamide topical human skin | Strong released-API permeation | No nanoparticle formulation |
| Caffeine/resorcinol/7-EC skin | Partition/diffusion parameters | No exact NP release chain |
| Tripterine lipid carriers | Candidate formulation literature | Full release-plus-independent penetration chain not verified here |
| Caffeic-acid lipid nanoparticles | Candidate formulation literature | Full-text quantitative chain and independent validation unresolved |
| Caffeine lipid nanoparticles | Candidate formulation literature | Full-text quantitative chain and independent validation unresolved |
| Intravesical chitosan/API systems | Mucoadhesion and local route | Depth-resolved primary data and validation incomplete |
| Ocular/nasal/buccal/pulmonary local delivery | Several formulation studies | Cross-study comparability and independent validation incomplete |

---

## 4. Finalist comparison

### Finalist A — released niacinamide transport through human skin

**Exact system presently supported**

Niacinamide in defined non-nanoparticle vehicles, topical finite-dose exposure, human skin, Franz-cell and in-vivo Raman endpoints.

**Strengths**

- Real API
- Human tissue/in-vivo relevance
- Quantitative permeation
- Vehicle dependence
- Strong reported IVIVC
- Clear measurable endpoints
- Compatible with multilayer slab transport

**Weaknesses**

- Not a nanoparticle formulation
- No carrier release
- No encapsulated/free distinction
- Independent external validation for the exact model remains incomplete

**Grade:** RESEARCH_SUPPORTED skin-transport submodel

---

### Finalist B — gold nanoparticles in MDA-MB-231 spheroids

**Exact system**

Quasi-spherical 15/22/60 nm gold nanoparticles, approximately −35 mV, 1 μg/mL, 12 h exposure, MDA-MB-231 spheroid.

**Strengths**

- Intact carrier measured directly
- Size, concentration and penetration location reported
- Multiple analytical techniques
- Mechanistic pathways investigated
- Good animation/education potential

**Weaknesses**

- No API
- No release
- No route equivalent to clinical administration
- One laboratory and one spheroid system
- No independent external validation
- Active cellular uptake means simple Fickian diffusion alone is inadequate

**Grade:** RESEARCH_SUPPORTED carrier-penetration benchmark

---

### Finalist C — dextran tumor transport

**Exact system**

Fluorescent dextrans of defined molecular weights, IV administration, murine FaDu window-chamber tumors.

**Strengths**

- Quantitative vascular permeability
- Spatial penetration from vessels
- Accumulation and PK-like data
- Useful benchmark equations and values

**Weaknesses**

- Model macromolecules
- Molecular weight is not a universal particle-size surrogate
- No API
- No formulation release
- Short imaging interval
- Murine tumor context

**Grade:** RESEARCH_SUPPORTED vascular transport benchmark

---

## 5. Selected scientific direction

### Primary Stage-3 direction

**Do not implement a complete named nanoparticle-drug profile yet.**

Implement, only after approval, a modular **topical human-skin released-API transport framework** with:

- exact API/vehicle profile selection
- finite donor
- stratum corneum
- viable epidermis
- dermis
- optional binding
- optional dermal clearance
- explicit formulation-to-skin partition
- flux boundary or finite-donor coupling
- uncertainty bands
- a visible label:  
  **RESEARCH_SUPPORTED RELEASED-API SKIN SUBMODEL — NOT YET A NANOPARTICLE RELEASE MODEL**

Use niacinamide only under its exact source-defined vehicle and exposure conditions.

### Parallel research benchmark

Retain Chen and Dreher as two separate tumor benchmarks:

1. carrier penetration in spheroids;
2. vascular-to-interstitium macromolecule transport.

They should not be combined into a drug-product prediction.

---

## 6. Recommended mathematical structure for the skin submodel

### 6.1 State variables

For a finite-donor, multilayer model:

- \(M_d(t)\): API in donor/formulation
- \(C_{sc}(x,t)\): free API in stratum corneum
- \(B_{sc}(x,t)\): bound API in stratum corneum, if supported
- \(C_{ve}(x,t)\): free API in viable epidermis
- \(C_d(x,t)\): free API in dermis
- \(M_{clear}(t)\): cleared API
- \(M_{rec}(t)\): receptor/systemic sink amount
- \(M_{deg}(t)\): degraded/metabolized API, if supported

### 6.2 Donor balance

\[
\frac{dM_d}{dt}
=
-AJ_{d\rightarrow sc}
-k_{\mathrm{evap}}M_d
-k_{\mathrm{deg},d}M_d
\]

Evaporation and donor degradation remain disabled unless evidence exists.

### 6.3 Layer equations

Stratum corneum:

\[
\frac{\partial C_{sc}}{\partial t}
=
D_{sc}\frac{\partial^2 C_{sc}}{\partial x^2}
-k_{on}C_{sc}
+k_{off}B_{sc}
\]

\[
\frac{\partial B_{sc}}{\partial t}
=
k_{on}C_{sc}
-k_{off}B_{sc}
\]

Viable epidermis:

\[
\frac{\partial C_{ve}}{\partial t}
=
D_{ve}\frac{\partial^2 C_{ve}}{\partial x^2}
-k_{met,ve}C_{ve}
\]

Dermis:

\[
\frac{\partial C_d}{\partial t}
=
D_d\frac{\partial^2 C_d}{\partial x^2}
-k_{clear,d}C_d
-k_{met,d}C_d
\]

### 6.4 Interface conditions

At each layer boundary:

\[
J_i = J_{i+1}
\]

and, where equilibrium partitioning is justified:

\[
C_{i+1}=K_{i+1/i}C_i
\]

### 6.5 Donor/skin boundary

A Robin condition is generally preferable to directly imposing cumulative release as concentration:

\[
-D_{sc}\left.\frac{\partial C_{sc}}{\partial x}\right|_{0}
=
k_m\left(C_{d,free}-\frac{C_{sc}(0,t)}{K_{sc/d}}\right)
\]

For a nanoparticle formulation, \(C_{d,free}\) must come from an explicit carrier-release/dissolution model. It must not equal “initial loading × cumulative released fraction” without dimensional and mechanistic justification.

---

## 7. Tumor carrier-penetration model structure

Chen’s findings indicate that a pure diffusion equation is insufficient for intact carrier transport.

A candidate spheroid equation is:

\[
\frac{\partial C_{np}}{\partial t}
=
\nabla\cdot(D_{\mathrm{eff}}\nabla C_{np})
-k_uC_{np}
+k_rC_{cell}
\]

\[
\frac{\partial C_{cell}}{\partial t}
=
k_uC_{np}
-k_rC_{cell}
-k_{loss}C_{cell}
\]

where:

- \(C_{np}\): extracellular/intact nanoparticle concentration
- \(C_{cell}\): cell-associated nanoparticle concentration
- \(D_{\mathrm{eff}}\): effective paracellular diffusion
- \(k_u\): uptake rate
- \(k_r\): return/release from cell-associated state
- \(k_{loss}\): sequestration or loss

Size-dependent values cannot be inferred from only the reported peak positions. Raw spatial profiles or digitization of the published figures would be required.

---

## 8. Complete mass-balance architecture

For an eventual nanoparticle drug profile:

\[
M_{initial}
=
M_{carrier}
+M_{donor,free}
+M_{interface}
+M_{tissue,free}
+M_{tissue,bound}
+M_{cell}
+M_{cleared}
+M_{degraded}
+M_{metabolized}
+M_{out}
+M_{unrecovered}
+M_{numerical\,residual}
\]

Every term must have:

- unit
- state or derived-status designation
- source
- measurement/fitting status
- uncertainty
- applicable route and tissue
- conservation test

### Minimum numerical acceptance criteria

- non-negativity
- conservation residual reported at every output time
- grid convergence
- time-step convergence
- analytical slab benchmark
- finite-donor depletion test
- zero-flux and sink-limit tests
- R/JavaScript agreement
- uncertainty propagation
- parameter-domain checks

---

## 9. Penetration endpoint policy

The application must not use one generic “penetration depth.”

For skin, report separately:

- cumulative permeated mass per area
- flux
- permeability coefficient
- lag time
- layer-specific concentration
- tissue retention
- receptor amount
- depth above a visible concentration threshold

For tumor spheroids:

- intact carrier concentration versus distance
- concentration peak location
- fraction of signal beyond a chosen depth
- cell-associated versus extracellular carrier
- maximum detectable depth

For vascular tumor models:

- apparent permeability
- extravascular AUC
- distance from vessel
- whole-tumor accumulation

No endpoint may be converted into another without a validated model.

---

## 10. Parameter role classification

### User-adjustable only within evidence-supported ranges

- donor dose
- exposure duration
- formulation vehicle, through discrete source-defined presets
- threshold used to visualize penetration
- selected source-defined API profile
- selected skin condition only when supported

### Locked profile parameters

- API identity
- formulation composition
- route
- species/tissue source
- particle formulation properties
- source-derived layer thickness
- source-derived partition and diffusion parameters

### Uncertainty parameters

- skin thickness
- partition variability
- diffusion variability
- donor recovery
- inter-subject variability
- digitization error
- model structural uncertainty

### Informational only unless a quantitative relation is sourced

- zeta potential
- PDI
- PEG density
- qualitative protein-corona information
- qualitative ECM density
- qualitative disease-state description

No informational parameter should become a slider without a supported equation.

---

## 11. Biological environment panels

### Skin panel

Display:

- stratum corneum as principal barrier
- viable epidermis
- dermis and vascular clearance
- hydration state
- anatomical site
- intact/damaged condition
- skin source: human/pig
- finite/infinite dose
- receptor sink status
- temperature
- vehicle
- current API
- included and excluded mechanisms

### Tumor-spheroid panel

Display:

- cell line
- spheroid diameter
- incubation medium
- exposure duration
- carrier diameter and zeta potential
- transcellular/paracellular pathways
- absence of vasculature and systemic clearance
- in-vitro status
- no human extrapolation

### Intravesical panel

Display:

- urothelium
- umbrella-cell barrier
- GAG/mucin layer
- urine volume/turnover
- residence time
- washout
- mucoadhesion
- distinction between review-derived and primary-study values

---

## 12. Risk-of-bias and applicability summary

### Chen 2024

Strengths:

- multiple complementary analytical methods
- direct gold quantification
- defined sizes and exposure
- quantitative spatial assessment

Limitations:

- one cell line
- one laboratory
- no therapeutic API
- no clinical route
- no independent validation
- cell uptake and paracellular transport may not generalize to other surfaces

### Dreher 2006

Strengths:

- intravital imaging
- simultaneous permeability/accumulation/penetration measurements
- defined molecular-weight series
- confidence intervals and compartment modeling

Limitations:

- animal window-chamber model
- dextran carrier surrogate
- short high-resolution observation window
- convective contribution simplified/uncertain
- tumor-specific transferability limited

### Rothe 2017

Strengths:

- explicit methods for D/K determination
- human and pig comparisons
- methodological discussion of hydration and assumptions

Limitations:

- only several model permeants
- parameter transformations depend on thickness and hydration
- not nanoparticle specific

### Iliopoulos 2020

Strengths:

- human skin and in-vivo Raman comparison
- finite dose
- quantitative API data
- multiple vehicles

Limitations:

- small study scope
- no nanoparticle carrier
- API/formulation specific
- correlation does not prove universal predictive validity

---

## 13. Calibration and external validation decision

### Skin released-API submodel

Possible calibration source:

- Iliopoulos 2020 niacinamide permeation data under one defined vehicle.

Possible validation source:

- A separate vehicle within the same paper is **not fully independent external validation**.
- Rothe data use different permeants and endpoints; they cannot automatically serve as exact niacinamide external validation.

**Conclusion:** no confirmed independent external validation dataset for the exact niacinamide profile.

### Tumor carrier model

Possible calibration source:

- Chen 2024 size-specific spatial carrier data.

Possible validation source:

- Dreher 2006 is not compatible enough to be exact validation because carrier, route, tissue model, and endpoint differ.

**Conclusion:** no exact independent external validation dataset.

### Maximum evidence grade

RESEARCH_SUPPORTED, not QUALIFIED.

---

## 14. Remaining critical evidence gaps

A complete nanoparticle drug profile still requires one exact candidate with:

1. complete formulation composition;
2. particle size distribution and PDI;
3. loading and encapsulation efficiency;
4. free fraction;
5. full release curve under route-relevant conditions;
6. release assay validated against membrane limitation;
7. tissue/interface data using the same API and formulation;
8. free versus total API separation;
9. biological environment data;
10. calibration dataset;
11. independent external validation dataset;
12. uncertainty and batch variability;
13. source-accessible raw or digitizable data.

Additional critical documents/data:

- The genuine Potts & Guy 1992 paper for the original QSAR coefficients and domain.
- Supporting information for Chen 2024.
- Full primary studies cited by the intravesical review.
- Exact topical nanoparticle primary studies containing both release and skin penetration.
- Independent replication of the selected formulation.
- Raw concentration-versus-depth data where possible.

---

## 15. Stage-3 scope permitted by this dossier

Stage 3 may:

- implement a research-supported multilayer skin transport engine;
- add exact source-defined non-nanoparticle API/vehicle profiles;
- implement finite donor and mass balance;
- display uncertainty and applicability warnings;
- implement Chen and Dreher as separate benchmark datasets;
- add carrier-penetration educational mode;
- add source provenance and environment cards.

Stage 3 must not:

- claim a complete nanoparticle drug model;
- use unrelated release and tissue data as one formulation;
- call a profile clinically validated;
- generalize pig skin to human without qualification;
- generalize spheroids to human tumors;
- infer free API from total carrier measurements;
- use cumulative release fraction directly as surface concentration;
- merge any production profile without validation review.

---

## 16. Final Stage-2 conclusion

### Outcome

**OUTCOME B — PARTIALLY SUFFICIENT EVIDENCE**, with an **INSUFFICIENT_EVIDENCE determination for a complete API–nanoparticle–route–tissue profile**.

### Primary recommendation

Proceed in Stage 3 with a modular, source-qualified **released-API human-skin transport submodel**, beginning with source-defined niacinamide vehicles, while explicitly disabling nanoparticle-specific release and carrier penetration for that profile.

### Parallel benchmarks

- Chen 2024: intact nanoparticle penetration in tumor spheroids.
- Dreher 2006: vascular permeability and penetration of model macromolecules.

### Fallback

Continue candidate acquisition for a topical lipid nanoparticle formulation that contains:

- exact API;
- complete release curve;
- skin retention/permeation profile;
- formulation characterization;
- independent validation.

Until such a candidate is verified, the software must not represent itself as a complete nanoparticle drug-release and tissue-penetration predictor.

---

## 17. Core references

1. Chen W, et al. *Small*. 2024;20:2304693. DOI 10.1002/smll.202304693.
2. Dreher MR, et al. *J Natl Cancer Inst*. 2006;98:335–344. DOI 10.1093/jnci/djj070. PMID 16507830.
3. Iliopoulos F, et al. *Pharmaceutics*. 2020;12:887. DOI 10.3390/pharmaceutics12090887.
4. Rothe H, et al. *J Appl Toxicol*. 2017. DOI 10.1002/jat.3427.
5. OECD Test Guideline 428. Skin Absorption: In Vitro Method.
6. Sarfraz et al. *Pharmaceutics*. 2022;14:1909. PMCID PMC9501312.
7. Potts RO, Guy RH. *Pharm Res*. 1992;9:663–669. DOI 10.1023/A:1015810312465.
8. Mitragotri S, et al. Dermal diffusion and stratum-corneum mathematical modeling review, *Int J Pharm*. 2011;418:115–129.
