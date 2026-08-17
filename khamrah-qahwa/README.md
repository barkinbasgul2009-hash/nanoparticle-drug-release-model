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
- Type is a system luxury stack (Didot → Bodoni MT → Hoefler Text → Georgia).
  No webfont is loaded, so the display face resolves differently per platform
  by design.

## Content

Product facts, the note pyramid and the launch year are presented exactly as
supplied. Sensory descriptors in the note strata ("roasted · deep") are UI
language, not additional official notes. Nothing about performance, longevity,
projection, perfumers, awards or retailers is claimed anywhere, and the closing
call to action returns to the fragrance profile rather than inventing a store.
