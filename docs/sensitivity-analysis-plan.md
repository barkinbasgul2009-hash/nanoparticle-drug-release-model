# Sensitivity Analysis Plan (design)

Separate uncertainty sources: measurement, biological, formulation, environmental,
inter-study, parameter, structural, numerical, digitization, extrapolation.

Recommended methods by stage:
- **Screening:** local one-at-a-time + Morris screening over sourced ranges.
- **If justified by data richness:** variance-based (Sobol) global sensitivity;
  Monte Carlo over parameter distributions; bootstrap / profile likelihood for
  fitted parameters.
Only methods appropriate to the (currently sparse) evidence will be used; Sobol/
Bayesian are deferred until parameter distributions are sourced.

Where uncertainty appears in the UI: graph bands, animation front envelope, evidence
badges, parameter tooltips, extrapolation warnings. Machine-readable source list:
`data/uncertainty-source-registry.json`.
