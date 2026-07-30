# Uncertainty Analysis (plan)

Status: plan only (no biological parameters to propagate yet).

## Uncertainty sources to separate
measurement · inter-study · biological · formulation · parameter · structural
model · numerical · extrapolation.

## Planned methods (used only when supported)
local + global sensitivity; Monte Carlo over documented parameter ranges;
bootstrap / profile-likelihood for fitted parameters; report intervals.

## Display rule
Uncertainty bands shown in **both** the graph and the animation. A visually sharp
penetration front must **not** be shown when the underlying prediction is highly
uncertain — the front is rendered with an uncertainty envelope for qualified
profiles.

---

## Stage-2 update
Uncertainty sources are enumerated in `sensitivity-analysis-plan.md`. Under the
Stage-2 access block, no parameter distributions could be sourced, so quantitative
uncertainty propagation is deferred. The overriding uncertainty at this stage is
**epistemic**: model-critical values are unverified because full texts are
inaccessible (`full-text-access-log.md`). Any Stage-3 profile must display: sourced
central value + range, species/route/formulation applicability, extrapolation
warnings, and evidence grade. A sharp penetration front must not be drawn when the
underlying prediction is highly uncertain. Machine-readable:
`data/uncertainty-source-registry.json`.
