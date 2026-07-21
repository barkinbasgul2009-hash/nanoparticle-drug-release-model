# Phase 7A Developer Notes — Passive Microenvironment Runtime

Practical notes for anyone extending or debugging the passive TME layer.

## Files

| File | Role |
|---|---|
| `src/biology/microenvironmentEngine.js` | the engine (passive field, penetration modifier, timeline, validate) |
| `src/biology/microenvironmentObjects.js` | runtime objects (ECM / collagen / interstitial / oxygen / hypoxia / mechanical / penetration) |
| `data/*.registry.json` (9) | context / ecm / diffusion / mechanical / oxygen / hypoxia / penetration / evidence / prediction |
| `src/types/microenvironment.ts` | TypeScript contract |
| `tests/microenvironment.test.mjs` | behaviour suite (registered in `tests/run.mjs`) |

## Running things

```
node simulator/tests/run.mjs        # full simulator suite (2095 assertions)
cd simulator && npx tsc --noEmit    # type contract (must run from simulator/)
```

## Construction & controls

```js
const me = new MicroenvironmentEngine({
  contextRegistry, ecmRegistry, diffusionRegistry, mechanicalRegistry,
  oxygenRegistry, hypoxiaRegistry, penetrationRegistry, evidenceRegistry, predictionRegistry,
  species: 'mouse',
});
me.setSpecies('mouse');        // rebuilds; mouse -> canonical B16BL6 passive field
me.setTumourModel('B16BL6');   // unsupported model -> idle (no fallback)
me.setFormulation('neutral_nlc'); // supported only; unsupported is ignored
me.penetrationModifier();      // advisory effective-penetration output [floor,1]
me.frame(); me.stats(); me.getTimeline(); me.validate();
```

Any context change (`setSpecies` / `setTumourModel` / `setFormulation`) calls `_build()`, which
recomputes the passive field once. `step(dt)` only advances the clock — the field is static per
context (no recalculation drift), which keeps replay deterministic.

## The model in one paragraph

`_compute()` reads the profile's component variants, combines collagen / hyaluronic-acid /
proteoglycan / fluid into an ECM resistance, reads interstitial diffusion resistance, mechanical
score, and oxygen / hypoxia, then forms `combinedRestriction` (weighted) and
`penetrationModifier = clamp(1 − combinedRestriction, floor, 1)`. See
`passive-microenvironment-model.md`.

## Gotchas

- **Config key.** Phase 7A uses `config.tmeSources` / `config.tme` — the Phase-4B key
  `microenvironmentSources` is frozen and must NOT be reused (reusing it overwrites Phase-4B and
  breaks the uptake test).
- **Modify, never replace.** The penetration modifier is advisory. Do not wire it into an upstream
  engine (that would alter upstream logic). `frame().modifiesSignalling` must stay `false`.
- **Passive only.** Hypoxia modifies penetration / effectiveness / stress-susceptibility /
  prediction-confidence — it must NOT activate signalling in Phase 7A.
- **Species isolation.** Give each species its own component values; never copy mouse → human.
  `_profile()` matches strictly on species + tumour model; an unsupported model idles.
- **Consistency.** Keep oxygen and hypoxia coherent; the validator rejects e.g. normoxic + severe.
  A dense ECM must not resolve to `permissive`.
- **No RNG.** Deterministic arithmetic; frame / timeline / stats are byte-identical across runs.
- **No hardcoded science.** All ordinal values, weights, thresholds, and floors come from the
  registries.
- **Scope.** No immune / vascular / remodeling / metastasis field; those stay `NOT_EVALUATED`.
  No fabricated concentration / density / pressure / diffusion coefficient / rate.

## Extending toward Phase 7B / later
Active TME biology (immune cells, fibroblasts / CAFs, ECM remodeling, MMPs, angiogenesis,
vasculature, drug clearance, migration, metastasis, systemic PK, clinical outcomes) belongs to a
**new** layer that reads this one read-only — do not add them here.
