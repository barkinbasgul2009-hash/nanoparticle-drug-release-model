# Profile B — Biological Visual Style Guide

Design only. Machine-readable: `data/profile-b-visual-style-registry.json`.

## Target aesthetic
**Scientifically defensible visual realism** — biologically recognizable, disciplined
scientific illustration (BioRender / Cell-Press / Nature-animation *principles*, not copied
assets). Not photorealism for its own sake, not cartoonish, not horror, not decorative
sci-fi. Suitable for students and researchers.

## Element language
- **Cells:** true-to-type — corneocyte flat/anucleate; keratinocyte polygonal; melanocyte &
  B16 dendritic-or-spindle; fibroblast spindle. **Nuclei only in nucleated cells — never in
  corneocytes.**
- **Membranes:** smooth bilayer line; desmosomal junctions where real (epidermis).
- **ECM:** intentional fibrillar pattern (dermal collagen bundles), not random noise.
- **Nanoparticle:** uniform spheres of the ~85–90 nm class (B1), one deliberately-assigned
  illustrative color.
- **Encapsulated vs free API:** encapsulated = tint *inside* the particle; released/free =
  separate small glyphs.
- **Uncertainty:** ghosted / hatched rendering + amber badge for INFERRED_RISK / qualitative
  events.
- **Trails/arrows:** diffusion trails look like a random walk, never directional "swimming."

## Movement rules (evidence-tagged)
| Movement | Render | Tag |
|---|---|---|
| Brownian motion | random-walk jitter | ILLUSTRATIVE_ONLY |
| Diffusion | **biased** random walk (not straight constant-speed lines) | QUALITATIVELY_SUPPORTED |
| SC barrier crossing | stalling / limited progress at SC | QUALITATIVELY_SUPPORTED |
| Partitioning | accumulation cue in lipid mortar | INFERRED / QUALITATIVE |
| Uptake | contact + ordinal glow (no endocytosis machinery for B1) | QUALITATIVELY_SUPPORTED |
| Release from carrier | gradual emission, unlabelled timing | QUALITATIVELY_SUPPORTED |
| Intracellular / ER trafficking | **B2 only**; prohibited for B1 | ABSTRACT_SUPPORTED (B2) / UNSUPPORTED (B1) |
| Directional swimming through tissue | **prohibited** | UNSUPPORTED_DO_NOT_ANIMATE |

**Forbidden:** constant-speed straight-line diffusion; intentional particle swimming;
organelle trafficking for B1; exact concentration fields without quantitative data.

## Color policy (declare every color's meaning)
Classes: `TRUE_NATURAL_COLOR` · `STAIN_DEPENDENT` · `FLUORESCENCE_PSEUDOCOLOR` ·
`ILLUSTRATIVE_COLOR` · `DATA_ENCODING_COLOR`.
- H&E pink/purple and trichrome blue are **STAIN_DEPENDENT** — never natural tissue colors.
- IF green/red are **FLUORESCENCE_PSEUDOCOLOR** (assigned channels).
- Nanoparticle color is **ILLUSTRATIVE_COLOR**.
- Depth/concentration encoding is **DATA_ENCODING_COLOR** with a legend.
- **Do not** reuse red for blood *and* concentration *and* danger *and* therapeutic effect —
  pick distinct hues.
- **Every major view carries a legend** declaring each color's class.
