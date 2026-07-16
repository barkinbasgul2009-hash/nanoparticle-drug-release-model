# Profile B — Animation Technology Stack & Asset Sources

Research-backed recommendation for the Profile-B animation system. **Design only — not
implemented.** Companion to `docs/profile-b-animation-design-document.md`.

## Project constraints that drive the choice
1. The existing tool is a **single, self-contained web page** (`web/index.html`) deployed
   to GitHub Pages — assets should be **inlined/bundled**, no hard runtime CDN dependency.
2. The science is **schematic** (depth bands, ordinal uptake, qualitative release) — heavy
   game engines are unnecessary and would hurt weight/maintainability.
3. Everything must be **evidence-gated and easily labelled** — favors code-controlled
   procedural graphics over pre-baked cinematics.

## Recommended pipeline (web-first, tiered)
| Layer | Recommendation | Why | License |
|---|---|---|---|
| Schematic 2D/2.5D (V1 core) | **Canvas 2D / SVG** procedural | lightest, deterministic, trivial to label, works everywhere; matches existing tool | n/a |
| Optional 3D scenes (V2) | **Three.js** (WebGL) | strong for scientific/data viz, opt-in features, self-contained, customizable | MIT |
| Molecular structure (optional) | **3Dmol.js** | 2-line embed, WebGL, no plugins; PubChem celastrol | BSD |
| Anatomy meshes (B2 orientation only) | **Z-Anatomy** / **BodyParts3D** | open 3D human atlas; export simplified glTF | CC BY-SA 4.0 / DBCLS |
| UI micro-animation (optional) | **Lottie** (or **Rive** for state-driven) | lightweight, scalable icons/transitions | Lottie open; Rive free plan |

**Not recommended:** Unity / Unreal (native runtimes, heavy, not web-self-contained for
this use); pre-rendered video (can't carry live evidence gates or parameter changes).

### Three.js vs Babylon.js (if/when 3D is added)
Both deploy self-contained. **Three.js** is preferred here: it is opt-in/minimal and well
suited to custom scientific visualization, keeping bundle size and complexity down. Babylon
is excellent for heavier, game-like, physics/GUI-rich scenes — more than this schematic
system needs.

## Asset-source table (permissive/attribution only)
| Asset | Source | License | Obligation |
|---|---|---|---|
| Human body atlas | Z-Anatomy (itch.io/SimTK/Sketchfab), BodyParts3D (DBCLS) | CC BY-SA 4.0 | attribute + share-alike |
| Celastrol molecule | PubChem SDF via 3Dmol.js | PubChem public domain; 3Dmol.js BSD | none/attribution |
| UI icons/motion | LottieFiles / Rive | Lottie open; Rive free-plan terms | check per-asset |
| Skin / cells / organelles / tumor | **procedural (in-code)** | project-owned | none |

## Self-containment & CSP notes
- Bundle Three.js/3Dmol.js locally; **do not** rely on a runtime CDN (matches the existing
  page's constraints and any future strict-CSP host).
- Embed anatomy meshes as compressed glTF/Draco or convert to lightweight procedural
  stand-ins where a full mesh is overkill.
- Keep the V1 core pure Canvas/SVG so the animation degrades gracefully without WebGL.

## Roadmap alignment
V1 (Canvas/SVG, B1) → V1.1 (evidence panels) → V2 (Three.js 3D, B1/B2) → V2.1 (B3 panel) →
V3 (3Dmol.js molecule + Lottie polish). See the design document §10. Each tier ships only
evidence-gated content.

## Sources
- Z-Anatomy — https://lluisv.itch.io/z-anatomy ; https://simtk.org/projects/z-anatomy
- BodyParts3D (DBCLS) via AnatomyTOOL — https://anatomytool.org/open3dmodel
- Three.js / Babylon.js comparison — https://www.sitepoint.com/three-js-babylon-js-comparison-webgl-frameworks/ ; https://blog.logrocket.com/three-js-vs-babylon-js/
- 3Dmol.js — https://3dmol.csb.pitt.edu/ ; https://github.com/3dmol/3Dmol.js
- Lottie / Rive — https://www.lottielab.com/lottie ; https://rive.app/blog/rive-as-a-lottie-alternative
