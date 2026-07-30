// TypeScript interface contract for Phase-4D intracellular drug release (types only,
// no runtime code). Describes intracellular.registry.json and the intracellular-drug
// state. Checked via `tsc --noEmit`. Ends at nucleus targeting; nothing downstream.

import type { Confidence } from './biology';
import type { EvidenceLevel } from './transport';

export type IntracellularReleaseModelId =
  | 'burst' | 'first_order' | 'zero_order' | 'higuchi' | 'korsmeyer_peppas';

export type DegradationMode = 'stable' | 'partial' | 'complete';
export type TargetingMode = 'none' | 'passive' | 'evidence_supported';

/** Per-formulation intracellular profile (registry data; never hard-coded). */
export interface IntracellularFormulation {
  trigger: string;
  intracellular_release: { model: IntracellularReleaseModelId | null; params: Record<string, number>; evidence_level: EvidenceLevel; basis: string };
  degradation: { mode: DegradationMode | null; params: Record<string, number>; evidence_level: EvidenceLevel; basis: string };
  nucleus_targeting: { mode: TargetingMode; evidence_level: EvidenceLevel; basis: string };
}

/** Schematic nucleus geometry (membrane + interior + label only). */
export interface NucleusSpec {
  radius_fraction: number;
  membrane_thickness: number;
  label: string;
  color?: string;
}

/** An intracellular free drug molecule (engine-owned). */
export interface IntracellularDrugState {
  id: string;
  parentCarrierId: string | null;
  species: string;
  x: number;
  u: number;
  vx: number;
  vu: number;
  diffusion: number;
  releaseTimeH: number;
  cellId: string | null;
  compartment: 'cytoplasm' | 'nuclear_membrane';
  alive: boolean;
  evidenceLevel: EvidenceLevel | Confidence;
  targetCompartment: 'cytoplasm' | 'nucleus';
}
