# Parameter Identifiability Plan (design)

Concern: fitting too many parameters to sparse curves yields non-identifiable
values. For the primary (tumour, radial) model:

- **Likely identifiable from a depth–concentration profile:** an effective
  D/k_e combination (they trade off — the profile shape constrains √(D/k_e)).
- **Weakly identifiable separately:** D and k_e individually without an independent
  time course or clearance measurement → fix one from an independent source or
  report the identifiable combination only.
- **Release parameters:** identifiable from a separate release assay, not from the
  tissue profile — fit release independently, then use it as a fixed input.

Plan: fit release separately; report the identifiable transport group; use priors /
fixed values for non-identifiable parameters with sourced justification; report
parameter correlations. Full plan finalized once data structure is known.
