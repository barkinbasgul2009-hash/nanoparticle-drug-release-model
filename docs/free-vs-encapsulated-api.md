# Free vs Encapsulated API (assessment)

The current solver diffuses **released free API**. Every candidate dataset must be
classified by what it measures, because total API ≠ free pharmacologically
available API.

| Measurement type | Represents | Usable as tool input directly? |
|---|---|---|
| Total API in tissue | free + encapsulated + bound | No (needs deconvolution) |
| Free API | pharmacologically available | Yes (matches tool) |
| Encapsulated API | still in carrier | No (it is the source, not tissue C) |
| Carrier (label) penetration | intact nanoparticle | No (tool models released API, not carrier) |
| Metabolite | downstream species | Only if modelled |

Key honesty points:
- **Skin:** intact nanoparticles largely stay in SC/follicle → skin data should be
  read as *released-API* diffusion, not carrier penetration.
- **Tumour/spheroid:** most quantitative data are **carrier** penetration → a
  released-API tool must not adopt carrier depths as API depths without justification.

Machine-readable endpoint typing: `data/measurement-endpoint-registry.json`.

---

## Stage-2 CONTINUATION finding (critical)
Every opened quantitative source measures **free small-molecule API** permeation/
partition in skin (caffeine, resorcinol, 7-ethoxycoumarin, niacinamide) — i.e.
exactly the "released free API" the tool diffuses. **None involves a nanoparticle
carrier.** Therefore:
- These sources parameterize the **released-API skin-diffusion layer** validly.
- They do **not** provide free-vs-encapsulated partitioning for any nanoparticle,
  nor carrier penetration.
- A genuine nanoparticle profile still needs an NP-formulation primary reporting
  encapsulated vs released fractions (identified: tripterine NLC etc., not provided).
Per §22, small-molecule/tracer transport data must not be presented as a complete
nanoparticle drug-release model.

---

## Stage-2 CONTINUATION 2 update
The external dossier reinforces this: its supported skin submodel uses **niacinamide
(free small molecule, no carrier)**, and Chen 2024 measures **intact carrier** (gold,
no API/no release), while Dreher measures **dextran** (model macromolecule). None
provides free-vs-encapsulated API kinetics for a therapeutic nanoparticle. The
**celastrol/tripterine NLC** candidate is the first identified system that could
provide encapsulated-to-released API behaviour for a nanoparticle, but its primaries are
unopened (values unverified).

---

## Stage-2 BATCH-1 update (primaries now opened)

Two genuine-nanoparticle systems are now **primary-verified**, each with distinct
state semantics.

### Profile B — tripterine/celastrol NLC (`chen-2012-tripterine-nlc`, opened)
The full chain is inside one primary, so states are internally consistent:
encapsulated in NLC -> released (first-order) -> permeated across rat skin -> deposited.
- **Released from NLC:** 24 h 49.7-75.7 %, 48 h 68-95 %; best fit **first-order**
  (r2 0.95-0.96) - directly compatible with the tool's existing first-order release model.
- **Permeated (across skin):** cumulative 11.9-16.3 ug/cm2; flux 0.91-1.26 ug/cm2/h.
- **Deposited (skin-retained):** measured (charge-dependent).
This is *released-API* + *carrier-modulated* skin transport - a legitimate NP topical
chain, not a blind carrier-depth transfer.

### Profile E — Doxil (`doxil-fda-pi`, `doxil-nda050718-s050`, opened)
The critical lesson: **total != free**, and free may be unmeasurable.
| State | Value | Source | Label |
|---|---|---|---|
| **Total** doxorubicin (plasma PK) | Table 8 (Cmax 4.12/8.34; AUC 277/590; lambda2 t1/2 52-55 h) | doxil-fda-pi | DIRECT_EXACT |
| **Encapsulated** fraction | >=90 % during circulation | doxil-fda-pi + s050 | DIRECT_EXACT |
| **Free** doxorubicin | mass-balance (total - encapsulated); 42 % of samples negative; FDA: "may not yield reliable estimates" | doxil-nda050718-s050 | DIRECT_PARTIAL (caution) |
| **Doxorubicinol** (metabolite) | 0.8-26.2 ng/mL | doxil-fda-pi | DIRECT_EXACT |
| **Tumour tissue** | none | (missing) | INSUFFICIENT_EVIDENCE |

**Consequences:** Profile E supports a *systemic-PK + formulation* submodel on **total**
(and, cautiously, **encapsulated**) doxorubicin. It does **not** support a free-drug
tumour-delivery curve - the free fraction is below assay resolution and no intratumoral
data exist. The "release at the tumour" step (Barenholz koff) stays **ASSUMED**
(in-vitro release numbers are redacted (b)(4) in the approval package). Tumour-
penetration outputs for Profile E must remain **disabled** until a spatial primary
(aid E4 / Charrois and Allen aid E5 / Gabizon aid E2) is opened.

---

## Stage-2 BATCH-2 update — free doxorubicin now DIRECTLY assayed (Li 2022)

The Front Oncol 2022 bioequivalence trial (`li-2022-pld-be`, DOI 10.3389/fonc.2022.1070001)
**separately and directly** assays free and encapsulated doxorubicin, resolving the
key weakness of the earlier FDA S-050 mass-balance estimate.

**§13 answers:**
1. **Directly assays free doxorubicin?** Yes.
2. **Separation method?** Free doxorubicin isolated by **solid-phase extraction (SPE)**;
   encapsulated pretreated separately — measured directly, not by subtraction.
3. **More defensible than mass balance?** Yes — avoids the 42%-negative artifact seen in
   the FDA S-050 total-minus-encapsulated approach.
4. **Resolves the FDA free-drug uncertainty?** Substantially — supplies a defensible,
   directly-measured free-dox PK profile (though it is a different trial/product, not the US label study).
5. **Formulations comparable to Doxil/Caelyx?** Reference arm = **Caelyx** (Janssen-Cilag,
   the EU twin of Doxil) → directly comparable; test arm = a generic shown bioequivalent.
6. **Usable as?** **DIRECT_PARTIAL** for Profile E (via the Caelyx reference arm; generic is BE).

| State | Test (generic) | Reference (Caelyx) | Unit |
|---|---|---|---|
| **Free** Cmax | 133.45 | 114.23 | ng/mL |
| **Free** t½ | 97.31 | 97.98 | h |
| **Free** CLz | 2.60 | 2.88 | L/h/m² |
| **Encapsulated** Cmax | 34.37 | 33.73 | µg/mL |
| **Encapsulated** t½ | 81.31 | 78.89 | h |
| **Encapsulated** CLz | 12.51 | 13.16 | mL/h/m² |

Free Cmax (~130 ng/mL) is ~250× lower than encapsulated Cmax (~34 µg/mL) — the plasma
pool is overwhelmingly encapsulated, consistent with the ≥90% figure. **States kept
separate; not merged.** Systemic only — still **no tumour-tissue** free/encapsulated data.
