# Profile-B — Biological Transport Documentation (Phase 3)

What biological process the engine represents, and — just as importantly — what it does **not**.

## The process modelled
Passive **topical permeation** of a surface-charged tripterine-loaded **nanostructured lipid
carrier (NLC)** applied to the skin, moving from the applied formulation into the skin tissue:

```
Topical Formulation  →  Skin Surface  →  Stratum Corneum  →  Viable Epidermis  →  Dermis  →  Target Region (skin)
   (donor)              (interface)      (rate-limiting)      (living cells)       (connective)   (topical target)
```

There is **no systemic stage** — topical B1 has no blood circulation, lymphatics, or distant
organ. The "target region" is the skin (dermis).

## The biological state machine
Each state and each transition is defined in `simulator/data/transport.registry.json` with an
evidence descriptor (references + confidence + notes):

| State | Anatomy layer | Meaning |
|---|---|---|
| Topical Formulation | — (donor) | applied NLC dispersion on the skin |
| Skin Surface | skin_surface | air/skin interface, first contact |
| Stratum Corneum | stratum_corneum | outermost keratinised **rate-limiting** barrier |
| Viable Epidermis | viable_epidermis | living epidermal layers; mobility rises past the SC |
| Dermis | dermis | connective tissue; least resistant |
| Target Region | dermis | arrival in the target skin tissue |

Transitions are a single **linear, fully-cited chain** (validated in tests). The stratum-corneum
crossing is the **rate-limiting** step — the biological reason topical delivery is hard and why
Chen's study pursued an *enhancing* carrier.

## Transport mechanisms (passive only)
| Mechanism | Rationale | Confidence |
|---|---|---|
| Contact / deposition | topical dosing deposits carrier on the surface | QUALITATIVELY_SUPPORTED |
| Brownian (thermal) motion | ~85–90 nm carriers thermally diffuse | MECHANISTIC_TRANSFER |
| Concentration-driven (Fickian) drift | net inward movement down the gradient; supported by the 1–12 h permeation series | QUALITATIVELY_SUPPORTED |
| Stratum-corneum barrier slowing | SC is the principal permeation barrier (consensus) | QUALITATIVELY_SUPPORTED |
| Post-SC mobility increase | viable epidermis/dermis resist a small carrier less | QUALITATIVELY_SUPPORTED |
| ~~Active / carrier-mediated transport~~ | **EXCLUDED** — not applicable to passive topical permeation | NOT_APPLICABLE |

## Barriers and movement modifiers
Movement is modified per layer by a **relative mobility** (0 = impermeable, 1 = free). These are
**schematic ordinal** values: only the *ordering* is evidence-based; the magnitudes are not
measured diffusion coefficients (those are NOT REPORTED). Each modifier has a biological
rationale — none is arbitrary.

| Layer | Relative mobility | Biological rationale |
|---|---|---|
| Stratum corneum | 0.15 (lowest) | dominant permeation barrier → rate-limiting |
| Viable epidermis | 0.5 | living cell layer, intermediate resistance |
| Dermis | 1.0 (highest) | hydrated, loose connective tissue, least resistant |

## Species behaviour (evidence-gated, no fallback)
| Species | Transport | Basis |
|---|---|---|
| **Rat** | **animated** | Chen 2012 ex-vivo full-thickness abdominal rat skin permeation (1–12 h) |
| Human | **blocked (NOT REPORTED)** | HaCaT *cellular uptake* only — not skin permeation |
| Mouse | **blocked (NOT REPORTED)** | C57BL/6 used for melanoma *pharmacodynamics* — not permeation |

Human/mouse do not inherit rat's numbers; the engine refuses to animate them and shows why.

## Explicitly NOT modelled (later phases)
Drug release · payload diffusion · cell entry · endocytosis · receptor binding · lysosomes ·
nucleus · pharmacokinetics · pharmacodynamics · efficacy · apoptosis · tumour response · immune
response · blood circulation · lymphatics · metabolism. Listed in
`integrity.excluded_downstream` and enforced by the terminal state being `target_region`.

## Honesty flags carried in the registry
- `intact_np_vs_drug` — Chen measured **drug** permeation + depth distribution; whether the
  **intact NLC** reaches the deep dermis is NOT REPORTED (lipid carriers often act within the
  SC). The animation depicts carrier transport **schematically**, not as measured intact-NP
  arrival.
- `schematic_timing` — timing uses the reported 1–12 h window + barrier ordering; no flux/lag/D
  numbers are taken from the frozen package or invented.
- `not_to_scale` / `no_active_transport` — retained throughout.
