# Profile B — Animation Design Document (Master Blueprint)

**Status: research + design only. Nothing is implemented.** No Stage 3, no production code,
no animation build; PR #3 not merged. This is the master blueprint for the Profile-B
animation system, bound to the frozen evidence package
(`data/profile-b-evidence-package.json`).

Machine-readable companions: `data/profile-b-animation-pipeline.json` (stage graph),
`data/profile-b-animation-modules.json` (parameter-driven modules),
`data/profile-b-animation-info-panels.json` (evidence-linked notes),
`data/profile-b-animation-asset-inventory.json` (assets). Technology + roadmap:
`docs/profile-b-animation-tech-stack.md`.

---

## 0. Governing principle — scientific fidelity first
Every animated event maps to an **evidence badge**. The animation may show an event
**qualitatively** when literature reports that it occurs but not its timing/magnitude; it
must **never** invent a value, curve, rate, or onset time. When timing is unknown, an
info note is shown, e.g. *"Sustained release reported; exact release kinetics were not
available."*

### The single most important design decision
The generic pipeline *administered → travels through bloodstream → reaches target →
releases → effect* **does not literally apply to Profile B's anchor preset.** **B1 (Chen
2012) is topical skin delivery — there is no bloodstream-circulation stage.** Therefore
the pipeline is **evidence-gated per preset**: the selected preset's route decides which
stages exist, and each stage is `SUPPORTED`, `ABSTRACT_SUPPORTED`, `CONTEXTUAL`,
`NOT_APPLICABLE`, or `DO_NOT_ANIMATE`.

---

## 1. Animation architecture
A **data-driven, evidence-gated** pipeline. Three layers:

1. **Scene graph** (WebGL/Canvas) — renders the current stage.
2. **Module layer** — reusable, parameter-driven animation modules
   (`profile-b-animation-modules.json`). Modules read the selected preset + parameters and
   the stage-applicability matrix; they never hardcode a preset.
3. **Evidence/overlay layer** — badges, info notes, and the "what is NOT shown" tray, all
   sourced from `profile-b-animation-info-panels.json`.

A **scene = an ordered list of module instances** bound to a preset's supported stages.
Nothing renders unless its `evidence_gate` passes; otherwise it renders display-only or as
a labelled info note.

## 2. Reusable animation modules (summary)
| Module | Driven by | Evidence gate | May NOT |
|---|---|---|---|
| `mod_administration` | route | preset route | imply IV journey for a topical preset |
| `mod_skin_depth_transport` | B1 | Chen depth sections | extravasation / ECM traversal |
| `mod_surface_charge_uptake` | charge | Chen uptake ranking | give a rate; ignore the lipid confound |
| `mod_particle_size_display` | size | 84.5–90.2 nm | drive penetration/uptake from size |
| `mod_release` | preset | B1 first-order/qualitative | draw a curve or state a % / time |
| `mod_er_targeting_icd` | B2 | Wang abstract chain | numeric labels / deterministic timing |
| `mod_therapeutic_effect` | preset | B1 efficacy / B2 ICD | quantify shrinkage / survival |
| `mod_solubility_stability_panel` | B3 | Shukla solubility/stability | animate precipitation / growth |
| `mod_hypothesized_property` | generic (PEG, size…) | none in package | animate an unevidenced effect |
| `mod_do_not_animate_guard` | any blocked event | package block-list | render blocked events as timed |

## 3. Per-stage design (bound to the stage matrix)

### S3 Administration
- **B1:** NLC dispersion applied to a skin-surface slab (`SUPPORTED`).
- **B2:** systemic administration shown for orientation only (`CONTEXTUAL`; PK NOT REPORTED).
- **B3:** none — comparator panel.

### S4 Transport
- **B1:** progression across the **three labelled skin depth bands (0–30/30–60/60–90 µm)**
  as a qualitative front (`SUPPORTED`). Blood-vessel extravasation & ECM traversal are
  `DO_NOT_ANIMATE`.
- **B2:** abstract "reaches tumor" (`CONTEXTUAL`; no timing).
- **B3:** N/A.

### S5 Target arrival
- **B1:** reaching local melanoma tissue in skin. **B2:** at B16F10 tumor cell
  (`ABSTRACT_SUPPORTED`). **B3:** EpiIntestinal tissue-model context (`CONTEXTUAL`).

### S6 Cellular interaction / uptake
- **B1:** uptake in HaCaT/B16BL6 with **ordinal charge ranking** cationic>neutral>anionic
  (`SUPPORTED` + mandatory confound note). Intracellular transport `DO_NOT_ANIMATE`.
- **B2:** uptake → **ER localization** (`ABSTRACT_SUPPORTED`).
- **B3:** N/A (uptake NOT REPORTED).

### S7 Drug release
- **B1:** qualitative **sustained/delayed release** (first-order selected) — eased,
  unlabelled emission; **no plotted curve** (`OBSERVED_TIMING_UNKNOWN` note).
- **B2 / B3:** release module **disabled** (NOT REPORTED).

### S8 Therapeutic effect
- **B1:** qualitative reduced tumor burden (endpoint-supported). **B2:** ER stress →
  CRT/HMGB1/ATP → DC maturation → CD8+ activation (`ABSTRACT_SUPPORTED`). **B3:**
  solubility/stability/permeability info panel (`CONTEXTUAL`).

### S9 Evidence panels (persistent)
Badges + hover notes + a collapsible **"What is NOT shown and why"** tray listing every
`DO_NOT_ANIMATE` / `HYPOTHESIZED` item for the current preset.

## 4. Parameter-driven animation logic (evidence-gated)
| Parameter | Effect on animation | Evidence status |
|---|---|---|
| Surface charge (B1) | ordinal uptake-intensity ranking | `SUPPORTED` (with lipid-confound note) |
| Particle size (B1) | **display-only label** (~85–90 nm) | no size→outcome evidence → not animated |
| Route / preset | selects the stage graph + anatomical scene | `SUPPORTED` (route is defined per preset) |
| Target organ/disease | swaps the tissue scene (skin/tumor/intestine) | `SUPPORTED` per preset |
| Release type | B1 qualitative sustained; else disabled | `OBSERVED_TIMING_UNKNOWN` |
| Coating / PEG | **info note only** ("PEG→longer circulation" is a general expectation) | `HYPOTHESIZED` (no Profile-B PK) |

**No hardcoded animations.** A parameter alters the scene only through a module whose
evidence gate it satisfies; unevidenced generic tropes become greyed info notes.

## 5. UI flow
`Select Profile B → Select preset (B1/B2/B3) → Configure supported parameters →
Run → Staged animation with persistent evidence panel → "What is NOT shown" review.`
B1 exposes preset + surface-charge class (+ dose/exposure only within tested domain);
B2/B3 expose preset choice only (all quantitative fields display `NOT REPORTED`).

## 6. Camera & scene transitions
Macro (application) → tissue (skin bands / tumor) → cell (uptake) → organelle (ER, B2 only).
Each **scale transition is labelled**; rates are never implied to be equal. Camera paths
and scale steps are procedural (keyframed). Suggested cadence: slow establishing dive,
hold on the load-bearing evidence event, ease to the next stage.

## 7. Anatomical asset requirements
Mostly **procedural** (skin slab with depth bands, cells, ER, tumor cluster, intestinal
model) to stay self-contained and evidence-controllable. **Reuse** a simplified
Z-Anatomy/BodyParts3D body only as an orientation frame for B2's systemic context. Full
inventory + license obligations: `data/profile-b-animation-asset-inventory.json`.

## 8. Evidence-linked information panels
Badges: `SUPPORTED` · `SUPPORTED_QUALITATIVE` · `ABSTRACT_SUPPORTED` ·
`OBSERVED_TIMING_UNKNOWN` · `HYPOTHESIZED` · `DO_NOT_ANIMATE`. Each animated element
carries a hover note + citation to a `profile-b-evidence-package.json` source id. Standard
note strings are frozen in `profile-b-animation-info-panels.json` (e.g. *"Supported by
Chen 2012."*, *"Observed in literature; exact timing was not reported."*, *"May occur
after prolonged storage."*).

## 9. Recommended asset sources (see tech-stack doc for detail)
- **Anatomy:** Z-Anatomy (CC BY-SA 4.0) / BodyParts3D (DBCLS).
- **Molecule:** 3Dmol.js (BSD) with a PubChem celastrol structure (optional).
- **UI micro-animation:** Lottie (open) or Rive (free plan).
- **Everything scientific-schematic:** procedural in-code.

## 10. Implementation roadmap (for a FUTURE, separately-approved build)
1. **V1 — schematic 2D/2.5D (Canvas/SVG), B1 only:** depth-band transport, ordinal-charge
   uptake, qualitative release, tumor-reduction endpoint, full evidence overlay. Highest
   fidelity-to-effort ratio; self-contained.
2. **V1.1 — evidence panel system + "what is NOT shown" tray** (data-driven).
3. **V2 — optional Three.js 3D layer** for B1 skin dive + B2 ER-targeting (abstract),
   reusing procedural assets; add Z-Anatomy body frame for B2 orientation.
4. **V2.1 — B3 comparator panel** (solubility/stability/permeability).
5. **V3 — 3Dmol.js celastrol molecule + Lottie UI polish** (optional).
Each version ships only evidence-gated content; new evidence extends the frozen package
first, then unlocks new modules.

## 11. What this blueprint deliberately excludes
Deterministic precipitation/aggregation/degradation timelines; size- or PEG-driven
quantitative effects; human-skin claims from rat data; any numeric read-out marked
`NOT REPORTED`; and any body-circulation journey for the topical B1 preset.
