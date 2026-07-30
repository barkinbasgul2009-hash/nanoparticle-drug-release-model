// TypeScript interface contract for Phase-6B apoptosis commitment & execution (types only,
// no runtime code). Describes the Phase-6B registries and the engine's object/frame shapes.
// Checked via `tsc --noEmit`. STOPS at the single-cell apoptotic state - population /
// tumour / immune outcome is NEVER evaluated. Irreversible after the commitment gate.

/** Apoptosis evidence vocabulary (additive; includes CONTEXT_TRANSFER_PREDICTION). */
export type ApoptosisEvidenceLevel =
  | 'EXPERIMENTAL_FORMULATION_SPECIFIC'
  | 'EXPERIMENTAL_DRUG_CELL_SPECIFIC'
  | 'EXPERIMENTAL_PATHWAY_SPECIFIC'
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

export type ApoptosisFsmState =
  | 'idle' | 'not_reported' | 'unavailable' | 'homeostatic' | 'stressed' | 'apoptosis_eligible'
  | 'pre_commitment' | 'commitment_threshold_reached' | 'committed' | 'mitochondrial_transition'
  | 'execution_in_progress' | 'apoptotic' | 'execution_complete';

export type MembranePotentialState = 'normal' | 'slightly_reduced' | 'reduced' | 'severely_reduced' | 'collapsed' | 'not_reported';
export type BaxBcl2State = 'anti_apoptotic_dominant' | 'balanced' | 'pro_apoptotic_shift' | 'strong_pro_apoptotic_shift' | 'not_reported';
export type MompState = 'inactive' | 'sensitized' | 'initiating' | 'active' | 'complete' | 'not_reported';
export type CytochromeCState = 'retained' | 'release_ready' | 'released' | 'not_reported';
export type CaspaseState = 'inactive' | 'primed' | 'activating' | 'active' | 'partially_inhibited' | 'inhibited' | 'complete' | 'not_reported';
export type ParpState = 'intact' | 'cleavage_started' | 'partially_cleaved' | 'cleaved' | 'not_reported';
export type AifState = 'mitochondrial' | 'release_ready' | 'released' | 'translocation_ready' | 'execution_active' | 'suppressed_by_knockdown' | 'not_reported';
export type MorphologyState = 'normal' | 'early_apoptotic' | 'condensing' | 'fragmentation_ready' | 'late_apoptotic';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Registry: a context-transfer record (e.g. B16 -> B16BL6). */
export interface ApoptosisContextTransfer {
  source_cell_model: string;
  target_cell_model: string;
  shared_features?: string[];
  shared_biological_features?: string[];
  uncertain_differences: string[];
  rationale: string;
  reference_ids?: string[];
}

/** Registry: an apoptosis context profile (per species + cell model). */
export interface ApoptosisProfile {
  status: 'EXPERIMENTAL_REFERENCE' | 'CONTEXT_TRANSFER' | 'NOT_REPORTED';
  species: string;
  cell_model: string;
  disease_context: string;
  drug?: string;
  formulation?: string;
  apoptosis_available: boolean;
  default_runtime?: boolean;
  source_stress_states: string[];
  required_protein_states: string[];
  commitment_model?: string;
  mitochondrial_model?: string;
  caspase_model?: string;
  aif_model?: string;
  intervention_model?: string;
  branch_weights?: { caspase_weight: number; aif_weight: number; other_weight: number };
  evidence_level: ApoptosisEvidenceLevel;
  prediction_level: ApoptosisEvidenceLevel;
  confidence: Confidence;
  uncertainty: string;
  context_transfer?: ApoptosisContextTransfer;
  evidence_refs: string[];
  stop_boundary: string;
  excluded_downstream_processes: string[];
  reason?: string;
}

export interface ApoptosisContext {
  profiles: Record<string, ApoptosisProfile>;
  context_rules: Record<string, string>;
}

/** Runtime objects. */
export interface ApoptosisState {
  id: string; cellId: string; species: string; cellModel: string; state: ApoptosisFsmState;
  eligibility: boolean; commitment: boolean; reversibility: 'reversible' | 'irreversible';
  apoptoticPressure: number; survivalPressure: number; mitochondrialPressure: number;
  caspasePressure: number; aifPressure: number; evidenceLevel: ApoptosisEvidenceLevel;
  predictionLevel: ApoptosisEvidenceLevel; confidence: Confidence;
  enteredAt: number | null; committedAt: number | null; executedAt: number | null;
}
export interface MitochondrialApoptosisState {
  cellId: string; membranePotentialState: MembranePotentialState; baxBcl2Balance: BaxBcl2State;
  mompReadiness: number; mompState: MompState; cytochromeCState: CytochromeCState; aifState: AifState;
  mitochondrialIntegrity: number; evidenceLevel: ApoptosisEvidenceLevel; confidence: Confidence;
}
export interface CaspaseCascadeState {
  cellId: string; initiatorState: CaspaseState; executionerState: CaspaseState; parpState: ParpState;
  caspaseDependence: string; inhibitorPresent: boolean; contribution: number; evidenceLevel: ApoptosisEvidenceLevel;
}
export interface AIFExecutionState {
  cellId: string; mitochondrialAifState: AifState; released: boolean; translocationState: string;
  executionContribution: number; knockdownActive: boolean; evidenceLevel: ApoptosisEvidenceLevel;
}
export interface ApoptosisIntervention {
  id: string; interventionType: string; target: string; effect: string; strengthClass: string;
  acts: string; evidenceLevel: ApoptosisEvidenceLevel; active: boolean; notes: string;
}

/** Evidence + prediction + commitment records. */
export interface ApoptosisEvidenceRecord {
  kind: string; cell_model?: string; citation: string; verification_status: string;
  supports: string[]; does_not_support: string[]; note: string;
}
export interface ApoptosisPredictionRecord {
  profile_id: string; claim: string; level: ApoptosisEvidenceLevel; confidence: Confidence;
  source_context: string; target_context: string; transfer_assumptions: string[]; uncertainty: string;
  species: string; cell_model: string; formulation_specific: boolean; reference_ids: string[];
}
export interface ApoptosisCommitmentRecord { committedAt: number | null; reversibility: 'reversible' | 'irreversible'; pressureAtCommit: number; }
export interface ApoptoticMorphologyState { state: MorphologyState; }

/** Frame + timeline + stats + validation. */
export interface ApoptosisFrame {
  cellModel: string; available: boolean; state: ApoptosisFsmState; reversibility: 'reversible' | 'irreversible';
  apoptoticPressure: number; survivalPressure: number; committed: boolean;
  mitochondria: { membranePotential: MembranePotentialState; baxBcl2: BaxBcl2State; momp: MompState; cytochromeC: CytochromeCState; mompReadiness: number };
  caspaseBranch: { initiator: CaspaseState; executioner: CaspaseState; parp: ParpState; contribution: number; inhibited: boolean };
  aifBranch: { state: AifState; released: boolean; translocation: string; contribution: number; knockdown: boolean };
  totalExecutionDrive: number; morphology: MorphologyState;
  interventions: { type: string; active: boolean; evidenceLevel: ApoptosisEvidenceLevel }[];
  evidenceLevel: ApoptosisEvidenceLevel; predicted: boolean; contextTransfer: boolean;
  cellFateEvidence: string; populationOutcomeEvidence: 'NOT_EVALUATED'; tumourResponseEvidence: 'NOT_EVALUATED';
  timeH: number; summaryLevel: string;
}
export interface ApoptosisTimelineEvent { timeH: number; kind: string; event: string; }
export interface ApoptosisStats {
  available: boolean; cellModel: string; state: ApoptosisFsmState; committed: boolean; reversibility: string;
  apoptoticPressure: number; survivalPressure: number; membranePotential: MembranePotentialState;
  baxBcl2: BaxBcl2State; momp: MompState; cytochromeC: CytochromeCState; aif: AifState;
  caspaseExecutioner: CaspaseState; parp: ParpState; caspaseContribution: number; aifContribution: number;
  totalExecutionDrive: number; timeH: number; steps: number;
}
export interface ApoptosisValidationResult { ok: boolean; errors: string[]; warnings: string[]; }
