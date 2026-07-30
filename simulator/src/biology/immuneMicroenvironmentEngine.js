// Phase-7C immune-microenvironment engine (Part 1 - Section 1: FOUNDATIONAL CONTRACTS). The top-level
// entry point of the immune runtime. It sits AFTER the tumour / Phase-7A microenvironment / Phase-7B
// vascular / apoptosis calculations and BEFORE Phase-8A resistance interpretation. It reads validated
// upstream outputs READ-ONLY (via the input adapter), evaluates immune state deterministically, and
// PUBLISHES a versioned, immutable ImmuneFrame consumed READ-ONLY by Phase 8A. It mutates NOTHING
// upstream, and Phase 8A mutates nothing here.
//
// SECTION-1 SCOPE: this section establishes the contracts, adapters, temporal model, availability
// model, frame builder, serialization, and the read-only 7C->8A boundary. The immune BIOLOGY
// (visibility / innate / adaptive / checkpoint / suppression / escape / net effect) is populated in
// later sections; component outputs are therefore structurally valid but explicitly UNAVAILABLE now
// (never hardcoded zeros). The frozen package has NO direct immune dataset (prediction-only; no
// experimental tier): mouse B16BL6 = MECHANISTIC_PREDICTION, human = predictive-exploratory, rat =
// NOT_REPORTED.

import {
  AVAILABILITY, ISSUE_SEVERITY, ImmuneRuntimeIssue, ImmuneContributionLedger, TemporalImmuneContext,
  TumorVisibilityState, InnateImmunityState, AntigenPresentationState, AdaptiveImmunityState,
  CheckpointState, ImmuneSuppressionState, ImmuneEscapeState, ImmuneEffectState, ResistanceReadinessState,
  IMMUNE_REGISTRY_BUNDLE_VERSION, isFiniteNumber,
} from './immuneObjects.js';
import { ImmuneStateMachines } from './immuneStateMachines.js';
import { ImmuneInputAdapter } from './immuneInputAdapter.js';
import { buildImmuneFrame } from './immuneFrameBuilder.js';
import { isImmuneEvidenceLevel, isImmunePrediction } from '../evidence/evidenceEngine.js';

const KNOWN_SPECIES = new Set(['mouse', 'human', 'rat']);
const REQUIRED = ['context', 'visibility', 'innate', 'antigenPresentation', 'adaptive', 'checkpoint', 'suppression', 'escape', 'effect', 'transition', 'evidence', 'prediction', 'validation'];
const MAX_PLAUSIBLE_DT = 1000;   // schematic guard against implausibly large simulation-time gaps

export class ImmuneMicroenvironmentEngine {
  /**
   * @param {{ registries: Record<string,any>, microenvironmentEngine?:object, vascularEngine?:object,
   *   populationEngine?:object, tumorEngine?:object, apoptosisEngine?:object,
   *   species?:string, tumourModel?:string, formulation?:string, logger?:object }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registries) throw new Error('ImmuneMicroenvironmentEngine requires the Phase-7C registries');
    const missing = REQUIRED.filter((k) => !deps.registries[k]);
    if (missing.length) throw new Error(`ImmuneMicroenvironmentEngine missing registries: ${missing.join(', ')}`);
    this.reg = deps.registries;
    this.logger = deps.logger || null;
    this.sm = new ImmuneStateMachines(this.reg.transition);
    this.adapter = new ImmuneInputAdapter({
      microenvironmentEngine: deps.microenvironmentEngine || null, vascularEngine: deps.vascularEngine || null,
      populationEngine: deps.populationEngine || null, tumorEngine: deps.tumorEngine || null, apoptosisEngine: deps.apoptosisEngine || null,
    });
    this.species = deps.species || 'human';
    this.tumourModel = deps.tumourModel || this._canonicalTumourModel(this.species);
    this._formulationOverride = deps.formulation || null;
    this._frameSeq = 0;
    this._build();
  }

  _canonicalTumourModel(species) { return species === 'mouse' ? 'B16BL6' : species === 'human' ? 'human_skin_melanoma_predictive' : species === 'rat' ? 'none' : null; }
  _profile() { return Object.values(this.reg.context.profiles || {}).find((p) => p.species === this.species && p.tumour_model === this.tumourModel) || null; }

  _build() {
    const p = this._profile();
    this.profile = p;
    this.available = !!(p && p.immune_available);
    this.formulation = p ? p.formulation : null;
    this.timeH = 0; this.frameIndex = 0; this._prevTime = null; this._priorFrame = null; this.publishedFrame = null;
    this.evaluateImmune({ temporalContext: new TemporalImmuneContext({ currentTime: 0, frameIndex: 0 }) });
  }

  isIdle() { return !this.available; }

  setSpecies(speciesId) { this.species = speciesId; this.tumourModel = this._canonicalTumourModel(speciesId); this._build(); this._log('info', 'immune', `species -> ${speciesId} (${this.tumourModel}; available=${this.available})`); return this; }
  setTumourModel(model) { this.tumourModel = model; this._build(); return this; }
  restart() { this._build(); return this; }
  reset() { return this.restart(); }

  // ---- foundational domain states (Section 1: structurally valid, UNAVAILABLE) ----
  _foundationalDomainStates() {
    return {
      tumorVisibility: new TumorVisibilityState(), innateImmunity: new InnateImmunityState(),
      antigenPresentation: new AntigenPresentationState(), adaptiveImmunity: new AdaptiveImmunityState(),
      checkpointState: new CheckpointState(), immuneSuppression: new ImmuneSuppressionState(),
      immuneEscape: new ImmuneEscapeState(), immuneEffect: new ImmuneEffectState(),
      resistanceReadiness: new ResistanceReadinessState(),
    };
  }

  _evidenceRecordsForProfile() {
    const recs = this.reg.evidence && this.reg.evidence.evidence_records || {};
    return ((this.profile && this.profile.evidence_refs) || []).map((id) => (recs[id] ? { id, ...recs[id] } : { id, availability: 'UNAVAILABLE' }));
  }
  _predictionRecordsForProfile() {
    const recs = this.reg.prediction && this.reg.prediction.prediction_records || {};
    return Object.values(recs).filter((r) => r.target_context === (this.profile && this.profile.profile_id)).map((r) => ({ ...r }));
  }

  /**
   * Evaluate + publish one immutable immune frame. Deterministic. Missing upstream inputs resolve to
   * explicit UNAVAILABLE (never zero). Section 1: component biology is UNAVAILABLE (foundational).
   */
  evaluateImmune(ctx = {}) {
    const issues = [];
    const ledger = new ImmuneContributionLedger();

    // --- temporal context + validation ---
    const currentTime = isFiniteNumber(ctx.currentTime) ? ctx.currentTime : (ctx.temporalContext && isFiniteNumber(ctx.temporalContext.currentTime) ? ctx.temporalContext.currentTime : this.timeH);
    let deltaTime = this._prevTime == null ? 0 : currentTime - this._prevTime;
    let discontinuity = false;
    if (!isFiniteNumber(deltaTime)) { issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_INVALID_DELTA_TIME', severity: ISSUE_SEVERITY.WARNING, module: 'immuneEngine', message: 'non-finite delta time; held at 0' })); deltaTime = 0; }
    else if (deltaTime < 0) { issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_INVALID_DELTA_TIME', severity: ISSUE_SEVERITY.WARNING, module: 'immuneEngine', message: `frame-order reversal (dt=${deltaTime}); flagged, held at 0` })); deltaTime = 0; discontinuity = true; }
    else if (deltaTime > MAX_PLAUSIBLE_DT) { issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_INVALID_DELTA_TIME', severity: ISSUE_SEVERITY.WARNING, module: 'immuneEngine', message: `implausibly large gap (dt=${deltaTime}); transitions may be unreliable` })); discontinuity = true; }
    const temporal = new TemporalImmuneContext({
      currentTime, previousTime: this._prevTime, deltaTime, frameIndex: this.frameIndex,
      priorFrameAvailable: !!this._priorFrame, discontinuity,
      initializationStatus: this._priorFrame ? 'CONTINUED' : 'INITIALIZED',
    });
    if (!this._priorFrame) issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_STATE_INITIALIZED', severity: ISSUE_SEVERITY.INFO, module: 'immuneEngine', message: 'immune state machines initialized from registry initial states (no prior frame)' }));

    // --- normalized input snapshot (read-only upstream) ---
    const { snapshot, sourceRefs, issues: adapterIssues } = this.adapter.build({
      temporalContext: temporal, treatmentContext: ctx.treatmentContext || {}, simulationContext: ctx.simulationContext || {},
      priorImmuneFrame: this._priorFrame, registries: this.reg,
    });
    issues.push(...adapterIssues);
    // record the prior 7C frame as a source reference for replay traceability
    if (this._priorFrame) sourceRefs.push({ engineName: 'immuneMicroenvironmentEngine', frameId: this._priorFrame.frameId, schemaVersion: this._priorFrame.schemaVersion, simulationTime: this._priorFrame.simulationTime, availability: AVAILABILITY.AVAILABLE, compatibilityStatus: 'COMPATIBLE' });

    // --- domain states (Section 1: foundational UNAVAILABLE; biology in later sections) ---
    const domainStates = this._foundationalDomainStates();
    let availability = AVAILABILITY.UNAVAILABLE;
    let status;
    if (!this.available) {
      status = 'UNAVAILABLE';   // rat / NOT_REPORTED context: fully idle
    } else {
      status = 'FOUNDATIONAL';  // context resolved (a labelled prediction) but component biology pending
      issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_INPUT_PARTIAL', severity: ISSUE_SEVERITY.INFO, module: 'immuneEngine', message: 'Phase-7C Section 1: immune context resolved; component biology UNAVAILABLE until later sections.' }));
    }

    // --- assemble + publish immutable frame ---
    const frame = buildImmuneFrame({
      frameId: `imf_${++this._frameSeq}`, simulationId: ctx.simulationId || null, simulationTime: currentTime, frameIndex: this.frameIndex,
      species: this.species, tumourModel: this.tumourModel, formulation: this.formulation,
      snapshot, sourceRefs, domainStates, ledger,
      evidenceRecords: this.available ? this._evidenceRecordsForProfile() : [], predictionRecords: this.available ? this._predictionRecordsForProfile() : [],
      transitionRecords: [], issues, availability, status,
      registryBundleVersion: (this.reg.context && this.reg.context.registry_bundle_version) || IMMUNE_REGISTRY_BUNDLE_VERSION,
      stateMachineVersion: this.sm.version,
      metadata: { evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED', predictionLevel: this.profile ? this.profile.prediction_level : 'NOT_REPORTED', section: 'part1-section1' },
    });

    // advance temporal bookkeeping (deterministic; no wall-clock)
    this._priorFrame = frame; this.publishedFrame = frame; this._prevTime = currentTime; this.timeH = currentTime;
    return frame;
  }

  /** Advance one deterministic step and publish the next frame. */
  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : 0.5;
    this.frameIndex += 1;
    return this.evaluateImmune({ currentTime: this.timeH + dt, temporalContext: new TemporalImmuneContext({ currentTime: this.timeH + dt, previousTime: this.timeH, frameIndex: this.frameIndex }) });
  }
  run(steps, dtHours) { for (let i = 0; i < steps; i++) this.step(dtHours); return this.publishedFrame; }

  // ---- accessors (read-only published frame) ----
  frame() { return this.publishedFrame; }
  getPublishedFrame() { return this.publishedFrame; }
  getResistanceReadiness() { return this.publishedFrame ? this.publishedFrame.resistanceReadiness : null; }

  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.evidence_level === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'MECHANISTIC_PREDICTION'); }
  summaryMessage() {
    if (this.isIdle()) return `Immune microenvironment: Not Reported / Unavailable for ${this.species} (${this.tumourModel}).`;
    return `Immune (${this.tumourModel}): ${this.profile.evidence_level} - context resolved; component biology UNAVAILABLE (Phase-7C Part 1 Section 1 foundational). Frame schema ${this.publishedFrame ? this.publishedFrame.schemaVersion : '?'}.`;
  }

  stats() {
    const f = this.publishedFrame || {};
    return {
      available: this.available, species: this.species, tumourModel: this.tumourModel, formulation: this.formulation,
      status: f.status || 'UNAVAILABLE', availability: f.availability || AVAILABILITY.UNAVAILABLE,
      schemaVersion: f.schemaVersion, engineVersion: f.engineVersion, frameIndex: f.frameIndex,
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED', timeH: r2(this.timeH),
    };
  }

  // ---- validation ----
  validate() {
    const errors = []; const warnings = [];
    const profs = this.reg.context.profiles || {};
    const seen = new Set();
    for (const [pid, p] of Object.entries(profs)) {
      if (seen.has(pid)) errors.push(`duplicate immune profile id: ${pid}`); seen.add(pid);
      if (p.profile_id && p.profile_id !== pid) errors.push(`profile ${pid} profile_id mismatch`);
      if (!KNOWN_SPECIES.has(p.species)) errors.push(`profile ${pid} invalid/unsupported species: ${p.species}`);
      if (!isImmuneEvidenceLevel(p.evidence_level)) errors.push(`profile ${pid} invalid evidence_level ${p.evidence_level}`);
      if (p.species === 'rat' && p.immune_available) errors.push(`profile ${pid} rat must not have available immune context (no fallback)`);
      if (!p.immune_available) { if (p.evidence_level !== 'NOT_REPORTED' && p.evidence_level !== 'UNAVAILABLE') errors.push(`profile ${pid} unavailable but evidence_level ${p.evidence_level}`); continue; }
      if (!isImmunePrediction(p.evidence_level)) errors.push(`profile ${pid} active immune context must be a labelled prediction (got ${p.evidence_level}); there is no experimental immune tier`);
    }
    // state-machine structural integrity
    const smv = this.sm.validate(); if (!smv.ok) errors.push(...smv.errors);
    // published frame must be immutable (frozen) and carry versions + explicit availability
    const f = this.publishedFrame;
    if (f) {
      if (!Object.isFrozen(f)) errors.push('published immune frame is not frozen (immutability violated)');
      if (!f.schemaVersion || !f.engineVersion || !f.resistanceContractVersion) errors.push('published immune frame missing version identifiers');
      if (!['AVAILABLE', 'PARTIALLY_AVAILABLE', 'UNAVAILABLE', 'NOT_APPLICABLE'].includes(f.availability)) errors.push('published immune frame has invalid availability');
      if (this.available && f.resistanceReadiness && f.resistanceReadiness.availability !== AVAILABILITY.UNAVAILABLE) warnings.push('Section 1 resistance readiness should be UNAVAILABLE (biology pending)');
    } else errors.push('no published immune frame');
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function r2(x) { return Math.round(x * 100) / 100; }

export default ImmuneMicroenvironmentEngine;
