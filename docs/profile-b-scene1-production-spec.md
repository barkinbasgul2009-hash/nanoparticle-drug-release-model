# Profile B — Scene 1 Production Specification (opening beat)

**Production-ready scene spec — for a FUTURE approved build. Nothing implemented here.**
Scene 1 = **"Application site → topical formulation on skin surface"** (storyboard S1→S2),
the first thing the user sees after selecting preset **B1** and a surface-charge config.
Evidence source: `chen_2012` (frozen package). Model label for this scene: **topical
application (generic skin site)** — no experimental-model banner yet (the rat-skin banner
appears at Scene 2/S3 when the cross-section opens).

## Visible biological objects (and representation)
| Object | Representation | Notes |
|---|---|---|
| Skin site (surface + subtle contour) | STYLIZED | generic skin; no body journey |
| Formulation reservoir (thin translucent film/droplet) | STYLIZED | holds the particles |
| NLC nanoparticles (~85–90 nm class) | STYLIZED spheres | one size class; **charge halo** = warm (cationic) / grey (neutral) / cool (anionic), declared illustrative |
| Encapsulated celastrol (tint inside particle) | SCHEMATIC | shows drug is inside |
| Scale indicator | UI | "Scale: surface ~1 mm → particles ~85–90 nm (not to scale)" |

**Hidden this scene:** cells, ECM, vessels, organelles, free API (release starts later),
depth bands (appear at S3). No epidermal detail yet.

## Layout & composition
Horizon line low; skin surface occupies the lower third; formulation film sits on it;
particles suspended in the film with gentle Brownian drift. Protagonist (particles) center-
frame with the strongest contrast; background neutral and recessive (color hierarchy).

## Color usage (all declared)
- Particle body: single ILLUSTRATIVE hue; charge halo a secondary ILLUSTRATIVE accent.
- Skin/film: muted TRUE-ish neutrals (not stain colors).
- **Legend chip** present from frame 1 declaring color classes. No red-for-everything.

## Camera
Open on `BODY→SKIN_SITE` gentle push-in (slow, ~2–3 s), settle to `SKIN_SURFACE` framing
(medium). Shallow DoF on the formulation film. **No descent toward circulation.** Ends held,
ready for the S3 cross-section clip-plane reveal.

## Movement
Particles: gentle **Brownian drift** within the film (no net direction, no swimming).
Formulation: eases into place (spreading). Accelerated narrative time, **labelled**.

## Transitions
In: fade from the preset-selection UI. Out: hold → (Scene 2) cross-section clip-plane opens
with the **EX VIVO RAT SKIN MODEL** banner + the 0–30/30–60/60–90 µm depth ruler.

## Lighting
Single soft key, low fill, subtle depth cue; matte surfaces; no CGI gloss or lens flare.

## Particle rendering
Uniform spheres, smooth surface (Chen TEM), semi-translucent to reveal the encapsulated tint;
charge halo as a soft rim; instanced for performance.

## Information panels & evidence badges
- Persistent **evidence badge**: `SUPPORTED_QUALITATIVE — topical application & formulation
  (Chen 2012)`.
- Hover on a particle → note: "NLC ~85–90 nm; PDI/zeta NOT REPORTED in the evidence package."
- Collapsible **"What is NOT shown"** tray seeded with: systemic circulation, precise size
  differences, precipitation/aggregation timing.

## User interactions
- Surface-charge toggle (cationic/neutral/anionic) → changes only the **charge halo** +
  (later scenes) ordinal uptake; shows the mandatory confound note.
- Play/pause + scrub; hover-for-detail; open/close evidence panel.
- No control that implies an unsupported route (no injection/oral/IV options for B1).

## Educational notes (this scene)
"You are applying a topical celastrol nanostructured-lipid-carrier formulation to the skin
surface. The particles are ~85–90 nm. Surface charge is selectable, but note it co-varies
with lipid composition in the source study. Nothing enters the bloodstream — this is a
topical model."

## Evidence-fidelity checklist (must all hold)
✅ topical only (no circulation/injection/oral) · ✅ one size class · ✅ charge halo declared
illustrative · ✅ no cells/organelles/vessels yet · ✅ color legend present · ✅ Brownian
(non-directional) motion · ✅ evidence badge + "what is not shown" visible · ✅ NOT REPORTED
fields labelled.
