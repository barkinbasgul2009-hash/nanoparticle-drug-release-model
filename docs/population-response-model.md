# Population Response Model (Phase 6C)

This document specifies the deterministic arithmetic that turns the Phase-6B single-cell
apoptosis trajectory into a normalized population composition. Every quantity is a schematic
`[0,1]` fraction; nothing here is a rate, a cell count, or a measurement.

## State variables (normalized fractions of the whole population)

| Variable | Meaning | Invariant |
|---|---|---|
| `apoptoticFraction` A | committed/executed cells | non-decreasing; `A ≤ susceptible_ceiling` |
| `livingFraction` L | surviving cells | `L = 1 − A` (exact) |
| `adaptedFraction` | living cells that adapted | sub-fraction of L |
| `recoveredFraction` | living cells that recovered from stress | sub-fraction of L |
| `cumulativeApoptosis` | history of apoptosis | `= A` |

**Conservation: `L + A = 1` at every step. `adapted + recovered ≤ L`.**

## Single-cell drivers (read-only)

From the Phase-6B apoptosis engine each step: `P` (apoptoticPressure), `surv`
(survivalPressure), `committed` (bool), `exec` (totalExecutionDrive), and the single-cell FSM
state. `P` is the schematic population stress signal.

## 1. Apoptotic accumulation (monotonic, heterogeneous)

```
deathDrive = committed ? max(P, exec)         // the modal cell has committed
                       : P × pre_commitment_leak   // most-susceptible tail only
dA = apoptosis_conversion_rate × deathDrive × (susceptible_ceiling − A) × dt
A ← min(susceptible_ceiling, A + max(0, dA))
L ← 1 − A
```

Two deliberate properties:
- **Heterogeneity / resistance:** `A` saturates at `susceptible_ceiling` (< 1), so a
  resistant living fraction always persists — the population never fully dies. This is a
  schematic stand-in for cell-to-cell susceptibility differences, not a measured resistant
  fraction.
- **Sub-threshold leak:** before the modal cell commits, only a small `pre_commitment_leak`
  of pressure converts, representing the most-susceptible tail of the population.

Because `dA ≥ 0` and `A` is capped, `A` (and `cumulativeApoptosis`) are **non-decreasing** —
committed apoptotic cells never resurrect.

## 2. Adaptation of surviving cells

When schematic stress sits in a sustained-but-survivable window `[low, high]`, living
non-adapted / non-recovered cells adapt:

```
if low ≤ P ≤ high:
  adapted += adaptation_rate × P × survPool × dt      // survPool = L − adapted − recovered
```

Above the window cells trend to apoptosis; below it there is little to adapt to.

## 3. Recovery of surviving cells

Recovery is **relief-driven**: it fires only while schematic stress is actively falling, so a
never-stressed population does not spuriously "recover" at t=0. Recovery reclassifies
**surviving** cells only — it never lowers `A`.

```
reliefSignal = max(0, prevP − P) × relief_sensitivity
if (state not irreversible) and (not committed) and reliefSignal > 0:
  recovered += recovery_rate × reliefSignal × survPool × dt
```

Recovery is legal only before `apoptosis_dominant` (enforced by the FSM).

## 4. Conservation clamp

`adapted` and `recovered` are sub-fractions of living. As apoptosis grows and `L` shrinks, if
`adapted + recovered` would exceed `L` they are scaled down proportionally. This keeps every
invariant intact (`L + A = 1`, `adapted + recovered ≤ L`) and is honestly schematic.

## 5. Composition → population state

The state target is derived from `A` (and the schematic stress / adaptation signals) against
registry thresholds, then the FSM advances one legal step toward it — see
`population-state-machine.md`.

## Registry knobs (all schematic, in `population-transitions.registry.json`)

`susceptible_ceiling`, `apoptosis_conversion_rate_per_hour`, `pre_commitment_leak`,
`adaptation_rate_per_hour`, `recovery_rate_per_hour`, `adaptive_stress_window {low, high}`,
`relief_sensitivity`, `terminal_plateau_hours`, `dt_hours`. Composition thresholds live in
`population-state.registry.json`. **No value is hardcoded in the engine.**

## Honesty boundaries

No cell counts, densities, cellularity, doubling times, apoptotic index, or biological
percentages. `dt` is a schematic step, not a biological timescale. The model stops at
population composition; nothing downstream of the population is computed.
