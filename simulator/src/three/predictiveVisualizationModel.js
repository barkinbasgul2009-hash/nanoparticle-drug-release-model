// PREDICTIVE VISUALIZATION MODEL (read-only, deterministic).
//
// The scientific runtime stops at the dermal stage (transportEngine has NO systemic stage). This
// module produces NORMALIZED VISUAL PREDICTIONS for the downstream narrative — bloodstream entry,
// systemic concentration, target arrival, extravasation, ECM-limited penetration and cellular uptake —
// so the 3D animation can show a continuous journey WITHOUT pretending the numbers are measured.
//
// HARD RULES:
//   • never mutates canonical frames, simulation results, replay data or registries
//   • never claims clinical PK accuracy and never emits mg/L or physical doses
//   • never replaces a missing input with 0 (missing -> unavailable, with a reason)
//   • every output is tagged PREDICTED_VISUAL (or VISUAL_ONLY) — never SIMULATION_DERIVED
//   • deterministic: identical inputs -> identical outputs (no RNG, no wall-clock)
//
// Conservation chain enforced by construction:
//   released -> systemic (x bioavailability) -> targetArrival -> extravasated -> interstitial
//   -> penetration -> uptake        (each stage <= the previous stage)

import { PREDICTIVE_MODEL_VERSION, resolveParams } from './predictiveVisualConfig.js';

export const SOURCE_CLASS = Object.freeze({
  SIMULATION_DERIVED: 'SIMULATION_DERIVED',
  PREDICTED_VISUAL: 'PREDICTED_VISUAL',
  VISUAL_ONLY: 'VISUAL_ONLY',
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** A tagged predictive output. Missing/invalid inputs produce value:null + unavailableReason. */
function pred(value, { confidence = 'LOW', assumptions = [], inputSources = [], unavailableReason = null, sourceClass = SOURCE_CLASS.PREDICTED_VISUAL } = {}) {
  const ok = isNum(value) && unavailableReason === null;
  return Object.freeze({
    value: ok ? clamp01(value) : null,
    sourceClass: ok ? sourceClass : SOURCE_CLASS.PREDICTED_VISUAL,
    available: ok,
    confidence: ok ? confidence : 'UNAVAILABLE',
    assumptions: Object.freeze([...assumptions]),
    modelVersion: PREDICTIVE_MODEL_VERSION,
    inputSources: Object.freeze([...inputSources]),
    unavailableReason,
  });
}

/**
 * Normalized first-order absorption/elimination (Bateman-style), bounded to [0,1] by its own peak.
 * Handles ka ~= ke (the removable singularity) with the analytic limit t*ka*exp(-ka*t).
 */
export function systemicCurve(t, ka, ke) {
  if (!isNum(t) || t <= 0) return 0;
  if (Math.abs(ka - ke) < 1e-6) {
    const v = t * ka * Math.exp(-ka * t);
    const peak = (1 / ke) * ka * Math.exp(-1);            // maximum of t*ka*e^{-ka t} at t=1/ka
    return peak > 0 ? clamp01(v / peak) : 0;
  }
  const shape = (ka / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
  const tmax = Math.log(ka / ke) / (ka - ke);
  const peak = (ka / (ka - ke)) * (Math.exp(-ke * tmax) - Math.exp(-ka * tmax));
  return peak > 0 ? clamp01(shape / peak) : 0;
}

/**
 * Build the predictive visual state.
 * @param {{
 *   releasedFraction?: number|null,   // SIMULATION_DERIVED input (may be null)
 *   absorbedFraction?: number|null,   // SIMULATION_DERIVED input (may be null)
 *   elapsedHours?: number|null,
 *   route?: string,
 *   tissueAccessibility?: number|null,
 *   vascularAccessibility?: number|null,
 *   penetrationDepth?: number|null,
 *   params?: object
 * }} input
 */
export function predictVisualState(input = {}) {
  const p = resolveParams(input.params || {});
  const route = input.route || 'topical';
  const released = isNum(input.releasedFraction) ? clamp01(input.releasedFraction) : null;
  const absorbed = isNum(input.absorbedFraction) ? clamp01(input.absorbedFraction) : null;
  const t = isNum(input.elapsedHours) ? Math.max(0, input.elapsedHours) : null;

  // ---------------- systemic ----------------
  const driver = absorbed != null ? absorbed : released;               // absorbed preferred; else released
  const driverSrc = absorbed != null ? 'transportEngine.absorbedFraction' : (released != null ? 'releaseEngine.releasedFraction' : null);

  let relPlasma, bloodDensity, arrivalProgress, remainingAtSite;
  if (driver == null || t == null) {
    const why = driver == null ? 'no absorbed/released fraction available from the simulation' : 'elapsed time unavailable';
    relPlasma = pred(null, { unavailableReason: why });
    bloodDensity = pred(null, { unavailableReason: why });
    arrivalProgress = pred(null, { unavailableReason: why });
    remainingAtSite = pred(null, { unavailableReason: why });
  } else if (driver === 0) {
    // zero dose is a REAL zero (not a missing value) -> predicted zero systemic exposure
    const base = { confidence: 'MODERATE', assumptions: ['zero released/absorbed drug -> no systemic exposure'], inputSources: [driverSrc] };
    relPlasma = pred(0, base); bloodDensity = pred(0, base); arrivalProgress = pred(0, base); remainingAtSite = pred(1, base);
  } else {
    const tv = Math.max(0, (t - p.distributionDelay * 24) * p.visualTimeScale);
    const shape = systemicCurve(tv, p.absorptionRate, p.eliminationRate);
    const scale = driver * p.relativeBioavailability;
    const assumptions = [
      'normalized first-order absorption/elimination — NOT a validated clinical PK model',
      `topical relative bioavailability assumed ${p.relativeBioavailability}`,
      'output is a relative shape in [0,1], not a concentration in mg/L',
    ];
    const meta = { confidence: 'LOW', assumptions, inputSources: [driverSrc, 'predictiveVisualConfig'] };
    relPlasma = pred(shape * scale, meta);
    bloodDensity = pred(shape * scale, { ...meta, confidence: 'LOW' });
    arrivalProgress = pred(clamp01(1 - Math.exp(-p.absorptionRate * tv)), meta);
    remainingAtSite = pred(clamp01(1 - driver * (1 - Math.exp(-p.absorptionRate * tv))), meta);
  }

  // ---------------- target tissue (each stage <= the previous) ----------------
  const acc = isNum(input.tissueAccessibility) ? clamp01(input.tissueAccessibility) : null;
  const vasc = isNum(input.vascularAccessibility) ? clamp01(input.vascularAccessibility) : null;
  const systemicAvail = relPlasma.value;

  let targetArrival, extravasated, interstitial, penetration, ecmRetention, uptake;
  if (systemicAvail == null) {
    const why = 'systemic prediction unavailable — cannot predict target arrival';
    targetArrival = pred(null, { unavailableReason: why });
    extravasated = pred(null, { unavailableReason: why });
    interstitial = pred(null, { unavailableReason: why });
    penetration = pred(null, { unavailableReason: why });
    ecmRetention = pred(null, { unavailableReason: why });
    uptake = pred(null, { unavailableReason: why });
  } else {
    const accEff = acc != null ? acc : p.relativePerfusion;            // documented fallback, not zero
    const vascEff = vasc != null ? vasc : p.vascularPermeability;
    const src = ['predictiveVisualModel.systemic', acc != null ? 'immuneFrame.tissueAccessibility' : 'predictiveVisualConfig.relativePerfusion'];
    const A = ['not all drug reaches the target tissue', 'accessibility gates arrival'];

    const arrival = systemicAvail * accEff * p.relativePerfusion;                       // <= systemic
    const extra = arrival * vascEff * p.extravasationEfficiency;                        // <= arrival
    const inter = extra * (1 - p.tissueRetention * 0.5);                                // <= extravasated
    const depth = inter * (1 - p.ecmResistance) * p.diffusionSpread;                    // ECM slows penetration
    const retained = extra * p.tissueRetention;                                         // <= extravasated
    const taken = inter * p.uptakeProbability;                                          // <= interstitial

    targetArrival = pred(arrival, { confidence: 'LOW', assumptions: A, inputSources: src });
    extravasated = pred(Math.min(extra, arrival), { confidence: 'LOW', assumptions: [...A, 'not all arriving drug extravasates'], inputSources: src });
    interstitial = pred(Math.min(inter, extra), { confidence: 'LOW', assumptions: [...A], inputSources: src });
    penetration = pred(Math.min(depth, inter), { confidence: 'LOW', assumptions: [...A, 'higher ECM resistance reduces penetration'], inputSources: src });
    ecmRetention = pred(Math.min(retained, extra), { confidence: 'LOW', assumptions: ['ECM can retain drug'], inputSources: src });
    uptake = pred(Math.min(taken, inter), { confidence: 'LOW', assumptions: [...A, 'only a subset approaches or enters cells'], inputSources: src });
  }

  return Object.freeze({
    modelVersion: PREDICTIVE_MODEL_VERSION,
    route,
    // the animation must label carrier vs released API honestly
    particleIdentity: Object.freeze({
      represents: 'released drug / API molecules',
      note: 'The skin transport model represents RELEASED API, not intact nanoparticle carrier transport. Downstream 3D particles are representative drug particles and must be labelled as such — do not claim intact nanoparticle penetration.',
      sourceClass: SOURCE_CLASS.PREDICTED_VISUAL,
    }),
    systemic: Object.freeze({
      relativePlasmaConcentration: relPlasma,
      bloodstreamParticleDensity: bloodDensity,
      systemicArrivalProgress: arrivalProgress,
      remainingApplicationSiteFraction: remainingAtSite,
    }),
    tissue: Object.freeze({
      predictedTargetArrival: targetArrival,
      predictedExtravasatedFraction: extravasated,
      predictedInterstitialConcentration: interstitial,
      predictedPenetrationDepth: penetration,
      predictedECMRetention: ecmRetention,
      predictedCellularUptake: uptake,
    }),
    params: p,
  });
}

export default predictVisualState;
