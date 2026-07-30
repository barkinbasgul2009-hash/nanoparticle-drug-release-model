# Profile-B — Predictive Transport Model Documentation (Phase 3.1)

What "Predictive Mode" is, how it behaves, and the guarantees it makes to the user.

## The three Evidence Levels
| Level | Meaning | Confidence | Animates | Species (this profile) |
|---|---|---|---|---|
| **Experimental** | species-specific experimental permeation data exists for this formulation | `QUALITATIVELY_SUPPORTED` | yes (filled dots) | Rat |
| **Predictive** | no formulation-specific data; based on the species' own anatomy + general passive-transport principles | `MECHANISTIC_TRANSFER` | yes (outlined dots) | Human, Mouse |
| **Unavailable** | no anatomy profile / explicitly unsupported | `NOT_REPORTED` | no (blocked) | (future / none today) |

## What Predictive Mode uses
- **The species' own anatomy profile** (Phase 2.6) — human/mouse have independent layer depth
  bands. The particle pathway (formulation → skin surface → SC → viable epidermis → dermis →
  target) is driven by *that species'* barrier depths.
- **The species' own barrier ordering** — SC rate-limiting → viable epidermis → dermis. This
  ordering is general, species-independent mammalian skin biology (consensus), applied to each
  species; it is **not** copied from rat.
- **Established passive mechanisms** — Brownian (thermal) motion and concentration-driven
  (Fickian) diffusion, slowed by the SC barrier. Identical mechanism set as the experimental
  path; **active transport remains excluded**.
- **Schematic mobility weights** — the same schematic-ordinal barrier ordering (SC 0.15 <
  epidermis 0.5 < dermis 1.0). These are general principles, not rat measurements, and not
  fabricated per-species coefficients.

## What Predictive Mode never does
- Never claims experimental validation for human or mouse.
- Never presents a prediction as an experimental observation.
- Never copies rat's parameters, references, or numbers into human/mouse.
- Never asserts quantitative timing, concentration, diffusion coefficients, or penetration
  depths beyond general biological expectation.
- Never overrides or replaces the experimental (rat) record.

## User-facing messages (from the registry)
- **Rat →** "Evidence Level: Experimental. Based on published topical permeation experiments for
  this formulation (Chen 2012, ex-vivo full-thickness rat skin)."
- **Human →** "Evidence Level: Predictive. This visualization is based on established human skin
  anatomy and general nanoparticle transport principles. Quantitative transport of this specific
  formulation has not yet been experimentally validated in human skin."
- **Mouse →** the equivalent message for mouse skin.

## Visual signalling
The renderer makes the mode unmistakable on screen:
- **Experimental** → **filled** particle dots.
- **Predictive** → **outlined (hollow)** particle dots.
- An `Evidence: Experimental` / `Evidence: Predictive` caption is drawn while particles are
  present, and the information panel shows the full message.

## Behaviour summary
| | Rat | Human | Mouse |
|---|---|---|---|
| Animates | yes | yes | yes |
| Evidence level | Experimental | Predictive | Predictive |
| Confidence | QUALITATIVELY_SUPPORTED | MECHANISTIC_TRANSFER | MECHANISTIC_TRANSFER |
| Permeation references | Chen 2012 | none | none |
| Anatomy source | rat profile | human profile | mouse profile |
| Particle style | filled | outlined | outlined |

## Not modelled (later phases)
Drug release, cellular uptake, endocytosis, payload release, PK, PD, immune response, tumour
killing — unchanged from Phase 3; the terminal state remains `target_region`.
