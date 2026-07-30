# Apoptosis Intervention Model (Phase 6B)

Phase 6B ships four interventions. Each is **target-isolated** (acts on exactly one node) and
**timing-sensitive** (its effect depends on whether it is applied before or after the
irreversible commitment gate). Interventions are defined in
`apoptosis-interventions.registry.json`, per profile, and toggled at runtime with
`app.apoptosis.setIntervention(type, active)`.

## The four interventions

| Intervention | Target node | Acts | Effect | Strength (default line) |
|---|---|---|---|---|
| **ROS scavenger** | `ms_oxidative_stress` (upstream, 6A) | before commitment | reduces oxidative stress input → lowers apoptotic pressure | strong (0.8) |
| **PI3K activator** | `ms_survival_signaling` (upstream, 6A) | before commitment | restores survival signaling → dampens pressure accumulation | strong (0.8), **B16-F10 only** |
| **Caspase inhibitor** | `caspase_branch` (execution) | during execution | partial — caps PARP at `partially_cleaved`, scales caspase contribution down | partial (0.5) |
| **AIF knockdown** | `aif_branch` (execution) | during execution | strong — silences the AIF branch (`suppressed_by_knockdown`, contribution 0) | strong (0.8) for B16BL6; partial for B16-F10 |

Strength classes come from `strength_class_values = { partial: 0.5, strong: 0.8, complete:
1.0 }`. The engine reads these; it never hardcodes a numeric strength.

## Timing sensitivity: before vs after commitment

The commitment gate is the pivot.

### Upstream interventions can *prevent* commitment (only before the gate)
- **ROS scavenger** multiplies the oxidative-stress input by `(1 − strength)`. With the
  dominant oxidative driver removed, the effective stress falls below the eligibility
  threshold, apoptotic pressure relieves instead of accumulating, and the cell never reaches
  the commitment gate. Applied *after* commitment it does nothing — the cell is already
  irreversible.
- **PI3K activator** (B16-F10) restores survival signaling toward 1. Because pressure
  *accumulation* is gated on `stressTarget − survival_accumulation_penalty × survival`,
  restored survival drops the effective stress below eligibility and the cell relieves
  pressure rather than committing. This models the Akt-style survival hold-off at the
  accumulation stage — not as a cosmetic post-hoc subtraction. It is present **only** on the
  B16-F10 profile, matching where the survival/PI3K axis is an experimental record.

### Execution interventions can only *attenuate* (never reverse)
- **Caspase inhibitor** (partial): the cell still commits (the AIF branch remains), but the
  caspase branch is attenuated and PARP never fully cleaves.
- **AIF knockdown** (strong): the cell still commits, but the dominant AIF branch is silenced,
  so the total execution drive drops substantially. Applied to the dominant branch, this is
  the single most effective execution-stage attenuator — yet it cannot undo the irreversible
  commitment.

## Target isolation

Each intervention touches exactly its declared target and nothing else. Tests verify:
- the caspase inhibitor does not alter the AIF branch, and the AIF knockdown does not alter
  the caspase branch;
- the ROS scavenger and PI3K activator act only on their upstream 6A input, not on the
  execution branches;
- toggling one intervention leaves the others inert.

## Cell-model isolation of interventions

Interventions are declared **per profile**. The PI3K activator exists only on B16-F10; B16 and
B16BL6 do not carry it. This prevents an intervention that is experimentally grounded in one
cell model from silently appearing in another. Switching cell model (`setCellModel`) rebuilds
the intervention set from that profile's registry entry.

## Honesty boundaries
Intervention strengths are schematic ordinal classes, not measured inhibition constants, Ki
values, knockdown efficiencies, or dose levels. No intervention produces a numeric survival
percentage or a population effect — the outcome is always the single cell's FSM state and its
schematic execution drive.
