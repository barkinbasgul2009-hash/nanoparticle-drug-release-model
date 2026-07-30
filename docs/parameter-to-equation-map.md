# Parameter-to-Equation Map (design)

Only parameters that appear in a model term may become controls.

| Parameter | Symbol | Unit | Equation term | State affected | Direction of effect | Range | Source status |
|---|---|---|---|---|---|---|---|
| Tissue diffusivity | D | length²·time⁻¹ | D∇²C | C(x,t) | ↑D → faster/deeper spread | pending source | pending |
| Local clearance | k_e | time⁻¹ | −k_e·C | C(x,t) | ↑k_e → shallower, lower C | pending source | pending |
| Release rate | Q(t) | mass·time⁻¹ | inner BC | source strength | ↑Q → higher surface C | pending source | pending |
| Interface partition | K | – | Robin BC | boundary C | context-dependent | pending source | pending |
| Layer thickness (skin) | L_i | length | domain length | profile shape | ↑L → longer path, more lag | pending source | pending |
| Penetration threshold | θ | – | endpoint def. | reported depth | ↑θ → smaller reported depth | 0–1 (user) | design |

"Direction of effect" statements are qualitative and physics-based; quantitative
magnitudes require sourced parameters. Machine-readable:
`data/parameter-mechanism-map.json`. See also `mechanism-influence-map.md`.

---

## Stage-2 CONTINUATION — sourced values for the skin sub-model
For a multilayer-slab skin model, the SC layer's transport is now parameterizable
(small molecule): partition K_SC/v (dimensionless) and the lumped diffusion term
D_SC/H²_SC (h⁻¹) — Rothe 2017, Table 2. Note D_SC/H²_SC already folds in SC
thickness; to recover an absolute D (cm²/s) an H_SC value is required (not in the
provided sources). These enter the SC-layer diffusion term and the SC/epidermis
partition interface. Values are small-molecule; a nanoparticle profile needs an
NP-formulation source.
