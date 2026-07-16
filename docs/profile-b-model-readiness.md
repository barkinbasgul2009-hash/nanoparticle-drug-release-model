# Profile B — Model Readiness

Machine-readable: `data/profile-b-model-state-registry.json`. Stage-3 design reference —
**not implemented**.

## P1 (Chen) — proposed model states
| State | Status | Basis |
|---|---|---|
| Donor compartment | directly measurable | applied dose |
| Encapsulated API | calibratable | EE + first-order release |
| Released/dissolved API | calibratable | release + Franz flux (apparent) |
| Tissue-free API | calibratable | cumulative permeation µg/cm² |
| Tissue-bound API | inferable | skin deposition |
| Intracellular API | inferable | HaCaT/B16BL6 uptake (qualitative) |
| Precipitated API | **unsupported** | risk-flag only |
| Aggregated carrier | **unsupported** | no time-series |
| Degraded carrier | **unsupported** | not measured |
| Cleared API | assumed | no local clearance rate |
| Metabolized API | unsupported | not measured |

**Recommended state set:** donor · encapsulated · released/dissolved · tissue-free ·
(optional) tissue-bound · (optional) intracellular. **Excluded:** precipitated (risk-flag
only), aggregated, degraded, metabolized.

## Stability / precipitation model recommendation
- **P1:** stability = type **A/B** (none, or empirical qualitative warning); precipitation =
  type **A/B** (none, or qualitative risk indicator). Types C–F unsupported.
- **P2–P5:** pending full text.

## Stage-3 readiness per preset
| Preset | Stage-3-ready? | Permitted outputs | Disabled outputs |
|---|---|---|---|
| **P1** | Yes (labelled) | release, rat-skin permeation, (optional) uptake compartment | precipitation clock, aggregation, degradation kinetics, human prediction |
| P2–P5 | No | — | all (pending full text) |

**Mandatory P1 labels:** "single study, rat skin (not human), celastrol NLC, surface charge
confounded with lipid identity, not externally validated."
