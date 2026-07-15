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
provide encapsulated→released API behaviour for a nanoparticle, but its primaries are
unopened (values unverified).
