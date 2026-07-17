# Profile B — Biological Visualization Readiness

Design only. Machine-readable: `data/profile-b-visualization-readiness.json`. Distinguishes
readiness levels — "the software architecture exists" does **not** make the animation ready.

## Readiness ladder
`ENGINEERING_READY` → `BIOLOGICALLY_SPECIFIED` → `VISUALLY_SPECIFIED` → `ASSET_READY` →
`IMPLEMENTATION_READY` → `VALIDATION_READY`.

## Overall status
| Level | Status |
|---|---|
| ENGINEERING_READY | ✅ (animation architecture from the prior phase) |
| BIOLOGICALLY_SPECIFIED | ✅ (this phase: tissue/cell/ECM/vascular atlases, storyboard, exclusions) |
| VISUALLY_SPECIFIED | ✅ (style guide, color policy, movement rules, scale system) |
| ASSET_READY | ◑ partial — procedural assets specified; open reference images identified but not license-verified/collected |
| IMPLEMENTATION_READY | ◑ conditional — assets to collect; **no code written (stop gate)** |
| VALIDATION_READY | ✗ not started |

## B1 scene readiness
| Scene | Status |
|---|---|
| S4 depth-layer deposition | **IMPLEMENTATION_READY (schematic)** — strongest evidence; ordinal only |
| S6 uptake comparison | **IMPLEMENTATION_READY (schematic, ordinal)** — mandatory confound note |
| S9 limitation panel | **IMPLEMENTATION_READY** — data-driven |
| S2 formulation on skin | VISUALLY_SPECIFIED — pending scale-indicator design |
| S3 stratum-corneum barrier | VISUALLY_SPECIFIED — label carrier-vs-released limitation |
| S1, S5 | CONTEXTUAL_ANATOMY — ready as context |
| S7 melanoma, S8 effect | BIOLOGICALLY_SPECIFIED — label murine model; qualitative endpoint |

## Remaining gaps
- Collect + license-verify specific open reference images (HPA CC BY, Wikimedia per-file,
  OpenStax CC BY).
- No B1-specific quantitative depth-concentration field (only bands) → keep schematic.
- No time-resolved stability/precipitation data → keep qualitative risk.
- B2/B3 scenes remain abstract/comparator until (optionally) more evidence extends the frozen
  package.

## What is ready to implement (when a build is approved)
The **B1 schematic 2D/2.5D pipeline** (depth-band transport, ordinal-charge uptake, qualitative
release, tumor-reduction endpoint) with the full evidence-panel + "what is NOT shown" system.
Everything else is contextual, abstract, or gated on more evidence — and **nothing is
implemented in this task.**
