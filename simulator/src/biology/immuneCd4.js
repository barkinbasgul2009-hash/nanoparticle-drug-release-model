// Phase-7C Section 4 CD4 helper T-cell runtime. Bounded functional-support abstraction (NOT a
// Th1/Th2/Th17/Tfh cytokine simulation). Estimates priming / recruitment / infiltration / activation /
// helper competence and publishes SEPARATE support contributions (never one opaque multiplier) that
// the integration layer applies to CD8 acyclically. CD4 never directly kills tumour cells and never
// holds a mutable reference to CD8. Reuses shared frameworks; deterministic; availability-gated.

import { AVAILABILITY, deepFreeze, clamp01, isFiniteNumber } from './immuneObjects.js';
import { weightsToContribs, evalStage, categorize, applyReductions, blockedPotential, resultMetric, asMetric } from './immuneAdaptiveShared.js';

function overallAvailability(metrics) { let a = 0, t = 0; for (const m of metrics) { t += 1; const av = asMetric(m).availability; if (av === AVAILABILITY.AVAILABLE) a += 1; else if (av === AVAILABILITY.PARTIALLY_AVAILABLE) a += 0.5; } return (t === 0 || a === 0) ? AVAILABILITY.UNAVAILABLE : a >= t ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE; }
function priorMetric(prior, key) { return prior && prior[key] ? asMetric(prior[key]) : { value: null, availability: AVAILABILITY.UNAVAILABLE }; }
const supp = (v) => (isFiniteNumber(v) ? clamp01(v) : 0);

export class ImmuneCd4Runtime {
  constructor({ registries, aggregator, confidence }) { this.reg = registries.cd4; this.agg = aggregator; this.conf = confidence; }

  evaluate(ctx, prior = null, opts = {}) {
    const I = ctx.inputs; const W = this.reg.stage_weights; const TH = this.reg.state_thresholds; const NP = this.reg.negative_penalties; const SW = this.reg.support_weights;
    const cp = opts.checkpoint || {}; const sup = opts.suppression || {}; const guard = opts.guard;
    const pen = (target, source, magnitude) => { if (!isFiniteNumber(magnitude) || magnitude <= 0) return 0; if (!guard) return magnitude; return guard.apply({ targetMetric: `cd4_${target}`, sourceMetric: source, sourceModule: source, value: magnitude }).applied ? magnitude : 0; };

    const priming = resultMetric(evalStage(this.agg, 'cd4_priming', weightsToContribs({
      antigen_presentation: I.antigen_presentation_potential, adaptive_priming: I.adaptive_priming_potential,
      antigen_availability: I.antigen_availability, dc_effectiveness: I.dendritic_contribution, prior_priming: priorMetric(prior, 'priming'),
    }, W.priming, 'cd4_priming_')));
    const recruitment = resultMetric(evalStage(this.agg, 'cd4_recruitment', weightsToContribs({
      priming, immune_accessibility: I.immune_accessibility, vascular_access: I.vascular_access, prior_recruitment: priorMetric(prior, 'recruitment'),
    }, W.recruitment, 'cd4_recruit_')));
    const infiltration = resultMetric(evalStage(this.agg, 'cd4_infiltration', weightsToContribs({
      recruitment, immune_accessibility: I.immune_accessibility, prior_infiltration: priorMetric(prior, 'infiltration'),
    }, W.infiltration, 'cd4_infil_')));
    const activation = resultMetric(evalStage(this.agg, 'cd4_activation', weightsToContribs({
      priming, infiltration, antigen_presentation: I.antigen_presentation_potential, tumor_visibility: I.tumor_immune_visibility, prior_activation: priorMetric(prior, 'activation'),
    }, W.activation, 'cd4_act_')));
    if (isFiniteNumber(activation.value)) activation.value = applyReductions(activation.value, [pen('activation', 'checkpoint', NP.checkpoint_on_activation * supp(cp.pd_axis_engagement)), pen('activation', 'suppression', NP.suppression_on_activation * supp(sup.cd4_helper_support ?? sup.pressure))]);
    const competence = resultMetric(evalStage(this.agg, 'cd4_helper_competence', weightsToContribs({
      activation, infiltration, prior_competence: priorMetric(prior, 'helperCompetence'),
    }, W.helper_competence, 'cd4_comp_')));

    // separate support contributions (scaled from helper competence)
    const c = isFiniteNumber(competence.value) ? competence.value : 0;
    const supportAvail = competence.availability;
    const supportOf = (w) => ({ value: isFiniteNumber(competence.value) ? clamp01(c * w) : null, availability: supportAvail });
    const support = {
      cd8_priming_support: supportOf(SW.cd8_priming_support), cd8_activation_support: supportOf(SW.cd8_activation_support),
      cd8_persistence_support: supportOf(SW.cd8_persistence_support), antigen_presentation_continuity_support: supportOf(SW.antigen_presentation_continuity_support),
      adaptive_coordination_support: supportOf(SW.adaptive_coordination_support), recovery_support: supportOf(SW.recovery_support),
    };
    // flat map for CD8 consumption
    const cd8Support = { cd8_priming_support: support.cd8_priming_support.value, cd8_activation_support: support.cd8_activation_support.value, cd8_persistence_support: support.cd8_persistence_support.value, recovery_support: support.recovery_support.value };

    const capability = resultMetric(evalStage(this.agg, 'cd4_capability', [{ id: 'cap_priming', value: priming.value, weight: 0.4, availability: priming.availability }, { id: 'cap_activation', value: activation.value, weight: 0.6, availability: activation.availability }]));
    const blocked = blockedPotential(capability, competence);
    const availability = overallAvailability([priming, recruitment, infiltration, activation, competence]);
    const unavailableCount = [I.antigen_presentation_potential, I.adaptive_priming_potential, I.immune_accessibility].filter((m) => asMetric(m).availability === AVAILABILITY.UNAVAILABLE).length;

    return deepFreeze({
      runtimeType: 'cd4', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      priming: { value: priming.value, state: categorize(isFiniteNumber(priming.value) ? priming.value : 0, TH.priming), availability: priming.availability },
      recruitment: { value: recruitment.value, availability: recruitment.availability },
      infiltration: { value: infiltration.value, availability: infiltration.availability },
      activation: { value: activation.value, state: categorize(isFiniteNumber(activation.value) ? activation.value : 0, TH.activation), availability: activation.availability },
      helperCompetence: { value: competence.value, availability: competence.availability },
      support, cd8Support,
      blockedPotential: { value: blocked.value, availability: blocked.availability, causes: ['access', 'checkpoint', 'regulatory', 'poor_priming'] },
      effectiveContribution: { value: competence.value, availability: competence.availability },
      availability, confidence: this.conf.propagate({ missingInputs: unavailableCount, unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
    });
  }
}

export default ImmuneCd4Runtime;
