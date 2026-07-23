// Phase-7C Section 4 CD8 cytotoxic T-cell runtime. A STAGED deterministic process (priming ->
// recruitment -> infiltration -> activation -> effector competence -> target engagement -> cytotoxic
// potential -> dysfunction -> exhaustion -> recovery), never a single activity score. Negative factors
// (checkpoint / suppression / dysfunction / exhaustion) are applied at exactly ONE stage each through
// the shared double-counting guard. Consumes the immutable AdaptiveImmuneContext + prior CD8 state +
// (checkpoint, suppression, CD4 support) contributions READ-ONLY; publishes an immutable CD8Contribution.
// It NEVER mutates tumour state. Reuses Section-1/2 frameworks; deterministic; availability-gated.

import { AVAILABILITY, deepFreeze, clamp01, isFiniteNumber } from './immuneObjects.js';
import { weightsToContribs, evalStage, categorize, applyReductions, blockedPotential, metric, resultMetric, asMetric } from './immuneAdaptiveShared.js';

function overallAvailability(metrics) {
  let avail = 0, total = 0;
  for (const m of metrics) { total += 1; const a = asMetric(m).availability; if (a === AVAILABILITY.AVAILABLE) avail += 1; else if (a === AVAILABILITY.PARTIALLY_AVAILABLE) avail += 0.5; }
  if (total === 0 || avail === 0) return AVAILABILITY.UNAVAILABLE;
  return avail >= total ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE;
}
function priorMetric(prior, key) { return prior && prior[key] ? asMetric(prior[key]) : { value: null, availability: AVAILABILITY.UNAVAILABLE }; }

export class ImmuneCd8Runtime {
  constructor({ registries, aggregator, confidence }) {
    this.reg = registries.cd8;
    this.agg = aggregator; this.conf = confidence;
  }

  /**
   * @param {object} ctx AdaptiveImmuneContext
   * @param {object|null} prior previous CD8Contribution
   * @param {{ checkpoint?:object, suppression?:object, cd4Support?:object, guard?:object, frameIndex?:number }} opts
   * @returns {object} immutable CD8Contribution
   */
  evaluate(ctx, prior = null, opts = {}) {
    const I = ctx.inputs; const W = this.reg.stage_weights; const TH = this.reg.state_thresholds;
    const NP = this.reg.negative_penalties; const guard = opts.guard;
    const cp = opts.checkpoint || {}; const sup = opts.suppression || {}; const cd4 = opts.cd4Support || {};
    const warnings = [];
    // guard-gated penalty (registered once; excluded if a duplicate causal application is attempted)
    const pen = (target, source, module, magnitude) => {
      if (!isFiniteNumber(magnitude) || magnitude <= 0) return 0;
      if (!guard) return magnitude;
      const r = guard.apply({ targetMetric: `cd8_${target}`, sourceMetric: source, sourceModule: module, value: magnitude });
      return r.applied ? magnitude : 0;
    };
    const support = (v) => (isFiniteNumber(v) ? clamp01(v) : 0);

    // 1) priming
    const priming = resultMetric(evalStage(this.agg, 'cd8_priming', weightsToContribs({
      antigen_presentation: I.antigen_presentation_potential, adaptive_priming: I.adaptive_priming_potential,
      antigen_availability: I.antigen_availability, dc_effectiveness: I.dendritic_contribution,
      tumor_visibility: I.tumor_immune_visibility, prior_priming: priorMetric(prior, 'priming'),
    }, W.priming, 'cd8_priming_')));
    // CD4 priming support (additive boost, bounded)
    if (isFiniteNumber(priming.value)) priming.value = clamp01(priming.value + this.reg.cd4_support_weights.cd8_priming_support * support(cd4.cd8_priming_support));
    // 2) recruitment (independent of priming success)
    const recruitment = resultMetric(evalStage(this.agg, 'cd8_recruitment', weightsToContribs({
      priming, immune_accessibility: I.immune_accessibility, vascular_access: I.vascular_access,
      tumor_visibility: I.tumor_immune_visibility, prior_recruitment: priorMetric(prior, 'recruitment'),
    }, W.recruitment, 'cd8_recruit_')));
    // 3) infiltration (distinct from recruitment)
    const infiltration = resultMetric(evalStage(this.agg, 'cd8_infiltration', weightsToContribs({
      recruitment, immune_accessibility: I.immune_accessibility, vascular_functionality: I.vascular_functionality,
      prior_infiltration: priorMetric(prior, 'infiltration'),
    }, W.infiltration, 'cd8_infil_')));
    // 4) activation (checkpoint + suppression penalties applied once here)
    const activation = resultMetric(evalStage(this.agg, 'cd8_activation', weightsToContribs({
      priming, infiltration, antigen_availability: I.antigen_availability, tumor_visibility: I.tumor_immune_visibility,
      prior_activation: priorMetric(prior, 'activation'),
    }, W.activation, 'cd8_act_')));
    if (isFiniteNumber(activation.value)) {
      activation.value = clamp01(activation.value + this.reg.cd4_support_weights.cd8_activation_support * support(cd4.cd8_activation_support));
      activation.value = applyReductions(activation.value, [pen('activation', 'pd_axis', 'checkpoint', NP.checkpoint_on_activation * support(cp.pd_axis_engagement)), pen('activation', 'suppression', 'suppression', NP.suppression_on_activation * support(sup.pressure))]);
    }
    // 5) effector competence (not identical to activation)
    const dysfunctionPrior = priorMetric(prior, 'dysfunction');
    const exhaustionPrior = priorMetric(prior, 'exhaustion');
    const competence = resultMetric(evalStage(this.agg, 'cd8_effector_competence', weightsToContribs({
      activation, infiltration, target_visibility: I.tumor_immune_visibility, prior_competence: priorMetric(prior, 'effectorCompetence'),
    }, W.effector_competence, 'cd8_comp_')));
    if (isFiniteNumber(competence.value)) competence.value = applyReductions(competence.value, [
      pen('effector_competence', 'pd_axis', 'checkpoint', NP.checkpoint_on_competence * support(cp.pd_axis_engagement)),
      pen('effector_competence', 'suppression', 'suppression', NP.suppression_on_competence * support(sup.pressure)),
      pen('effector_competence', 'dysfunction', 'cd8', NP.dysfunction_on_competence * support(dysfunctionPrior.value)),
    ]);
    // 6) target engagement (distinct from killing)
    const targetEngagement = resultMetric(evalStage(this.agg, 'cd8_target_engagement', weightsToContribs({
      tumor_visibility: I.tumor_immune_visibility, antigen_availability: I.antigen_availability,
      immune_accessibility: I.immune_accessibility, infiltration, effector_competence: competence,
    }, W.target_engagement, 'cd8_te_')));
    // 7) cytotoxic potential
    const cytotoxic = resultMetric(evalStage(this.agg, 'cd8_cytotoxic_potential', weightsToContribs({
      effector_competence: competence, target_engagement: targetEngagement, activation, infiltration,
    }, W.cytotoxic_potential, 'cd8_cyto_')));
    if (isFiniteNumber(cytotoxic.value)) cytotoxic.value = applyReductions(cytotoxic.value, [
      pen('cytotoxic', 'exhaustion', 'cd8', NP.exhaustion_on_cytotoxic * support(exhaustionPrior.value)),
      pen('cytotoxic', 'dysfunction_late', 'cd8', NP.dysfunction_on_cytotoxic * support(dysfunctionPrior.value)),
    ]);

    // 8) dysfunction (gradual, continuous)
    const D = this.reg.dysfunction;
    const dysAgg = resultMetric(evalStage(this.agg, 'cd8_dysfunction', weightsToContribs({
      persistent_suppression: metric(support(sup.persistent), sup.pressure != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE),
      persistent_checkpoint: metric(support(cp.persistent), cp.pd_axis_engagement != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE),
      repeated_activation_without_clearance: activation, poor_microenvironment: metric(1 - clamp01(asMetric(I.immune_accessibility).value ?? 0), asMetric(I.immune_accessibility).availability),
      prior_dysfunction: dysfunctionPrior,
    }, D.contributors, 'cd8_dys_')));
    const dysfunction = metric(isFiniteNumber(dysAgg.value) ? clamp01((dysfunctionPrior.value || 0) + D.gradual_rate * dysAgg.value) : (isFiniteNumber(dysfunctionPrior.value) ? dysfunctionPrior.value : null), dysAgg.availability);

    // 9) exhaustion (persistent; min-duration gated)
    const EX = this.reg.exhaustion;
    const exhAgg = resultMetric(evalStage(this.agg, 'cd8_exhaustion', weightsToContribs({
      dysfunction_pressure: dysfunction, persistent_checkpoint: metric(support(cp.persistent), cp.pd_axis_engagement != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE),
      persistent_suppression: metric(support(sup.persistent), sup.pressure != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE),
      ineffective_engagement_history: metric(1 - clamp01(asMetric(targetEngagement).value ?? 0), targetEngagement.availability), prior_exhaustion: exhaustionPrior,
    }, EX.contributors, 'cd8_exh_')));
    // min-duration gate: exhaustion rises only if the driver persisted (prior driver present) or already exhausted
    let exhaustionValue = exhAgg.value;
    if (isFiniteNumber(exhaustionValue)) {
      const priorExh = exhaustionPrior.value || 0;
      const driverPersisted = (prior && isFiniteNumber(prior._exhaustionDriver) && prior._exhaustionDriver > EX.driver_persistence_threshold) || priorExh > 0;
      if (!driverPersisted) exhaustionValue = Math.min(exhaustionValue, priorExh + EX.hysteresis_margin);   // damp single-frame spike
    }
    const exhaustion = metric(exhaustionValue, exhAgg.availability);
    const exhaustionState = categorize(isFiniteNumber(exhaustionValue) ? exhaustionValue : 0, TH.exhaustion);

    // 10) recovery potential (bounded; incomplete)
    const RC = this.reg.recovery;
    const recovery = resultMetric(evalStage(this.agg, 'cd8_recovery', weightsToContribs({
      suppression_reduction: metric(1 - support(sup.pressure), sup.pressure != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE),
      checkpoint_reduction: metric(1 - support(cp.pd_axis_engagement), cp.pd_axis_engagement != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE),
      residual_competence: competence, recovery_duration: metric(RC.recovery_duration_fallback, AVAILABILITY.PARTIALLY_AVAILABLE), favorable_context: I.immune_accessibility,
    }, RC.contributors, 'cd8_rec_')));
    if (isFiniteNumber(recovery.value)) recovery.value = applyReductions(recovery.value, [RC.severity_penalty[exhaustionState] || 0]);

    // effective CD8 contribution = cytotoxic potential (bounded, penalties already applied once)
    const effective = metric(cytotoxic.value, cytotoxic.availability);
    // capability = upstream priming+activation potential (pre-penalty proxy) for blocked accounting
    const CW = this.reg.capability_weights;
    const capability = resultMetric(evalStage(this.agg, 'cd8_capability', [
      { id: 'cap_priming', value: priming.value, weight: CW.priming, availability: priming.availability },
      { id: 'cap_activation', value: activation.value, weight: CW.activation, availability: activation.availability },
      { id: 'cap_competence', value: competence.value, weight: CW.competence, availability: competence.availability },
    ]));
    const blocked = blockedPotential(capability, effective);

    const availability = overallAvailability([priming, recruitment, infiltration, activation, competence, cytotoxic]);
    const unavailableCount = [I.antigen_presentation_potential, I.adaptive_priming_potential, I.tumor_immune_visibility, I.immune_accessibility].filter((m) => asMetric(m).availability === AVAILABILITY.UNAVAILABLE).length;
    const conf = this.conf.propagate({ missingInputs: unavailableCount, unavailableDependencies: ctx.innateAvailable ? 0 : 1 });

    return deepFreeze({
      runtimeType: 'cd8', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      priming: { value: priming.value, state: categorize(isFiniteNumber(priming.value) ? priming.value : 0, TH.priming), availability: priming.availability },
      recruitment: { value: recruitment.value, state: categorize(isFiniteNumber(recruitment.value) ? recruitment.value : 0, TH.recruitment), availability: recruitment.availability },
      infiltration: { value: infiltration.value, state: categorize(isFiniteNumber(infiltration.value) ? infiltration.value : 0, TH.infiltration), availability: infiltration.availability },
      activation: { value: activation.value, state: categorize(isFiniteNumber(activation.value) ? activation.value : 0, TH.activation), availability: activation.availability },
      effectorCompetence: { value: competence.value, availability: competence.availability },
      targetEngagement: { value: targetEngagement.value, availability: targetEngagement.availability },
      cytotoxicPotential: { value: cytotoxic.value, availability: cytotoxic.availability },
      dysfunction: { value: dysfunction.value, availability: dysfunction.availability },
      exhaustion: { value: exhaustion.value, state: exhaustionState, availability: exhaustion.availability },
      recoveryPotential: { value: recovery.value, availability: recovery.availability },
      effectiveContribution: { value: effective.value, availability: effective.availability },
      blockedPotential: { value: blocked.value, availability: blocked.availability, causes: ['checkpoint', 'suppression', 'dysfunction', 'exhaustion', 'infiltration', 'target_engagement'] },
      availability, confidence: conf,
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings,
      _exhaustionDriver: isFiniteNumber(exhAgg.value) ? exhAgg.value : 0,
    });
  }
}

export default ImmuneCd8Runtime;
