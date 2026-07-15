# User-Control Policy (Stage-3 design)

For each environment/model parameter decide: auto-loaded from organ profile /
scenario-selected / manually adjustable / visible-but-locked / derived / hidden in
simple view / excluded (insufficient evidence).

Scenario presets (only if evidence exists): fasted vs fed stomach; intact vs
hydrated vs compromised skin; healthy vs inflamed tissue; specific tumour
microenvironment. `data/scenario-presets.json` holds the structure (empty until
sourced).

Override handling: when a user changes a profile value the app must show the
original evidence-based value, the user value, the supported range, whether the new
value is interpolation or **extrapolation**, which outputs are affected, and why.
Biologically impossible combinations trigger warnings.

Simple view never hides an important warning; scientific view exposes full
provenance, uncertainty, and diagnostics.
