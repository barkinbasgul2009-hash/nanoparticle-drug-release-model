# Phase 7B Developer Notes — Tumor Vasculature Runtime

Practical notes for anyone extending or debugging the vascular layer.

## Files

| File | Role |
|---|---|
| `src/biology/vascularEngine.js` | the engine (vascular field, delivery modifier, timeline, validate) |
| `src/biology/vascularObjects.js` | runtime objects (vessel / perfusion / oxygen / nutrient / permeability / delivery) |
| `data/*.registry.json` (9) | vascular-context / angiogenesis / perfusion / oxygen-supply / nutrient / permeability / delivery / evidence / prediction |
| `src/types/vascular.ts` | TypeScript contract |
| `tests/vascular.test.mjs` | behaviour suite (registered in `tests/run.mjs`) |

## Running things

```
node simulator/tests/run.mjs        # full simulator suite (2203 assertions)
cd simulator && npx tsc --noEmit    # type contract (must run from simulator/)
```

## Construction & controls

```js
const va = new VascularEngine({
  contextRegistry, angiogenesisRegistry, perfusionRegistry, oxygenSupplyRegistry,
  nutrientRegistry, permeabilityRegistry, deliveryRegistry, evidenceRegistry, predictionRegistry,
  microenvironmentEngine,   // optional Phase-7A engine for the combined delivery x penetration view
  species: 'mouse',
});
va.setSpecies('mouse');         // rebuilds; mouse -> canonical B16BL6 vascular field
va.setTumourModel('B16BL6');    // unsupported model -> idle (no fallback)
va.setFormulation('neutral_nlc'); // supported only; unsupported is ignored
va.deliveryModifier();          // advisory effective-delivery output [floor,1]
va.effectiveDeliveryPenetration(); // delivery x Phase-7A penetration (read-only)
va.frame(); va.stats(); va.getTimeline(); va.validate();
```

Any context change (`setSpecies` / `setTumourModel` / `setFormulation`) calls `_build()`, which
recomputes the vascular field once. `step(dt)` only advances the clock — the field is static per
context (no recalculation drift), which keeps replay deterministic.

## The model in one paragraph

`_compute()` reads the profile's component states, maps each to a schematic 0–1 value, then forms
`deliveryModifier = clamp(w.perfusion·perfusionEff + w.permeability·permeability +
w.vessel_density·vesselDensity + w.maturity_efficiency·maturityEff, floor, 1)`. See
`tumor-vasculature-model.md`.

## Gotchas

- **Modify, never signal or replace.** The delivery modifier is advisory. Do not wire it into an
  upstream engine (that would alter upstream logic). `frame().modifiesSignalling`,
  `inducesApoptosis`, and `remodels` must stay `false`.
- **Integration is read-only.** `effectiveDeliveryPenetration()` reads the Phase-7A engine
  read-only; it never mutates it. If no Phase-7A engine is supplied it equals the delivery
  modifier.
- **Species isolation.** Give each species its own component states; never copy mouse → human.
  `_profile()` matches strictly on species + tumour model; an unsupported model idles.
- **No rat fallback.** Rat has no available vasculature; the validator rejects an available rat
  profile.
- **Consistency.** Keep oxygen supply and perfusion coherent; the validator rejects e.g.
  `very_high` oxygen with `very_low` perfusion.
- **No RNG.** Deterministic arithmetic; frame / timeline / stats are byte-identical across runs.
- **No hardcoded science.** All ordinal values, weights, thresholds, and floors come from the
  registries.
- **Config key.** Phase 7B uses `config.vascularSources` / `config.vascular` — distinct from the
  Phase-4B `microenvironmentSources` and Phase-7A `tmeSources`.
- **Scope.** No immune / VEGF / HIF / vascular-inflammation / fibroblast / lymphatic / metastasis
  field; those stay `NOT_EVALUATED`. No fabricated blood flow / vessel count / pO₂ / diameter /
  perfusion rate.

## Replay guide
The vascular field is fully determined by the profile + registries, so replay reproduces the
vascular profile, vessel state, perfusion, oxygen supply, nutrient environment, permeability, and
delivery modifier exactly. The renderer frame is derived from the static field, so renderer output
is deterministic across replays.

## Extending toward Phase 7C / later
Active vascular biology (VEGF/HIF signalling, vascular inflammation, immune trafficking, ECM
remodeling, lymphatics, metastasis) and letting downstream engines consume the delivery modifier
belong to a **new** layer that reads this one read-only — do not add them here.
