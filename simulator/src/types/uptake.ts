// TypeScript interface contract for Phase-4B cellular microenvironment + passive
// uptake (types only, no runtime code). Describes microenvironment.registry.json and
// the molecule/uptake simulation state. Checked via `tsc --noEmit`. Passive ONLY;
// nothing intracellular beyond simple diffusion.

import type { Confidence, SpeciesId } from './biology';
import type { EvidenceLevel } from './transport';

/** A schematic minimal cell - MEMBRANE + CYTOPLASM only (no organelles/receptors). */
export interface Cell {
  id: string;
  x: number;                   // patch coordinate (0..1)
  u: number;                   // patch coordinate (0..1, relative depth in the dermis band)
  radius: number;              // normalized radius in the (x,u) patch
}

/** The passive membrane-crossing model (no receptors/vesicles/endocytosis). */
export interface UptakeModel {
  id: 'passive_membrane_crossing';
  name: string;
  mechanism: 'PASSIVE';
  description: string;
  confidence: Confidence;      // MECHANISTIC_TRANSFER (predictive)
  references: string[];
  principle_basis?: string;
  notes?: string;
}

/** Per-species uptake evidence (evidence-levelled; predictive for all here). */
export interface SpeciesUptake {
  evidence_level: EvidenceLevel;
  confidence: Confidence;
  referenceIds: string[];      // empty for predictive (no fabricated citation)
  principle_refs?: string[];
  observational_support?: string;
  message: string;
}

/** A free drug molecule - an independent diffusing object (no chemistry). */
export interface DrugMoleculeState {
  id: string;
  x: number;
  u: number;                   // "y" position (relative depth in the dermis patch)
  vx: number;
  vu: number;
  diffusion: number;           // schematic diffusion coefficient (sim units)
  species: SpeciesId | string;
  releaseTimeH: number;        // release timestamp
  alive: boolean;
  compartment: 'extracellular' | 'cytoplasm';
  cellId: string | null;
  contacted: boolean;          // has it touched a membrane? (uptake requires contact)
  evidenceTag: object | null;
}
