// Phase-7C Section 4 immune-escape runtime. Escape = the integrated outcome in which tumour cells
// avoid/resist/outlast otherwise-available immune pressure - DISTINCT from suppression. Represented as
// MULTIPLE explicit dimensions (recognition / access / priming / effector / checkpoint / suppression /
// exhaustion) plus a temporal PERSISTENCE state kept SEPARATE from magnitude. It CONSUMES upstream
// blocked-potential metrics rather than re-applying raw penalties (double-count avoidance), and
// requires temporal persistence for persistent/recurrent escape (never inferred from one frame). NO
// genetic adaptation / clonal evolution / acquired resistance here (that is Phase 8A). Deterministic.

import { AVAILABILITY, deepFreeze, clamp01, isFiniteNumber } from './immuneObjects.js';
import { evalStage, categorize, contrib, resultMetric, asMetric } from './immuneAdaptiveShared.js';

function inv(m) { const a = asMetric(m); return { value: isFiniteNumber(a.value) ? clamp01(1 - a.value) : null, availability: a.availability }; }
function dimContribs(map, weights) { const out = []; for (const [name, w] of Object.entries(weights)) { if (name === 'note') continue; const a = asMetric(map[name]); out.push(contrib(name, a.value, a.availability, { weight: w })); } return out; }

export class ImmuneEscapeRuntime {
  constructor({ registries, aggregator, confidence }) { this.reg = registries.adaptiveEscape; this.agg = aggregator; this.conf = confidence; }

  evaluate(ctx, prior = null, opts = {}) {
    const R = this.reg; const DW = R.dimension_weights; const I = ctx.inputs;
    const cd8 = opts.cd8 || {}; const cd4 = opts.cd4 || {}; const treg = opts.treg || {}; const cp = opts.checkpoint || {}; const sup = opts.suppression || {}; const guard = opts.guard;

    const sources = {
      recognition_escape: { low_tumor_visibility: inv(I.tumor_immune_visibility), low_antigen_availability: inv(I.antigen_availability), poor_antigen_presentation: inv(I.antigen_presentation_potential), weak_target_engagement: inv(cd8.targetEngagement) },
      access_escape: { poor_immune_accessibility: inv(I.immune_accessibility), poor_vascular_access: inv(I.vascular_access), weak_recruitment: inv(cd8.recruitment), weak_infiltration: inv(cd8.infiltration) },
      priming_escape: { poor_dc_effectiveness: inv(I.dendritic_contribution), poor_antigen_presentation: inv(I.antigen_presentation_potential), low_adaptive_priming: inv(I.adaptive_priming_potential), ctla4_priming_inhibition: { value: cp.ctla4_pressure ?? null, availability: cp.ctla4 ? cp.ctla4.availability : AVAILABILITY.UNAVAILABLE }, failed_cd8_priming: inv(cd8.priming) },
      effector_escape: { weak_effector_competence: inv(cd8.effectorCompetence), poor_target_engagement: inv(cd8.targetEngagement), low_cytotoxic_potential: inv(cd8.cytotoxicPotential), insufficient_cd4_support: inv(cd4.helperCompetence), blocked_cd8_potential: asMetric(cd8.blockedPotential) },
      checkpoint_escape: { pd_axis_engagement: { value: cp.pd_axis_engagement ?? null, availability: cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE }, ctla4_pressure: { value: cp.ctla4_pressure ?? null, availability: cp.ctla4 ? cp.ctla4.availability : AVAILABILITY.UNAVAILABLE }, checkpoint_persistence: { value: cp.persistent ?? null, availability: cp.axis ? cp.axis.availability : AVAILABILITY.UNAVAILABLE } },
      suppression_escape: { treg_suppressive_competence: asMetric(treg.suppressiveCompetence), integrated_suppression: { value: sup.pressure ?? null, availability: sup.availability || AVAILABILITY.UNAVAILABLE }, poor_recovery_potential: inv(cd8.recoveryPotential) },
      exhaustion_escape: { exhaustion_severity: asMetric(cd8.exhaustion), exhaustion_duration: asMetric(cd8.exhaustion), recurrent_exhaustion: { value: (prior && prior._recurrenceCount) ? clamp01(0.2 * prior._recurrenceCount) : null, availability: prior ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE }, residual_blocked_cd8: asMetric(cd8.blockedPotential) },
    };

    const dims = {};
    for (const [dim, weights] of Object.entries(DW)) dims[dim] = resultMetric(evalStage(this.agg, `escape_${dim}`, dimContribs(sources[dim], weights)));

    // overall escape via shared aggregation (each dimension counted once)
    const overallContribs = Object.entries(R.overall_weights).map(([dim, w]) => contrib(dim, dims[dim] ? dims[dim].value : null, dims[dim] ? dims[dim].availability : AVAILABILITY.UNAVAILABLE, { weight: w }));
    if (guard) for (const c of overallContribs) guard.apply({ targetMetric: 'immune_escape_overall', sourceMetric: c.id, sourceModule: 'escape', value: c.value });
    const overall = resultMetric(evalStage(this.agg, 'net_immune_effect', overallContribs));   // confidence-weighted-ish; bounded
    const magnitudeState = categorize(isFiniteNumber(overall.value) ? overall.value : 0, R.magnitude_states);

    // temporal persistence (SEPARATE from magnitude)
    const P = R.persistence;
    const priorFrames = (prior && Number.isInteger(prior._persistFrames)) ? prior._persistFrames : 0;
    let persistFrames = priorFrames; let recurrenceCount = (prior && prior._recurrenceCount) || 0;
    if (isFiniteNumber(overall.value)) {
      if (overall.value >= P.activation_threshold) { if (priorFrames === 0 && (prior && prior._everActive)) recurrenceCount += 1; persistFrames = priorFrames + 1; }
      else if (overall.value < P.deactivation_threshold) persistFrames = Math.max(0, priorFrames - 1);
    }
    const everActive = (prior && prior._everActive) || persistFrames > 0;
    let persistenceState;
    if (persistFrames <= 0) persistenceState = 'NONE';
    else if (recurrenceCount >= 1 && persistFrames <= 2) persistenceState = 'RECURRENT';
    else if (persistFrames === 1) persistenceState = 'TRANSIENT';
    else if (persistFrames === 2) persistenceState = 'EMERGING';
    else if (persistFrames === 3) persistenceState = 'ESTABLISHED';
    else persistenceState = 'PERSISTENT';

    const recovery = { value: isFiniteNumber(overall.value) ? clamp01(1 - overall.value) : null, availability: overall.availability };
    return deepFreeze({
      runtimeType: 'immune_escape', owner: 'immuneAdaptiveEngine', schemaVersion: '7C.1.0',
      recognitionEscape: dims.recognition_escape, accessEscape: dims.access_escape, primingEscape: dims.priming_escape,
      effectorEscape: dims.effector_escape, checkpointEscape: dims.checkpoint_escape, suppressionEscape: dims.suppression_escape, exhaustionEscape: dims.exhaustion_escape,
      overallEscapePressure: { value: overall.value, availability: overall.availability },
      escapeMagnitudeState: magnitudeState, escapePersistenceState: persistenceState,
      recoveryPotential: recovery, availability: overall.availability, confidence: this.conf.propagate({ unavailableDependencies: ctx.innateAvailable ? 0 : 1 }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
      _persistFrames: persistFrames, _recurrenceCount: recurrenceCount, _everActive: everActive,
    });
  }
}

export default ImmuneEscapeRuntime;
