# Microenvironment Registry Guide (Phase 7A)

Phase 7A is fully registry-driven — no passive-environment behaviour is hardcoded in engine
source. Nine registries under `simulator/data/`, referenced via `config.tmeSources` (a key
distinct from the frozen Phase-4B `microenvironmentSources`).

## The nine registries

| File | Holds |
|---|---|
| `microenvironment-context.registry.json` | per-species/tumour-model profiles (which component variants apply + evidence) |
| `ecm.registry.json` | collagen / hyaluronic acid / proteoglycan / extracellular fluid variants + composite weights |
| `diffusion.registry.json` | interstitial-space variants (available volume / path length / mobility / diffusion resistance) |
| `mechanical.registry.json` | ordinal barrier states + schematic scores |
| `oxygen.registry.json` | qualitative oxygen states + availability |
| `hypoxia.registry.json` | hypoxia states + penetration / effectiveness / stress-susceptibility modifiers |
| `penetration.registry.json` | combination weights + penetration floor + microenvironment-state thresholds + excluded processes |
| `microenvironment-evidence.registry.json` | qualitative evidence records (all `citation: NOT_REPORTED`) |
| `microenvironment-prediction.registry.json` | labelled prediction records |

## Profile fields (`microenvironment-context`)

`profile_id`, `species`, `tumour_model`, `drug`, `formulation`, `components` (a map naming the
chosen variant per component: `collagen` / `hyaluronic_acid` / `proteoglycan` /
`extracellular_fluid` / `interstitial` / `mechanical` / `oxygen` / `hypoxia`), `supported_ecm` /
`supported_hypoxia` / `supported_diffusion` / `supported_predictions` / `supported_formulations`,
`microenvironment_available`, `confidence`, `uncertainty`, `evidence_level`, `prediction_level`,
`evidence_refs`, `limitations`, `excluded_processes`, plus optional
`predictive_exploratory` / `default_shown` / `human_translation_warning` / `reason`.

## Adding or editing a context

1. Choose an existing variant key for each component (the validator rejects unsupported
   variants). To add a new variant, add it to the relevant component registry first.
2. Keep oxygen and hypoxia **coherent** (the validator rejects e.g. `normoxic` oxygen with
   `severe` hypoxia — indices ≥ 2 apart).
3. An **available** profile must be a labelled prediction (never experimental) and must
   reference existing evidence records; `NOT_REPORTED` / `UNAVAILABLE` profiles must not be
   available.
4. Keep species isolated — do not copy another species' component values; give each its own.
5. Run `node simulator/tests/run.mjs` and `MicroenvironmentEngine.validate()`.

## Ordinal → schematic values

Each component registry stores a schematic 0–1 value alongside its ordinal label (e.g. collagen
`dense.density = 0.75`, mechanical `highly_dense.score = 0.9`). The engine reads these directly;
the `penetration.registry.json` combination weights + thresholds turn them into a single
penetration modifier and microenvironment state. Tune behaviour by editing these registry values
— never the engine.
