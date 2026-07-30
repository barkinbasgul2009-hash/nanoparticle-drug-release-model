# Profile B — Scientific Animation Specification

Machine-readable: `data/profile-b-animation-events.json`. **This defines the spec only —
the production animation is NOT implemented in this task.**

## Confidence taxonomy
`DIRECTLY_OBSERVED` · `QUANTITATIVELY_MODELED` · `QUALITATIVELY_SUPPORTED` ·
`CONTEXTUAL_VISUAL` · `UNSUPPORTED_DO_NOT_SHOW`.

## Scene sequence (anchor preset P1)
| # | Scene | Confidence |
|---|---|---|
| 1 | Formulation at skin surface | CONTEXTUAL_VISUAL |
| 2 | Celastrol release from NLC | QUANTITATIVELY_MODELED (first-order, **apparent**) |
| 3 | Contact with stratum corneum | CONTEXTUAL_VISUAL |
| 4 | Movement through skin layers | QUANTITATIVELY_MODELED (Franz flux/Kp/lag, **rat**) |
| 5 | Distribution toward melanoma | QUALITATIVELY_SUPPORTED |
| 6 | Interaction with ECM | CONTEXTUAL_VISUAL |
| 7 | Encounter melanoma cells | QUALITATIVELY_SUPPORTED |
| 8 | Uptake / binding | QUALITATIVELY_SUPPORTED (charge-dependent) |
| 9 | Intracellular localization | CONTEXTUAL_VISUAL |
| 10 | Pharmacodynamic outcome | QUALITATIVELY_SUPPORTED (separate timeline) |
| 11 | Clearance / degradation / aggregation / precipitation | **UNSUPPORTED_DO_NOT_SHOW** as deterministic |

## Supported vs unsupported animation events
- **Supported (show):** encapsulated→released transition (release curve); skin-layer
  transport; charge-configuration visual difference (with confound caption); melanoma-cell
  uptake (qualitative); a **precipitation/degradation RISK cue** for released drug.
- **Unsupported (do NOT show as timed events):** nanoparticle aggregation, particle-size
  growth, carrier breakdown, a precise precipitation clock, sub-cellular trafficking detail.

## Formulation-specific visuals
Distinguish cationic/neutral/anionic (with the lipid-confound caption); show size as one
**~85–90 nm region** (no 84.5-vs-90.2 animation); distinguish encapsulated vs released vs
tissue-bound API. Aggregated/precipitated states appear **only** as labelled qualitative
risk, never deterministic.

## Time mapping
Release (min–h) → seconds; permeation (up to 24 h) → short sequence; pharmacodynamics
(days) → **separate** outcome timeline. Never imply all processes share one rate.

## Global rule
No visual may contradict the scientific state. Anything `UNSUPPORTED_DO_NOT_SHOW` is absent
or shown only as an explicitly-labelled qualitative risk.
