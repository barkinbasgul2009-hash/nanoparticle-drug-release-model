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
