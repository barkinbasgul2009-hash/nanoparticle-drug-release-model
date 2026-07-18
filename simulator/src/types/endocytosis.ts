// TypeScript interface contract for Phase-4C endocytosis & intracellular trafficking
// (types only, no runtime code). Describes endocytosis.registry.json and the carrier
// fate state. Checked via `tsc --noEmit`. Applies to CARRIERS only; nothing beyond
// intracellular trafficking is modelled.

import type { Confidence } from './biology';
import type { EvidenceLevel } from './transport';

/** The three implemented endocytic pathways (no phagocytosis / receptor-specific / Fc). */
export type Pathway = 'clathrin_mediated' | 'caveolae_mediated' | 'macropinocytosis';

/** The strict carrier-fate states. */
export type EndocytosisState =
  | 'EXTRACELLULAR' | 'MEMBRANE_CONTACT' | 'WRAPPING' | 'INTERNALIZED'
  | 'EARLY_ENDOSOME' | 'LATE_ENDOSOME' | 'LYSOSOME' | 'ESCAPED' | 'CYTOPLASM';

/** Per-formulation endocytosis profile (registry data; never hard-coded). */
export interface EndocytosisFormulation {
  carrier_kind: string;
  size_nm: string;
  endocytosis_probability: number;
  pathway_weights: Record<Pathway, number>;
  pathway_basis: string;
  escape: { state: 'no_escape' | 'partial' | 'efficient'; escape_probability: number; evidence_level: EvidenceLevel; basis: string };
  trafficking_profile: { early_endosome_dwell: number; late_endosome_dwell: number; lysosome_dwell: number; basis?: string };
}

/** Per-species endocytosis / trafficking evidence. */
export interface SpeciesEndocytosis {
  evidence_level: EvidenceLevel;
  confidence: Confidence;
  referenceIds: string[];
  observational_support?: string;
  message: string;
}

/** A carrier's intracellular fate record (endocytosis-engine owned). */
export interface CarrierFate {
  carrierId: string;
  state: EndocytosisState;
  pathway: Pathway | null;
  cellId: string | null;
  ex: number;                  // patch x
  eu: number;                  // patch u
  wrap: number;                // membrane wrapping progress 0..1
  dwell: number;
  stalled: boolean;
}
