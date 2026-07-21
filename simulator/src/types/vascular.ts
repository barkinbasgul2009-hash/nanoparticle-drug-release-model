// TypeScript interface contract for Phase-7B tumour vasculature / angiogenesis (types only,
// no runtime code). Describes the Phase-7B registries and the engine object / frame shapes.
// Checked via `tsc --noEmit`. The vasculature is an ACTIVE architectural component but a
// PASSIVE modulator of drug delivery: schematic ordinal states + 0-1 values, never a real
// vessel count / blood flow / pO2 / vascular diameter / perfusion rate. STOPS at delivery
// modification.

/** Vascular evidence vocabulary (additive; predictions + not-reported only). */
export type VascularEvidenceLevel =
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'CONTEXT_TRANSFER_PREDICTION'
  | 'HYPOTHESIS'
  | 'NOT_REPORTED'
  | 'UNAVAILABLE'
  | 'CONTRADICTORY_EVIDENCE';

export type AngiogenicStateName = 'poorly_vascularized' | 'moderately_vascularized' | 'highly_vascularized' | 'hypervascular';
export type VesselMaturityName = 'immature' | 'developing' | 'mature' | 'stable';
export type PerfusionStateName = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
export type OxygenSupplyStateName = 'very_low' | 'low' | 'moderate' | 'high' | 'very_high';
export type NutrientStateName = 'limited' | 'restricted' | 'adequate' | 'abundant';
export type PermeabilityStateName = 'low' | 'moderate' | 'high' | 'very_high';
export type DeliveryStateName = 'poor_delivery' | 'limited_delivery' | 'moderate_delivery' | 'good_delivery' | 'excellent_delivery';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';

/** Registry: a vascular context profile (per species + tumour model). */
export interface VascularProfile {
  profile_id: string;
  species: string;
  tumour_model: string;
  drug?: string;
  formulation: string;
  components: Record<string, string>;
  supported_vascular_state: AngiogenicStateName[];
  supported_perfusion: PerfusionStateName[];
  supported_oxygen: OxygenSupplyStateName[];
  supported_predictions: string[];
  supported_formulations: string[];
  default_runtime?: boolean;
  vascular_available: boolean;
  predictive_exploratory?: boolean;
  default_shown?: boolean;
  confidence: Confidence;
  uncertainty: string;
  evidence_level: VascularEvidenceLevel;
  prediction_level: VascularEvidenceLevel;
  human_translation_warning?: string;
  evidence_refs: string[];
  reason?: string;
  limitations: string;
  excluded_processes: string[];
}

export interface VascularContext {
  profiles: Record<string, VascularProfile>;
  context_rules: Record<string, string>;
}

/** Runtime objects. */
export interface VesselState {
  angiogenicState: AngiogenicStateName; vesselDensity: number; branchingComplexity: string;
  organization: string; maturity: VesselMaturityName; maturityValue: number; deliveryEfficiency: number;
}
export interface VascularNetwork { vessels: VesselState; density: number; organization: string; }
export interface PerfusionState { state: PerfusionStateName; efficiency: number; }
export interface OxygenSupply { state: OxygenSupplyStateName; supply: number; }
export interface NutrientEnvironment { state: NutrientStateName; availability: number; }
export interface PermeabilityState { state: PermeabilityStateName; value: number; }
export interface DeliveryModifier { deliveryModifier: number; effectiveArrival: number; deliveryState: DeliveryStateName; }
export interface VascularState {
  id: string; species: string; tumourModel: string; formulation: string | null;
  network: VascularNetwork; perfusion: PerfusionState; oxygen: OxygenSupply; nutrient: NutrientEnvironment;
  permeability: PermeabilityState; delivery: DeliveryModifier;
  evidenceLevel: VascularEvidenceLevel; predictionLevel: VascularEvidenceLevel;
  confidence: Confidence; uncertainty: string; updatedAt: number;
}

/** Evidence + prediction records. */
export interface VascularEvidenceRecord {
  kind: string; species?: string; tumour_model?: string; citation: string; verification_status: string;
  supports: string[]; does_not_support: string[]; note: string;
}
export interface VascularPredictionRecord {
  prediction_category: VascularEvidenceLevel; profile_id: string; claim: string; confidence: Confidence;
  rationale: string; source_context: string; target_context: string; assumptions: string[]; uncertainty: string;
  limitations: string; species: string; reference_ids: string[]; quantitative_status: string; may_show_by_default: boolean;
}

/** Frame + stats. */
export interface VascularFrame {
  species: string; tumourModel: string; formulation: string | null; available: boolean;
  vessels: { angiogenicState: AngiogenicStateName; density: number; branching: string; organization: string; maturity: VesselMaturityName };
  perfusion: { state: PerfusionStateName; efficiency: number };
  oxygenSupply: { state: OxygenSupplyStateName; supply: number };
  nutrient: { state: NutrientStateName; availability: number };
  permeability: { state: PermeabilityStateName; value: number };
  delivery: { deliveryModifier: number; effectiveArrival: number; deliveryState: DeliveryStateName };
  effectiveDeliveryPenetration: number;
  evidenceLevel: VascularEvidenceLevel; predictionLevel: VascularEvidenceLevel;
  predicted: boolean; contextTransfer: boolean; confidence: Confidence; uncertainty: string;
  humanTranslationWarning: string | null;
  modifiesDelivery: true; modifiesSignalling: false; inducesApoptosis: false; remodels: false;
  deliveryModifierEvidence: 'PREDICTED' | 'NOT_EVALUATED';
  immuneEvidence: 'NOT_EVALUATED'; vegfSignallingEvidence: 'NOT_EVALUATED'; hifRegulationEvidence: 'NOT_EVALUATED'; metastasisEvidence: 'NOT_EVALUATED';
  timeH: number; summaryLevel: string;
}
export interface VascularStats {
  available: boolean; species: string; tumourModel: string; formulation: string | null;
  angiogenicState: AngiogenicStateName; vesselMaturity: VesselMaturityName; deliveryState: DeliveryStateName;
  vesselDensity: number; perfusion: number; oxygenSupply: number; nutrient: number; permeability: number;
  deliveryModifier: number; evidenceLevel: VascularEvidenceLevel; timeH: number;
}
export interface VascularValidationRecord { ok: boolean; errors: string[]; warnings: string[]; }
