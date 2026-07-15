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
