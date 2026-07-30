// Phase-7C Section 4 regulatory T-cell (Treg) runtime. Estimates the SUPPRESSIVE INFLUENCE Tregs exert
// on the adaptive response (recruitment / infiltration / activation / suppressive competence /
// persistence). Recruitment != infiltration; suppressive competence is independent of activation.
// Tregs never mutate CD8/CD4 - they publish contribution objects targeting specific adaptive stages.
// Suppression persists after initiating conditions decline (registry-driven decay + recurrence).
// Reuses shared frameworks; deterministic; availability-gated.

import { AVAILABILITY, deepFreeze, clamp01, isFiniteNumber } from './immuneObjects.js';
import { weightsToContribs, evalStage, categorize, blockedPotential, resultMetric, asMetric } from './immuneAdaptiveShared.js';

function overallAvailability(metrics) { let a = 0, t = 0; for (const m of metrics) { t += 1; const av = asMetric(m).availability; if (av === AVAILABILITY.AVAILABLE) a += 1; else if (av === AVAILABILITY.PARTIALLY_AVAILABLE) a += 0.5; } return (t === 0 || a === 0) ? AVAILABILITY.UNAVAILABLE : a >= t ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE; }
function priorMetric(prior, key) { return prior && prior[key] ? asMetric(prior[key]) : { value: null, availability: AVAILABILITY.UNAVAILABLE }; }

export class ImmuneTregRuntime {
  constructor({ registries, aggregator, confidence }) { this.reg = registries.treg; this.agg = aggregator; this.conf = confidence; }

  evaluate(ctx, prior = null, opts = {}) {
    const I = ctx.inputs; const W = this.reg.stage_weights; const TH = this.reg.state_thresholds; const P = this.reg.persistence; const T = this.reg.suppression_targets;
    const recruitment = resultMetric(evalStage(this.agg, 'treg_recruitment', weightsToContribs({
      adaptive_priming_context: I.adaptive_priming_potential, immune_accessibility: I.immune_accessibility,
      vascular_access: I.vascular_access, prior_treg_abundance: priorMetric(prior, 'recruitment'), tumor_immune_context: I.tumor_immune_visibility,
    }, W.recruitment, 'treg_recruit_')));
    const infiltration = resultMetric(evalStage(this.agg, 'treg_infiltration', weightsToContribs({
      recruitment, immune_accessibility: I.immune_accessibility, prior_infiltration: priorMetric(prior, 'infiltration'),
    }, W.infiltration, 'treg_infil_')));
    const activation = resultMetric(evalStage(this.agg, 'treg_activation', weightsToContribs({
      recruitment, infiltration, tumor_immune_context: I.tumor_immune_visibility, prior_activation: priorMetric(prior, 'activation'),
    }, W.activation, 'treg_act_')));
    const competence = resultMetric(evalStage(this.agg, 'treg_suppressive_competence', weightsToContribs({
      activation, infiltration, prior_competence: priorMetric(prior, 'suppressiveCompetence'),
    }, W.suppressive_competence, 'treg_comp_')));

    // suppressive persistence (persists after decline; decay from prior)
    const priorPersist = priorMetric(prior, 'suppressivePersistence').value || 0;
    const persistenceValue = isFiniteNumber(competence.value) ? clamp01(Math.max(competence.value, priorPersist * (1 - P.decay_rate))) : (isFiniteNumber(priorPersist) ? clamp01(priorPersist * (1 - P.decay_rate)) : null);

    // suppression contributions targeting specific adaptive stages (each uniquely identified)
    const cv = isFiniteNumber(competence.value) ? competence.value : 0;
    const target = (w) => ({ value: isFiniteNumber(competence.value) ? clamp01(cv * w) : null, availability: competence.availability });
    const contributions = {
      cd8_activation: target(T.cd8_activation), cd8_effector_competence: target(T.cd8_effector_competence),
      cd4_helper_effectiveness: target(T.cd4_helper_effectiveness), adaptive_persistence: target(T.adaptive_persistence),
      dysfunction_probability: target(T.dysfunction_probability), exhaustion_probability: target(T.exhaustion_probability),
    };
    const capability = { value: competence.value, availability: competence.availability };
    const blocked = blockedPotential(capability, { value: persistenceValue, availability: competence.availability });
    const availability = overallAvailability([recruitment, infiltration, activation, competence]);

    return deepFreeze({
      runtimeType: 'treg', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      recruitment: { value: recruitment.value, state: categorize(isFiniteNumber(recruitment.value) ? recruitment.value : 0, TH.recruitment), availability: recruitment.availability },
      infiltration: { value: infiltration.value, state: categorize(isFiniteNumber(infiltration.value) ? infiltration.value : 0, TH.infiltration), availability: infiltration.availability },
      activation: { value: activation.value, state: categorize(isFiniteNumber(activation.value) ? activation.value : 0, TH.activation), availability: activation.availability },
      suppressiveCompetence: { value: competence.value, state: categorize(isFiniteNumber(competence.value) ? competence.value : 0, TH.suppressive_competence), availability: competence.availability },
      suppressivePersistence: { value: persistenceValue, availability: competence.availability },
      effectiveSuppressiveContribution: { value: competence.value, availability: competence.availability },
      contributions, blockedSuppressivePotential: { value: blocked.value, availability: blocked.availability },
      availability, confidence: this.conf.propagate({ unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
    });
  }
}

export default ImmuneTregRuntime;
