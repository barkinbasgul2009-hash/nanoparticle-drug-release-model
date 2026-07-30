# Profile B — Scientific Visualization Director Pass

**Second-pass review focused on visual-communication quality. Design spec only — nothing
implemented, no assets, no production code, PR #3 not merged.** This extends (does not
replace) the biological visualization blueprint. Every recommendation ends in a **final
decision**: `IMPLEMENT` / `OPTIONAL` / `DEFER` / `DO NOT USE` — no undecided items.

Companion registries: `data/profile-b-visual-reference-guide.json`,
`profile-b-camera-language.json`, `profile-b-motion-language.json`,
`profile-b-visual-metaphors.json`, `profile-b-visual-decision-matrix.json`. Production scene:
`docs/profile-b-scene1-production-spec.md`.

## 0. Guiding principle
From molecular-animation practice (Front Bioinform 2022, PMC9580893; PMC11371733; Iwasa,
Berry): **clarity through simplification and abstraction**, governed by **consistent
complexity** — one abstraction level per scale. Conventions (color, framing, selective
fade/blur) guide attention; they never fabricate biology.

## 1. Visual reference extraction → representation
Per-structure design attributes (geometry, silhouette, texture, membrane, nucleus,
proportions, translucency, landmarks, defensible simplifications) are in
`profile-b-visual-reference-guide.json`, each tagged REALISTIC / STYLIZED / SCHEMATIC.
Headlines: SC = **STYLIZED** bricks-and-mortar (3–6 rows, anucleate); epidermis = **STYLIZED**
grouped bands; dermis = **SCHEMATIC** fiber weave; NLC = **STYLIZED** smooth sphere (one
~85–90 nm class, charge halo); B16 cell = **STYLIZED** with **murine** label. Attributes are
extracted from open references (HPA CC BY, OpenStax CC BY) — **no artwork is traced.**

## 2. Scientific camera language
Standardized in `profile-b-camera-language.json`. The signature beat is a **cross-section
clip-plane reveal** (surface → layered slab) with the 0–30/30–60/60–90 µm ruler; ease-in/out,
no whip pans; DoF isolates the load-bearing element. A **persistent scale badge** and a
**model banner** (rat skin / HaCaT / B16BL6 / mouse) accompany every transition. The
`BODY→ORGAN→BLOODSTREAM` descent is **DO NOT USE** for topical B1.

## 3. Biological motion language
In `profile-b-motion-language.json`. Diffusion = **biased random walk** (population drift),
never straight constant-speed lines; SC crossing = crowding/stalling; release = slow
unlabelled emission of free-API dots (no timer); uptake = **ordinal** glow by charge (no
endocytosis machinery for B1). **Particles never self-propel; no cinematic motion.** Time
compression is always labelled.

## 4. Scientific visual metaphors
In `profile-b-visual-metaphors.json`. **Recommended:** particle-density gradient (with
legend), diffusion front, ordinal band shading, dashed-outline + amber-badge uncertainty,
ghost overlay + warning for inferred risk, side-by-side ordinal comparison. **Avoid / DO NOT
USE:** continuous quantitative concentration heat field (no measured field exists), cinematic
FX, sci-fi auras/beams, red-for-everything.

## 5. Unified visual language (Nature/Cell/BioRender principles)
Analyzing common principles (not copying artwork): restrained palette with a clear **color
hierarchy** (protagonist particle pops; context recedes); **soft, single-key lighting** with
gentle depth cueing; **flat/semi-realistic membranes**, no glossy CGI sheen; **quiet
typography** with consistent label chips and leader lines on hold; **low scene complexity per
frame**; abstraction rises as scale falls. One palette, one type system, one label style
across all Profile-B scenes. → `IMPLEMENT`.

## 6. Visual decision matrix
Full matrix in `profile-b-visual-decision-matrix.json`. Summary — **IMPLEMENT:** SC,
epidermis, dermis, corneocyte, keratinocyte, B16 cell, NLC particle, free-API dots,
formulation reservoir, depth ruler, evidence badges. **OPTIONAL:** melanocyte, fibroblast,
vessel, collagen, BM, RBC, celastrol 3D molecule, B2 ER/immune cells, trails/glow.
**DEFER:** whole-body model, appendages. **DO NOT USE:** B1 organelles/endocytosis,
B1 decorative immune cells, subcutis penetration, nerves, concentration heat field, cinematic
FX, self-propelled particles, systemic circulation for B1.

## 7. Visual simplification strategy
Intentional omissions (each raising signal-to-noise): excessive cell density; general
organelles (B1); decorative immune cells; random ECM fibers; dense vasculature (risks
implying circulation); background clutter; continuous concentration fields. Justifications in
the matrix.

## 8. Final implementation decisions
Every row above and in the registries carries a terminal `IMPLEMENT / OPTIONAL / DEFER / DO
NOT USE`. Nothing is left as a possibility.

## 9. Complete first-scene specification
See `docs/profile-b-scene1-production-spec.md` — a production-ready spec for the opening B1
scene.

## 10. Stop
Specification only. No implementation, no assets, no production-code change, PR #3 not merged.
