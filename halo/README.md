# HALO — concept microsite

A self-contained, scroll-driven product reveal for a fictional smart ring.
Open `index.html` directly in a browser; there is no build step, and the page
loads no external resources.

This is a standalone design piece and is unrelated to the simulation work in
the rest of the repository. It is not part of the Pages deployment, which
assembles only the files named explicitly in `.github/workflows/pages.yml`.

## How it works

The ring is not an image or a 3D library scene. It is drawn every frame into a
2D canvas as a surface of revolution with a superellipse cross-section — a thin
wide machined band rather than a torus — tessellated into quads that are
back-face culled on their projected winding, depth sorted, and flat shaded with
a three-light rig, environment reflection, Fresnel and a cavity term.

A few decisions worth knowing before editing:

- **Yaw is authored, not accumulated.** Yaw is applied before tilt, so it swings
  the ring's axis in space; an unbounded spin would drive the apparent tilt too
  and could park the object edge-on under any line of copy. Every keyframe in
  `CAM` picks a pose for its scene. On-screen openness is `cos(rx)·cos(ry)`.
- **Culling uses the projected winding**, not an averaged vertex normal. Where
  the surface runs parallel to the view, the averaged normal reads as
  back-facing while the quad is still a large visible polygon, and culling it
  punches a wedge out of the object.
- **The capacitive band is painted into the shading** of the shell rather than
  modelled as its own geometry, which would z-fight with the shell it sits in.
- **Tessellation follows the drawn size.** Flat-shaded quads that are fine at
  thumbnail size quilt visibly at full bleed, so the band is rebuilt when it
  crosses a size bucket.
- Quads grow a fixed distance from their centroid to close seams. The offset
  must stay absolute — a proportional grow turns near-degenerate silhouette
  quads into spikes — and widens for grazing quads, whose polygonal edge would
  otherwise read as sawteeth.

Scene copy, layer names and finishes are data at the top of the script
(`MATERIALS`, `LAYERS`, `SCENES`, `CAM`, `MODES`).
