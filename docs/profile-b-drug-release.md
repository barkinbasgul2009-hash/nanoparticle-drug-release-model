# Profile-B — Drug Release Documentation (Phase 4)

What the release process is, the model behind it, and what it deliberately excludes.

## The process
After a nanoparticle **arrives** at the target region (Phase 3), the encapsulated drug
(tripterine/celastrol) leaves the NLC carrier. This is a **separate biological process** from
transport: transport moves the carrier; release empties it. The two never mix.

```
loaded  ──(arrival)──▶  releasing  ──(payload depleted)──▶  empty
 payload full          payload ↓ / released ↑              payload = 0
```

## The kinetic model (first-order)
Chen 2012 fit release to zero-order, first-order, Higuchi and Ritger-Peppas and **selected
first-order** (good correlation). The engine uses:

- Released fraction: **F(t) = 1 − e^(−k·t)**
- Remaining payload: **Q(t) = e^(−k·t)**
- Conservation: **payload + released = 1** at all times.

`t` is the elapsed *release* time (starts at arrival, not at spawn). `k` is a **schematic** rate
(the frozen package does not report a numeric k) anchored to span the reported **1–48 h** release
window — no exact k or %-released is claimed.

## Lifecycle states (per particle)
| State | Payload | Meaning |
|---|---|---|
| `loaded` | full | arrived (or just arrived); release not yet started |
| `releasing` | decreasing | first-order release in progress |
| `empty` | 0 | payload released to the empty threshold; the phase ends here |

Release state is held by the **ReleaseEngine** (keyed by particle id), not on the transport
particle — keeping transport and release cleanly separated.

## Aggregate release curve
The engine records a curve of **mean released fraction vs time** across releasing carriers. It
rises monotonically from 0 to full release — the classic cumulative-release curve — and updates
every step. It carries no absolute %-released claim (schematic k).

## Visualization
The particle glyph is a carrier **shell** with an inner **payload disc** whose *area* is
proportional to the remaining payload:
- Full carrier → shell + full inner disc.
- Releasing → inner disc shrinks.
- Empty → shell only.

The Phase-3.1 evidence signalling is preserved: the shell is **solid** for experimental (rat)
and **dashed** for predictive (human/mouse), with the evidence caption unchanged. No glow, no
trails, no gaming effects. Released drug is shown as the shrinking payload + the release curve —
**not** as freely diffusing specks (that would be payload diffusion/transport, which is out of
scope).

## Formulation-level, not species-specific
Release kinetics describe the **formulation** (in-vitro release of the NLC into medium), so the
same first-order model applies whichever skin the carrier was applied to. No per-species rate is
fabricated. For predictive-transport species (human/mouse), the *arrival* remains predictive
(Phase 3.1); the *release model* is the formulation's reported kinetics.

## Explicitly NOT modelled (hard stop)
cellular uptake · membrane crossing · receptor binding · endocytosis · clathrin · caveolae ·
lysosome · endosome · cytoplasm · nucleus · intracellular trafficking · degradation · PK · PD ·
blood circulation · immune system · toxicity · tumour killing · apoptosis · pharmacology ·
payload diffusion/transport. These are enforced by `integrity.excluded_downstream` and by the
lifecycle ending at `empty`.
