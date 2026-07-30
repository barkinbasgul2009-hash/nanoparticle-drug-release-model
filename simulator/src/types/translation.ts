// TypeScript interface contract for Phase-5D translation / protein synthesis (types only,
// no runtime code). Describes the translation registries and the engine's object/frame
// shapes. Checked via `tsc --noEmit`. STOPS at mature protein + turnover - protein
// catalytic FUNCTION is never evaluated (functional_state stays 'not_evaluated').

/** Translation / protein-synthesis evidence vocabulary (additive; see evidenceEngine.js). */
export type TranslationEvidenceLevel =
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

export type RibosomeState =
  | 'free' | 'recruiting' | 'initiating' | 'elongating' | 'terminating'
  | 'released' | 'paused' | 'suppressed' | 'unavailable';

export type InitiationState =
  | 'not_assembled' | 'assembling' | 'assembled' | 'initiated' | 'failed' | 'suppressed' | 'released';

export type FoldingState =
  | 'nascent' | 'partially_folded' | 'newly_synthesized' | 'folding' | 'mature' | 'misfolded';

export type MaturationState =
  | 'not_required' | 'newly_synthesized' | 'folding' | 'maturing' | 'mature' | 'unavailable' | 'not_reported';

export type ProteinState =
  | 'nascent' | 'newly_synthesized' | 'folding' | 'maturing' | 'mature' | 'misfolded' | 'inactive' | 'degrading' | 'degraded';

export type TurnoverState = 'stable' | 'degrading' | 'degraded' | 'not_reported';

export type AbundanceLevel = 0 | 25 | 50 | 75 | 100;
export type AbundanceOrdinal = 'none' | 'low' | 'moderate' | 'high';
export type CapacityOrdinal = 'suppressed' | 'low' | 'moderate' | 'high';
export type DegradationClass = 'slow' | 'moderate' | 'fast';
export type ChaperoneFlag = 'none' | 'general_assistance' | 'required' | 'not_reported';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Global translation capacity definition (constitutive or signal-node-linked prediction). */
export interface GlobalCapacityDef {
  source: 'constitutive' | 'signal_node_linked';
  level?: number;
  ordinal?: CapacityOrdinal;
  signal_node?: string;
  relationship?: 'suppression' | 'activation';
  baseline?: number;
  evidence_level: TranslationEvidenceLevel;
  rationale: string;
}

/** A protein-output profile entry (one mRNA -> one protein). */
export interface TranslationOutputDef {
  protein_id: string;
  mrna_source: string;
  gene_id: string;
  translation_available: boolean;
  gene_efficiency: number;
  initiation_model: string;
  elongation_model: string;
  termination_model: string;
  folding_model: string;
  maturation_model: string;
  turnover_model: string;
  evidence_level: TranslationEvidenceLevel;
  evidence_summary: string;
  uncertainty_summary: string;
  excluded_downstream: string[];
}

/** A species translation context/profile. */
export interface TranslationProfile {
  status: 'ACTIVE' | 'NOT_REPORTED';
  species: string;
  cell_model: string;
  tissue_context?: string;
  drug?: string;
  formulation?: string;
  summary_level: string;
  reason?: string;
  global_capacity?: GlobalCapacityDef;
  outputs: Record<string, TranslationOutputDef>;
}

/** Protein identity + turnover + evidence (protein.registry.json). */
export interface ProteinDef {
  canonical_name: string;
  protein_name: string;
  gene_id: string;
  source_mrna_id: string;
  species: string;
  cell_model: string;
  compartment: string;
  evidence_level: TranslationEvidenceLevel;
  prediction_level: TranslationEvidenceLevel;
  confidence: Confidence;
  maturation_model: string;
  chaperone: ChaperoneFlag;
  turnover: { state: TurnoverState; half_life_h: number | 'NOT_REPORTED'; degradation_class: DegradationClass; degradation_class_basis: string };
  reference_ids: string[];
  rationale: string;
  functional_state: 'not_evaluated';
}

/** Registry roots. */
export interface TranslationContextRegistry { profiles: Record<string, TranslationProfile>; excluded_downstream_global: string[]; }
export interface TranslationMachineryRegistry {
  vocabularies: Record<string, (string | number)[]>;
  defaults: {
    dt_hours: number; mrna_eligibility_threshold: number; capacity_threshold: number;
    recruitment_delay_h: number; initiation_delay_h: number; elongation_rate_per_hour: number;
    maturation_delay_h: number; translation_delay_h: number; max_protein_units: number; polysome_size: number;
    turnover_rate_per_hour: number; degradation_class_hours: Record<DegradationClass, number>; degrade_delay_h: number;
    global_capacity_default: number; gene_efficiency_default: number;
  };
}
export interface ProteinRegistry {
  proteins: Record<string, ProteinDef>;
  protein_evidence: Record<string, TranslationEvidenceRecord>;
  prediction_records: Record<string, TranslationPredictionRecord>;
}

/** Runtime objects. */
export interface Ribosome {
  id: string; cellId: string; species: string; state: RibosomeState; boundMrnaId: string | null;
  positionOnMrna: number; translationProgress: number; currentProteinId: string | null;
  evidenceLevel: TranslationEvidenceLevel; active: boolean; startTime: number | null; completionTime: number | null;
}
export interface TranslationInitiationComplex {
  id: string; mrnaId: string; ribosomeId: string; state: InitiationState; capDependent: boolean;
  initiationCapacity: number; evidenceLevel: TranslationEvidenceLevel; predictionLevel: TranslationEvidenceLevel;
  confidence: Confidence; rationale: string;
}
export interface NascentPolypeptide {
  id: string; proteinId: string; sourceMrnaId: string; ribosomeId: string; progress: number;
  lengthState: 'short' | 'extending' | 'full'; foldingState: FoldingState; maturationState: MaturationState;
  alive: boolean; evidenceLevel: TranslationEvidenceLevel; predictionLevel: TranslationEvidenceLevel;
  createdAt: number | null; completedAt: number | null;
}
export interface Protein {
  id: string; canonicalName: string; geneId: string; species: string; compartment: string;
  state: ProteinState; abundanceState: AbundanceLevel; abundanceFrac: number;
  matureUnits: number; foldingUnits: number; degradingUnits: number; degradedUnits: number; producedUnits: number;
  turnoverState: TurnoverState; halfLifeH: number | 'NOT_REPORTED'; degradationClass: DegradationClass;
  evidenceLevel: TranslationEvidenceLevel; predictionLevel: TranslationEvidenceLevel; confidence: Confidence;
  functionalState: 'not_evaluated';
}

/** Evidence + prediction records. */
export interface TranslationEvidenceRecord {
  kind: string; citation: string; verification_status: string;
  supports: string[]; does_not_support: string[]; note: string;
}
export interface TranslationPredictionRecord {
  protein_id: string; claim: string; level: TranslationEvidenceLevel; confidence: Confidence;
  source_principle: string; context_limitations: string; species: string; cell_model: string; formulation_specific: boolean;
}

/** A translation turnover state summary. */
export interface ProteinTurnoverState { state: TurnoverState; halfLifeH: number | 'NOT_REPORTED'; degradationClass: DegradationClass; }

/** Frame shapes (headless-testable). */
export interface TranslationFrameOutput {
  outId: string; proteinId: string; proteinName: string; mrnaId: string; mrnaLevel: number;
  ribosomeState: RibosomeState; translationProgress: number; proteinState: ProteinState;
  abundanceState: AbundanceLevel; abundanceOrdinal: AbundanceOrdinal; matureUnits: number; foldingUnits: number; degradingUnits: number;
  turnoverState: TurnoverState; halfLifeH: number | 'NOT_REPORTED'; degradationClass: DegradationClass;
  predicted: boolean; evidenceLevel: TranslationEvidenceLevel; predictionLevel: TranslationEvidenceLevel;
  confidence: Confidence; functionalState: 'not_evaluated';
}
export interface TranslationFrame {
  outputs: TranslationFrameOutput[];
  capacity: number;
  capacityOrdinal: CapacityOrdinal;
  timeH: number;
  summaryLevel: string;
}

/** A timeline event. */
export interface TranslationTimelineEvent {
  timeH: number; kind: 'ribosome' | 'protein'; id: string; event: string;
}

/** Engine stats. */
export interface TranslationStats {
  outputs: number; recruitedRibosomes: number; elongatingRibosomes: number;
  matureUnits: number; degradingUnits: number; producedUnits: number; maxAbundance: number;
  capacity: CapacityOrdinal; timeH: number; steps: number;
}

/** Validation result. */
export interface TranslationValidationResult { ok: boolean; errors: string[]; warnings: string[]; }
