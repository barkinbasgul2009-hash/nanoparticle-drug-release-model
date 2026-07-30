# Profile-B — Drug Release Evidence Report (Phase 4)

Auditable mapping of every release behaviour to its source. Authoritative source: the **frozen**
`data/profile-b-evidence-package.json` (Chen 2012 full text). Where the frozen package says
NOT REPORTED, nothing is invented.

## What the frozen package reports (release)
| Field | Value | Source | Used as |
|---|---|---|---|
| Release model | fit to zero-order / first-order / Higuchi / Ritger-Peppas; **FIRST-ORDER selected** (good correlation) | Chen 2012 (`release_profile`) | the engine's kinetic model |
| Release qualifier | "delayed tripterine release" (qualitative) | Chen 2012 | context only (not a number) |
| Release time series | 1, 2, 4, 8, 10, 12, 18, 24, 36, 48 h | Chen 2012 (`time_series.release_h`) | the reported window k is anchored to |
| Crystallinity | tripterine **amorphous** in the NLC | Chen 2012 | supports simple diffusion-limited release |
| Rate constant k | **NOT REPORTED** in the frozen package | — | schematic (see below) |
| Exact % released | **NOT REPORTED** in the frozen package | — | not claimed |
| Per-charge release numbers | **NOT REPORTED** in the frozen package | — | charge is a label only |

Primary paper: **Chen Y et al., Int J Nanomedicine 2012;7:3023-3033, DOI 10.2147/IJN.S32476.**

## Accepted vs rejected
- **Accepted:** the first-order **model** (directly reported as the selected fit); the 1–48 h
  release **window**; amorphous drug state (supports the diffusion-limited assumption).
- **Rejected / not encoded:** a numeric rate constant k, exact %-released values, and
  per-surface-charge release rates — all **NOT REPORTED** in the frozen package → not encoded,
  not invented. The engine's k is **schematic** (a simulation-scale rate in config), anchored to
  span the reported window, and flagged as such in the registry (`rate_constant.status =
  NOT REPORTED`) and in the model's evidence descriptor.

## Confidence
| Item | Confidence | Rationale |
|---|---|---|
| First-order model choice | `QUALITATIVELY_SUPPORTED` | the model selection is directly reported |
| Rate magnitude (k) | schematic (NOT REPORTED) | no numeric k in the frozen package |
| Species dependence | none (formulation-level) | release is in-vitro release of the NLC, not skin-dependent |

## Species handling (consistent with Phase 3.1)
Release kinetics are a **formulation** property, so the same first-order model is used for every
species — there is no per-species release rate and no rat-to-other transfer of a release number.
What differs by species is only *transport* (experimental for rat, predictive for human/mouse,
Phase 3.1); release begins only after a particle has arrived, whichever way it arrived.

## Integrity flags (in the registry)
- `separation` — release is a distinct process; the engine reads, never writes, transport state.
- `schematic_rate` — the model is evidence-based; k is NOT REPORTED → schematic; no quantitative
  release claim.
- `formulation_level` — no per-species k fabricated.
- `ends_at_empty` — the phase ends when the carrier empties; nothing further.
- `excluded_downstream` — 21 downstream processes (uptake, endocytosis, PK, PD, apoptosis, …)
  explicitly excluded.

Every decision above is encoded in `simulator/data/release.registry.json` so another scientist
can audit each choice against the frozen package.
