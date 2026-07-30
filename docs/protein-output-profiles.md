# Protein Output Profiles (Profile B, Phase 5D)

Accepted, deferred, and rejected protein outputs for the translation runtime.

## Accepted (human HaCaT, all labelled predictions)

| Output | Protein | mRNA | Evidence | Behaviour |
|---|---|---|---|---|
| `out_ho1` | HO-1 | mrna_hmox1 (5C) | LITERATURE_DERIVED_PREDICTION | rises to ~50% (induced, transient, lagged) then turns over |
| `out_nqo1` | NQO1 | mrna_nqo1 (5C) | MECHANISTIC_PREDICTION | rises (canonical Nrf2/ARE target) |
| `out_infl` | INFL_PROTEIN (schematic) | mrna_infl (5C) | MECHANISTIC_PREDICTION | stays low (~25%); suppressed mRNA → reduced protein |

Each output stops at mature protein abundance + turnover. Catalytic function is
`not_evaluated`; HO-1 enzymatic activity, antioxidant phenotype, and ROS reduction are
**excluded** (later phases).

## Not adopted / rejected

- **HO-1 as EXPERIMENTAL** — rejected: no verified in-repo primary HO-1 protein source (see
  the evidence review). Kept as LITERATURE_DERIVED_PREDICTION.
- **ICAM1 as the inflammatory identity** — not adopted: no verified ICAM1 evidence; a
  schematic inflammatory protein is used.
- **NQO1 as EXPERIMENTAL** — rejected: no same-context primary protein evidence; kept as
  MECHANISTIC_PREDICTION.

## Deferred

- **Mouse / rat protein outputs** — deferred to a future phase: Phase 5C provides no
  compatible mRNA, so translation is idle (NOT_REPORTED). No human output is transferred.
- **Signal-node-linked global capacity** (e.g. mTOR suppression → reduced capacity) — the
  architecture supports it, but it is not part of the default human profile (no human mTOR
  node) and is exercised only via a test-only patched registry, labelled prediction.

## Abundance model

Abundance uses the schematic ladder `{0,25,50,75,100}`; production is capped by
`round(maxUnits × mRNA level × gene efficiency)`; turnover ages units to degraded on a
schematic degradation class; conservation `produced = folding+mature+degrading+degraded`
holds. Biological half-life is `NOT_REPORTED`.
