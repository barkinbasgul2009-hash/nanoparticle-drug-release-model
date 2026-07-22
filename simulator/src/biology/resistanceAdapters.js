// Phase-8A resistance adapters. Each adapter receives IMMUTABLE resistance output and returns a
// BOUNDED [0,1] modifier for one downstream channel. Adapters preserve original engine ownership:
// they NEVER write into upstream (frozen) engine state, avoid circular dependencies, and are
// deterministic. Modifier convention: 1 = no resistance effect (channel unmodified); lower = more
// resistance. Double-counting guards ensure an effect (e.g. apoptosis evasion) is applied through
// exactly one adapter and not re-added to the final population modifier.

import { clamp, clamp01, r3, ResistanceResponseModifier } from './resistanceObjects.js';

function mechModifier(state, category) {
  const m = (state.mechanisms || []).find((x) => x.category === category);
  return m && m.modifier != null ? clamp01(m.modifier) : 0;
}

/** Reduced effective intracellular availability (uptake + efflux share this channel; take the max). */
export function resistanceToUptakeAdapter(state) {
  const reduction = Math.max(mechModifier(state, 'reduced_uptake_tendency'), mechModifier(state, 'increased_efflux_tendency'));
  return r3(clamp01(1 - reduction));                 // uptake-effectiveness modifier
}

/** Compensatory survival signaling reduces apoptosis susceptibility (pathway abstraction only). */
export function resistanceToSignalingAdapter(state) {
  const reduction = mechModifier(state, 'compensatory_survival_signaling');
  return r3(clamp01(1 - reduction));                 // signaling/apoptosis-susceptibility modifier
}

/** Stress-response adaptation reduces stress-to-apoptosis conversion. */
export function resistanceToStressAdapter(state) {
  const reduction = mechModifier(state, 'stress_response_adaptation');
  return r3(clamp01(1 - reduction));                 // stress-response modifier
}

/** Apoptosis evasion raises the effective apoptosis threshold (applied ONCE; guarded downstream). */
export function resistanceToApoptosisAdapter(state) {
  const increase = mechModifier(state, 'apoptosis_evasion');
  return r3(clamp01(1 - increase));                  // apoptosis-sensitivity modifier
}

/** Net population-loss modifier from resistance burden (bounded); does NOT re-apply apoptosis evasion. */
export function resistanceToPopulationResponseAdapter(state) {
  // population loss is reduced by the TOTAL burden, but apoptosis-evasion is already applied via the
  // apoptosis adapter, so we subtract its contribution here to avoid double counting.
  const evasion = mechModifier(state, 'apoptosis_evasion');
  const burden = clamp01(state.burden.total);
  const nonApoptotic = clamp01(burden - 0.5 * evasion);   // discount the already-applied apoptosis effect
  return r3(clamp01(1 - nonApoptotic));              // population-loss modifier
}

/** Tumour-response durability/regrowth pressure from persistent-resistance burden. */
export function resistanceToTumorResponseAdapter(state) {
  const persistent = clamp01(state.burden.persistent);
  const durability = clamp01(1 - 0.5 * persistent);       // higher persistent burden -> lower durability
  return { durability: r3(durability), regrowthPressure: r3(clamp01(0.3 * persistent)) };
}

/**
 * Assemble the advisory ResistanceResponseModifier from all channels. net_treatment_sensitivity is
 * a single bounded value (product of effectiveness channels, floored) consumed on the NEXT frame -
 * never applied to the same response event that produced it.
 */
export function buildResponseModifier(state, modReg) {
  const floor = (modReg && modReg.net_combination && modReg.net_combination.floor) || 0.05;
  const uptake = resistanceToUptakeAdapter(state);
  const target = r3(clamp01(1 - mechModifier(state, 'reduced_target_availability')));
  const signaling = resistanceToSignalingAdapter(state);
  const stress = resistanceToStressAdapter(state);
  const apoptosis = resistanceToApoptosisAdapter(state);
  const populationLoss = resistanceToPopulationResponseAdapter(state);
  const tumor = resistanceToTumorResponseAdapter(state);
  const exposure = r3(clamp01(1 - state.microenvironmentProtection.deliveryProtection));
  const recovery = r3(clamp01(state.reSensitization.sensitivityRecovery || 0));
  // net treatment sensitivity: bounded product of the effectiveness channels, restored by recovery.
  let net = exposure * uptake * target * signaling * apoptosis;
  net = clamp(net + recovery * (1 - net), floor, 1);
  return new ResistanceResponseModifier({
    exposureEffectiveness: exposure, uptakeEffectiveness: uptake, targetEffectiveness: target,
    stressResponse: stress, apoptosisSensitivity: apoptosis, populationLoss,
    recoveryPressure: recovery, regrowthPressure: tumor.regrowthPressure, durability: tumor.durability,
    netTreatmentSensitivity: r3(net),
    evidenceLevel: state.evidenceLevel, predictionLevel: state.predictionLevel,
    confidence: state.confidence,
    uncertainty: 'Advisory bounded modifier; consumed next frame; applied additively via adapters only.',
    limitations: 'Schematic normalized; no measured efficacy change (NOT_REPORTED quantitatively).',
  });
}

export default buildResponseModifier;
