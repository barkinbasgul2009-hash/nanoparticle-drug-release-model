// TypeScript interface contract for Phase-5B.1 signal-transduction EVIDENCE + GRAPH
// ARCHITECTURE (types only, no runtime code). Describes the six signal-*.registry.json
// files and the SignalGraph they assemble. Checked via `tsc --noEmit`. There is NO
// runtime signaling engine in 5B.1: these types describe DATA and a VALIDATOR only.
// The graph stops before gene regulation / transcription / PD - forbidden node types
// are not representable as a valid SignalNodeType value.

/** Refined signal-transduction evidence vocabulary (9 values), stored per node/edge. */
export type SignalEvidenceLevel =
  | 'EXPERIMENTAL_FORMULATION_SPECIFIC'
  | 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'
  | 'EXPERIMENTAL_PATHWAY_SPECIFIC'
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

/** Prediction level subset (used by the prediction registry). */
export type SignalPredictionLevel =
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION';

/** Verification status for a reference / audit-trail record. */
export type VerificationStatus =
  | 'VERIFIED_IN_FROZEN_PACKAGE'
  | 'UNVERIFIED_IN_REPO'
  | 'CANONICAL_GENERAL_BIOLOGY'
  | 'NOT_APPLICABLE';

/** Allowed node types. Forbidden downstream biology is deliberately NOT included. */
export type SignalNodeType =
  | 'molecular_target' | 'second_messenger' | 'reactive_species' | 'kinase'
  | 'phosphatase' | 'transcription_factor' | 'ion_channel_complex'
  | 'calcium_signal' | 'regulatory_state' | 'signaling_output' | 'pathway_placeholder';

/** Directed relationship types an edge may carry. */
export type SignalRelationshipType =
  | 'activation' | 'inhibition' | 'required' | 'permissive'
  | 'amplification' | 'attenuation' | 'positive_feedback' | 'negative_feedback'
  | 'recovery' | 'adaptation' | 'desensitization' | 'translocation'
  | 'phosphorylation' | 'dephosphorylation' | 'association' | 'dissociation';

/** Edge direction: forward, or explicitly unresolved (never invented). */
export type SignalEdgeDirection = 'forward' | 'unresolved';

/** Qualitative amplification/attenuation strength - never numeric magnitude. */
export type EffectStrength = 'low' | 'moderate' | 'high' | 'not_reported';

export type Compartment = 'cytoplasm' | 'nucleus' | 'membrane' | 'extracellular';

export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** A SIGNALING NODE (schematic activity only - no concentration / phospho-%). */
export interface SignalingNode {
  profile_id: string;
  canonical_name: string;
  display_name: string;
  aliases: string[];
  node_type: SignalNodeType;
  species: string;
  cell_model: string;
  disease_context: string;
  compartment: Compartment;
  baseline_state: string;
  allowed_states: string[];
  effect_direction: 'activation' | 'inhibition' | 'none';
  upstream_nodes: string[];
  downstream_nodes: string[];
  evidence_level: SignalEvidenceLevel;
  reference_ids: string[];
  confidence: Confidence;
  uncertainty: string;
  measured_readout: string;
  measurement_method: string;
  reported_timepoints: string[];
  formulation_specific: boolean;
  drug_specific: boolean;
  context_specific: boolean;
  notes: string;
}

/** A directed SIGNALING EDGE with its own independent evidence record. */
export interface SignalingEdge {
  profile_id: string;
  source: string;
  target: string;
  relationship_type: SignalRelationshipType;
  direction: SignalEdgeDirection;
  required: boolean;
  effect_strength: EffectStrength;
  temporal_order: number;      // SCHEMATIC ordinal, NOT a biological timestamp
  delay_basis: string;
  evidence_level: SignalEvidenceLevel;
  reference_ids: string[];
  confidence: Confidence;
  uncertainty: string;
  formulation_specific: boolean;
  drug_specific: boolean;
  species_specific: boolean;
  cell_model_specific: boolean;
  measurement_basis: string;
  notes: string;
}

export type ProfileStatus = 'ACCEPTED' | 'DEFERRED' | 'REJECTED' | 'NOT_REPORTED';

/** A pathway PROFILE binds exactly one context to a node/edge set. */
export interface PathwayProfile {
  status: ProfileStatus;
  title: string;
  context_id: string;
  species: string;
  cell_model: string;
  start_condition: string;
  stop_condition: string;
  node_ids: string[];
  edge_ids: string[];
  graph_shape: string;
  evidence_summary: string;
  uncertainty_summary: string;
  excluded_downstream: string[];
  accept_rationale?: string;
  reject_or_defer_rationale?: string;
}

/** A signaling CONTEXT (species + cell model + drug + formulation + target). */
export interface SignalContext {
  species: string;
  cell_model: string;
  cell_model_note?: string;
  tissue_context: string;
  disease_context: string;
  drug: string;
  formulation: string;
  molecular_target: string | null;
  target_evidence: string;
  start_condition: string;
  start_condition_basis: string;
  source_context: string;
  evidence_scope: string;
}

/** A reference record (symbolic key -> citation + verification status). */
export interface ReferenceRecord {
  kind: 'primary_source' | 'canonical_relationship' | 'literature_prediction';
  citation: string;
  verification_status: VerificationStatus;
  supports: string[];
  does_not_support: string[];
  note: string;
}

/** An audit-trail entry recording how an evidence level was assigned. */
export interface EvidenceAuditEntry {
  target_kind: 'node' | 'edge';
  target_id: string;
  assigned_level: SignalEvidenceLevel;
  reference_ids: string[];
  rationale: string;
  verification_status: VerificationStatus;
}

/** A prediction record (explicit predictive claim + any cross-context transfer). */
export interface PredictionRecord {
  profile_id: string;
  claim: string;
  level: SignalPredictionLevel;
  basis_kind: 'canonical_general_biology' | 'drug_class_literature' | 'same_drug_other_context' | 'mechanistic_inference';
  reference_ids: string[];
  cross_context_transfer: string;
  verification_status: VerificationStatus;
  note: string;
}

/** Result of SignalGraph.validate(). */
export interface SignalValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}
