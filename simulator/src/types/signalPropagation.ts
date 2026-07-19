// TypeScript interface contract for Phase-5B.2 signal PROPAGATION (types only, no
// runtime code). Describes signal-propagation.registry.json and the runtime engine's
// node/edge/frame/timeline shapes. Checked via `tsc --noEmit`. The engine consumes the
// frozen 5B.1 graph read-only; these types cover the RUNTIME dynamics only. Stops at
// signaling - no transcription/translation/apoptosis/PD/PK.

import type { SignalNodeType, SignalRelationshipType, Compartment, Confidence } from './signaling';

/** Runtime node states during propagation. */
export type RuntimeState =
  | 'inactive' | 'transitioning' | 'partial' | 'active' | 'suppressed' | 'degraded';

/** Runtime prediction ladder (adds HYPOTHESIS; EXPERIMENTAL always outranks predictions). */
export type RuntimePredictionLevel =
  | 'EXPERIMENTAL'
  | 'HIGH_CONFIDENCE_PREDICTION'
  | 'LITERATURE_DERIVED_PREDICTION'
  | 'MECHANISTIC_PREDICTION'
  | 'HYPOTHESIS';

/** Evidence-overlay display modes (never mutate data). */
export type OverlayMode = 'experimental' | 'prediction' | 'combined' | 'unavailable' | 'not_reported';

export type DelayClass = 'fast' | 'medium' | 'slow' | number;

/** Global runtime defaults from the registry. */
export interface PropagationDefaults {
  activity_max: number;
  activation_threshold: number;
  attenuation_per_edge: number;
  edge_weight: number;
  decay_rate_per_hour: number;
  activation_duration_h: number;
  delay_classes_h: { fast: number; medium: number; slow: number };
  drive: { start_activity: number; ramp_per_hour: number };
  dt_hours: number;
}

/** Per-node runtime dynamics (keyed by frozen 5B.1 node id). */
export interface NodeDynamics {
  threshold?: number;
  decay_rate_per_hour?: number;
  activation_duration_h?: number;
  is_start?: boolean;
  is_output?: boolean;
  baseline_active?: boolean;
  prediction_level?: RuntimePredictionLevel;
  confidence?: Confidence;
  rationale?: string;
  layout?: { col: number; row: number };
}

/** Per-edge runtime dynamics (keyed by frozen 5B.1 edge id). */
export interface EdgeDynamics {
  delay_class?: DelayClass;
  attenuation?: number;
  weight?: number;
}

/** A labelled, toggleable predicted feedback edge (not in the frozen graph). */
export interface PredictedFeedbackEdge {
  profile_id: string;
  source: string;
  target: string;
  relationship_type: SignalRelationshipType;
  direction: 'forward' | 'unresolved';
  delay_class: DelayClass;
  attenuation: number;
  weight: number;
  prediction_level: RuntimePredictionLevel;
  evidence_level: string;
  confidence: Confidence;
  rationale: string;
  reference_ids: string[];
}

/** A labelled predicted extension pathway (e.g. STIM1 -> Orai1 -> SOCE -> Ca2+). */
export interface PredictionPathway {
  title: string;
  context_id: string;
  species: string;
  cell_model: string;
  prediction_level: RuntimePredictionLevel;
  start_condition: string;
  stop_condition: string;
  no_profile_b_evidence: boolean;
  basis: string;
  nodes: Record<string, NodeDynamics & { canonical_name: string; display_name: string; node_type: SignalNodeType; compartment: Compartment }>;
  edges: Record<string, Partial<PredictedFeedbackEdge> & { source: string; target: string; relationship_type: SignalRelationshipType }>;
}

/** The full runtime registry. */
export interface SignalPropagationRegistry {
  runtime_states: RuntimeState[];
  runtime_prediction_levels: RuntimePredictionLevel[];
  evidence_overlay_modes: OverlayMode[];
  defaults: PropagationDefaults;
  node_dynamics: Record<string, NodeDynamics>;
  edge_dynamics: Record<string, EdgeDynamics>;
  predicted_extensions: {
    feedback_edges: Record<string, PredictedFeedbackEdge>;
    prediction_pathways: Record<string, PredictionPathway>;
  };
}

/** A node in a render frame. */
export interface SignalFrameNode {
  id: string;
  displayName: string;
  nodeType: SignalNodeType;
  compartment: Compartment;
  activity: number;
  state: RuntimeState;
  predicted: boolean;
  predictionLevel: RuntimePredictionLevel;
  evidenceLevel: string;
  confidence: Confidence;
  rationale: string;
  visible: boolean;
  layout: { col: number; row: number };
  isOutput: boolean;
}

/** An edge in a render frame. */
export interface SignalFrameEdge {
  id: string;
  source: string;
  target: string;
  relationship: SignalRelationshipType;
  sign: number;
  flowing: boolean;
  active: boolean;
  predicted: boolean;
  predictionLevel: RuntimePredictionLevel;
  evidenceLevel: string;
  visible: boolean;
}

/** A full render frame. */
export interface SignalFrame {
  nodes: SignalFrameNode[];
  edges: SignalFrameEdge[];
  timeH: number;
  overlay: OverlayMode;
  predictions: boolean;
}

/** A timeline event. */
export interface SignalTimelineEvent {
  timeH: number;
  nodeId: string;
  event: 'activated' | 'suppressed' | 'deactivated';
  activity: number;
  predicted: boolean;
  predictionLevel: RuntimePredictionLevel;
}

/** Engine stats. */
export interface SignalPropagationStats {
  nodes: number;
  edges: number;
  active: number;
  suppressed: number;
  degraded: number;
  predicted: number;
  maxActivity: number;
  timeH: number;
  steps: number;
}
