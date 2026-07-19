# Signal Node/Edge Evidence Matrix (Profile B, Phase 5B.1)

A per-node and per-edge evidence table for the accepted signaling profiles. Every entry
is independently classified. Sources are symbolic keys defined in
`simulator/data/signal-evidence.registry.json`; no DOI is fabricated.

## Reference key legend

| Key | Kind | Verification status |
|---|---|---|
| `chen_2012` | primary source | VERIFIED_IN_FROZEN_PACKAGE (context/uptake only) |
| `canonical_ros_mapk` | canonical relationship | CANONICAL_GENERAL_BIOLOGY |
| `canonical_mapk_nrf2` | canonical relationship | CANONICAL_GENERAL_BIOLOGY |
| `canonical_nrf2_are` | canonical relationship | CANONICAL_GENERAL_BIOLOGY |
| `canonical_nfkb_inflammatory` | canonical relationship | CANONICAL_GENERAL_BIOLOGY |
| `canonical_pi3k_akt_mtor` | canonical relationship | CANONICAL_GENERAL_BIOLOGY |
| `celastrol_ros_literature` | literature prediction | UNVERIFIED_IN_REPO |
| `celastrol_ho1_literature` | literature prediction | UNVERIFIED_IN_REPO |
| `celastrol_nfkb_literature` | literature prediction | UNVERIFIED_IN_REPO |
| `celastrol_pi3k_literature` | literature prediction | UNVERIFIED_IN_REPO |

## Node matrix

| Node id | Profile | Type | Compartment | Evidence level | Refs | Confidence |
|---|---|---|---|---|---|---|
| `h1_exposure` | 5B-H1 | pathway_placeholder | cytoplasm | EXPERIMENTAL_DRUG_CELL_SPECIFIC | chen_2012 | MEDIUM |
| `h1_ros` | 5B-H1 | reactive_species | cytoplasm | LITERATURE_DERIVED_PREDICTION | celastrol_ros_literature | LOW |
| `h1_erk` | 5B-H1 | kinase | cytoplasm | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_ros_mapk | MEDIUM |
| `h1_p38` | 5B-H1 | kinase | cytoplasm | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_ros_mapk | MEDIUM |
| `h1_nrf2` | 5B-H1 | transcription_factor | cytoplasm→nucleus (state) | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_mapk_nrf2 | MEDIUM |
| `h1_are` | 5B-H1 | regulatory_state | nucleus | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_nrf2_are | MEDIUM |
| `h1_ho1` | 5B-H1 | signaling_output | cytoplasm | LITERATURE_DERIVED_PREDICTION | celastrol_ho1_literature | LOW |
| `h2_exposure` | 5B-H2 | pathway_placeholder | cytoplasm | EXPERIMENTAL_DRUG_CELL_SPECIFIC | chen_2012 | MEDIUM |
| `h2_nfkb` | 5B-H2 | transcription_factor | cytoplasm | LITERATURE_DERIVED_PREDICTION | celastrol_nfkb_literature | LOW |
| `h2_inflammatory_output` | 5B-H2 | signaling_output | cytoplasm | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_nfkb_inflammatory | MEDIUM |
| `m1_exposure` | 5B-M1 | pathway_placeholder | cytoplasm | EXPERIMENTAL_DRUG_CELL_SPECIFIC | chen_2012 | MEDIUM |
| `m1_pi3k` | 5B-M1 | kinase | membrane | LITERATURE_DERIVED_PREDICTION | celastrol_pi3k_literature | LOW |
| `m1_akt` | 5B-M1 | kinase | cytoplasm | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_pi3k_akt_mtor | MEDIUM |
| `m1_mtor` | 5B-M1 | kinase | cytoplasm | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_pi3k_akt_mtor | MEDIUM |
| `m1_survival_output` | 5B-M1 | signaling_output | cytoplasm | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_pi3k_akt_mtor | MEDIUM |

## Edge matrix

| Edge id | Profile | Source → Target | Relationship | Evidence level | Refs |
|---|---|---|---|---|---|
| `h1_e_exposure_ros` | 5B-H1 | h1_exposure → h1_ros | activation | LITERATURE_DERIVED_PREDICTION | celastrol_ros_literature |
| `h1_e_ros_erk` | 5B-H1 | h1_ros → h1_erk | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_ros_mapk |
| `h1_e_ros_p38` | 5B-H1 | h1_ros → h1_p38 | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_ros_mapk |
| `h1_e_erk_nrf2` | 5B-H1 | h1_erk → h1_nrf2 | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_mapk_nrf2 |
| `h1_e_p38_nrf2` | 5B-H1 | h1_p38 → h1_nrf2 | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_mapk_nrf2 |
| `h1_e_nrf2_are` | 5B-H1 | h1_nrf2 → h1_are | translocation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_nrf2_are |
| `h1_e_are_ho1` | 5B-H1 | h1_are → h1_ho1 | activation | LITERATURE_DERIVED_PREDICTION | celastrol_ho1_literature |
| `h2_e_exposure_nfkb` | 5B-H2 | h2_exposure → h2_nfkb | inhibition | LITERATURE_DERIVED_PREDICTION | celastrol_nfkb_literature |
| `h2_e_nfkb_inflammatory` | 5B-H2 | h2_nfkb → h2_inflammatory_output | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_nfkb_inflammatory |
| `m1_e_exposure_pi3k` | 5B-M1 | m1_exposure → m1_pi3k | inhibition | LITERATURE_DERIVED_PREDICTION | celastrol_pi3k_literature |
| `m1_e_pi3k_akt` | 5B-M1 | m1_pi3k → m1_akt | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_pi3k_akt_mtor |
| `m1_e_akt_mtor` | 5B-M1 | m1_akt → m1_mtor | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_pi3k_akt_mtor |
| `m1_e_mtor_survival` | 5B-M1 | m1_mtor → m1_survival_output | activation | EXPERIMENTAL_PATHWAY_SPECIFIC | canonical_pi3k_akt_mtor |

## Notes on interpretation

- **Effect strength** is `not_reported` for every edge (no numeric magnitude exists);
  amplification/attenuation would be qualitative (low/moderate/high) if ever asserted.
- **Temporal order** is a schematic ordinal only; `delay_basis` is `NOT_REPORTED`
  throughout (the frozen package reports no signaling timing).
- **Inhibitory entry edges** (`h2_e_exposure_nfkb`, `m1_e_exposure_pi3k`) sit on
  baseline-active nodes: the drug removes/attenuates an otherwise-active pathway.
- **No `EXPERIMENTAL_FORMULATION_SPECIFIC`** entry exists — nothing in the frozen
  package rises to that tier for signaling.
