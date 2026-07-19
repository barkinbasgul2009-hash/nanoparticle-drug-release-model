// TypeScript interface contract for Phase-5C gene regulation / transcription (types only,
// no runtime code). Describes transcription.registry.json and the runtime engine's
// object/frame shapes. Checked via `tsc --noEmit`. STOPS at mRNA - no translation,
// ribosomes, proteins, enzymes, metabolism, or anything downstream.

/** Gene/transcription evidence vocabulary (additive; see evidenceEngine.js). */
export type GeneEvidenceLevel =
  | 'EXPERIMENTAL'
  | 'HIGH_CONFIDENCE'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED';

export type TfState =
  | 'inactive' | 'activated' | 'cytoplasmic' | 'nuclear' | 'dna_bound' | 'released' | 'degraded';

export type PolymeraseState =
  | 'not_recruited' | 'recruiting' | 'bound' | 'transcribing' | 'released';

export type ChromatinState = 'closed' | 'partially_open' | 'open';

export type ExpressionLevel = 0 | 25 | 50 | 75 | 100;

export type MrnaCopyState = 'none' | 'low' | 'moderate' | 'high';

export type BindingRelationship = 'activation' | 'suppression';

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** A binding TF entry on a promoter. */
export interface PromoterBinding {
  tf_id: string;
  relationship: BindingRelationship;
  weight: number;
  evidence_level: GeneEvidenceLevel;
  note?: string;
}

/** Registry: a transcription factor definition. */
export interface TranscriptionFactorDef {
  name: string;
  family: string;
  source_signal_node: string;
  activation_threshold?: number;
  activation_delay_h?: number;
  translocation_delay_h?: number;
  binding_delay_h?: number;
  evidence_level: GeneEvidenceLevel;
  prediction_level: GeneEvidenceLevel;
  confidence: Confidence;
  rationale: string;
  layout?: { col: number; row: number };
}

/** Registry: a promoter / response element. */
export interface PromoterDef {
  gene_id: string;
  response_element: string;
  binding_sites: number;
  chromatin: ChromatinState;
  prediction_level: GeneEvidenceLevel;
  confidence: Confidence;
  binding_tfs: PromoterBinding[];
  layout?: { col: number; row: number };
}

/** Registry: an mRNA definition. */
export interface MrnaDef {
  id: string;
  decay_rate_per_hour: number;
  half_life_h: number | 'NOT_REPORTED';
  prediction_level: GeneEvidenceLevel;
}

/** Registry: a gene definition. */
export interface GeneDef {
  symbol: string;
  gene_name: string;
  promoter_id: string;
  basal_expression: number;
  evidence_level: GeneEvidenceLevel;
  prediction_level: GeneEvidenceLevel;
  confidence: Confidence;
  transcription_delay_h: number;
  rationale: string;
  mrna: MrnaDef;
  encodes_tf?: string;
  layout?: { col: number; row: number };
}

/** Registry: a species transcription profile. */
export interface TranscriptionProfile {
  status: 'ACTIVE' | 'NOT_REPORTED';
  species: string;
  cell_model: string;
  disease_context?: string;
  summary_level: string;
  reason?: string;
  transcription_factors: Record<string, TranscriptionFactorDef>;
  promoters: Record<string, PromoterDef>;
  genes: Record<string, GeneDef>;
}

/** The full transcription registry. */
export interface TranscriptionRegistry {
  vocabularies: {
    tf_states: TfState[];
    polymerase_states: PolymeraseState[];
    chromatin_states: ChromatinState[];
    gene_expression_levels: number[];
    mrna_copy_states: MrnaCopyState[];
    evidence_levels: GeneEvidenceLevel[];
    relationship_types: BindingRelationship[];
  };
  defaults: {
    activation_delay_h: number;
    translocation_delay_h: number;
    binding_delay_h: number;
    transcription_delay_h: number;
    tf_activation_threshold: number;
    binding_threshold: number;
    expression_relax_per_hour: number;
    mrna_decay_rate_per_hour: number;
    mrna_half_life_h: number | 'NOT_REPORTED';
    dt_hours: number;
  };
  profiles: Record<string, TranscriptionProfile>;
}

/** Frame shapes (headless-testable). */
export interface TranscriptionFactorFrame {
  id: string; name: string; state: TfState; location: 'cytoplasm' | 'nucleus';
  activity: number; predicted: boolean; predictionLevel: GeneEvidenceLevel;
  evidenceLevel: GeneEvidenceLevel; confidence: Confidence; boundPromoters: string[];
  layout: { col: number; row: number };
}
export interface PromoterFrame {
  id: string; geneId: string; responseElement: string; occupancy: number; occupied: number;
  sites: number; chromatin: ChromatinState; accessible: boolean; predictionLevel: GeneEvidenceLevel;
  layout: { col: number; row: number };
}
export interface GeneFrame {
  id: string; symbol: string; expressionState: ExpressionLevel; expressionFrac: number;
  polymerase: PolymeraseState; predicted: boolean; predictionLevel: GeneEvidenceLevel;
  evidenceLevel: GeneEvidenceLevel; confidence: Confidence; layout: { col: number; row: number };
  mrna: { id: string; level: number; copyState: MrnaCopyState; degrading: boolean; predictionLevel: GeneEvidenceLevel } | null;
}
export interface TranscriptionFrame {
  tfs: TranscriptionFactorFrame[];
  promoters: PromoterFrame[];
  genes: GeneFrame[];
  timeH: number;
  summaryLevel: string;
}

/** Engine stats. */
export interface TranscriptionStats {
  tfs: number; genes: number; promoters: number; nuclearTfs: number; dnaBoundTfs: number;
  transcribingGenes: number; mrnaProduced: number; maxExpression: number; timeH: number; steps: number;
}

/** Validation result. */
export interface TranscriptionValidationResult { ok: boolean; errors: string[]; warnings: string[]; }
