// Phase-7C Section 4 adaptive immune engine (orchestrator). Runs the DETERMINISTIC ACYCLIC evaluation
// sequence and assembles the final immutable ImmuneFrame + the Phase-8A resistance-readiness output.
// Consumes the Section-1 ImmuneFrame + (absent) Section-3 innate contribution + Phase-7A/7B engines
// READ-ONLY; mutates nothing upstream. Reuses the Section-1/2 frameworks (aggregation, confidence,
// double-counting guard, frame builder). Deterministic; availability-gated (Section-3 innate inputs
// UNAVAILABLE in this build -> most outputs UNAVAILABLE, never fabricated to zero; the machinery is
// exercised with injected inputs).
//
// Acyclic order (no within-frame circularity): Treg -> Checkpoint -> Integrated Suppression -> CD4 ->
// CD8 (consumes checkpoint/suppression/CD4 support) -> Escape -> Adaptive Integration -> Net Integration.

import { AVAILABILITY, ImmuneContributionLedger, deepFreeze, isFiniteNumber } from './immuneObjects.js';
import { ImmuneAggregator } from './immuneAggregation.js';
import { ImmuneConfidence } from './immuneConfidence.js';
import { ImmuneContributionGuard } from './immuneDoubleCounting.js';
import { buildImmuneFrame } from './immuneFrameBuilder.js';
import { buildAdaptiveContext } from './immuneAdaptiveContext.js';
import { ImmuneInnateRuntime } from './immuneInnate.js';
import { ImmuneStateMachines } from './immuneStateMachines.js';
import { populateTransitions } from './immuneTransitionPopulator.js';
import { ImmuneCd8Runtime } from './immuneCd8.js';
import { ImmuneCd4Runtime } from './immuneCd4.js';
import { ImmuneTregRuntime } from './immuneTreg.js';
import { ImmuneCheckpointRuntime } from './immuneCheckpoint.js';
import { ImmuneSuppressionRuntime } from './immuneSuppressionRuntime.js';
import { ImmuneEscapeRuntime } from './immuneEscapeRuntime.js';
import { ImmuneAdaptiveIntegration } from './immuneAdaptiveIntegration.js';
import { IMMUNE_RESISTANCE_CONTRACT_VERSION } from './immuneObjects.js';
import { ImmuneValidators, VALIDATION_LEVEL } from './immuneValidation.js';

const REQUIRED = ['cd8', 'cd4', 'treg', 'adaptiveCheckpoint', 'adaptiveSuppression', 'adaptiveEscape', 'adaptiveIntegration', 'adaptiveContext', 'aggregation', 'confidence', 'innateRuntime', 'transition'];

export class ImmuneAdaptiveEngine {
  /** @param {{ registries:Record<string,any>, microenvironmentEngine?:object, vascularEngine?:object, logger?:object }} deps */
  constructor(deps) {
    if (!deps || !deps.registries) throw new Error('ImmuneAdaptiveEngine requires the Phase-7C Section-4 registries');
    const missing = REQUIRED.filter((k) => !deps.registries[k]);
    if (missing.length) throw new Error(`ImmuneAdaptiveEngine missing registries: ${missing.join(', ')}`);
    this.reg = deps.registries;
    // fail early on malformed registry-driven scientific parameters (Remediation Part 3)
    const sci = ImmuneValidators.scientificParameters(this.reg);
    if (sci.level === VALIDATION_LEVEL.FATAL || sci.level === VALIDATION_LEVEL.RECOVERABLE) throw new Error(`ImmuneAdaptiveEngine invalid scientific parameters: ${sci.issues.map((i) => i.message).join('; ')}`);
    this.micro = deps.microenvironmentEngine || null;
    this.vascular = deps.vascularEngine || null;
    this.agg = new ImmuneAggregator(this.reg.aggregation);
    this.conf = new ImmuneConfidence(this.reg.confidence);
    const shared = { registries: this.reg, aggregator: this.agg, confidence: this.conf };
    this.innate = new ImmuneInnateRuntime(shared);          // Section 3 innate runtime (real, production)
    this.sm = new ImmuneStateMachines(this.reg.transition); // shared state-machine framework
    this.treg = new ImmuneTregRuntime(shared);
    this.checkpoint = new ImmuneCheckpointRuntime(shared);
    this.suppression = new ImmuneSuppressionRuntime(shared);
    this.cd4 = new ImmuneCd4Runtime(shared);
    this.cd8 = new ImmuneCd8Runtime(shared);
    this.escape = new ImmuneEscapeRuntime(shared);
    this.integration = new ImmuneAdaptiveIntegration(shared);
    this._prior = null; this._frameSeq = 0; this.frameIndex = 0; this.publishedFrame = null;
  }

  /**
   * Evaluate one adaptive immune frame.
   * @param {{ immuneFrame?:object, innateContribution?:object, explicitInputs?:object, frameIndex?:number,
   *   simulationTime?:number, species?:string, tumourModel?:string }} def
   */
  evaluate(def = {}) {
    const frameIndex = Number.isInteger(def.frameIndex) ? def.frameIndex : this.frameIndex;
    const prior = this._prior;

    // --- Section 3 innate runtime (REAL production output; not a fixture/placeholder) ---
    const ex = def.explicitInputs || {};
    const um = (k) => (ex[k] && typeof ex[k] === 'object' ? ex[k] : (isFiniteNumber(ex[k]) ? { value: ex[k], availability: AVAILABILITY.AVAILABLE } : { value: null, availability: AVAILABILITY.UNAVAILABLE }));
    const fromEngine = (eng, fn) => (eng && (typeof eng.isIdle !== 'function' || !eng.isIdle()) && typeof eng[fn] === 'function' ? { value: eng[fn](), availability: AVAILABILITY.AVAILABLE } : { value: null, availability: AVAILABILITY.UNAVAILABLE });
    const rawInputs = {
      tumor_immune_visibility: um('tumor_immune_visibility'), antigen_availability: um('antigen_availability'),
      immune_accessibility: ex.immune_accessibility ? um('immune_accessibility') : fromEngine(this.micro, 'penetrationModifier'),
      vascular_access: ex.vascular_access ? um('vascular_access') : fromEngine(this.vascular, 'deliveryModifier'),
      damage: um('damage'),
    };
    const innate = def.innateContribution || this.innate.evaluate(rawInputs, prior ? prior.innate : null);

    const { context, issues } = buildAdaptiveContext({
      immuneFrame: def.immuneFrame || null, innateContribution: innate,
      vascularEngine: this.vascular, microenvironmentEngine: this.micro,
      explicitInputs: def.explicitInputs || {}, frameIndex, simulationTime: def.simulationTime ?? frameIndex,
      previousAdaptiveState: prior ? prior.adaptive : null, registries: this.reg,
    });
    const ledger = new ImmuneContributionLedger();
    const guard = new ImmuneContributionGuard(ledger);

    // --- acyclic evaluation ---
    const treg = this.treg.evaluate(context, prior ? prior.treg : null, { frameIndex });
    const checkpoint = this.checkpoint.evaluate(context, prior ? prior.checkpoint : null, { suppressionContext: prior ? prior.suppression : null, frameIndex });
    const suppression = this.suppression.evaluate(context, prior ? prior.suppression : null, { treg, checkpoint, guard, frameIndex });
    const cd4 = this.cd4.evaluate(context, prior ? prior.cd4 : null, { checkpoint, suppression, guard, frameIndex });
    const cd8 = this.cd8.evaluate(context, prior ? prior.cd8 : null, { checkpoint, suppression, cd4Support: cd4.cd8Support, guard, frameIndex });
    const escape = this.escape.evaluate(context, prior ? prior.escape : null, { cd8, cd4, treg, checkpoint, suppression, guard, frameIndex });
    const adaptive = this.integration.integrateAdaptive({ ctx: context, cd8, cd4, treg, checkpoint, suppression, escape, prior: prior ? prior.adaptive : null });
    const net = this.integration.integrateNet({ ctx: context, innate, adaptive, escape, suppression, checkpoint, cd8 });

    // --- transition population via the shared state controllers (real records; previous-state from
    // the prior canonical frame; no false initial transition) ---
    const currentStates = this._collectStates({ innate, cd8, cd4, treg, checkpoint, suppression, escape, net });
    const priorMeta = prior && prior.frame && prior.frame.metadata ? prior.frame.metadata : null;
    const tp = populateTransitions(this.sm, {
      priorStates: priorMeta ? priorMeta.controllerStates : null, currentStates,
      valueMap: this._collectValues({ cd8, treg, suppression, escape, net }), frameIndex,
      simulationTime: def.simulationTime ?? frameIndex, previousFrameId: prior ? prior.frame.frameId : null,
      enteredAt: priorMeta ? priorMeta.enteredAt : {},
    });

    const resistanceReadiness = this._buildReadiness({ net, escape, suppression, checkpoint, cd8, adaptive, context });
    const frame = this._assembleFrame({ def, context, innate, cd8, cd4, treg, checkpoint, suppression, escape, adaptive, net, resistanceReadiness, ledger, guard, issues, frameIndex, transitionRecords: tp.transitionRecords, controllerStates: tp.controllerStates, enteredAt: tp.enteredAt });

    const result = { frame, context, innate, cd8, cd4, treg, checkpoint, suppression, escape, adaptive, net, resistanceReadiness, transitions: tp.transitionRecords, ledger: ledger.toArray(), exclusions: guard.getExclusions() };
    this._prior = result; this.publishedFrame = frame; this.frameIndex = frameIndex + 1;
    return result;
  }

  step(dt) { return this.evaluate({ immuneFrame: this._prior ? this._prior.frame : null, frameIndex: this.frameIndex, simulationTime: this.frameIndex * (typeof dt === 'number' ? dt : 0.5) }); }

  _buildReadiness({ net, escape, suppression, checkpoint, cd8, adaptive, context }) {
    const m = (v, a) => ({ value: isFiniteNumber(v) ? v : null, availability: a || (isFiniteNumber(v) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE) });
    const anyAvail = net.availability !== AVAILABILITY.UNAVAILABLE || escape.availability !== AVAILABILITY.UNAVAILABLE;
    return deepFreeze({
      availability: anyAvail ? net.availability : AVAILABILITY.UNAVAILABLE,
      contractVersion: IMMUNE_RESISTANCE_CONTRACT_VERSION,
      // Section-1 fields (kept for backward compatibility with the existing adapter)
      immuneSuppression: net.overallSuppressionBurden, immuneEscape: net.overallImmuneEscapePressure,
      persistentImmuneEscape: m(escape.escapePersistenceState === 'PERSISTENT' || escape.escapePersistenceState === 'RECURRENT' ? (escape.overallEscapePressure.value ?? null) : null, escape.availability),
      checkpointPressure: net.overallCheckpointBurden, tumorVisibility: context.inputs.tumor_immune_visibility,
      exhaustedAdaptiveResponse: cd8.exhaustion, immuneMediatedTumorLossModifier: net.netImmuneMediatedTumorLossPotential,
      // Section-4 extended features (additive)
      immunePressureCurrent: net.adaptiveImmunePressure, immunePressurePersistent: adaptive.persistence,
      immuneSuppressionCurrent: net.overallSuppressionBurden, immuneSuppressionPersistent: m(suppression.persistent, suppression.availability),
      checkpointBurdenCurrent: net.overallCheckpointBurden, checkpointBurdenPersistent: m(checkpoint.persistent, checkpoint.axis ? checkpoint.axis.availability : AVAILABILITY.UNAVAILABLE),
      immuneEscapeCurrent: net.overallImmuneEscapePressure, immuneEscapePersistent: m(escape.escapePersistenceState === 'PERSISTENT' || escape.escapePersistenceState === 'RECURRENT' ? escape.overallEscapePressure.value : null, escape.availability),
      cd8DysfunctionBurden: cd8.dysfunction, cd8ExhaustionBurden: cd8.exhaustion,
      ineffectiveEngagementBurden: cd8.blockedPotential, blockedImmunePotential: net.blockedImmunePotential,
      adaptiveRecoveryPotential: adaptive.recoveryPotential, immuneControlState: net.immuneControlState, immuneFailureState: net.immuneFailureState,
      // causal-group metadata so Phase 8A can deduplicate summarised mechanisms
      causalGroups: {
        checkpoint: ['checkpointBurdenCurrent', 'checkpointBurdenPersistent'], suppression: ['immuneSuppressionCurrent', 'immuneSuppressionPersistent'],
        escape: ['immuneEscapeCurrent', 'immuneEscapePersistent', 'blockedImmunePotential'], exhaustion: ['cd8ExhaustionBurden', 'ineffectiveEngagementBurden'],
      },
      featureConfidence: net.confidence, featureAvailability: net.availability,
    });
  }

  /** Map computed categorical states -> registry machine names (for the transition populator). */
  _collectStates({ innate, cd8, cd4, treg, checkpoint, suppression, escape, net }) {
    const s = {};
    const set = (m, v) => { if (v != null) s[m] = v; };
    set('macrophage_polarization_state', innate.states && innate.states.macrophage_polarization); set('nk_activation_state', innate.states && innate.states.nk_activation); set('dc_maturation_state', innate.states && innate.states.dc_maturation);
    set('cd8_priming', cd8.priming.state); set('cd8_recruitment', cd8.recruitment.state); set('cd8_infiltration', cd8.infiltration.state); set('cd8_activation', cd8.activation.state); set('cd8_exhaustion', cd8.exhaustion.state);
    set('cd4_priming', cd4.priming.state); set('cd4_activation', cd4.activation.state);
    set('treg_recruitment', treg.recruitment.state); set('treg_infiltration', treg.infiltration.state); set('treg_activation', treg.activation.state); set('treg_suppressive_competence', treg.suppressiveCompetence.state);
    set('pd_pressure', checkpoint.pd1.state); set('ctla4_pressure', checkpoint.ctla4.state);
    set('suppression_pressure', suppression.state); set('escape_magnitude', escape.escapeMagnitudeState); set('escape_persistence', escape.escapePersistenceState);
    set('immune_control', net.immuneControlState); set('immune_failure', net.immuneFailureState);
    return s;
  }
  _collectValues({ cd8, treg, suppression, escape, net }) {
    return { cd8_priming: cd8.priming.value, cd8_activation: cd8.activation.value, cd8_exhaustion: cd8.exhaustion.value, treg_suppressive_competence: treg.suppressiveCompetence.value, suppression_pressure: suppression.pressure, escape_magnitude: escape.overallEscapePressure.value, immune_control: net.netImmuneMediatedTumorLossPotential.value };
  }

  _assembleFrame({ def, context, innate, cd8, cd4, treg, checkpoint, suppression, escape, adaptive, net, resistanceReadiness, ledger, guard, issues, frameIndex, transitionRecords, controllerStates, enteredAt }) {
    const availability = net.availability;
    const status = availability === AVAILABILITY.UNAVAILABLE ? 'FOUNDATIONAL' : availability === AVAILABILITY.AVAILABLE ? 'AVAILABLE' : 'PARTIAL';
    return buildImmuneFrame({
      frameId: `imf_adaptive_${++this._frameSeq}`, simulationTime: def.simulationTime ?? frameIndex, frameIndex,
      species: def.species || null, tumourModel: def.tumourModel || null,
      snapshot: { availabilitySummary: context.availability, temporalContext: context.temporalContext },
      sourceRefs: def.immuneFrame ? [{ engineName: 'immuneMicroenvironmentEngine', frameId: def.immuneFrame.frameId, schemaVersion: def.immuneFrame.schemaVersion, availability: AVAILABILITY.AVAILABLE, compatibilityStatus: 'COMPATIBLE' }] : [],
      domainStates: {
        innateImmunity: { availability: innate.availability, macrophage: innate.macrophage, nk: innate.nk, dendritic: innate.dendritic, antigenPresentation: innate.antigenPresentation, readiness: innate.readiness, tumorPressure: innate.tumorPressure, adaptivePrimingPotential: innate.adaptivePrimingPotential },
        adaptiveImmunity: { availability, cd8, cd4, treg, adaptive },
        checkpointState: { availability: checkpoint.availability, pd1: checkpoint.pd1, pdl1: checkpoint.pdl1, axis: checkpoint.axis, ctla4: checkpoint.ctla4, overallCheckpointBurden: checkpoint.overallCheckpointBurden },
        immuneSuppression: { availability: suppression.availability, pressure: suppression.pressure, state: suppression.state, persistent: suppression.persistent, components: suppression.components },
        immuneEscape: { availability: escape.availability, overallEscapePressure: escape.overallEscapePressure, magnitudeState: escape.escapeMagnitudeState, persistenceState: escape.escapePersistenceState, dimensions: { recognition: escape.recognitionEscape, access: escape.accessEscape, priming: escape.primingEscape, effector: escape.effectorEscape, checkpoint: escape.checkpointEscape, suppression: escape.suppressionEscape, exhaustion: escape.exhaustionEscape } },
        immuneEffect: { availability, potential: net.netImmuneMediatedTumorLossPotential, blockedPotential: net.blockedImmunePotential, controlState: net.immuneControlState, failureState: net.immuneFailureState },
        resistanceReadiness,
      },
      ledger, evidenceRecords: [{ id: 'im_b16bl6_posture' }], predictionRecords: [{ prediction_id: 'pred_im_b16bl6' }],
      transitionRecords, issues, availability, status,
      metadata: { section: 'part2-section2', innateAvailable: innate.availability !== AVAILABILITY.UNAVAILABLE, exclusionCount: guard.getExclusions().length, exclusions: guard.getExclusions(), controllerStates, enteredAt },
    });
  }

  getPublishedFrame() { return this.publishedFrame; }
  getInnateContribution() { return this._prior ? this._prior.innate : null; }
  getTransitions() { return this._prior ? this._prior.transitions : []; }
  getResistanceReadiness() { return this._prior ? this._prior.resistanceReadiness : null; }
}

export default ImmuneAdaptiveEngine;
