// PREDICTIVE VISUAL PARAMETERS (Phase-0 completion patch).
//
// These are VISUAL PREDICTION parameters for the 3D animation — they are NOT validated clinical
// constants, NOT measured values and NOT part of any scientific registry. They are deliberately kept
// out of animation/scene code so no magic numbers hide there. Every entry declares a semantic name,
// default, valid range, normalized meaning and description.
//
// The scientific runtime stops at the dermal stage (transportEngine: "no systemic stage"). Everything
// downstream of the dermis is therefore PREDICTED_VISUAL, never SIMULATION_DERIVED.

export const PREDICTIVE_MODEL_VERSION = 'pvm-1.0.0';

/** @typedef {{ default:number, min:number, max:number, meaning:string, description:string }} PVParam */

export const PREDICTIVE_PARAMS = Object.freeze({
  // ---- systemic (first-order absorption / elimination, normalized) ----
  absorptionRate: { default: 0.45, min: 0.001, max: 5, meaning: 'normalized 1/visual-hour', description: 'first-order rate at which absorbed drug enters the systemic compartment' },
  eliminationRate: { default: 0.18, min: 0.001, max: 5, meaning: 'normalized 1/visual-hour', description: 'first-order systemic elimination rate' },
  distributionDelay: { default: 0.08, min: 0, max: 1, meaning: 'fraction of the visual timeline', description: 'lag before systemic appearance begins' },
  relativeBioavailability: { default: 0.30, min: 0, max: 1, meaning: 'fraction of released drug reaching systemic circulation', description: 'topical routes deliver only a fraction systemically' },
  visualTimeScale: { default: 1.0, min: 0.05, max: 20, meaning: 'multiplier', description: 'compresses biological hours into presentation time' },

  // ---- target tissue ----
  relativePerfusion: { default: 0.55, min: 0, max: 1, meaning: 'normalized', description: 'relative blood supply to the target tissue' },
  vascularPermeability: { default: 0.40, min: 0, max: 1, meaning: 'normalized', description: 'ease of crossing the vessel wall' },
  extravasationEfficiency: { default: 0.35, min: 0, max: 1, meaning: 'fraction of arriving drug leaving the vessel', description: 'only a subset extravasates' },
  ecmResistance: { default: 0.45, min: 0, max: 1, meaning: 'normalized resistance', description: 'extracellular-matrix hindrance to diffusion; higher NEVER increases penetration' },
  diffusionSpread: { default: 0.50, min: 0, max: 1, meaning: 'normalized', description: 'lateral spread of drug through interstitium' },
  tissueRetention: { default: 0.30, min: 0, max: 1, meaning: 'fraction retained in ECM', description: 'drug held by matrix binding' },
  uptakeProbability: { default: 0.25, min: 0, max: 1, meaning: 'fraction of interstitial drug entering cells', description: 'only a subset approaches or enters cells' },
});

/** Resolve overrides against the declared ranges. Out-of-range/invalid values fall back to default. */
export function resolveParams(overrides = {}) {
  const out = {};
  for (const [k, spec] of Object.entries(PREDICTIVE_PARAMS)) {
    const v = overrides[k];
    out[k] = (typeof v === 'number' && Number.isFinite(v) && v >= spec.min && v <= spec.max) ? v : spec.default;
  }
  return Object.freeze(out);
}

export function paramSpec(name) { return PREDICTIVE_PARAMS[name] || null; }

export default PREDICTIVE_PARAMS;
