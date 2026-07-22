// TypeScript interface contract for Phase-7C immune microenvironment (types only, no runtime code).
// Part 1 - Section 1: FOUNDATIONAL CONTRACTS. Describes the immune registries, the versioned immutable
// ImmuneFrame, the input snapshot, the availability model, the contribution ledger, the runtime-issue
// model, and the read-only Phase-7C -> Phase-8A resistance context. Checked via `tsc --noEmit`.
// Prediction-only (no experimental tier). Component biology is UNAVAILABLE until later sections.
// No `any`.

export type ImmuneEvidenceLevel =
  | 'HIGH_CONFIDENCE_PREDICTION' | 'LITERATURE_DERIVED_PREDICTION' | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION' | 'HYPOTHESIS' | 'NOT_REPORTED' | 'UNAVAILABLE' | 'CONTRADICTORY_EVIDENCE';
export type ImmunePredictionLabel =
  | 'MECHANISTIC_PREDICTION' | 'CROSS_SPECIES_PREDICTION' | 'CROSS_TUMOR_PREDICTION' | 'FORMULATION_PREDICTION'
  | 'IMMUNE_CONTEXT_PREDICTION' | 'EVIDENCE_GAP' | 'NOT_REPORTED' | 'UNAVAILABLE' | 'UNSUPPORTED';
export type Availability = 'AVAILABLE' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
export type IssueSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
export type FrameStatus = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'FOUNDATIONAL';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** A structurally valid metric that may be explicitly unavailable (never a silent zero). */
export interface ImmuneMetric { value: number | null; availability: Availability; reason?: string; }

// ---- registry: context profile ---------------------------------------------
export interface ImmuneContextProfile {
  profile_id: string; species: string; tumour_model: string; drug: string; formulation: string;
  immune_available: boolean; default_runtime?: boolean; predictive_exploratory?: boolean; default_shown?: boolean;
  baseline_immune_posture?: string; supported_domains: string[];
  confidence: Confidence; uncertainty: string;
  evidence_level: ImmuneEvidenceLevel; prediction_level: ImmuneEvidenceLevel;
  human_translation_warning?: string; evidence_refs: string[]; reason?: string; limitations: string; excluded_processes: string[];
}
export interface ImmuneContextRegistry { registry_bundle_version: string; profiles: Record<string, ImmuneContextProfile>; context_rules: Record<string, string>; }

// ---- runtime issue / contribution / source-frame reference -----------------
export interface ImmuneRuntimeIssue {
  code: string; severity: IssueSeverity; category: string; module: string; message: string;
  affectedField: string | null; sourceFrame: string | null; recoverable: boolean; metadata: Record<string, unknown>;
}
export interface ImmuneContributionRecord {
  contributionId: string; targetMetric: string; sourceModule: string; sourceMetric: string;
  rawValue: number | null; normalizedValue: number | null; weight: number | null; signedContribution: number | null;
  availability: Availability; evidenceId: string | null; predictionId: string | null; registryEntryId: string | null;
  applied: boolean; exclusionReason: string | null; warningCodes: string[]; metadata: Record<string, unknown>;
}
export interface SourceFrameReference {
  engineName: string; frameId: string | null; schemaVersion: string | null; simulationTime: number | null;
  availability: Availability; contentId: string | null; compatibilityStatus: string;
}

// ---- temporal + input snapshot ---------------------------------------------
export interface TemporalImmuneContext {
  currentTime: number; previousTime: number | null; deltaTime: number; frameIndex: number;
  initializationStatus: string; priorFrameAvailable: boolean; discontinuity: boolean;
  treatmentStartMarker: string | null; treatmentStopMarker: string | null;
}
export interface ImmuneInputField { value: number | null; availability: Availability; source: string | null; confidence: string | null; frameTime: number | null; warnings: string[]; }
export interface ImmuneInputSnapshot {
  simulationContext: Record<string, unknown>; temporalContext: TemporalImmuneContext;
  tumorContext: Record<string, ImmuneInputField>; treatmentContext: Record<string, ImmuneInputField>;
  exposureContext: Record<string, ImmuneInputField>; damageContext: Record<string, ImmuneInputField>;
  passiveMicroenvironmentContext: Record<string, ImmuneInputField>; vascularContext: Record<string, ImmuneInputField>;
  priorImmuneContext: ImmuneFrame | null; registryContext: Record<string, unknown>;
  availabilitySummary: Record<string, Availability>; warnings: ImmuneRuntimeIssue[];
}

// ---- domain states (foundational: UNAVAILABLE-capable) ---------------------
export interface TumorVisibilityState { availability: Availability; antigenAvailability: ImmuneMetric; detectability: ImmuneMetric; presentationPotential: ImmuneMetric; effectiveRecognition: ImmuneMetric; summary: ImmuneMetric; }
export interface MacrophageState { availability: Availability; polarizationTendency: string; tumorOpposingTendency: ImmuneMetric; tumorSupportingTendency: ImmuneMetric; }
export interface NKState { availability: Availability; available: ImmuneMetric; presence: ImmuneMetric; activation: ImmuneMetric; functionalCompetence: ImmuneMetric; suppression: ImmuneMetric; cytotoxicPotential: ImmuneMetric; }
export interface DendriticCellState { availability: Availability; available: ImmuneMetric; antigenUptakePotential: ImmuneMetric; maturation: ImmuneMetric; presentationPotential: ImmuneMetric; suppression: ImmuneMetric; }
export interface InnateImmunityState { availability: Availability; macrophage: MacrophageState; nk: NKState; dendritic: DendriticCellState; }
export interface AntigenPresentationState { availability: Availability; presentationCapacity: ImmuneMetric; maturationSupport: ImmuneMetric; effectivePresentation: ImmuneMetric; suppression: ImmuneMetric; }
export interface CD8State { availability: Availability; available: ImmuneMetric; infiltration: ImmuneMetric; priming: ImmuneMetric; activation: ImmuneMetric; effectorCompetence: ImmuneMetric; suppression: ImmuneMetric; exhaustion: ImmuneMetric; recoveryPotential: ImmuneMetric; cytotoxicContribution: ImmuneMetric; }
export interface CD4State { availability: Availability; available: ImmuneMetric; activation: ImmuneMetric; adaptiveSupport: ImmuneMetric; suppression: ImmuneMetric; functionalContribution: ImmuneMetric; }
export interface TregState { availability: Availability; available: ImmuneMetric; enrichment: ImmuneMetric; activation: ImmuneMetric; suppressivePressure: ImmuneMetric; escapeContribution: ImmuneMetric; }
export interface AdaptiveImmunityState { availability: Availability; cd8: CD8State; cd4: CD4State; treg: TregState; }
export interface CheckpointComponentState { name: string; availability: Availability; componentAvailability: ImmuneMetric; expressionPressure: ImmuneMetric; interactionPotential: ImmuneMetric; functionalSuppression: ImmuneMetric; uncertainty: string; }
export interface CheckpointState { availability: Availability; pd1: CheckpointComponentState; pdl1: CheckpointComponentState; ctla4: CheckpointComponentState; pd1PdL1AxisPressure: ImmuneMetric; ctla4Pressure: ImmuneMetric; }
export interface ImmuneSuppressionState { availability: Availability; components: ImmuneContributionRecord[]; totalSuppressionPressure: ImmuneMetric; confidence: Confidence; }
export interface ImmuneEscapeState { availability: Availability; components: ImmuneContributionRecord[]; escapePressure: ImmuneMetric; persistentEscape: ImmuneMetric; confidence: Confidence; }
export interface ImmuneEffectState { availability: Availability; potential: ImmuneMetric; effectiveModifier: ImmuneMetric; blockedPotential: ImmuneMetric; uncertainty: string; }
export interface ResistanceReadinessState {
  availability: Availability; contractVersion: string;
  immuneSuppression: ImmuneMetric; immuneEscape: ImmuneMetric; persistentImmuneEscape: ImmuneMetric;
  checkpointPressure: ImmuneMetric; tumorVisibility: ImmuneMetric; exhaustedAdaptiveResponse: ImmuneMetric; immuneMediatedTumorLossModifier: ImmuneMetric;
}

// ---- immutable frame -------------------------------------------------------
export interface ImmuneFrame {
  schemaVersion: string; engineVersion: string; registryBundleVersion: string; stateMachineVersion: string; resistanceContractVersion: string;
  frameId: string; simulationId: string | null; simulationTime: number; frameIndex: number;
  species: string | null; tumourModel: string | null; formulation: string | null;
  availability: Availability; status: FrameStatus;
  sourceFrameReferences: SourceFrameReference[]; inputSummary: Record<string, unknown>;
  tumorVisibility: TumorVisibilityState; innateImmunity: InnateImmunityState; antigenPresentation: AntigenPresentationState;
  adaptiveImmunity: AdaptiveImmunityState; checkpointState: CheckpointState; immuneSuppression: ImmuneSuppressionState;
  immuneEscape: ImmuneEscapeState; immuneEffect: ImmuneEffectState; resistanceReadiness: ResistanceReadinessState;
  contributionLedger: ImmuneContributionRecord[]; evidenceRecords: Array<Record<string, unknown>>; predictionRecords: Array<Record<string, unknown>>;
  transitionRecords: Array<Record<string, unknown>>; warnings: Array<Record<string, unknown>>; errors: Array<Record<string, unknown>>; metadata: Record<string, unknown>;
}

// ---- read-only Phase-7C -> Phase-8A resistance context ---------------------
export interface ImmuneResistanceContext {
  available: boolean; status: Availability; compatible: boolean;
  contractVersion: string; schemaVersion: string | null; engineVersion: string | null; reason: string | null;
  immuneSuppression: ImmuneMetric; immuneEscape: ImmuneMetric; persistentImmuneEscape: ImmuneMetric;
  checkpointPressure: ImmuneMetric; tumorVisibility: ImmuneMetric; exhaustedAdaptiveResponse: ImmuneMetric; immuneMediatedTumorLossModifier: ImmuneMetric;
  warnings: Array<{ code: string; message: string }>;
}

// ---- stats + validation ----------------------------------------------------
export interface ImmuneStats {
  available: boolean; species: string; tumourModel: string; formulation: string | null;
  status: FrameStatus; availability: Availability; schemaVersion: string; engineVersion: string; frameIndex: number;
  evidenceLevel: ImmuneEvidenceLevel; timeH: number;
}
export interface ImmuneValidationRecord { ok: boolean; errors: string[]; warnings: string[]; }

// ---- state-machine registry ------------------------------------------------
export interface ImmuneStateMachineDefinition {
  type: 'categorical' | 'ordinal_bidirectional'; initial_state: string; states: string[];
  legal_transitions: Record<string, string[]>; disallowed?: string[];
}
export interface ImmuneTransitionRegistry { state_machine_version: string; state_machines: Record<string, ImmuneStateMachineDefinition>; rules: Record<string, string>; }

// ===========================================================================
// Part 1 - Section 2: SHARED RUNTIME SYSTEMS (additive; reused by every later biological module).
// ===========================================================================
export type RuntimeLifecycleStatus =
  | 'CREATED' | 'INITIALIZED' | 'READY' | 'RUNNING' | 'PARTIALLY_AVAILABLE' | 'UNAVAILABLE' | 'PUBLISHED' | 'FROZEN' | 'ARCHIVED';
export type ConfidenceCategory = 'VERY_LOW' | 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH';
export type EvidenceCategory =
  | 'Experimental' | 'Clinical' | 'Mechanistic' | 'Computational' | 'LiteratureDerived'
  | 'RepositoryAssumption' | 'ModelAssumption' | 'Calibration' | 'ExpertRule';
export type PredictionCategory =
  | 'ExpectedIncrease' | 'ExpectedDecrease' | 'ExpectedStability' | 'PotentialSuppression' | 'PotentialActivation'
  | 'PotentialEscape' | 'PotentialExhaustion' | 'PotentialRecovery' | 'PotentialRecruitment' | 'PotentialInfiltration'
  | 'PotentialFunctionalLoss' | 'PotentialFunctionalGain';
export type PredictionStatus = 'AVAILABLE' | 'SUPERSEDED' | 'EXPIRED' | 'UNAVAILABLE';
export type AggregationMethod =
  | 'weighted_average' | 'weighted_sum' | 'bounded_additive' | 'bounded_multiplicative' | 'min_selector'
  | 'max_selector' | 'dominant_contributor' | 'availability_aware_average' | 'confidence_weighted_average';
export type ValidationLevel = 'PASSED' | 'WARNING' | 'RECOVERABLE' | 'FATAL';

/** Base runtime object every immune biological object derives from. */
export interface BaseImmuneRuntimeObject {
  id: string; runtimeType: string; owner: string; schemaVersion: string; creationFrame: number;
  status: RuntimeLifecycleStatus; availability: Availability; confidence: { score: number | null; category: ConfidenceCategory | null };
  validationStatus: string; evidenceRefs: string[]; predictionRefs: string[]; contributionRefs: string[];
  transitionRefs: string[]; warnings: unknown[]; metadata: Record<string, unknown>;
}

export interface ImmuneTransitionRecord {
  transitionId: string; machine: string; previousState: string | null; newState: string | null;
  trigger: string | null; reason: string | null; frameIndex: number; simulationTime: number | null;
  confidence: number | null; availability: Availability; evidenceRefs: string[]; predictionRefs: string[];
  warnings: unknown[]; blocked: boolean; blockingReason: string | null; metadata: Record<string, unknown>;
}

export interface AggregationContribution { id: string; value: number | null; weight?: number; availability: Availability; confidence?: number; signed?: number; evidenceId?: string; predictionId?: string; }
export interface AggregationResult {
  target: string; method: AggregationMethod; value: number | null; availability: Availability; confidence: number | null;
  contributors: AggregationContribution[]; ignored: Array<{ id: string; reason: string }>;
  conflicts: Array<{ positive: string[]; negative: string[] }>; warnings: Array<{ code: string; message: string }>;
}
export interface ConfidenceResult { score: number; category: ConfidenceCategory; }

export interface SharedEvidenceRecord {
  evidenceId: string; title: string; description: string; interpretation: string; category: EvidenceCategory;
  sourceReference: string; strength: string; version: string; applicability: string; confidenceModifier: number; metadata: Record<string, unknown>;
}
export interface SharedPredictionRecord {
  predictionId: string; description: string; targetMetric: string | null; category: PredictionCategory; confidence: number | null;
  supportingEvidenceIds: string[]; affectedObjects: string[]; dependencies: string[]; availability: Availability;
  version: string; status: PredictionStatus; createdFrame: number; metadata: Record<string, unknown>;
}
export interface ExclusionRecord {
  exclusionId: string; reason: string; excludedContributor: string | null; replacementContributor: string | null;
  registryRule: string | null; frameIndex: number; metadata: Record<string, unknown>;
}
export interface ValidationReportItem { level: ValidationLevel; message: string; field: string | null; }
export interface ValidationReport { subject: string; issues: ValidationReportItem[]; }

export interface ImmuneAggregationRegistry {
  aggregation_framework_version: string; methods: Record<string, { description: string; bounded: boolean }>;
  targets: Record<string, { method: AggregationMethod; min: number; max: number }>; conflict_resolution: Record<string, unknown>; rules: Record<string, string>;
}
export interface ImmuneConfidenceRegistry {
  confidence_framework_version: string; categories: Record<ConfidenceCategory, { min: number; max: number }>;
  propagation: { base_confidence: number; penalties: Record<string, number>; floor: number; ceiling: number }; policy: Record<string, string>;
}

// ===========================================================================
// Part 1 - Section 4: ADAPTIVE IMMUNITY / CHECKPOINTS / SUPPRESSION / ESCAPE (additive).
// ===========================================================================
export interface StagedMetric { value: number | null; state?: string | null; availability: Availability; }
export interface AdaptiveImmuneContext {
  schemaVersion: string; registryVersion: string; frameIndex: number; simulationTime: number;
  sourceImmuneFrameId: string | null; sourceImmuneSchemaVersion: string | null;
  temporalContext: { frameIndex: number; currentTime: number; deltaTime: number; initializationStatus: string };
  inputs: Record<string, ImmuneMetric>; availability: Record<string, Availability>; previousAdaptiveState: unknown; innateAvailable: boolean;
}
export interface CD8Contribution {
  runtimeType: 'cd8'; owner: string; schemaVersion: string;
  priming: StagedMetric; recruitment: StagedMetric; infiltration: StagedMetric; activation: StagedMetric;
  effectorCompetence: ImmuneMetric; targetEngagement: ImmuneMetric; cytotoxicPotential: ImmuneMetric;
  dysfunction: ImmuneMetric; exhaustion: StagedMetric; recoveryPotential: ImmuneMetric;
  effectiveContribution: ImmuneMetric; blockedPotential: ImmuneMetric & { causes: string[] };
  availability: Availability; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface CD4HelperContribution {
  runtimeType: 'cd4'; owner: string; schemaVersion: string;
  priming: StagedMetric; recruitment: ImmuneMetric; infiltration: ImmuneMetric; activation: StagedMetric; helperCompetence: ImmuneMetric;
  support: Record<string, ImmuneMetric>; cd8Support: Record<string, number | null>;
  blockedPotential: ImmuneMetric & { causes: string[] }; effectiveContribution: ImmuneMetric;
  availability: Availability; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface TregContribution {
  runtimeType: 'treg'; owner: string; schemaVersion: string;
  recruitment: StagedMetric; infiltration: StagedMetric; activation: StagedMetric; suppressiveCompetence: StagedMetric; suppressivePersistence: ImmuneMetric;
  effectiveSuppressiveContribution: ImmuneMetric; contributions: Record<string, ImmuneMetric>; blockedSuppressivePotential: ImmuneMetric;
  availability: Availability; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface CheckpointContribution {
  runtimeType: 'checkpoint'; owner: string; schemaVersion: string;
  pd1: StagedMetric; pdl1: StagedMetric; axis: { engagement: number | null; state: string | null; availability: Availability; persistent: number | null }; ctla4: StagedMetric;
  pd_axis_engagement: number | null; persistent: number | null; ctla4_pressure: number | null;
  contributions: Record<string, ImmuneMetric>; overallCheckpointBurden: ImmuneMetric;
  availability: Availability; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface IntegratedSuppressionContribution {
  runtimeType: 'integrated_suppression'; owner: string; schemaVersion: string;
  pressure: number | null; state: string | null; availability: Availability; persistence: number | null; persistent: number | null;
  components: Array<{ id: string; value: number | null; availability: Availability; weight: number }>; contributions: Record<string, ImmuneMetric>;
  cd4_helper_support: number | null; blockedAdaptiveFunction: ImmuneMetric; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface ImmuneEscapeContribution {
  runtimeType: 'immune_escape'; owner: string; schemaVersion: string;
  recognitionEscape: ImmuneMetric; accessEscape: ImmuneMetric; primingEscape: ImmuneMetric; effectorEscape: ImmuneMetric;
  checkpointEscape: ImmuneMetric; suppressionEscape: ImmuneMetric; exhaustionEscape: ImmuneMetric;
  overallEscapePressure: ImmuneMetric; escapeMagnitudeState: string | null; escapePersistenceState: string | null;
  recoveryPotential: ImmuneMetric; availability: Availability; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface AdaptiveImmuneContribution {
  runtimeType: 'adaptive_immune'; owner: string; schemaVersion: string;
  readiness: ImmuneMetric; activation: ImmuneMetric; effectorCompetence: ImmuneMetric; effectiveCytotoxicPotential: ImmuneMetric;
  persistence: ImmuneMetric; recoveryPotential: ImmuneMetric; suppressionBurden: ImmuneMetric; checkpointBurden: ImmuneMetric;
  blockedPotential: ImmuneMetric & { categories: string[] }; escapePressure: ImmuneMetric; overallAdaptiveContribution: ImmuneMetric;
  availability: Availability; confidence: ConfidenceResult; evidenceRefs: string[]; predictionRefs: string[]; warnings: unknown[];
}
export interface NetImmuneIntegration {
  overallImmuneReadiness: ImmuneMetric; overallImmuneCompetence: ImmuneMetric; innateImmunePressure: ImmuneMetric; adaptiveImmunePressure: ImmuneMetric;
  netImmuneMediatedTumorLossPotential: ImmuneMetric; blockedImmunePotential: ImmuneMetric & { decomposition: Record<string, unknown> };
  overallSuppressionBurden: ImmuneMetric; overallCheckpointBurden: ImmuneMetric; overallImmuneEscapePressure: ImmuneMetric;
  immuneControlState: string | null; immuneFailureState: string | null; availability: Availability; confidence: ConfidenceResult;
}
export interface ExtendedImmuneResistanceContext extends ImmuneResistanceContext {
  immunePressureCurrent?: ImmuneMetric; immunePressurePersistent?: ImmuneMetric;
  immuneSuppressionCurrent?: ImmuneMetric; immuneSuppressionPersistent?: ImmuneMetric;
  checkpointBurdenCurrent?: ImmuneMetric; checkpointBurdenPersistent?: ImmuneMetric;
  immuneEscapeCurrent?: ImmuneMetric; immuneEscapePersistent?: ImmuneMetric;
  cd8DysfunctionBurden?: ImmuneMetric; cd8ExhaustionBurden?: ImmuneMetric; ineffectiveEngagementBurden?: ImmuneMetric;
  blockedImmunePotential?: ImmuneMetric; adaptiveRecoveryPotential?: ImmuneMetric;
  immuneControlState?: string | null; immuneFailureState?: string | null; causalGroups?: Record<string, string[]>;
}
