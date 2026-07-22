// Phase-7C Section 4 final adaptive + net immune integration. Combines innate + CD8 + CD4 + Treg +
// checkpoint + integrated suppression + immune escape into adaptive readiness/activation/competence/
// effective cytotoxic potential/persistence/recovery/burdens/blocked, then the net immune layer
// (readiness, competence, net immune-mediated tumour-LOSS POTENTIAL, blocked immune potential, immune
// control + failure states). Uses the Section-2 aggregation framework; positive contributions are
// weighted-averaged and negative (penalty) contributions are applied as bounded reductions ONCE. Net
// tumour-loss is a POTENTIAL - it never mutates tumour burden. Control + failure are not exact
// inverses (mixed states allowed). Deterministic; availability-gated.

import { AVAILABILITY, deepFreeze, clamp01, isFiniteNumber } from './immuneObjects.js';
import { evalStage, categorize, contrib, applyReductions, resultMetric, asMetric } from './immuneAdaptiveShared.js';

function combineSigned(agg, target, inputs, weights) {
  const pos = []; const negs = [];
  for (const [name, w] of Object.entries(weights)) {
    if (name === 'note') continue;
    const m = asMetric(inputs[name]);
    if (w >= 0) pos.push(contrib(name, m.value, m.availability, { weight: w }));
    else if (isFiniteNumber(m.value)) negs.push(clamp01(Math.abs(w) * m.value));
  }
  const base = resultMetric(evalStage(agg, target, pos));
  const value = isFiniteNumber(base.value) ? applyReductions(base.value, negs) : null;
  return { value, availability: base.availability };
}
const M = (v, a) => ({ value: isFiniteNumber(v) ? v : null, availability: a || (isFiniteNumber(v) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE) });

export class ImmuneAdaptiveIntegration {
  constructor({ registries, aggregator, confidence }) { this.reg = registries.adaptiveIntegration; this.agg = aggregator; this.conf = confidence; }

  integrateAdaptive({ ctx, cd8, cd4, treg, checkpoint, suppression, escape, prior }) {
    const I = ctx.inputs; const W = this.reg.adaptive_weights;
    const cp = checkpoint || {}; const sup = suppression || {}; const esc = escape || {};
    const cd4sup = cd4 && cd4.cd8Support ? cd4.cd8Support : {};
    const in_ = {
      adaptive_priming: I.adaptive_priming_potential, cd8_priming: cd8.priming, cd4_priming: cd4.priming, antigen_presentation: I.antigen_presentation_potential,
      immune_accessibility: I.immune_accessibility, cd8_infiltration: cd8.infiltration,
      cd8_activation: cd8.activation, cd4_activation: cd4.activation, cd4_activation_support: M(cd4sup.cd8_activation_support),
      prior_adaptive_activation: prior ? asMetric(prior.activation) : M(null), checkpoint_burden: M(cp.pd_axis_engagement, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE), suppression_burden: M(sup.pressure, sup.availability),
      cd8_effector_competence: cd8.effectorCompetence, cd4_helper_competence: cd4.helperCompetence, cd4_support: M(cd4sup.cd8_activation_support), recovery_potential: cd8.recoveryPotential,
      dysfunction: cd8.dysfunction, exhaustion: cd8.exhaustion,
      cd8_cytotoxic_potential: cd8.cytotoxicPotential, target_engagement: cd8.targetEngagement, escape_applied: M(esc.overallEscapePressure ? esc.overallEscapePressure.value : null, esc.availability),
      cd4_persistence_support: M(cd4sup.cd8_persistence_support), checkpoint_persistence: M(cp.persistent, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE), suppression_persistence: M(sup.persistent, sup.availability),
      cd8_recovery_potential: cd8.recoveryPotential, cd4_recovery_support: M(cd4sup.recovery_support), residual_accessibility: I.immune_accessibility, residual_antigen_presentation: I.antigen_presentation_potential, exhaustion_severity: cd8.exhaustion,
    };
    const readiness = combineSigned(this.agg, 'adaptive_readiness', in_, W.readiness);
    const activation = combineSigned(this.agg, 'adaptive_activation', in_, W.activation);
    const effectorCompetence = combineSigned(this.agg, 'adaptive_effector_competence', in_, W.effector_competence);
    const effectiveCytotoxic = combineSigned(this.agg, 'adaptive_effective_cytotoxic', in_, W.effective_cytotoxic);
    const persistence = combineSigned(this.agg, 'adaptive_persistence', in_, W.persistence);
    const recovery = combineSigned(this.agg, 'adaptive_recovery', in_, W.recovery);

    // blocked decomposition (causal categories)
    const blockedInputs = [
      contrib('priming', asMetric(cd8.priming).value != null ? clamp01(1 - asMetric(cd8.priming).value) : null, asMetric(cd8.priming).availability, { weight: 1 }),
      contrib('infiltration', asMetric(cd8.infiltration).value != null ? clamp01(1 - asMetric(cd8.infiltration).value) : null, asMetric(cd8.infiltration).availability, { weight: 1 }),
      contrib('checkpoint', cp.pd_axis_engagement ?? null, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE, { weight: 1 }),
      contrib('regulatory', asMetric(treg && treg.suppressiveCompetence).value ?? null, asMetric(treg && treg.suppressiveCompetence).availability, { weight: 1 }),
      contrib('exhaustion', asMetric(cd8.exhaustion).value ?? null, asMetric(cd8.exhaustion).availability, { weight: 1 }),
    ];
    const blocked = resultMetric(evalStage(this.agg, 'immune_suppression', blockedInputs));   // bounded_multiplicative -> [0,1]
    const availability = [readiness, activation, effectorCompetence].every((x) => x.availability === AVAILABILITY.UNAVAILABLE) ? AVAILABILITY.UNAVAILABLE
      : [readiness, activation, effectorCompetence].every((x) => x.availability === AVAILABILITY.AVAILABLE) ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE;

    return deepFreeze({
      runtimeType: 'adaptive_immune', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      readiness, activation, effectorCompetence, effectiveCytotoxicPotential: effectiveCytotoxic, persistence, recoveryPotential: recovery,
      suppressionBurden: M(sup.pressure, sup.availability), checkpointBurden: M(cp.pd_axis_engagement, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE),
      blockedPotential: { value: blocked.value, availability: blocked.availability, categories: this.reg.blocked_categories },
      escapePressure: M(esc.overallEscapePressure ? esc.overallEscapePressure.value : null, esc.availability),
      overallAdaptiveContribution: effectiveCytotoxic,
      availability, confidence: this.conf.propagate({ unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
    });
  }

  integrateNet({ ctx, innate, adaptive, escape, suppression, checkpoint, cd8 }) {
    const NW = this.reg.net_immune_weights; const I = ctx.inputs;
    const inn = innate || {}; const esc = escape || {}; const sup = suppression || {}; const cp = checkpoint || {};
    const readiness = combineSigned(this.agg, 'net_readiness', { innate_readiness: M(inn.readiness ? inn.readiness.value : null, inn.readiness ? inn.readiness.availability : AVAILABILITY.UNAVAILABLE), adaptive_readiness: adaptive.readiness }, NW.readiness);
    const competence = combineSigned(this.agg, 'net_competence', { innate_competence: M(inn.competence ? inn.competence.value : null, AVAILABILITY.UNAVAILABLE), adaptive_effector_competence: adaptive.effectorCompetence }, NW.competence);
    const netLossInputs = {
      innate_tumor_pressure: M(inn.tumorPressure ? inn.tumorPressure.value : null, inn.tumorPressure ? inn.tumorPressure.availability : AVAILABILITY.UNAVAILABLE),
      nk_cytotoxic_potential: M(inn.nk ? inn.nk.value : null, AVAILABILITY.UNAVAILABLE), macrophage_tumor_opposing: M(inn.macrophage ? inn.macrophage.value : null, AVAILABILITY.UNAVAILABLE),
      adaptive_effective_cytotoxic: adaptive.effectiveCytotoxicPotential, target_engagement: cd8.targetEngagement, immune_accessibility: I.immune_accessibility,
      suppression_burden: M(sup.pressure, sup.availability), checkpoint_burden: M(cp.pd_axis_engagement, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE),
      exhaustion: cd8.exhaustion, immune_escape: M(esc.overallEscapePressure ? esc.overallEscapePressure.value : null, esc.availability),
    };
    const netTumorLoss = combineSigned(this.agg, 'net_tumor_loss', netLossInputs, NW.net_tumor_loss);

    // control + failure states (not exact inverses)
    const controlValue = isFiniteNumber(netTumorLoss.value) ? clamp01(netTumorLoss.value * (1 - clamp01(esc.overallEscapePressure ? esc.overallEscapePressure.value ?? 0 : 0) * 0.5)) : null;
    const controlState = categorize(isFiniteNumber(controlValue) ? controlValue : 0, this.reg.control_state_thresholds);
    const failureValue = combineSigned(this.agg, 'immune_failure_v', {
      immune_escape: M(esc.overallEscapePressure ? esc.overallEscapePressure.value : null, esc.availability), suppression_burden: M(sup.pressure, sup.availability),
      checkpoint_burden: M(cp.pd_axis_engagement, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE), blocked_immune_potential: adaptive.blockedPotential,
    }, this.reg.failure_weights).value;
    const failureState = categorize(isFiniteNumber(failureValue) ? failureValue : 0, this.reg.failure_state_thresholds);

    // blocked immune potential decomposition
    const blockedImmune = {
      value: adaptive.blockedPotential.value, availability: adaptive.blockedPotential.availability,
      decomposition: { recognition: esc.recognitionEscape || null, access: esc.accessEscape || null, priming: esc.primingEscape || null, effector: esc.effectorEscape || null, checkpoint: esc.checkpointEscape || null, suppression: esc.suppressionEscape || null, exhaustion: esc.exhaustionEscape || null },
    };
    const availability = netTumorLoss.availability;
    return deepFreeze({
      overallImmuneReadiness: readiness, overallImmuneCompetence: competence,
      innateImmunePressure: M(inn.tumorPressure ? inn.tumorPressure.value : null, inn.tumorPressure ? inn.tumorPressure.availability : AVAILABILITY.UNAVAILABLE),
      adaptiveImmunePressure: adaptive.effectiveCytotoxicPotential,
      netImmuneMediatedTumorLossPotential: netTumorLoss, blockedImmunePotential: blockedImmune,
      overallSuppressionBurden: M(sup.pressure, sup.availability), overallCheckpointBurden: M(cp.pd_axis_engagement, cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE),
      overallImmuneEscapePressure: M(esc.overallEscapePressure ? esc.overallEscapePressure.value : null, esc.availability),
      immuneControlState: controlState, immuneFailureState: failureState,
      availability, confidence: this.conf.propagate({ unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
    });
  }
}

export default ImmuneAdaptiveIntegration;
