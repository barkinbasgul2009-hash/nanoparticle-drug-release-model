// TypeScript interface contract for Phase-5A target engagement (types only, no
// runtime code). Describes target-engagement.registry.json and the target/binding
// state. Checked via `tsc --noEmit`. Ends at target binding; nothing downstream.

import type { EvidenceLevel } from './transport';

/** Prediction labels for the pharmacology layer (a prediction is always labelled). */
export type PredictionLabel =
  | 'EXPERIMENTAL'
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'LITERATURE_PREDICTION'
  | 'UNAVAILABLE'
  | 'NOT_REPORTED';

export type TargetType =
  | 'enzyme' | 'receptor' | 'cytoplasmic_protein' | 'transport_protein'
  | 'dna_associated_protein' | 'nuclear_protein';

export type BindingModel = 'reversible' | 'irreversible';

/** Per-formulation binding profile (registry data; never hard-coded). */
export interface BindingProfile {
  model: BindingModel | null;
  kon: number | null;
  koff: number | null;
  Kd: number | null;
  Ki: number | null;
  IC50: number | null;
  evidence_level: PredictionLabel;
  basis: string;
}

/** A schematic molecular target (individual protein). */
export interface TargetState {
  id: string;
  type: TargetType;
  x: number;
  u: number;
  compartment: 'cytoplasm' | 'nucleus';
  availableSites: number;
  occupiedSites: number;
  species: string;
  evidenceLevel: PredictionLabel | EvidenceLevel;
  kineticModel: BindingModel;
  boundDrugIds: string[];
}

/** A binding record (target-engine owned; the Phase-4D molecule is not modified). */
export interface BindingRecord {
  targetId: string;
  x: number;
  u: number;
  tBindH: number;
}
