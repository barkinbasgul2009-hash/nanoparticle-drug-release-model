# Microenvironment Validation Report — Phase 7A

## Quality-control gate (all green)

| Check | Result |
|---|---|
| Full simulator suite (`node simulator/tests/run.mjs`) | **2095 passed, 0 failed** (110 new) |
| TypeScript contract (`npx tsc --noEmit`, from `simulator/`) | clean (exit 0) |
| JSON validity (all nine Phase-7A registries) | valid |
| Hidden / zero-width character scan | clean |
| Model-id scan (no model identifier in any pushed artifact) | clean |
| Production diff vs `origin/main` (`web/`, `R/`, `app/`, `tests/`, CI) | **empty** |
| Production tests | 99 JS + 31 R, all green |

## Engine `validate()` checks

`MicroenvironmentEngine.validate()` verifies, over the registries + active state:

- **required fields**: `profile_id` matches its key; `tumour_model` present;
- **species / tumour validity**: species ∈ {mouse, human, rat}; unsupported species rejected;
- **prediction labelling**: an available microenvironment must be a labelled prediction (there is
  no experimental tier); `NOT_REPORTED` / `UNAVAILABLE` profiles must not be available;
- **evidence completeness**: an available profile references existing evidence records;
- **renderer / registry compatibility**: every referenced component variant (collagen /
  interstitial / mechanical / oxygen / hypoxia) exists in its registry;
- **consistency**: oxygen and hypoxia states are coherent (rejects impossible combinations such
  as `normoxic` + `severe`, indices ≥ 2 apart); a dense ECM must not resolve to a `permissive`
  microenvironment; the penetration modifier stays in `[0,1]`;
- **scope**: no forbidden downstream concept named in a profile field.

## What the test suite verifies (`microenvironment.test.mjs`, 110 assertions)

**Evidence vocabulary** — 8 tiers, no experimental tier; prediction / transfer / active
classifiers correct.

**Registry integrity + profile loading** — mouse / human = `MECHANISTIC_PREDICTION`, rat =
`NOT_REPORTED`; human predictive-exploratory + not shown by default; component registries have the
expected variant counts.

**Passive field** — mouse melanoma TME is restrictive; penetration modifier bounded `[floor,1]`;
`effectiveAvailability ≤ penetrationModifier`; `penetrationModifier = 1 − combinedRestriction`
(schematic); ECM / diffusion / mechanical / oxygen / hypoxia surfaced.

**STOP boundary** — `modifiesTransport true`, `replacesTransport false`, `modifiesSignalling
false`; immune / vascular / remodeling / metastasis `NOT_EVALUATED`.

**Species isolation** — human penetration modifier and component choices are **distinct** from
mouse (not copied); rat idle / `NOT_REPORTED` with no timeline; human carries the non-clinical
warning.

**State + monotonicity transitions** — loose ECM + normoxia → `permissive`; dense ECM + severe
hypoxia → `extremely_restrictive`; more hypoxia / stiffer barrier / denser collagen → lower
penetration; ordinal registry monotonicity (mechanical, collagen, oxygen, hypoxia, interstitial).

**Deterministic replay** — frame / timeline / stats identical across runs; restart reproduces the
field; the static field does not drift across steps.

**Timeline** — all eight evaluation milestones present and ordered.

**Validation negatives** — experimental TME level; inconsistent oxygen/hypoxia; unsupported
component variant; available profile without evidence; unsupported species — all caught.

**Controls** — `setFormulation` accepts supported / rejects unsupported; unsupported tumour model
→ idle.

**Prediction + evidence integrity** — prediction records carry rationale / confidence /
`quantitative_status = NOT_REPORTED` / `may_show_by_default`; every evidence citation is
`NOT_REPORTED`-qualitative.

**Full-app integration** — `app.microenvironment` exposed; renderer produces an ECM-field +
penetration frame flagging the prediction; the evidence panel shows an independent **Passive Tumor
Microenvironment** section with prediction status + `modifiesSignalling: false` + excluded biology
and immune / vascular / remodeling `NOT_EVALUATED`; earlier phases unchanged; rat idle via the
full app.

## Previous-phase regression
Phases 1–6D unchanged: the microenvironment layer is additive and advisory; the full pre-7A suite
still passes as part of the 2095 total. The Phase-4B `microenvironmentSources` config key is
untouched (the Phase-7A key is `tmeSources`).

## Scope compliance
- Passive modulator only: modifies penetration, never replaces / signals / clears / remodels.
- No immune / vascular / angiogenesis / fibrosis / MMP / fibroblast / CAF / migration /
  metastasis / lymphatic / systemic field anywhere.
- No fabricated oxygen concentration / ECM fibre density / collagen mass / interstitial pressure /
  diffusion coefficient / penetration rate (all `NOT_REPORTED`).
- No hardcoded scientific values in engine source — all behaviour from the registries.
