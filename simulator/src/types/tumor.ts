// TypeScript interface contract for Phase-6D tumour growth, regression & treatment response
// (types only, no runtime code). Describes the Phase-6D registries and the engine object /
// frame shapes. Checked via `tsc --noEmit`. A SCHEMATIC normalized tumour burden (baseline
// 1.0) derived from the Phase-6C population; never a real tumour volume / RECIST measurement.
// STOPS at the treatment-response trajectory - no clinical / survival / patient outcome.

/** Tumour evidence vocabulary (additive; includes an experimental tumour-model tier). */
export type TumorEvidenceLevel =
  | 'EXPERIMENTAL_FORMULATION_SPECIFIC'
  | 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'
  | 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC'
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

export type TumorResponseState =
  | 'idle' | 'not_reported' | 'unavailable'
  | 'untreated_growth' | 'treatment_started' | 'growth_continues' | 'growth_slowed'
  | 'stable_burden' | 'partial_regression' | 'strong_regression' | 'minimal_residual_burden'
  | 'treatment_ended' | 'rebound_possible' | 'rebound_in_progress' | 'stable_post_treatment' | 'unresolved';

export type TreatmentState = 'on' | 'off';
export type TimingType = 'reported_biological' | 'schematic_simulation';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Registry: a tumour context profile (per species + cell model). */
export interface TumorModelProfile {
  profile_id: string;
  species: string;
  cell_model: string;
  tumor_model: string;
  disease_context: string;
  drug?: string;
  route?: string;
  default_formulation: string;
  supported_formulations: string[];
  default_treatment_schedule: string;
  supported_response_states: TumorResponseState[];
  default_runtime?: boolean;
  tumor_available: boolean;
  population_gated: boolean;
  predictive_exploratory?: boolean;
  default_shown?: boolean;
  cycling_capacity_input?: string;
  evidence_level: TumorEvidenceLevel;
  prediction_level: TumorEvidenceLevel;
  confidence: Confidence;
  uncertainty: string;
  human_translation_warning?: string;
  evidence_refs: string[];
  reason?: string;
  stop_boundary: string;
  excluded_downstream_processes: string[];
}

export interface TumorContext {
  profiles: Record<string, TumorModelProfile>;
  context_rules: Record<string, string>;
}

/** Registry: a formulation profile. */
export interface TumorFormulationProfile {
  id: string;
  label: string;
  administration_route: string;
  growth_suppression_class: string;
  loss_induction_class: string;
  effect_rank: number;
  evidence_level: TumorEvidenceLevel;
  prediction_level: TumorEvidenceLevel;
  confidence: Confidence;
  uncertainty: string;
  evidence_refs: string[];
}

/** Runtime objects. */
export interface TumorBurdenState {
  id: string; species: string; cellModel: string; tumorModel: string; formulation: string | null;
  treatmentState: TreatmentState;
  baselineBurden: number; currentBurden: number;
  normalizedViableBurden: number; normalizedApoptoticBurden: number; normalizedTerminalBurden: number;
  growthPressure: number; lossPressure: number; netGrowthPressure: number;
  responseState: TumorResponseState;
  evidenceLevel: TumorEvidenceLevel; predictionLevel: TumorEvidenceLevel;
  confidence: Confidence; uncertainty: string;
  createdAt: number; updatedAt: number;
  stabilizedAt: number | null; regressionStartedAt: number | null; reboundStartedAt: number | null;
  notes: string;
}
export interface TumorGrowthPressure {
  baselineProliferativePressure: number; survivalPressure: number; populationViabilityInput: number;
  cellCycleInput: number; treatmentSuppression: number; resourceLimitation: number;
  netGrowthPressure: number; evidenceLevel: TumorEvidenceLevel; predictionLevel: TumorEvidenceLevel; confidence: Confidence;
}
export interface TumorLossPressure {
  apoptoticFractionInput: number; committedFractionInput: number; terminalFractionInput: number;
  treatmentInducedLoss: number; delayedLoss: number; clearanceExcluded: boolean;
  netLossPressure: number; evidenceLevel: TumorEvidenceLevel; predictionLevel: TumorEvidenceLevel; confidence: Confidence;
}
export interface TumorTreatmentEvent {
  id: string; formulation: string | null; administrationRoute: string;
  treatmentStart: number | null; treatmentEnd: number | null; repeatIndex: number; active: boolean;
  evidenceLevel: TumorEvidenceLevel; predictionLevel: TumorEvidenceLevel; timingType: TimingType; notes: string;
}

/** Evidence + prediction records. */
export interface TumorEvidenceRecord {
  kind: string; cell_model?: string; citation: string; verification_status: string;
  supports: string[]; does_not_support: string[]; quantitative_status: string; note: string;
}
export interface TumorPredictionRecord {
  prediction_category: TumorEvidenceLevel; profile_id: string; claim: string; confidence: Confidence;
  rationale: string; source_model: string; target_model: string; source_species: string; target_species: string;
  source_formulation: string; target_formulation: string; assumptions: string[]; uncertainty: string;
  limitations: string; reference_ids: string[]; quantitative_status: string; may_show_by_default: boolean;
}
export interface TumorUncertaintyRecord { confidence: Confidence; uncertainty: string; quantitative_status: string; }

/** Frame + timeline + curve + history + stats + validation. */
export interface TumorFrame {
  cellModel: string; species: string; formulation: string | null; tumorModel: string; available: boolean;
  responseState: TumorResponseState; treatmentState: TreatmentState;
  currentBurden: number; baselineBurden: number; normalizedViableBurden: number; normalizedApoptoticBurden: number; normalizedTerminalBurden: number;
  growthPressure: number; lossPressure: number; netGrowthPressure: number;
  evidenceLevel: TumorEvidenceLevel; predictionLevel: TumorEvidenceLevel;
  predicted: boolean; experimental: boolean; contextTransfer: boolean;
  confidence: Confidence; uncertainty: string;
  humanTranslationWarning: string | null; burdenWarning: string; quantitativeStatus: string;
  tumourResponseEvidence: 'EXPERIMENTAL_DIRECTION' | 'PREDICTED' | 'NOT_EVALUATED';
  clinicalResponseEvidence: 'NOT_EVALUATED'; survivalEvidence: 'NOT_EVALUATED'; recistEvidence: 'NOT_EVALUATED';
  metastasisEvidence: 'NOT_EVALUATED'; immuneEvidence: 'NOT_EVALUATED'; pkEvidence: 'NOT_EVALUATED';
  timeH: number; summaryLevel: string;
}
export interface TumorTimelineEvent { timeH: number; kind: string; event: string; }
export interface TumorResponseCurvePoint { timeH: number; burden: number; }
export interface TumorResponseCurve {
  cellModel: string; formulation: string | null; evidenceLevel: TumorEvidenceLevel;
  predicted: boolean; quantitativeStatus: string; timeWarning: string; points: TumorResponseCurvePoint[];
}
export interface TumorHistoryEntry {
  timeH: number; responseState: TumorResponseState; currentBurden: number;
  normalizedViableBurden: number; normalizedApoptoticBurden: number;
  growthPressure: number; lossPressure: number; netGrowthPressure: number;
  treatmentState: TreatmentState; formulation: string | null;
  evidenceLevel: TumorEvidenceLevel; predictionLevel: TumorEvidenceLevel; confidence: Confidence;
}
export type TumorHistory = TumorHistoryEntry[];
export interface TumorValidationRecord { ok: boolean; errors: string[]; warnings: string[]; }
