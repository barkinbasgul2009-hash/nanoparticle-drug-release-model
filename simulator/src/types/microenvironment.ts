// TypeScript interface contract for Phase-7A passive tumour-microenvironment (TME) (types
// only, no runtime code). Describes the Phase-7A registries and the engine object / frame
// shapes. Checked via `tsc --noEmit`. A PASSIVE modulator: schematic ordinal states + 0-1
// values, never a real ECM density / collagen mass / interstitial pressure / oxygen
// concentration / diffusion coefficient. STOPS at penetration modification.

/** Microenvironment evidence vocabulary (additive; predictions + not-reported only). */
export type MicroenvironmentEvidenceLevel =
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

export type MicroenvironmentStateName =
  | 'permissive' | 'slightly_restrictive' | 'moderately_restrictive' | 'highly_restrictive' | 'extremely_restrictive';
export type OxygenStateName = 'normoxic' | 'mild_hypoxia' | 'moderate_hypoxia' | 'severe_hypoxia';
export type HypoxiaStateName = 'normoxic' | 'mild' | 'moderate' | 'severe';
export type MechanicalStateName = 'soft' | 'moderate' | 'dense' | 'highly_dense';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Registry: a microenvironment context profile (per species + tumour model). */
export interface MicroenvironmentProfile {
  profile_id: string;
  species: string;
  tumour_model: string;
  drug?: string;
  formulation: string;
  components: Record<string, string>;
  supported_ecm: string[];
  supported_hypoxia: string[];
  supported_diffusion: string[];
  supported_predictions: string[];
  supported_formulations: string[];
  default_runtime?: boolean;
  microenvironment_available: boolean;
  predictive_exploratory?: boolean;
  default_shown?: boolean;
  confidence: Confidence;
  uncertainty: string;
  evidence_level: MicroenvironmentEvidenceLevel;
  prediction_level: MicroenvironmentEvidenceLevel;
  human_translation_warning?: string;
  evidence_refs: string[];
  reason?: string;
  limitations: string;
  excluded_processes: string[];
}

export interface MicroenvironmentContext {
  profiles: Record<string, MicroenvironmentProfile>;
  context_rules: Record<string, string>;
}

/** Runtime objects. */
export interface CollagenNetwork {
  variant: string; density: number; alignment: string; packing: string; porosityEffect: number; penetrationEffect: number;
}
export interface ECMState {
  collagen: CollagenNetwork;
  hyaluronicAcid: { variant: string; diffusionModifier: number; interstitialResistance: number; hydrationModifier: number };
  proteoglycan: { variant: string; resistance: number };
  extracellularFluid: { variant: string; porosity: number };
  density: number; porosity: number; stiffness: number; diffusionResistance: number; penetrationResistance: number;
}
export interface InterstitialSpace {
  variant: string; availableVolume: number; fluidResistance: number; pathLength: number; mobilityModifier: number; diffusionResistance: number;
}
export interface DiffusionBarrier { resistance: number; mobilityModifier: number; }
export interface OxygenEnvironment { state: OxygenStateName; availability: number; diffusion: number; }
export interface HypoxiaState {
  state: HypoxiaStateName; severity: number; penetrationModifier: number; drugEffectivenessModifier: number; stressSusceptibility: number; predictionConfidence: Confidence;
}
export interface MechanicalBarrier { state: MechanicalStateName; score: number; }
export interface PenetrationModifier {
  combinedRestriction: number; penetrationModifier: number; effectiveAvailability: number; microenvironmentState: MicroenvironmentStateName;
}
export interface MicroenvironmentState {
  id: string; species: string; tumourModel: string; formulation: string | null;
  ecm: ECMState; interstitial: InterstitialSpace; diffusion: DiffusionBarrier;
  oxygen: OxygenEnvironment; hypoxia: HypoxiaState; mechanical: MechanicalBarrier; penetration: PenetrationModifier;
  microenvironmentState: MicroenvironmentStateName;
  evidenceLevel: MicroenvironmentEvidenceLevel; predictionLevel: MicroenvironmentEvidenceLevel;
  confidence: Confidence; uncertainty: string; updatedAt: number;
}

/** Evidence + prediction records. */
export interface MicroenvironmentEvidenceRecord {
  kind: string; species?: string; tumour_model?: string; citation: string; verification_status: string;
  supports: string[]; does_not_support: string[]; note: string;
}
export interface MicroenvironmentPredictionRecord {
  prediction_category: MicroenvironmentEvidenceLevel; profile_id: string; claim: string; confidence: Confidence;
  rationale: string; source_context: string; target_context: string; assumptions: string[]; uncertainty: string;
  limitations: string; species: string; reference_ids: string[]; quantitative_status: string; may_show_by_default: boolean;
}

/** Frame + stats. */
export interface MicroenvironmentFrame {
  species: string; tumourModel: string; formulation: string | null; available: boolean;
  microenvironmentState: MicroenvironmentStateName;
  ecm: { density: number; porosity: number; stiffness: number; penetrationResistance: number; collagen: string; hyaluronicAcid: string };
  diffusion: { resistance: number; mobilityModifier: number; interstitial: string };
  mechanical: { state: MechanicalStateName; score: number };
  oxygen: { state: OxygenStateName; availability: number };
  hypoxia: { state: HypoxiaStateName; severity: number; penetrationModifier: number; drugEffectivenessModifier: number; stressSusceptibility: number };
  penetration: { combinedRestriction: number; penetrationModifier: number; effectiveAvailability: number };
  evidenceLevel: MicroenvironmentEvidenceLevel; predictionLevel: MicroenvironmentEvidenceLevel;
  predicted: boolean; contextTransfer: boolean; confidence: Confidence; uncertainty: string;
  humanTranslationWarning: string | null;
  modifiesTransport: true; replacesTransport: false; modifiesSignalling: false;
  penetrationModifierEvidence: 'PREDICTED' | 'NOT_EVALUATED';
  immuneEvidence: 'NOT_EVALUATED'; vascularEvidence: 'NOT_EVALUATED'; remodelingEvidence: 'NOT_EVALUATED'; metastasisEvidence: 'NOT_EVALUATED';
  timeH: number; summaryLevel: string;
}
export interface MicroenvironmentStats {
  available: boolean; species: string; tumourModel: string; formulation: string | null;
  microenvironmentState: MicroenvironmentStateName;
  penetrationModifier: number; effectiveAvailability: number; combinedRestriction: number;
  ecmPenetrationResistance: number; diffusionResistance: number; mechanicalScore: number;
  oxygenAvailability: number; hypoxiaSeverity: number;
  evidenceLevel: MicroenvironmentEvidenceLevel; timeH: number;
}
export interface MicroenvironmentValidationRecord { ok: boolean; errors: string[]; warnings: string[]; }
