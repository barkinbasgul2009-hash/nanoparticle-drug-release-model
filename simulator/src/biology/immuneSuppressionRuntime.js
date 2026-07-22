// Phase-7C Section 4 integrated immune-suppression runtime. Combines Treg suppressive competence +
// PD-1/PD-L1 axis engagement + CTLA-4 pressure + microenvironment suppressive context into overall
// suppressive pressure via the Section-2 aggregation framework (bounded_multiplicative). Each component
// is uniquely identified (counted once); suppression influences ADAPTIVE FUNCTION only and never
// reduces tumour burden. Publishes contributions targeting distinct adaptive stages. Deterministic;
// availability-gated.

import { AVAILABILITY, deepFreeze, clamp01, isFiniteNumber } from './immuneObjects.js';
import { evalStage, categorize, contrib, resultMetric, asMetric } from './immuneAdaptiveShared.js';

export class ImmuneSuppressionRuntime {
  constructor({ registries, aggregator, confidence }) { this.reg = registries.adaptiveSuppression; this.agg = aggregator; this.conf = confidence; }

  evaluate(ctx, prior = null, opts = {}) {
    const R = this.reg; const CW = R.component_weights; const TH = R.state_thresholds.pressure;
    const treg = opts.treg || {}; const checkpoint = opts.checkpoint || {}; const I = ctx.inputs; const guard = opts.guard;
    const mic = asMetric(I.immune_accessibility); const micSuppression = isFiniteNumber(mic.value) ? 1 - mic.value : null;

    // components (each unique id via double-counting guard so nothing is re-applied)
    const components = [
      contrib('treg_suppressive_competence', asMetric(treg.suppressiveCompetence).value, asMetric(treg.suppressiveCompetence).availability, { weight: CW.treg_suppressive_competence }),
      contrib('pd_axis_engagement', checkpoint.pd_axis_engagement ?? null, checkpoint.axis ? checkpoint.axis.availability : AVAILABILITY.UNAVAILABLE, { weight: CW.pd_axis_engagement }),
      contrib('ctla4_pressure', checkpoint.ctla4_pressure ?? null, checkpoint.ctla4 ? checkpoint.ctla4.availability : AVAILABILITY.UNAVAILABLE, { weight: CW.ctla4_pressure }),
      contrib('microenvironment_suppressive_context', micSuppression, mic.availability, { weight: CW.microenvironment_suppressive_context }),
    ];
    if (guard) for (const c of components) guard.apply({ targetMetric: 'integrated_suppression', sourceMetric: c.id, sourceModule: 'suppression', value: c.value });
    const agg = resultMetric(evalStage(this.agg, 'immune_suppression', components));

    // persistence (from prior)
    const priorPersist = asMetric(prior && prior.persistence).value || 0;
    const persistence = isFiniteNumber(agg.value) ? clamp01(Math.max(agg.value, priorPersist * (1 - R.persistence.decay_rate))) : (isFiniteNumber(priorPersist) ? clamp01(priorPersist * (1 - R.persistence.decay_rate)) : null);

    const T = R.targets;
    const target = (w) => ({ value: isFiniteNumber(agg.value) ? clamp01(agg.value * w) : null, availability: agg.availability });
    return deepFreeze({
      runtimeType: 'integrated_suppression', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      pressure: agg.value, state: categorize(isFiniteNumber(agg.value) ? agg.value : 0, TH), availability: agg.availability,
      persistence, persistent: persistence,
      components: components.map((c) => ({ id: c.id, value: c.value, availability: c.availability, weight: c.weight })),
      contributions: {
        cd8_activation: target(T.cd8_activation), cd8_effector_competence: target(T.cd8_effector_competence),
        cd8_persistence: target(T.cd8_persistence), cd8_recovery: target(T.cd8_recovery), cd4_helper_support: target(T.cd4_helper_support),
        adaptive_readiness: target(T.adaptive_readiness), future_immune_effectiveness: target(T.future_immune_effectiveness),
      },
      // flat fields consumed downstream
      cd4_helper_support: target(T.cd4_helper_support).value,
      blockedAdaptiveFunction: { value: agg.value, availability: agg.availability },
      confidence: this.conf.propagate({ unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
    });
  }
}

export default ImmuneSuppressionRuntime;
