// TypeScript interface contract for Phase-8A adaptive & acquired drug resistance (types only, no
// runtime code). Describes the Phase-8A registries and the engine object / frame shapes. Checked via
// `tsc --noEmit`. Resistance is a TIME-DEPENDENT process producing an ADVISORY treatment-sensitivity
// modifier; it never mutates an upstream engine. Prediction-only: schematic ordinal states + 0-1
// values, never a real IC50 / fold-resistance / time-to-resistance / mutation / resistant-cell count.
// No experimental tier. STOPS at resistance state + advisory modifier. Immune-associated resistance
// is UNAVAILABLE (Phase 7C not implemented in this build). No `any`.

export type ResistanceEvidenceLevel =
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'CONTRADICTORY_EVIDENCE';

export type ResistancePredictionLabel =
  | 'MECHANISTIC_PREDICTION' | 'CROSS_SPECIES_PREDICTION' | 'CROSS_TUMOR_PREDICTION' | 'FORMULATION_PREDICTION'
  | 'RESISTANCE_MECHANISM_PREDICTION' | 'PERSISTENCE_PREDICTION' | 'REVERSIBILITY_PREDICTION'
  | 'EVIDENCE_GAP' | 'NOT_REPORTED' | 'UNAVAILABLE' | 'UNSUPPORTED';

export type ResistanceMissingState =
  | 'NOT_REPORTED' | 'UNAVAILABLE' | 'UNSUPPORTED' | 'UNKNOWN' | 'INSUFFICIENT_EVIDENCE' | 'MECHANISTIC_PREDICTION_REQUIRED';

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

// ---- ordinal state name unions --------------------------------------------
export type IntrinsicSensitivityName = 'very_high_sensitivity' | 'high_sensitivity' | 'moderate_sensitivity' | 'low_sensitivity' | 'very_low_sensitivity' | 'heterogeneous_sensitivity' | 'unknown';
export type ExposureStatusName = 'untreated' | 'single_exposure' | 'repeated_exposure' | 'sustained_exposure' | 'interrupted' | 'washout' | 'rechallenge';
export type ExposureStageName = 'none' | 'initial' | 'early' | 'intermediate' | 'sustained' | 'post_exposure';
export type PressureStateName = 'absent' | 'negligible' | 'low' | 'moderate' | 'high' | 'very_high';
export type SurvivorCategoryName = 'no_meaningful_selection' | 'predominantly_sensitive_survivors' | 'mixed_survivors' | 'tolerant_survivors_enriched' | 'adaptive_survivors_enriched' | 'persistent_resistant_survivors_enriched';
export type ApparentResistanceCause = 'delivery_limited_response' | 'uptake_limited_response' | 'target_engagement_limited_response' | 'apoptosis_limited_response' | 'microenvironment_protected_response' | 'adaptive_resistance_consistent' | 'acquired_resistance_consistent' | 'insufficient_evidence';
export type DrugToleranceName = 'absent' | 'emerging' | 'established' | 'maintained' | 'resolving' | 'resolved';
export type AdaptiveResistanceName = 'absent' | 'initiating' | 'developing' | 'established' | 'maintained' | 'declining' | 'resolved' | 'persistence_evaluation';
export type AcquiredResistanceName = 'absent' | 'suspected' | 'emerging' | 'established' | 'persistent' | 'partially_reversible' | 're_sensitized';
export type PersistentResistanceName = 'not_evaluated' | 'persistence_pending' | 'persistent' | 'partially_reversible' | 'reversed';
export type ReSensitizationName = 'not_applicable' | 'not_observed' | 'possible' | 'partial' | 'substantial' | 'complete' | 'unknown';
export type WashoutStageName = 'no_washout' | 'early_washout' | 'intermediate_washout' | 'extended_washout';
export type RechallengeStateName = 'not_rechallenged' | 'rechallenge_pending' | 'rechallenge_active' | 'rechallenge_evaluated';
export type SubpopulationTypeName = 'sensitive' | 'tolerant' | 'adaptive_resistant' | 'persistent_resistant' | 'unclassified';
export type EnrichmentStateName = 'none' | 'weak' | 'moderate' | 'strong';
export type BurdenCategoryName = 'none' | 'low' | 'moderate' | 'high' | 'very_high';
export type MechanismCategoryName =
  | 'reduced_effective_intracellular_availability' | 'increased_efflux_tendency' | 'reduced_uptake_tendency'
  | 'reduced_target_availability' | 'compensatory_survival_signaling' | 'alternative_pathway_dependence'
  | 'stress_response_adaptation' | 'apoptosis_evasion' | 'cell_state_adaptation' | 'slow_cycling_or_tolerant_phenotype'
  | 'microenvironment_mediated_protection' | 'immune_associated_escape_pressure' | 'mixed_or_multifactorial_resistance' | 'unknown_mechanism';
export type OriginClassification = 'PRE_EXISTING_SELECTION' | 'TREATMENT_INDUCED_ADAPTATION' | 'TOLERANCE_TRANSITION' | 'PERSISTENCE_TRANSITION' | 'MICROENVIRONMENT_PROTECTION' | 'UNKNOWN_OR_MIXED';

export type FractionMap = Readonly<Record<SubpopulationTypeName, number>>;

// ---- registry: context profile --------------------------------------------
export interface ResistanceProfile {
  profile_id: string;
  profile_version: string;
  species: string;
  tumour_model: string;
  cell_line_or_model: string;
  drug: string;
  formulation: string;
  treatment_context: string;
  baseline_sensitivity: IntrinsicSensitivityName;
  baseline_resistant_fraction: number | null;
  baseline_tolerant_fraction: number | null;
  baseline_fractions: FractionMap | null;
  baseline_pathway_dependence?: string;
  baseline_apoptosis_competence?: string;
  baseline_uptake_competence?: string;
  baseline_stress_tolerance?: string;
  baseline_microenvironment_protection?: string;
  supported_mechanisms: MechanismCategoryName[];
  supported_exposure_patterns: ExposureStatusName[];
  supported_tolerance_states: DrugToleranceName[];
  supported_adaptive_states: AdaptiveResistanceName[];
  supported_acquired_states: AcquiredResistanceName[];
  supported_subpopulations: SubpopulationTypeName[];
  allowed_adapters: string[];
  resistance_available: boolean;
  default_runtime?: boolean;
  predictive_exploratory?: boolean;
  default_shown?: boolean;
  confidence: Confidence;
  uncertainty: string;
  evidence_level: ResistanceEvidenceLevel;
  prediction_level: ResistanceEvidenceLevel;
  human_translation_warning?: string;
  source_ids: string[];
  reason?: string;
  limitations: string;
  excluded_processes: string[];
  compatibility: Record<string, boolean>;
  validation_rules: string;
}
export interface ResistanceContext { profiles: Record<string, ResistanceProfile>; context_rules: Record<string, string>; }

// ---- registry: mechanism + subpopulation profiles -------------------------
export interface ResistanceMechanismProfile {
  mechanism_id: string; mechanism_category: MechanismCategoryName; mechanism_name: string;
  species: string; tumor_model: string; drug: string; formulation: string; treatment_context: string;
  mechanism_scope: string; reversibility: string; persistence: string;
  entry_conditions: string[]; maintenance_conditions: string[]; exit_conditions: string[];
  affected_response_stage: string; allowed_modifiers: string[]; maximum_modifier: number;
  evidence_level: ResistanceEvidenceLevel; prediction_level: ResistanceEvidenceLevel;
  confidence: Confidence; uncertainty: string; source_ids: string[]; limitations: string;
}
export interface SubpopulationProfile {
  subpopulation_id: string; subpopulation_type: SubpopulationTypeName; species: string; tumor_model: string;
  drug: string; formulation: string; baseline_fraction: number;
  sensitivity_state: IntrinsicSensitivityName; tolerance_state: DrugToleranceName;
  adaptive_state: AdaptiveResistanceName; persistent_state: PersistentResistanceName;
  mechanism_ids: string[]; transition_rules: string; enrichment_rules: string; decay_rules: string; re_sensitization_rules: string;
  evidence_level: ResistanceEvidenceLevel; prediction_level: ResistanceEvidenceLevel;
  confidence: Confidence; uncertainty: string; source_ids: string[]; limitations: string;
}

// ---- runtime objects ------------------------------------------------------
export interface BaselineResistanceState {
  intrinsicSensitivity: IntrinsicSensitivityName; baselineResistantFraction: number | null; baselineTolerantFraction: number | null;
  pathwayDependence: string; apoptosisCompetence: string; uptakeCompetence: string; stressTolerance: string; microenvironmentProtection: string;
  evidenceLevel: ResistanceEvidenceLevel; confidence: Confidence; uncertainty: string;
}
export interface IntrinsicSensitivityState { state: IntrinsicSensitivityName; initialResponseFactor: number | null; evidenceLevel: ResistanceEvidenceLevel; }
export interface TreatmentExposure { exposureStatus: ExposureStatusName; exposureStage: ExposureStageName; relativeExposureIntensity: number; effectiveIntracellularExposure: number; exposureConfidence: Confidence; evidenceLevel: ResistanceEvidenceLevel; }
export interface ExposureHistory {
  firstExposureStage: number | null; currentEpisode: number; cumulativeExposure: number; repeatedEpisodes: number;
  interrupted: boolean; washoutStage: WashoutStageName; rechallengeState: RechallengeStateName; previousMaximalPressure: number;
  priorTolerantState: DrugToleranceName; priorAdaptiveState: AdaptiveResistanceName; priorPersistentResistance: PersistentResistanceName;
  priorReSensitization: ReSensitizationName; priorEnrichmentDominant: SubpopulationTypeName; stageIndex: number;
}
export interface TreatmentPressureState {
  exposurePressure: number; cytotoxicPressure: number; stressPressure: number; apoptosisPressure: number;
  pathwayPressure: number; durationPressure: number; cumulativePressure: number; netTreatmentPressure: number;
  state: PressureStateName; confidence: Confidence; uncertainty: string;
}
export interface SurvivorState { category: SurvivorCategoryName; apparentResistanceCause: ApparentResistanceCause; evidenceLevel: ResistanceEvidenceLevel; }
export interface DrugToleranceState { state: DrugToleranceName; toleranceSurvivalModifier: number; reversibility: string; evidenceLevel: ResistanceEvidenceLevel; }
export interface AdaptiveResistanceState { state: AdaptiveResistanceName; adaptiveSensitivityReduction: number; mechanismCategory: MechanismCategoryName | null; reversibility: string; evidenceLevel: ResistanceEvidenceLevel; }
export interface AcquiredResistanceState { state: AcquiredResistanceName; acquiredSensitivityReduction: number; evidenceLevel: ResistanceEvidenceLevel; }
export interface PersistentResistanceState { state: PersistentResistanceName; persistenceResult: string; evidenceLevel: ResistanceEvidenceLevel; }
export interface ResistanceMechanismState { category: MechanismCategoryName; state: string; modifier: number | null; evidenceLevel: ResistanceEvidenceLevel; }
export interface UptakeResistanceState extends ResistanceMechanismState {}
export interface EffluxResistanceState extends ResistanceMechanismState {}
export interface TargetAvailabilityState extends ResistanceMechanismState {}
export interface SurvivalSignalingResistanceState extends ResistanceMechanismState {}
export interface StressAdaptationState extends ResistanceMechanismState {}
export interface ApoptosisEvasionState extends ResistanceMechanismState {}
export interface CellStateResistance extends ResistanceMechanismState {}
export interface MicroenvironmentProtectionState extends ResistanceMechanismState { deliveryProtection: number; stressProtection: number; apoptosisProtection: number; survivorEnrichment: number; }
export interface ImmuneAssociatedResistanceState extends ResistanceMechanismState { available: boolean; immuneEscapeProtection: number | null; treatmentDurabilityReduction: number | null; }
export interface TumorSubpopulation { type: SubpopulationTypeName; fraction: number; sensitivityState: string; resistanceState: string; responseModifier: number | null; evidenceLevel: ResistanceEvidenceLevel; predictionLevel: ResistanceEvidenceLevel; }
export interface SensitiveSubpopulation extends TumorSubpopulation {}
export interface TolerantSubpopulation extends TumorSubpopulation {}
export interface AdaptiveResistantSubpopulation extends TumorSubpopulation {}
export interface PersistentResistantSubpopulation extends TumorSubpopulation {}
export interface MixedPopulationState { fractions: Record<SubpopulationTypeName, number>; }
export interface SelectionPressureState { state: PressureStateName; selectionPressureValue: number; hasDifferentialSensitivity: boolean; evidenceLevel: ResistanceEvidenceLevel; }
export interface PopulationEnrichmentState { state: EnrichmentStateName; enrichmentStrength: number; changes: Record<SubpopulationTypeName, number>; dominantSubpopulation: SubpopulationTypeName; originClassification: OriginClassification; confidence: Confidence; uncertainty: string; evidenceLevel: ResistanceEvidenceLevel; }
export interface ReSensitizationState { state: ReSensitizationName; sensitivityRecovery: number | null; evidenceLevel: ResistanceEvidenceLevel; }
export interface WashoutState { stage: WashoutStageName; relativeRecovery: number; }
export interface RechallengeState { state: RechallengeStateName; responseRetention: number | null; }
export interface ResistanceBurden {
  intrinsic: number; tolerance: number; adaptive: number; persistent: number; microenvironmentProtection: number; immuneEscape: number;
  total: number; category: BurdenCategoryName; dominantMechanism: string; dominantSubpopulation: SubpopulationTypeName; confidence: Confidence; uncertainty: string;
}
export interface ResistanceResponseModifier {
  exposureEffectiveness: number; uptakeEffectiveness: number; targetEffectiveness: number; stressResponse: number;
  apoptosisSensitivity: number; populationLoss: number; recoveryPressure: number; regrowthPressure: number; durability: number; netTreatmentSensitivity: number;
  evidenceLevel: ResistanceEvidenceLevel; predictionLevel: ResistanceEvidenceLevel; confidence: Confidence; uncertainty: string; limitations: string;
}
export interface ResistanceTransition { machine: string; from: string; to: string; originClassification: OriginClassification; }
export interface ResistanceEvent {
  eventId: string; simulationFrame: number; simulationStage: string; eventType: string;
  previousState: string | null; nextState: string | null; affectedSubpopulation: SubpopulationTypeName | null;
  mechanismCategory: MechanismCategoryName | null; causalInputs: string[]; treatmentPressure: number;
  originClassification: OriginClassification; evidenceLevel: ResistanceEvidenceLevel; predictionLevel: ResistanceEvidenceLevel;
  confidence: Confidence; uncertainty: string; limitations: string; sourceIds: string[];
}

// ---- evidence + prediction records ----------------------------------------
export interface ResistanceEvidenceRecord {
  evidence_id: string; citation_id: string; title: string; authors: string; year: number | null; source_type: string;
  species: string; tumour_model: string; cell_line_or_model: string; drug: string; formulation: string;
  treatment_schedule: string; exposure_duration: string; washout_duration_if_reported: string; rechallenge_context_if_reported: string;
  baseline_response: string; post_exposure_response: string; resistance_endpoint: string; mechanism_category: string;
  measured_variables: string[]; quantitative_values_if_reported: string; units_if_reported: string;
  reversibility_result: string; persistence_result: string; directness: string; certainty: string; verification_status: string;
  supports: string[]; does_not_support: string[]; limitations: string; notes: string; supported_registry_entries: string[];
}
export interface ResistancePredictionRecord {
  prediction_id: string; prediction_type: ResistancePredictionLabel; source_context: string; target_context: string;
  species_transfer: string; tumor_transfer: string; formulation_transfer: string; mechanistic_basis: string;
  supporting_evidence_ids: string[]; assumptions: string[]; expected_direction: string; predicted_state: string;
  confidence: Confidence; uncertainty: string; falsifiability_statement: string; limitations: string;
  status: ResistancePredictionLabel; may_show_by_default: boolean;
}

// ---- frame + stats + validation -------------------------------------------
export interface ResistanceFrame {
  species: string; tumourModel: string; formulation: string | null; available: boolean;
  baseline: { intrinsicSensitivity: IntrinsicSensitivityName; initialResponseFactor: number | null; resistantFraction: number | null; tolerantFraction: number | null };
  exposure: { status: ExposureStatusName; stage: ExposureStageName; effective: number };
  pressure: { state: PressureStateName; net: number };
  survivor: { category: SurvivorCategoryName; apparentResistanceCause: ApparentResistanceCause };
  tolerance: { state: DrugToleranceName; modifier: number; reversibility: string };
  adaptive: { state: AdaptiveResistanceName; modifier: number; mechanism: MechanismCategoryName | null; reversibility: string };
  acquired: { state: AcquiredResistanceName; modifier: number };
  persistence: { state: PersistentResistanceName; result: string };
  mechanisms: Array<{ category: MechanismCategoryName; state: string; modifier: number | null; evidenceLevel: ResistanceEvidenceLevel }>;
  microenvironmentProtection: { level: string; deliveryProtection: number };
  immune: { available: boolean; state: string; evidence: 'MECHANISTIC_PREDICTION' | 'UNAVAILABLE' };
  population: { fractions: Record<SubpopulationTypeName, number>; dominant: SubpopulationTypeName; normalized: boolean };
  selection: { state: PressureStateName; value: number; differentialSensitivity: boolean };
  enrichment: { state: EnrichmentStateName; strength: number; dominant: SubpopulationTypeName; origin: OriginClassification };
  reSensitization: { state: ReSensitizationName; recovery: number | null };
  washout: { stage: WashoutStageName }; rechallenge: { state: RechallengeStateName };
  burden: { category: BurdenCategoryName; total: number; dominantMechanism: string; components: Record<string, number> };
  modifier: Record<string, number>;
  evidenceLevel: ResistanceEvidenceLevel; predictionLevel: ResistanceEvidenceLevel; predicted: boolean;
  confidence: Confidence; uncertainty: string; humanTranslationWarning: string | null; eventCount: number;
  modifiesResistanceStateOnly: true; calculatesUpstreamBiology: false; mutatesUpstream: false;
  combinationTherapyEvidence: 'NOT_EVALUATED'; forecastingEvidence: 'NOT_EVALUATED'; mutationEvidence: 'NOT_EVALUATED';
  clinicalOutcomeEvidence: 'NOT_EVALUATED'; immuneResistanceEvidence: 'MECHANISTIC_PREDICTION' | 'UNAVAILABLE';
  quantitativeStatus: 'NOT_REPORTED'; timeH: number; summaryLevel: string;
}
export interface ResistanceStats {
  available: boolean; species: string; tumourModel: string; formulation: string | null;
  intrinsicSensitivity: IntrinsicSensitivityName; treatmentPressure: PressureStateName; survivorState: SurvivorCategoryName;
  tolerance: DrugToleranceName; adaptive: AdaptiveResistanceName; acquired: AcquiredResistanceName; persistence: PersistentResistanceName;
  selectionPressure: PressureStateName; dominantSubpopulation: SubpopulationTypeName; resistanceBurden: BurdenCategoryName;
  totalBurden: number; netSensitivityModifier: number; immune: 'AVAILABLE' | 'UNAVAILABLE'; evidenceLevel: ResistanceEvidenceLevel; timeH: number;
}
export interface ResistanceValidationRecord { ok: boolean; errors: string[]; warnings: string[]; }

// ---- state-machine registry -----------------------------------------------
export interface StateMachineDefinition {
  type: 'categorical' | 'ordinal_bidirectional';
  initial_state: string;
  states: string[];
  legal_transitions: Record<string, string[]>;
  conditional_transitions?: Record<string, string>;
  disallowed?: string[];
  note?: string;
}
export interface ResistanceTransitionRegistry { state_machines: Record<string, StateMachineDefinition>; origin_classifications: OriginClassification[]; rules: Record<string, string>; }
