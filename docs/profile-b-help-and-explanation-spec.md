# Profile B — Help and Explanation System Specification

Machine-readable: `data/profile-b-help-content.json`. **Content architecture only — no UI
implemented in this task.**

## Global help panel (always accessible)
Explains: what Profile B is · celastrol/tripterine · NLC · what a **preset** is and **why
excipients aren't freely combinable** · particle size · PDI · zeta potential ·
cationic/neutral/anionic · encapsulation efficiency · **apparent** release · permeation ·
retention · uptake · precipitation · aggregation · degradation · **what is modeled** ·
**what is visual-only** · evidence limitations (single study, rat skin, no independent
validation, charge/lipid confound).

## Contextual help (per preset / per output)
Each field carries: plain-language name · scientific name · value · unit · role · why it
matters · evidence source · expected effect · limitations · adjustable? · locked? ·
directly-measured / inferred / assumed.

## "Why did the result change?" panel
Explains differences in release / permeation / uptake / lag / stability / precipitation
risk between configurations. **Mandatory wording** where multiple things differ:

> "This difference was observed between formulations that differed in **both** surface
> charge **and** lipid composition; it should not be interpreted as a pure isolated charge
> effect."

The panel must **not** reduce a multi-factor difference to a single parameter, and must not
claim a stability/precipitation difference that was never measured.

## Adjustable vs locked vs informational
- **User-adjustable (after verification):** surface configuration; exposure time and dose
  **within the measured/tested domain**.
- **Preset-locked:** lipids, surfactant (lecithin/TPGS), stabilizer (Pluronic F68),
  manufacturing method, particle-size region.
- **Informational-only:** surrounding cell types, ECM, vasculature, pH/oxygenation.
