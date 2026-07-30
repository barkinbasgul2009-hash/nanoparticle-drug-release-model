# Vascular Validation Report — Phase 7B

## Quality-control gate (all green)

| Check | Result |
|---|---|
| Full simulator suite (`node simulator/tests/run.mjs`) | **2203 passed, 0 failed** (108 new) |
| TypeScript contract (`npx tsc --noEmit`, from `simulator/`) | clean (exit 0) |
| JSON validity (all nine Phase-7B registries) | valid |
| Hidden / zero-width character scan | clean |
| Model-id scan (no model identifier in any pushed artifact) | clean |
| Production diff vs `origin/main` (`web/`, `R/`, `app/`, `tests/`, CI) | **empty** |
| Production tests | 99 JS + 31 R, all green |

## Engine `validate()` checks

`VascularEngine.validate()` verifies, over the registries + active state:

- **required fields**: `profile_id` matches its key; `tumour_model` present; valid evidence level;
- **species / tumour validity**: species ∈ {mouse, human, rat}; unsupported species rejected;
- **no rat fallback**: rat must not have an available vasculature;
- **prediction labelling**: an available vasculature must be a labelled prediction (there is no
  experimental tier); `NOT_REPORTED` / `UNAVAILABLE` profiles must not be available;
- **evidence completeness**: an available profile references existing evidence records;
- **renderer / registry compatibility**: every referenced component state (angiogenic / maturity /
  perfusion / oxygen / nutrient / permeability) exists in its registry;
- **registry-driven support lists**: the chosen `angiogenic_state` / `perfusion` / `oxygen_supply`
  is in the profile's `supported_*` list;
- **formulation compatibility**: the profile formulation is in `supported_formulations`;
- **consistency**: oxygen supply and perfusion are coherent (both blood-flow-derived; rejects
  impossible combinations such as `very_high` oxygen + `very_low` perfusion);
- **scope**: no forbidden downstream concept named in a profile field; delivery modifier `[0,1]`.

## What the test suite verifies (`vascular.test.mjs`, 108 assertions)

**Evidence vocabulary** — 8 tiers, no experimental tier; prediction / transfer / active
classifiers correct.

**Registry integrity + profile loading** — mouse / human = `MECHANISTIC_PREDICTION`, rat =
`NOT_REPORTED`; human predictive-exploratory + not shown by default; component registries have the
expected state counts.

**Vascular field** — mouse tumour paradox (highly vascularized + immature + poorly perfused +
leaky); delivery modifier bounded `[floor,1]`; delivery state reflects the mixed vasculature.

**STOP boundary** — `modifiesDelivery true`, `modifiesSignalling / inducesApoptosis / remodels
false`; immune / VEGF / HIF / metastasis `NOT_EVALUATED`.

**Integration with Phase 7A** — combined delivery × penetration ≤ delivery modifier; without a
microenvironment engine, combined == delivery modifier.

**Species isolation** — human delivery modifier and component choices are **distinct** from mouse
(not copied); rat idle / `NOT_REPORTED` with no timeline; human carries the non-clinical warning.

**Transitions + monotonicity** — perfusion / permeability / vascularization / maturity / oxygen
transitions all monotonic (engine + registry).

**Deterministic replay** — frame / timeline / stats identical across runs; restart reproduces the
field; the static field does not drift across steps.

**Timeline** — all eight evaluation milestones present and ordered.

**Validation negatives** — experimental level; rat fallback; inconsistent oxygen/perfusion;
unsupported component state; missing evidence; unsupported species; state-not-in-supported-list —
all caught.

**Controls** — `setFormulation` accepts supported / rejects unsupported; unsupported tumour model
→ idle.

**Prediction + evidence integrity** — prediction records carry rationale / confidence /
`quantitative_status = NOT_REPORTED` / `may_show_by_default`; every evidence citation is
`NOT_REPORTED`-qualitative.

**Full-app integration** — `app.vascular` exposed; renderer produces a vessel-field + delivery
frame flagging the prediction; the evidence panel shows an independent **Tumor Vasculature &
Angiogenesis** section with prediction status + `modifiesSignalling: false` + excluded biology and
immune / VEGF / HIF `NOT_EVALUATED`; earlier phases unchanged; rat idle via the full app.

## Previous-phase regression
Phases 1–7A unchanged: the vascular layer is additive and advisory; the full pre-7B suite still
passes as part of the 2203 total.

## Scope compliance
- Advisory modulator only: modifies delivery / oxygen / nutrient, never signals / apoptosis /
  remodels / replaces.
- No immune / macrophage / NK / T / B / fibroblast / CAF / ECM-remodeling / VEGF / HIF / lymphatic
  / metastasis / invasion / drug-clearance field anywhere.
- No fabricated blood flow / vessel count / pO₂ / vascular diameter / perfusion rate (all
  `NOT_REPORTED`).
- No hardcoded scientific values in engine source — all behaviour from the registries.
