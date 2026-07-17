// TypeScript interface contract: scenes, camera, animation, scale (Phase 1).
// Types only - no runtime behavior. Animation types are declared for later
// phases but nothing animates in Phase 1.

import type { EvidenceDescriptor } from './evidence';

export interface ScaleLevel {
  id: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | string;
  name: string;
  order: number;
  visibleStructures: string[];
  allowedLabels: string[];
  cameraLimits: Record<string, unknown>;
  canTransitionTo: string[];
}

export interface CameraDescriptor {
  mode: 'perspective' | 'orthographic';
  fovDegrees: number;
  near: number;
  far: number;
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  clipPlanes: ClipPlane[];
  navMode: 'free' | 'guided' | 'cinematic' | 'educational';
}

export interface ClipPlane {
  enabled: boolean;
  normal: [number, number, number];
  constant: number;
}

export interface SceneMeta {
  id: string;
  title?: string;
  preset?: string;
  scale?: string;
  evidence?: EvidenceDescriptor;
}

export interface Scene {
  meta: SceneMeta;
  init?: (ctx: Record<string, unknown>) => void | Promise<void>;
  enter?: (ctx: Record<string, unknown>) => void;
  exit?: (ctx: Record<string, unknown>) => void;
  dispose?: () => void;
}

/** Declared for later phases; unused in Phase 1. */
export interface AnimationTrack {
  id: string;
  targetId: string;
  property: string;
  qualitative: boolean;        // most Profile-B motion is qualitative
  evidence: EvidenceDescriptor;
}
