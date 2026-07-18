// TypeScript interface contract for Phase-4 drug release (types only, no runtime
// code). Describes release.registry.json and the release simulation state so later
// work stays type-safe. Checked via `tsc --noEmit`. Release is a SEPARATE domain
// from transport and models NOTHING beyond payload release.

import type { Confidence } from './biology';

/** The evidence-selected release kinetic model. */
export interface ReleaseModelSpec {
  id: 'first_order';
  name: string;
  equation_released: string;   // F(t) = 1 - exp(-k t)
  equation_remaining: string;  // Q(t) = Q0 exp(-k t)
  selected_by: string;
  alternatives_considered: string[];
  confidence: Confidence;
  references: string[];
  notes?: string;
}

/** The (NOT REPORTED) rate constant record - schematic timing only. */
export interface RateConstant {
  value: number | null;        // null = NOT REPORTED
  status: string;
  reported_model: string;
  reported_window_h: [number, number];
  note?: string;
}

/** A release lifecycle state. */
export interface ReleaseState {
  id: 'loaded' | 'releasing' | 'empty';
  name: string;
  description: string;
  payload: 'full' | 'decreasing' | 'depleted';
}

/** Per-particle release state held by the ReleaseEngine (not on the transport Particle). */
export interface ParticleReleaseState {
  payloadFraction: number;     // 1 -> 0
  releasedFraction: number;    // 0 -> 1  (payloadFraction + releasedFraction = 1)
  releaseState: 'loaded' | 'releasing' | 'empty';
  tReleaseH: number;           // elapsed release time (h)
}

/** A point on the aggregate release curve. */
export interface ReleaseCurvePoint {
  t: number;                   // cumulative time (h)
  released: number;            // mean released fraction across carriers
}
