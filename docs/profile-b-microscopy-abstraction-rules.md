# Profile B — Microscopy → Illustration Abstraction Rules

Documentation only. Translates real microscopy into illustration rules that **preserve
biology**, plus scale-dependent simplification. Extends
`docs/profile-b-histology-reference-guide.md`.

## Microscopy comparison (what each method contributes)
| Method | Visible | Hidden | Animation usefulness |
|---|---|---|---|
| H&E | tissue architecture, nuclei, collagen (pink) | ultrastructure, molecular | high (tissue view) |
| Masson trichrome | collagen organization (blue) | fine cells | medium (dermis) |
| IHC | marker+ cells (SOX10/Melan-A/HMB-45) | non-target | medium (identify melanocytes) |
| IF / confocal | labelled targets, localization (pseudocolor) | unlabelled context | high (uptake/localization) |
| TEM | SC lamellae, membranes, NP morphology (grayscale) | color, large field | high (SC/NP) |
| SEM | surface topography (grayscale) | interior | medium (surface) |
| Whole-slide | large-field architecture | ultrastructure | medium (context) |

## Abstraction rules (preserve biology, reduce noise)
- **Corneocytes:** real = overlapping flattened polygonal plates → illustration = slightly
  simplified polygonal tiles, **anucleate**, 3–6 representative rows (not 15–20).
- **Keratinocytes:** real = irregular polygons with desmosomes → keep polygonality, reduce
  membrane noise; one clear nucleus.
- **Collagen:** real = interwoven fibrillar bundles → **continuous bundled fibers**, avoid
  "decorative spaghetti"; intentional weave direction.
- **Lipid lamellae:** real = parallel periodic bilayers → a few clean parallel bands at high
  zoom only.
- **Basement membrane:** real = thin sheet at DEJ → single undulating line with rete ridges.
- **Melanoma (murine):** real = nests + single cells → clustered rounded/spindle cells,
  optional pigment; **label murine**, do not render human invasive-melanoma detail as the model.
- **Nanoparticle:** real = smooth spheres (TEM) → uniform spheres, one size class.

## Scale-dependent simplification (visible / simplified / hidden)
| Object | Body | Skin | Cross-section | Cell | Nanoparticle |
|---|---|---|---|---|---|
| Skin layers | — | simplified | **visible** | simplified | hidden |
| Corneocytes/lamellae | hidden | hidden | simplified | **visible** | simplified |
| Keratinocytes | hidden | hidden | simplified | **visible** | simplified |
| Collagen/ECM | hidden | hidden | simplified | simplified | hidden |
| Vessels | hidden | hidden | simplified (context) | hidden | hidden |
| Melanoma cells | hidden | hidden | simplified | **visible** | simplified |
| Nanoparticle | hidden | simplified | simplified | visible | **visible** |
| Free API | hidden | hidden | simplified | visible | **visible** |

**Rule:** each abstraction is derived from real microscopy appearance (above), never from
artistic preference; each simplification raises the signal-to-noise of the supported transport
story.
