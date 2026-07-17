# Profile B — Help and Explanation System (biological layer)

Design only. Extends `docs/profile-b-help-and-explanation-spec.md` +
`data/profile-b-help-content.json` with the biological-scene explanation architecture.

## Global help button (persistent, top of simulator)
On open/hover it states, for the current scene:
- what the user is seeing;
- **which biological model is active** (e.g. "ex vivo rat skin", "in vitro HaCaT", "in vitro
  B16BL6 murine melanoma", "in vivo C57BL/6 mouse");
- species · tissue · route;
- evidence level (confidence badge);
- current animation **scale** (L1–L6);
- what is directly measured vs inferred vs omitted.

## Contextual help (every important element)
hover / tap / label / glossary / evidence note — each carries: plain-language name,
scientific name, role, confidence label, and a citation into
`data/profile-b-evidence-package.json`.

## "Why did the result change?" panel
On a parameter change it states which parameter changed, what evidence supports the visual
change, whether the change is quantitative or only qualitative, and whether another variable
was **confounded**. Mandatory wording for surface charge:
> "This difference was observed between formulations that differed in **both** surface charge
> **and** lipid composition; it should not be interpreted as a pure isolated charge effect."

## "What is NOT shown?" panel
A persistent, collapsible tray listing, for the active preset: unsupported events; unavailable
biological processes (systemic PK, time-resolved stability); omitted cell types; and any
model mismatch (rat skin ≠ human; B16BL6 ≠ human melanoma). Populated from
`data/profile-b-biological-exclusions.json`.

## Model-mixing guard (specific to this phase)
Because B1 spans four experimental models, every scene transition that changes the model
displays a full-width label banner (e.g. `EX VIVO RAT SKIN MODEL` → `IN VITRO HUMAN
KERATINOCYTE MODEL`) so the user never mistakes them for one specimen.
