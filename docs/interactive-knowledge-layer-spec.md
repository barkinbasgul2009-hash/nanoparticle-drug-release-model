# Interactive Knowledge Layer — Specification (Stage-3 design)

The eventual app must explain, not just animate. For every user-facing parameter or
environment variable, an **information card** is rendered with this schema:

- display_name, scientific_name, plain_language_explanation
- current_value, unit, supported_range
- why_it_matters, mechanism_of_action
- effect_if_increased, effect_if_decreased (qualitative; sourced where possible)
- known_interactions, tissue_context, route_context, species_context
- evidence_grade, source_count, primary_citations
- uncertainty, adjustable | locked | derived | informational
- extrapolation_warning, limitation_note

Rules:
- No invented causal explanations. If direction of effect is context-dependent, the
  card says so explicitly.
- Cards for quantitative parameters remain **stubs** until sourced (fields set to
  `pending full-text`), never filled with guessed numbers.

Example cards to build (content pending sources): tissue diffusivity, local
clearance, release rate/t50, interface partition, layer thickness, penetration
threshold, particle diameter (informational), zeta potential (informational).

Machine-readable card store: `data/parameter-explanations.json` and
`data/environment-information-cards.json`.
