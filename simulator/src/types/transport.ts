// TypeScript interface contract for Phase-3 biological transport (types only,
// no runtime code). Describes the shape of transport.registry.json and the
// simulation objects so later phases stay type-safe. Checked via `tsc --noEmit`.

import type { Confidence, SpeciesId } from './biology';

/** A state in the topical-transport pathway. */
export interface TransportState {
  id: 'formulation' | 'skin_surface' | 'stratum_corneum' | 'viable_epidermis' | 'dermis' | 'target_region';
  name: string;
  layer: string | null;          // anatomy layer id (null for the formulation compartment)
  depth_anchor: 'above_surface' | 'surface' | 'layer_center' | 'target';
  description: string;
  evidence: TransportEvidence;
}

/** Evidence attached to a state/transition (feeds the EvidenceEngine gate). */
export interface TransportEvidence {
  referenceIds: string[];
  confidence: Confidence;
  notes?: string;
}

/** A transition between two consecutive states. */
export interface TransportTransition {
  from: string;
  to: string;
  mechanisms: string[];          // mechanism ids (passive only)
  barrier: string | null;        // barrier/layer id modifying movement, or null
  evidence: TransportEvidence;
}

/** A passive transport mechanism (active transport is EXCLUDED). */
export interface TransportMechanism {
  name: string;
  kind: 'PASSIVE' | 'EXCLUDED';
  confidence: Confidence;
  references: string[];
  rationale: string;
}

/** A per-layer barrier: SCHEMATIC ORDINAL mobility, evidence-based ordering only. */
export interface TransportBarrier {
  relative_mobility: number;     // 0..1 (0 impermeable, 1 free) - schematic, not a measured D
  role: string;
  basis: 'SCHEMATIC_ORDINAL';
  confidence: Confidence;
  references: string[];
  rationale: string;
}

/** Evidence Level (Phase 3.1): how well a species' transport is supported. */
export type EvidenceLevel = 'EXPERIMENTAL' | 'PREDICTIVE' | 'UNAVAILABLE';

/** Per-species transport (evidence-gated + evidence-levelled; no fallback). */
export interface SpeciesTransport {
  supported: boolean;
  evidence_level: EvidenceLevel;
  predictive?: boolean;
  context?: string;
  referenceIds: string[];        // EXPERIMENTAL only; PREDICTIVE carries none (no fallback)
  principle_refs?: string[];     // PREDICTIVE: transparent general-principle basis
  principle_basis?: string;
  confidence: Confidence;        // QUALITATIVELY_SUPPORTED | MECHANISTIC_TRANSFER | NOT_REPORTED
  message: string;               // species-facing evidence-level message (UX)
  reason?: string;               // present when UNAVAILABLE
  notes?: string;
  tissue?: string;
  time_window_h?: [number, number];
}

/** A single simulated carrier. */
export interface ParticleState {
  id: string;
  species: SpeciesId | string;
  charge: 'cationic' | 'neutral' | 'anionic';
  x: number;                     // 0..1 across the cross-section
  d: number;                     // 0..1 depth (surface -> stack bottom)
  state: string;
  layer: string | null;
  transportStatus: 'spawned' | 'moving' | 'crossing_barrier' | 'arrived';
  evidenceTag: TransportEvidence | null;
}
