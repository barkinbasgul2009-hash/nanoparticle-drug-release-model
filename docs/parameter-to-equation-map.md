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
