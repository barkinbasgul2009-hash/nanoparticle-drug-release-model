// Phase-7C Section 3 innate immune runtime. Produces one REAL, immutable InnateImmuneContribution
// (macrophage continuum + NK + dendritic + antigen presentation + innate integration + adaptive
// priming potential) computed DETERMINISTICALLY from validated upstream inputs (tumour visibility /
// antigen availability / immune accessibility / vascular access / treatment-induced damage) via the
// shared aggregation + confidence frameworks. NOT a fixture, NOT zeros: availability-gated (a missing
// input yields UNAVAILABLE, never zero). Its output FEEDS Section 4 read-only. Prediction-only;
// deterministic; deep-frozen at publication.

import { AVAILABILITY, deepFreeze, clamp, clamp01, isFiniteNumber } from './immuneObjects.js';
import { weightsToContribs, evalStage, categorize, resultMetric, asMetric, metric } from './immuneAdaptiveShared.js';

function overallAvailability(metrics) { let a = 0, t = 0; for (const m of metrics) { t += 1; const av = asMetric(m).availability; if (av === AVAILABILITY.AVAILABLE) a += 1; else if (av === AVAILABILITY.PARTIALLY_AVAILABLE) a += 0.5; } return (t === 0 || a === 0) ? AVAILABILITY.UNAVAILABLE : a >= t ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE; }
function priorMetric(prior, path) { let n = prior; for (const k of path) { if (!n) return { value: null, availability: AVAILABILITY.UNAVAILABLE }; n = n[k]; } return asMetric(n); }

export class ImmuneInnateRuntime {
  constructor({ registries, aggregator, confidence }) {
    this.reg = registries.innateRuntime; this.agg = aggregator; this.conf = confidence;
    if (!this.reg) throw new Error('ImmuneInnateRuntime requires the innate-runtime registry');
  }

  /**
   * @param {Record<string,{value:number|null,availability:string}>} rawInputs upstream inputs
   * @param {object|null} prior previous InnateImmuneContribution
   * @returns {object} immutable InnateImmuneContribution
   */
  evaluate(rawInputs = {}, prior = null) {
    const R = this.reg; const TH = R.state_thresholds;
    const I = {
      tumor_immune_visibility: asMetric(rawInputs.tumor_immune_visibility), antigen_availability: asMetric(rawInputs.antigen_availability),
      immune_accessibility: asMetric(rawInputs.immune_accessibility), vascular_access: asMetric(rawInputs.vascular_access), damage: asMetric(rawInputs.damage),
    };

    // --- macrophage (continuum) ---
    const opposing = resultMetric(evalStage(this.agg, 'innate_macrophage', weightsToContribs({
      tumor_immune_visibility: I.tumor_immune_visibility, immune_accessibility: I.immune_accessibility, innate_activation_context: priorMetric(prior, ['readiness']),
    }, R.macrophage.tumor_opposing_weights, 'mac_')));
    const opp = isFiniteNumber(opposing.value) ? opposing.value : null;
    const axis = isFiniteNumber(opp) ? clamp(opp - (1 - opp), -1, 1) : null;
    // States only when the underlying metric is AVAILABLE; UNAVAILABLE stays null (never a fabricated
    // concrete state) so the transition populator falls back to the machine's initial state instead.
    const macroState = isFiniteNumber(axis) ? categorize(axis, TH.macrophage_polarization) : null;

    // --- NK (staged) ---
    const nkAvail = resultMetric(evalStage(this.agg, 'innate_nk_available', weightsToContribs({ immune_accessibility: I.immune_accessibility, vascular_access: I.vascular_access }, R.nk.available_weights, 'nk_av_')));
    const nkAct = resultMetric(evalStage(this.agg, 'innate_nk_activation', weightsToContribs({ available: nkAvail, tumor_immune_visibility: I.tumor_immune_visibility, damage: I.damage }, R.nk.activation_weights, 'nk_act_')));
    const nkCompetence = nkAct;   // schematic: functional competence tracks activation here
    const nkCyto = resultMetric(evalStage(this.agg, 'innate_nk_cyto', weightsToContribs({ activation: nkAct, functional_competence: nkCompetence, available: nkAvail }, R.nk.cytotoxic_weights, 'nk_cy_')));
    const nkState = isFiniteNumber(nkAct.value) ? categorize(nkAct.value, TH.nk_activation) : null;

    // --- dendritic (staged) ---
    const dcAvail = resultMetric(evalStage(this.agg, 'innate_dc_available', weightsToContribs({ immune_accessibility: I.immune_accessibility, vascular_access: I.vascular_access }, R.dendritic.available_weights, 'dc_av_')));
    const dcUptake = resultMetric(evalStage(this.agg, 'innate_dc_uptake', weightsToContribs({ antigen_availability: I.antigen_availability, damage: I.damage, available: dcAvail }, R.dendritic.uptake_weights, 'dc_up_')));
    const dcMat = resultMetric(evalStage(this.agg, 'innate_dc_maturation', weightsToContribs({ uptake: dcUptake, tumor_immune_visibility: I.tumor_immune_visibility, available: dcAvail }, R.dendritic.maturation_weights, 'dc_ma_')));
    const dcPres = resultMetric(evalStage(this.agg, 'innate_dc_presentation', weightsToContribs({ maturation: dcMat, uptake: dcUptake, antigen_availability: I.antigen_availability }, R.dendritic.presentation_weights, 'dc_pr_')));
    const dcState = isFiniteNumber(dcMat.value) ? categorize(dcMat.value, TH.dc_maturation) : null;

    // --- antigen presentation (effective) ---
    const apEffective = resultMetric(evalStage(this.agg, 'innate_ap', weightsToContribs({ dc_presentation: dcPres, antigen_availability: I.antigen_availability }, R.antigen_presentation.effective_weights, 'ap_')));

    // --- innate integration ---
    const readiness = resultMetric(evalStage(this.agg, 'innate_readiness', weightsToContribs({ macrophage_tumor_opposing: opposing, nk_cytotoxic: nkCyto, dc_presentation: dcPres }, R.innate_integration.readiness_weights, 'inr_')));
    const tumorPressure = resultMetric(evalStage(this.agg, 'innate_tumor_pressure', weightsToContribs({ nk_cytotoxic: nkCyto, macrophage_tumor_opposing: opposing, innate_readiness: readiness }, R.innate_integration.tumor_pressure_weights, 'inp_')));

    // --- adaptive priming potential (FEEDS Section 4) ---
    const priming = resultMetric(evalStage(this.agg, 'innate_priming', weightsToContribs({ dc_presentation: dcPres, antigen_presentation_effective: apEffective, tumor_immune_visibility: I.tumor_immune_visibility, antigen_availability: I.antigen_availability }, R.adaptive_priming_potential.weights, 'prm_')));

    const availability = overallAvailability([I.tumor_immune_visibility, I.antigen_availability, I.immune_accessibility]);
    const unavailableCount = [I.tumor_immune_visibility, I.antigen_availability, I.immune_accessibility, I.vascular_access].filter((m) => m.availability === AVAILABILITY.UNAVAILABLE).length;

    return deepFreeze({
      runtimeType: 'innate', owner: 'immuneInnateRuntime', schemaVersion: '7C.1.0',
      macrophage: { value: opp, availability: opposing.availability, polarizationAxis: isFiniteNumber(axis) ? Math.round(axis * 1000) / 1000 : null, polarizationState: macroState, tumorOpposingTendency: opp, tumorSupportingTendency: isFiniteNumber(opp) ? clamp01(1 - opp) : null },
      nk: { value: nkCyto.value, availability: nkCyto.availability, available: nkAvail.value, activation: nkAct.value, functionalCompetence: nkCompetence.value, cytotoxicPotential: nkCyto.value, activationState: nkState },
      dendritic: { value: dcPres.value, availability: dcPres.availability, available: dcAvail.value, antigenUptakePotential: dcUptake.value, maturation: dcMat.value, presentationPotential: dcPres.value, maturationState: dcState },
      antigenPresentation: { value: apEffective.value, availability: apEffective.availability, effectivePresentation: apEffective.value },
      readiness: { value: readiness.value, availability: readiness.availability },
      tumorPressure: { value: tumorPressure.value, availability: tumorPressure.availability },
      adaptivePrimingPotential: { value: priming.value, availability: priming.availability },
      states: { macrophage_polarization: macroState, nk_activation: nkState, dc_maturation: dcState },
      availability, confidence: this.conf.propagate({ missingInputs: unavailableCount }),
      evidenceRefs: ['im_b16bl6_posture'], predictionRefs: ['pred_im_b16bl6'], warnings: [],
    });
  }
}

export default ImmuneInnateRuntime;
