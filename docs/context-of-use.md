# Context of Use

Status: pre-approval definition.

## Current tool (live website)
An **educational / research-exploratory** simulator of (1) drug release from a
nanoparticle and (2) local diffusion of the *released* drug through a generic,
homogeneous soft-tissue medium. It is **not** a clinical decision tool and does
**not** predict any individual patient's response.

## Intended extension
Add named, evidence-qualified API–formulation–route–tissue profiles that produce
quantitative predictions **only within a documented applicability domain**, each
carrying an explicit evidence grade and uncertainty.

## Out of scope (unless explicitly added, evidenced, and validated)
Whole-body biodistribution; nanoparticle carrier transport; barrier crossing;
cellular uptake; intracellular trafficking; pharmacodynamic effect.

## Terminology
"API" = **active pharmaceutical ingredient**. Software connections are called
libraries / web services / backend services — never "API".

---

## Stage-2 update
Stage 2 identified the candidate landscape and recommends (Outcome B) a **solid
tumour local released-drug diffusion** profile as the primary Stage-3 target
(fallback: topical skin multilayer). No named-tissue quantitative profile is
activated. The intended context of use for any Stage-3 named profile is
**educational/research-exploratory within a documented applicability domain**, never
clinical or patient-specific, and never claiming validity beyond the species/route/
formulation of its sourced data. See `stage3-recommendation.md`.
