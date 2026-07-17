// TypeScript interface contract for Profile-B biological objects (Phase 1).
// TYPES ONLY - no runtime code, no rendering. These describe the shape of data
// loaded from the frozen repository registries so later phases are type-safe.
// Consuming with `tsc --noEmit` is optional in Phase 1.

/** A biological confidence label from the controlled vocabulary. */
export type Confidence =
  | 'DIRECTLY_OBSERVED'
  | 'QUANTITATIVELY_SUPPORTED'
  | 'QUALITATIVELY_SUPPORTED'
  | 'ABSTRACT_SUPPORTED'
  | 'CONTEXTUAL_ANATOMY'
  | 'MECHANISTIC_TRANSFER'
  | 'INFERRED_RISK'
  | 'ILLUSTRATIVE_ONLY'
  | 'NOT_REPORTED'
  | 'UNSUPPORTED_DO_NOT_ANIMATE'
  | 'NOT_APPLICABLE';

/** How a structure should be drawn (from the director pass). */
export type Representation =
  | 'REALISTIC' | 'STYLIZED' | 'SCHEMATIC' | 'LABEL_ONLY' | 'HIDDEN';

export type SpeciesId = 'human' | 'rat' | 'mouse' | 'cell_line' | 'model_3d';

export interface Species {
  id: SpeciesId;
  label: string;               // e.g. "Sprague-Dawley rat (ex vivo skin)"
  note?: string;
}

export type ExperimentContext =
  | 'EX_VIVO_RAT_SKIN'
  | 'IN_VITRO_HUMAN_KERATINOCYTE'
  | 'IN_VITRO_MURINE_MELANOMA'
  | 'IN_VIVO_MOUSE_MELANOMA'
  | 'IN_VITRO_INTESTINAL_MODEL'
  | 'IN_VITRO_NSCLC';

export interface Experiment {
  context: ExperimentContext;
  species: SpeciesId;
  use: string;
  confidence: Confidence;
}

/** A tissue layer (e.g. stratum corneum) - appearance only, no invented numbers. */
export interface Layer {
  id: string;
  name: string;
  confidence: Confidence;
  representation?: Representation;
  avascular?: boolean;
  depthBandUm?: string;        // e.g. "0-30" (Chen section boundary), never a fabricated value
}

/** A cell type reference (appearance + role, no invented densities). */
export interface Cell {
  id: string;
  role: 'REQUIRED' | 'OPTIONAL_CONTEXT' | 'LABEL_ONLY' | 'EXCLUDED';
  confidence: Confidence;
  representation?: Representation;
  morphology?: string;
}

/** A carrier/particle descriptor (foundation-level; no simulation). */
export interface Particle {
  id: string;
  kind: 'NLC' | 'PLGA_PEG' | 'INCLUSION_COMPLEX' | 'FREE_API';
  sizeClassNm?: string;        // e.g. "~85-90" (display class only)
  representation?: Representation;
}

/** A microscopy feature/method reference. */
export interface MicroscopyFeature {
  method: 'H&E' | 'MASSON_TRICHROME' | 'IHC' | 'IF_CONFOCAL' | 'TEM' | 'SEM' | 'DARKFIELD' | 'WHOLE_SLIDE';
  visible: string;
  colorClass: 'TRUE_NATURAL' | 'STAIN_DEPENDENT' | 'FLUORESCENCE_PSEUDOCOLOR' | 'ILLUSTRATIVE' | 'DATA_ENCODING';
}

/** An atlas bundle for a preset (tissue + cells + ecm references). */
export interface Atlas {
  presetId: string;
  layers: Layer[];
  cells: Cell[];
  microscopy: MicroscopyFeature[];
}
