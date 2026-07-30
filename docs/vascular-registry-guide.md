# Vascular Registry Guide (Phase 7B)

Phase 7B is fully registry-driven — no vascular behaviour is hardcoded in engine source. Nine
registries under `simulator/data/`, referenced via `config.vascularSources`.

## The nine registries

| File | Holds |
|---|---|
| `vascular-context.registry.json` | per-species/tumour-model profiles (which component states apply + evidence) |
| `angiogenesis.registry.json` | angiogenic states (density / branching / organization) + vessel maturity (delivery efficiency) |
| `perfusion.registry.json` | ordinal perfusion states + efficiency |
| `oxygen-supply.registry.json` | vascular oxygen supply states (independent from the ECM oxygen field) |
| `nutrient.registry.json` | ordinal nutrient states + availability |
| `permeability.registry.json` | ordinal permeability states (abstracted leakiness) |
| `delivery.registry.json` | combination weights + delivery floor + delivery-state thresholds + excluded processes |
| `vascular-evidence.registry.json` | qualitative evidence records (all `citation: NOT_REPORTED`) |
| `vascular-prediction.registry.json` | labelled prediction records |

## Profile fields (`vascular-context`)

`profile_id`, `species`, `tumour_model`, `drug`, `formulation`, `components` (a map naming the
chosen state per component: `angiogenic_state` / `vessel_maturity` / `perfusion` /
`oxygen_supply` / `nutrient` / `permeability`), `supported_vascular_state` / `supported_perfusion`
/ `supported_oxygen` / `supported_predictions` / `supported_formulations`, `vascular_available`,
`confidence`, `uncertainty`, `evidence_level`, `prediction_level`, `evidence_refs`, `limitations`,
`excluded_processes`, plus optional `predictive_exploratory` / `default_shown` /
`human_translation_warning` / `reason`.

## Adding or editing a context

1. Choose an existing state key for each component (the validator rejects unsupported states). To
   add a new state, add it to the relevant component registry first.
2. Keep the chosen component **inside** the profile's supported list (the validator checks
   `angiogenic_state ∈ supported_vascular_state`, `perfusion ∈ supported_perfusion`,
   `oxygen_supply ∈ supported_oxygen`).
3. Keep oxygen supply and perfusion **coherent** (both are blood-flow-derived; the validator
   rejects e.g. `very_high` oxygen with `very_low` perfusion — indices ≥ 3 apart).
4. An **available** profile must be a labelled prediction (never experimental) and must reference
   existing evidence records; `NOT_REPORTED` / `UNAVAILABLE` profiles must not be available; rat
   must never be available (no fallback).
5. Keep species isolated — do not copy another species' component states; give each its own.
6. Run `node simulator/tests/run.mjs` and `VascularEngine.validate()`.

## Ordinal → schematic values

Each component registry stores a schematic 0–1 value alongside its ordinal label (e.g. perfusion
`high.efficiency = 0.8`, permeability `very_high.value = 0.9`). The engine reads these directly;
`delivery.registry.json` combination weights + thresholds turn them into a single delivery
modifier and delivery state. Tune behaviour by editing these registry values — never the engine.
