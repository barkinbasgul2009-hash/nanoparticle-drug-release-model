// TypeScript interface contract for Phase-6C population response & tissue-level dynamics
// (types only, no runtime code). Describes the Phase-6C registries and the PopulationEngine
// object/frame shapes. Checked via `tsc --noEmit`. A SCHEMATIC virtual population derived
// from the Phase-6B single-cell apoptosis trajectory: normalized fractions only, never real
// cell counts. Conservation holds (living + apoptotic == 1); apoptotic is non-decreasing.
// STOPS at population composition - tumour / survival / clinical outcome is NEVER evaluated.

/** Population evidence vocabulary (additive; predictions + not-reported only - never experimental). */
export type PopulationEvidenceLevel =
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

export type PopulationFsmState =
  | 'idle' | 'not_reported' | 'unavailable'
  | 'healthy' | 'minimal_response' | 'adaptive_response' | 'partial_response'
  | 'mixed_population' | 'apoptosis_accumulating' | 'apoptosis_dominant' | 'stable_terminal_state';

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Registry: a population context-transfer record (e.g. B16 -> B16BL6). */
export interface PopulationContextTransfer {
  source_cell_model: string;
  target_cell_model: string;
  rationale: string;
  uncertain_differences: string[];
  reference_ids?: string[];
}

/** Registry: a population-response profile (per species + cell model). */
export interface PopulationProfile {
  profile_id: string;
  species: string;
  cell_model: string;
  disease_context: string;
  population_model: string;
  supported_population_states: PopulationFsmState[];
  supported_predictions: string[];
  default_runtime?: boolean;
  population_available: boolean;
  confidence: Confidence;
  uncertainty: string;
  evidence_level: PopulationEvidenceLevel;
  prediction_level: PopulationEvidenceLevel;
  context_transfer?: PopulationContextTransfer;
  evidence_refs: string[];
  reason?: string;
  stop_boundary: string;
  excluded_downstream_processes: string[];
}

export interface PopulationContext {
  profiles: Record<string, PopulationProfile>;
  context_rules: Record<string, string>;
}

/** Registry: the population state machine + dynamics defaults. */
export interface PopulationStateMachine {
  initial_state: PopulationFsmState;
  recoverable_states: PopulationFsmState[];
  irreversible_states: PopulationFsmState[];
  legal_transitions: Record<string, PopulationFsmState[]>;
  recovery_policy: string;
}
export interface PopulationDynamicsDefaults {
  dt_hours: number;
  susceptible_ceiling: number;
  apoptosis_conversion_rate_per_hour: number;
  pre_commitment_leak: number;
  adaptation_rate_per_hour: number;
  recovery_rate_per_hour: number;
  adaptive_stress_window: { low: number; high: number };
  relief_sensitivity: number;
  terminal_plateau_hours: number;
}
export interface PopulationTransitionsRegistry {
  state_machine: PopulationStateMachine;
  defaults: PopulationDynamicsDefaults;
}
export interface PopulationStateRegistry {
  fraction_semantics: Record<string, string>;
  population_states: { id: PopulationFsmState; description: string }[];
  idle_states: string[];
  composition_thresholds: Record<string, number | string>;
  stop_boundary: string;
  excluded_downstream_processes: string[];
}

/** Runtime object: the composition + state of a schematic virtual population. */
export interface PopulationState {
  populationId: string;
  species: string;
  cellModel: string;
  livingFraction: number;       // [0,1]; living + apoptotic == 1
  apoptoticFraction: number;    // [0,1]; non-decreasing
  adaptedFraction: number;      // [0,1]; sub-fraction of living
  recoveredFraction: number;    // [0,1]; sub-fraction of living
  cumulativeApoptosis: number;  // [0,1]; == apoptoticFraction
  populationState: PopulationFsmState;
  confidence: Confidence;
  uncertainty: string;
  evidenceLevel: PopulationEvidenceLevel;
  predictionLevel: PopulationEvidenceLevel;
  updatedAt: number;
}

/** Evidence + prediction + transfer records. */
export interface PopulationEvidenceRecord {
  kind: string; cell_model?: string; citation: string; verification_status: string;
  supports: string[]; does_not_support: string[]; note: string;
}
export interface PopulationPredictionRecord {
  profile_id: string; claim: string; level: PopulationEvidenceLevel; confidence: Confidence;
  source_context: string; target_context: string; transfer_assumptions: string[];
  uncertainty: string; species: string; cell_model: string; reference_ids: string[];
}

/** Frame + timeline + stats. */
export interface PopulationFrame {
  cellModel: string; available: boolean; populationState: PopulationFsmState;
  livingFraction: number; apoptoticFraction: number; adaptedFraction: number;
  recoveredFraction: number; cumulativeApoptosis: number;
  evidenceLevel: PopulationEvidenceLevel; predicted: boolean; contextTransfer: boolean;
  confidence: Confidence; uncertainty: string;
  populationCompositionEvidence: 'PREDICTED' | 'NOT_EVALUATED';
  tumourResponseEvidence: 'NOT_EVALUATED';
  survivalEvidence: 'NOT_EVALUATED';
  clinicalOutcomeEvidence: 'NOT_EVALUATED';
  timeH: number; summaryLevel: string;
}
export interface PopulationTimelineEvent { timeH: number; kind: string; event: string; }
export interface PopulationStats {
  available: boolean; cellModel: string; populationState: PopulationFsmState;
  livingFraction: number; apoptoticFraction: number; adaptedFraction: number;
  recoveredFraction: number; cumulativeApoptosis: number;
  evidenceLevel: PopulationEvidenceLevel; timeH: number; steps: number;
}
/** Alias for the reported per-step statistics (spec name). */
export type PopulationStatistics = PopulationStats;

/** One recorded step of the deterministic replay history. */
export interface PopulationHistoryEntry {
  timeH: number; populationState: PopulationFsmState;
  livingFraction: number; apoptoticFraction: number;
  adaptedFraction: number; recoveredFraction: number; cumulativeApoptosis: number;
  evidenceLevel: PopulationEvidenceLevel; predictionLevel: PopulationEvidenceLevel;
  confidence: Confidence; uncertainty: string;
}
export type PopulationHistory = PopulationHistoryEntry[];

/** Renderer-facing state (restrained composition bar + apoptotic-fraction sparkline). */
export interface PopulationRendererState {
  available: boolean; cellModel: string | null; populationState: PopulationFsmState;
  livingFraction?: number; apoptoticFraction?: number; adaptedFraction?: number; recoveredFraction?: number;
  cumulativeApoptosis?: number; predicted?: boolean; contextTransfer?: boolean;
  evidenceLevel?: PopulationEvidenceLevel; confidence?: Confidence;
  compositionBar?: { x: number; y: number; w: number; living: number; adapted: number; recovered: number; apoptotic: number };
  sparkline?: { x: number; y: number; w: number; h: number; points: number[] };
  tumourResponseEvidence?: 'NOT_EVALUATED'; survivalEvidence?: 'NOT_EVALUATED'; clinicalOutcomeEvidence?: 'NOT_EVALUATED';
}

/** Validation result. */
export interface PopulationValidationRecord { ok: boolean; errors: string[]; warnings: string[]; }
