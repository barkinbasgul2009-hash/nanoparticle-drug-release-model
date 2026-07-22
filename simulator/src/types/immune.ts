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
