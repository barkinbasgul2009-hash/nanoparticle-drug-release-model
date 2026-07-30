// Phase-7C Section 4 endogenous checkpoint runtime (PD-1, PD-L1, PD-1/PD-L1 axis, CTLA-4). Represents
// checkpoint inhibition ALREADY present in the microenvironment - NOT therapeutic blockade. PD-1 and
// PD-L1 are separate component records; the axis is a registry-driven interaction (both components
// required - low ligand OR low receptor -> low engagement, never a plain multiply). CTLA-4 acts on
// PRIMING, separately from the PD axis (checkpoints are not interchangeable). Persistence accumulates
// gradually. Publishes contributions targeting distinct CD8/CD4 stages. Deterministic; availability-gated.

import { AVAILABILITY, deepFreeze, clamp, clamp01, isFiniteNumber } from './immuneObjects.js';
import { weightsToContribs, evalStage, categorize, resultMetric, asMetric } from './immuneAdaptiveShared.js';

function priorMetric(prior, path) { let n = prior; for (const k of path) { if (!n) return { value: null, availability: AVAILABILITY.UNAVAILABLE }; n = n[k]; } return asMetric(n); }
const val = (m) => (isFiniteNumber(asMetric(m).value) ? asMetric(m).value : null);

export class ImmuneCheckpointRuntime {
  constructor({ registries, aggregator, confidence }) { this.reg = registries.adaptiveCheckpoint; this.agg = aggregator; this.conf = confidence; }

  evaluate(ctx, prior = null, opts = {}) {
    const I = ctx.inputs; const R = this.reg; const TH = R.state_thresholds.pressure;
    const sup = opts.suppressionContext || {};
    // PD-1 pressure
    const pd1 = resultMetric(evalStage(this.agg, 'pd1_pressure', weightsToContribs({
      adaptive_activation_context: I.tumor_immune_visibility, persistent_engagement: priorMetric(prior, ['pd1', 'value']), prior_pd1: priorMetric(prior, ['pd1', 'value']),
    }, R.pd1.weights, 'pd1_')));
    // PD-L1 pressure
    const pdl1 = resultMetric(evalStage(this.agg, 'pdl1_pressure', weightsToContribs({
      tumor_immune_context: I.tumor_immune_visibility, suppressive_context: { value: sup.pressure ?? null, availability: sup.pressure != null ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE }, prior_pdl1: priorMetric(prior, ['pdl1', 'value']),
    }, R.pdl1.weights, 'pdl1_')));
    // PD-1/PD-L1 axis: registry-driven interaction (both required)
    const aw = R.axis.engagement_weights; const floor = R.axis.min_component_floor;
    let engagement = null; let axisAvail = AVAILABILITY.UNAVAILABLE;
    const p1 = val(pd1), pl = val(pdl1);
    if (isFiniteNumber(p1) && isFiniteNumber(pl)) {
      const both = Math.min(p1, pl) < floor ? 0 : 1;                    // low ligand OR receptor -> no engagement
      engagement = clamp(R.axis.interaction_gain * (aw.pd1_expression * p1 + aw.pdl1_expression * pl) * (Math.min(p1, pl)) * both, 0, 1);
      axisAvail = (pd1.availability === AVAILABILITY.AVAILABLE && pdl1.availability === AVAILABILITY.AVAILABLE) ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE;
    }
    // CTLA-4 pressure (targets priming)
    const ctla4 = resultMetric(evalStage(this.agg, 'ctla4_pressure', weightsToContribs({
      adaptive_priming_context: I.adaptive_priming_potential, persistent_priming_inhibition: priorMetric(prior, ['ctla4', 'value']), prior_ctla4: priorMetric(prior, ['ctla4', 'value']),
    }, R.ctla4.weights, 'ctla4_')));

    // persistence (gradual accumulation from prior)
    const priorEng = priorMetric(prior, ['axis', 'engagement']).value || 0;
    const persistent = isFiniteNumber(engagement) ? clamp01(priorEng + R.persistence.accumulation_rate * (engagement - priorEng >= 0 ? engagement : -R.persistence.reduction_rate)) : (isFiniteNumber(priorEng) ? clamp01(priorEng * (1 - R.persistence.reduction_rate)) : null);

    // contributions (unique per target)
    const pdT = R.targets.pd_axis; const ctT = R.targets.ctla4;
    const scale = (base, w) => ({ value: isFiniteNumber(base) ? clamp01(base * w) : null, availability: axisAvail });
    const ctScale = (w) => ({ value: isFiniteNumber(val(ctla4)) ? clamp01(val(ctla4) * w) : null, availability: ctla4.availability });

    return deepFreeze({
      runtimeType: 'checkpoint', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      pd1: { value: pd1.value, state: categorize(isFiniteNumber(pd1.value) ? pd1.value : 0, TH), availability: pd1.availability },
      pdl1: { value: pdl1.value, state: categorize(isFiniteNumber(pdl1.value) ? pdl1.value : 0, TH), availability: pdl1.availability },
      axis: { engagement, state: categorize(isFiniteNumber(engagement) ? engagement : 0, TH), availability: axisAvail, persistent },
      ctla4: { value: ctla4.value, state: categorize(isFiniteNumber(ctla4.value) ? ctla4.value : 0, TH), availability: ctla4.availability },
      // flat fields consumed by CD8/CD4/suppression/escape
      pd_axis_engagement: engagement, persistent, ctla4_pressure: ctla4.value,
      contributions: {
        cd8_activation: scale(engagement, pdT.cd8_activation), cd8_effector_competence: scale(engagement, pdT.cd8_effector_competence),
        cd8_exhaustion: scale(engagement, pdT.cd8_exhaustion), cd4_helper_competence: scale(engagement, pdT.cd4_helper_competence),
        adaptive_persistence: scale(engagement, pdT.adaptive_persistence),
        cd8_priming: ctScale(ctT.cd8_priming), cd4_priming: ctScale(ctT.cd4_priming), adaptive_priming: ctScale(ctT.adaptive_priming),
      },
      overallCheckpointBurden: { value: isFiniteNumber(engagement) || isFiniteNumber(val(ctla4)) ? clamp01(0.6 * (engagement || 0) + 0.4 * (val(ctla4) || 0)) : null, availability: axisAvail === AVAILABILITY.UNAVAILABLE && ctla4.availability === AVAILABILITY.UNAVAILABLE ? AVAILABILITY.UNAVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE },
      availability: axisAvail, confidence: this.conf.propagate({ unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
    });
  }
}

export default ImmuneCheckpointRuntime;
