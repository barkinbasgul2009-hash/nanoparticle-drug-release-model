// TypeScript interface contract for Phase-6A protein function & early cellular response
// (types only, no runtime code). Describes the Phase-6A registries and the engine's
// object/frame shapes. Checked via `tsc --noEmit`. STOPS before cell fate - cell-fate
// evidence stays NOT_EVALUATED; no apoptosis/caspase/cytochrome-c/AIF/necrosis is
// representable.

/** Protein-function / cellular-response evidence vocabulary (additive; see evidenceEngine.js). */
export type FunctionEvidenceLevel =
  | 'EXPERIMENTAL_FORMULATION_SPECIFIC'
  | 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'
  | 'EXPERIMENTAL_PATHWAY_SPECIFIC'
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

export type FunctionalState =
  | 'unavailable' | 'not_reported' | 'inactive' | 'eligible' | 'activating' | 'active'
  | 'partially_active' | 'inhibited' | 'recovering' | 'degrading' | 'inactive_after_degradation';

export type CellularStateType =
  | 'oxidative_stress' | 'antioxidant_capacity' | 'inflammatory_state' | 'adhesion_readiness'
  | 'survival_signaling' | 'mitochondrial_stress' | 'homeostatic_capacity' | 'general_stress'
  | 'translation_capacity' | 'protein_function_output';

export type StateOrdinal = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';

export type FunctionalRelationship =
  | 'activation' | 'inhibition' | 'support' | 'attenuation' | 'amplification' | 'recovery'
  | 'homeostatic_feedback' | 'stress_promotion' | 'stress_reduction'
  | 'capacity_increase' | 'capacity_decrease' | 'readiness_increase' | 'readiness_decrease';

export type FunctionalSourceType = 'protein_function' | 'signal_node' | 'cellular_state';

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Registry: a protein-function profile entry. */
export interface ProteinFunctionProfileDef {
  source_protein: string;
  gene_id: string;
  required_maturity_state: string;
  function_available: boolean;
  function_type: string;
  functional_direction: string;
  target_cellular_states: string[];
  activation_basis: string;
  inhibition_basis: string;
  evidence_level: FunctionEvidenceLevel;
  prediction_level: FunctionEvidenceLevel;
  confidence: Confidence;
  uncertainty: string;
  stop_boundary: string;
  excluded_downstream_processes: string[];
}

/** Registry: a protein-function context profile (per species). */
export interface ProteinFunctionContext {
  status: 'ACTIVE' | 'ACTIVE_SIGNAL_DRIVEN' | 'NOT_REPORTED';
  species: string;
  cell_model: string;
  tissue_context?: string;
  disease_context?: string;
  summary_level: string;
  cell_fate_evidence: 'NOT_EVALUATED';
  reason?: string;
  functions: Record<string, ProteinFunctionProfileDef>;
}

/** Registry: a cellular-state variable definition. */
export interface CellularStateDef {
  canonical_name: string;
  display_name: string;
  state_type: CellularStateType;
  baseline: number;
  direction: string;
  reversible: boolean;
  evidence_level: FunctionEvidenceLevel;
  prediction_level: FunctionEvidenceLevel;
  confidence: Confidence;
  ordinal_states?: string[];
  notes: string;
}

/** Registry: a functional edge definition. */
export interface FunctionalEdgeDef {
  source_type: FunctionalSourceType;
  source_id: string;
  target_state_id: string;
  relationship_type: FunctionalRelationship;
  direction: 'forward' | 'unresolved';
  strength_class: 'low' | 'moderate' | 'high';
  delay_class: 'immediate' | 'early' | 'intermediate' | 'late';
  reversibility: string;
  baseline_relative?: boolean;
  source_reference?: number;
  feedback?: boolean;
  evidence_level: FunctionEvidenceLevel;
  prediction_level: FunctionEvidenceLevel;
  confidence: Confidence;
  rationale: string;
  reference_ids: string[];
  uncertainty: string;
}

/** Runtime objects. */
export interface FunctionalProteinState {
  id: string; proteinId: string; geneId: string; species: string; cellModel: string | null; cellId: string | null;
  maturityState: string; functionalState: FunctionalState; functionalCapacity: number; activityState: number;
  inhibitionState: number; evidenceLevel: FunctionEvidenceLevel; predictionLevel: FunctionEvidenceLevel;
  confidence: Confidence; activatedAt: number | null; deactivatedAt: number | null; alive: boolean;
}
export interface CellularStateVariable {
  id: string; canonicalName: string; displayName: string; species: string; cellModel: string | null;
  stateType: CellularStateType; baseline: number; currentValue: number; direction: string;
  evidenceLevel: FunctionEvidenceLevel; predictionLevel: FunctionEvidenceLevel; confidence: Confidence;
  reversible: boolean; updatedAt: number | null; sourceProteins: string[]; sourceSignals: string[]; notes: string;
}
export interface FunctionalEdge {
  id: string; sourceType: FunctionalSourceType; sourceId: string; targetStateId: string;
  relationshipType: FunctionalRelationship; direction: string; strengthClass: string; delayClass: string;
  reversibility: string; baselineRelative: boolean; sourceReference: number; feedback: boolean;
  evidenceLevel: FunctionEvidenceLevel; predictionLevel: FunctionEvidenceLevel; confidence: Confidence;
  rationale: string; referenceIds: string[]; uncertainty: string; active: boolean; contribution: number;
}

/** Evidence + prediction records. */
export interface FunctionalEvidenceRecord {
  kind: string; citation: string; verification_status: string; supports: string[]; does_not_support: string[]; note: string;
}
export interface FunctionalPredictionRecord {
  edge_id: string; claim: string; level: FunctionEvidenceLevel; confidence: Confidence; source_principle: string;
  source_context: string; target_context: string; limitations: string; species: string; cell_model: string; formulation_specific: boolean;
}

/** A functional feedback record (declared, bounded). */
export interface FunctionalFeedbackRecord { edgeId: string; relationship: FunctionalRelationship; feedback: true; }
/** A functional recovery state summary. */
export interface FunctionalRecoveryState { stateId: string; value: number; baseline: number; recovering: boolean; }

/** Frame shapes (headless-testable). */
export interface FunctionalFrameFunction {
  id: string; proteinId: string; functionType: string; functionalState: FunctionalState; capacity: number;
  activity: number; maturityState: string; predicted: boolean; evidenceLevel: FunctionEvidenceLevel;
  predictionLevel: FunctionEvidenceLevel; confidence: Confidence;
}
export interface FunctionalFrameState {
  id: string; name: string; stateType: CellularStateType; value: number; ordinal: StateOrdinal; baseline: number;
  reversible: boolean; evidenceLevel: FunctionEvidenceLevel; predictionLevel: FunctionEvidenceLevel;
  confidence: Confidence; sourceProteins: string[]; sourceSignals: string[];
}
export interface FunctionalFrameEdge {
  id: string; sourceType: FunctionalSourceType; sourceId: string; targetStateId: string;
  relationship: FunctionalRelationship; sign: number; active: boolean; contribution: number; predicted: boolean; feedback: boolean;
}
export interface FunctionalFrame {
  functions: FunctionalFrameFunction[];
  states: FunctionalFrameState[];
  edges: FunctionalFrameEdge[];
  timeH: number;
  summaryLevel: string;
  cellFateEvidence: 'NOT_EVALUATED';
}

/** A timeline event. */
export interface FunctionalTimelineEvent { timeH: number; kind: 'function' | 'state'; id: string; event: string; }

/** Engine stats. */
export interface FunctionalStats {
  functions: number; activeFunctions: number; states: number; activeEdges: number;
  stateValues: Record<string, number>; timeH: number; steps: number;
}

/** Validation result. */
export interface FunctionalValidationResult { ok: boolean; errors: string[]; warnings: string[]; }
