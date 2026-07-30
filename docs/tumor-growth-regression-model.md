# Tumor Growth / Regression Model (Phase 6D)

This document specifies the deterministic arithmetic that turns the Phase-6C population
composition into a schematic normalized tumour burden and a treatment-response trajectory.
Every quantity is a schematic normalized value; nothing here is a growth constant, kill
coefficient, doubling time, or dose-response parameter.

## Normalized burden

Relative tumour burden ∈ `[lower_bound, upper_bound]` (0.0 … 1.5), baseline **1.0** as a
simulation reference only. It is **not** a real tumour volume / diameter / weight / cellularity
/ RECIST measurement — the UI states this. Partition (schematic):

- `normalizedViableBurden = burden × living`
- `normalizedApoptoticBurden = burden × apoptotic`  (viable + apoptotic = burden, since the
  population's `living + apoptotic = 1`)
- `normalizedTerminalBurden = burden × apoptotic` when the population is terminal, else 0
  (a display subset ≤ apoptotic).

## Baseline growth model

The Profile-B default growth model is **ordinal / normalized schematic** — no mathematical
growth curve (exponential / logistic / Gompertz) is activated because no verified quantitative
tumour curves are extracted. The architecture for those models exists in
`tumor-model.registry.json` but every one is `active: false` with `parameters_status:
NOT_REPORTED`; activating one predictively would require an explicit label, exposed assumptions
and uncertainty, and a user disable — and it would never be called experimentally validated.

## Two distinct treatment paths (never collapsed)

Treatment enters through **two** separate paths:

1. **Growth suppression** (e.g. PI3K/AKT/mTOR-style): reduces growth pressure.
2. **Increased loss** (apoptosis accumulation): raises loss pressure.

### Growth pressure

```
viability          = treated ? population_living_fraction : 1.0   // untreated control is fully viable
resourceLimitation = (upper_bound - burden) / upper_bound         // logistic damping
growthPressure     = baseline_growth × cyclingCapacity × viability × (1 - treatmentSuppression) × resourceLimitation
```

The living fraction feeds *viability* but is a **distinct** abstraction from proliferation — it
is one input among several, not the growth rate. The untreated / vehicle control grows as a
fully-viable reference; under treatment the actual population living fraction drives capacity.

### Loss pressure

```
apoptoticLoss = treated ? loss_apoptotic_coupling × population_apoptotic_fraction : 0
lossPressure  = apoptoticLoss + treatmentInducedLoss × loss_induction_scale
```

Population apoptosis couples to loss **only under treatment** (the untreated control grows
regardless of the in-vitro apoptosis signal). The ordinal formulation loss class is scaled into
the schematic pressure regime so regression is **gradual** (never an instant disappearance).
Loss represents *reduced viable burden*, **not** physical or immune clearance.

### Net pressure + burden update

```
net_growth_pressure = growth_pressure - loss_pressure          // "Schematic net tumour-growth pressure"
burden += net_growth_pressure × burden_step_scale × dt
burden  = clamp(burden, lower_bound, upper_bound)
```

The equation is **schematic** and labelled as such; it is not a measured biological equation.

## Regression

Regression occurs only when loss pressure exceeds growth pressure and persists, the profile
permits it, and the burden is above the lower bound. It is **gradual** (bounded per-step change)
— no instant disappearance, no negative burden. As the burden reaches the
`minimal_residual_burden_level`, net loss is held at zero so the burden plateaus at a **minimal
residual** (a resistant residual population), preferred over literal zero. Reaching a low burden
is **never** a clinical cure.

## Rebound (prediction-ready)

When treatment stops, `treatmentSuppression` and `treatmentInducedLoss` **decay** toward zero,
growth pressure recovers (viability returns to the fully-viable control reference), and a
surviving viable fraction can drive renewed growth (`rebound_possible → rebound_in_progress`).
Rebound is a `MECHANISTIC_PREDICTION`; no genetic resistance or clonal evolution is modelled.

## Cell-cycle contribution

Phase 6D accepts only a schematic `cyclingCapacity` / growth-readiness modifier as an upstream
input (relevant to the B16-F10 cell-cycle evidence). It does **not** implement G1/S/G2/M
populations or a cell-cycle engine.

## Honesty boundaries

No tumour volume / diameter / weight, doubling time, regression half-time, growth constant,
Gompertz / logistic parameter, kill coefficient, PD rate constant, dose-response, % TGI,
survival, or recurrence probability is ever produced. Timing is schematic simulation steps, not
a biological timescale. The model stops at the response trajectory.
