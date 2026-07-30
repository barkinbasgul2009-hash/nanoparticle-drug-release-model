# Mechanism Influence Map (design)

Qualitative, physics-based influence chains for the future "why did it change?"
layer. Magnitudes are not asserted (pending sourced parameters).

- ↑ shell thickness → longer diffusion path in carrier → slower release Q(t) →
  lower boundary source → lower/shallower tissue C.
- ↑ tissue diffusivity D → faster radial spread → deeper penetration front, lower
  peak near source.
- ↑ local clearance k_e → more removal per unit time → shallower front, lower AUC.
- ↑ interface partition favouring tissue → more transfer at boundary → higher
  tissue C (context-dependent).
- ↑ particle size → (often) slower/altered release and, for carriers, reduced
  penetration — direction can be system-dependent; flagged where uncertain.

Context-dependent relationships are labelled as such; the engine must not assert a
fixed direction where evidence is mixed. Machine-readable statements:
`data/parameter-effect-statements.json`.
