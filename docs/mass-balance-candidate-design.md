# Mass-Balance Candidate Design (design dossier)

Stage 2 defines the correct balance structure; it does not implement a solver. The
existing "tissue drug mass" readout is a **diagnostic**, not a closed balance.

## Target balance
M_initial = M_carrier + M_donor_free + M_interface + M_tissue + M_bound
          + M_cleared + M_degraded + M_metabolized + M_out + M_residual

| Term | Meaning | Unit | Status | Data source needed | Necessary? |
|---|---|---|---|---|---|
| M_carrier | API still in nanoparticle/depot | mass | state | release data | yes |
| M_donor_free | free API in donor/interface | mass | state | release/partition | yes (flux coupling) |
| M_interface | API at boundary | mass | state | interface model | if Robin BC |
| M_tissue | ∫C dV in tissue | mass | state | D, geometry | yes |
| M_bound | tissue-bound API | mass | state | tissue binding | candidate-dependent |
| M_cleared | first-order clearance loss | mass | flux integral | k_e | yes (tumour/skin dermis) |
| M_degraded | chemical/enzymatic loss | mass | flux integral | degradation data | candidate-dependent |
| M_metabolized | metabolism | mass | flux integral | metabolism data | skin/GI relevant |
| M_out | flux across outer boundary | mass | flux integral | BC | yes |
| M_residual | numerical closure error | mass | diagnostic | — | yes (must be small) |

Machine-readable: `data/mass-balance-state-registry.json`. A closed balance
(|M_residual|/M_initial below tolerance) is a Stage-3 numerical-verification target.
