# Khamrah Qahwa — scroll-driven fragrance experience

A single-page, art-directed presentation of the Lattafa Khamrah Qahwa Eau de
Parfum. Nine scenes unfold from one continuous scroll: a reveal out of
darkness, the object, the three olfactive acts, the Qahwa idea, an exploded
teardown, light through glass, the profile, the note strata, and a closing
reveal.

Unrelated to the simulation work in the rest of this repository, and outside
the Pages deployment, which assembles only the files named in
`.github/workflows/pages.yml`.

## Build

```
python3 build.py      # inlines assets -> index.html
```

Edit `index.template.html`; `index.html` is generated and self-contained (no
external requests, so it runs from `file://` and inside a strict CSP). Assets
live in `assets/`.

## The photography

Three supplied studio photographs are the visual source of truth. All three
were shot on a cream backdrop, which fights a dark presentation, so each was
matted out of its background by growing the background inward from the frame
edge and accepting a pixel only when it closely matches the neighbour it grew
from — local continuity follows the smooth backdrop gradient anywhere and
stops at the product outline. A global colour key cannot do this, because the
backdrop is a gradient and the cap is transparent.

The matte itself is then estimated rather than thresholded (`matte2.py` in the
scratch pipeline, mirrored in `assets/`): along a two-pixel band around the
silhouette each pixel is expressed as a blend of the local foreground and
local background colour, and that blend factor becomes alpha. This recovers
the soft edge the camera actually recorded; hard-thresholding it is what makes
a cut-out look cut out. Three further rules matter:

- cleanup is done by **reconstruction** — an opening decides which component
  survives, then the original shape is propagated back, so hairlines go
  without notches being bitten out of the cap's corners;
- the bottle is **cut at its true base line**, because the glossy tabletop
  reflection below it survives the background grow as a pale ragged fringe;
- every piece keeps a **transparent margin**, so no part of a silhouette sits
  flush against its own frame edge where shadows and masks would clip it.

The exploded frame was then split into its five separately floating pieces by
connected component, and each piece's position in the original frame is stored
in `assets/pieces.json` as normalised coordinates. The teardown scene lays the
pieces out from that geometry, so the composition reassembles exactly as it was
photographed, and each piece can still travel on its own axis.

The bottle and packaging are never redrawn or substituted — only masked,
composited and lit.

## Things worth knowing before editing

- **`.rise` ends on `transform: none`.** Only put it on elements that carry no
  positioning transform of their own; anything centred with `translateX(-50%)`
  takes the class on an inner span instead. A CSS animation's `forwards` fill
  also outranks inline styles, so it must not sit on elements whose opacity the
  scroll code drives.
- **Never scale a viewport-sized gradient per frame.** Doing so re-rasterises
  it every frame and was, by measurement, the single largest cost on the page
  (22 → 58 fps in a forced full-page scroll once removed). Glows animate
  opacity only. Large `drop-shadow` filters on per-frame-transformed images are
  the second largest; the products rely on a pooled `.ground` gradient instead,
  and only the teardown pieces keep a real shadow, at a small radius.
- **Don't put a CSS transition on a property the scroll code writes every
  frame** — the transition restarts continuously and lags behind the scroll.
  Class toggles (annotations, note hovers) are the right place for transitions.
- Scrolling is never hijacked. Only the product transforms follow a damped copy
  of the scroll position, so the object feels weighted while text stays locked
  to the user's input.
- **The product's dimensionality is built, not modelled.** It is one
  photograph, so there is no geometry to light: instead each product sits on a
  perspective plane it can tilt on, and every light layer — travelling
  specular, rim light, base shading — is clipped to the product's own alpha
  via `mask-image`, so highlights fall on the glass rather than over the
  scene. Depth between bottle, packaging and ground comes from differential
  parallax (the box tilts and drifts at 0.4× the bottle) plus a little
  defocus on the box.
- **The artwork is referenced through a CSS custom property**, not repeated in
  four `<img>` tags. That is what lets the light layers share the same mask,
  and it halved the page (1222 KB → 724 KB).
- A specular band must not be a diagonal gradient inside a narrow box — the
  box corners land mid-gradient and show as a hard edge. Run the gradient
  straight and skew the element.
- Type is a system luxury stack (Didot → Bodoni MT → Hoefler Text → Georgia).
  No webfont is loaded, so the display face resolves differently per platform
  by design.

## Content

Product facts, the note pyramid and the launch year are presented exactly as
supplied. Sensory descriptors in the note strata ("roasted · deep") are UI
language, not additional official notes. Nothing about performance, longevity,
projection, perfumers, awards or retailers is claimed anywhere, and the closing
call to action returns to the fragrance profile rather than inventing a store.
