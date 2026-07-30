// TypeScript interface contract: presets + app state (Phase 1). Types only.

export interface VisualizationPermissions {
  supportedEvents: string[];
  contextualOnly: string[];
  unsupportedDoNotAnimate: string[];
}

export interface PresetMeta {
  id: string;                  // 'B1' | 'B2' | 'B3'
  sourceKey: string;           // e.g. 'chen_2012'
  active: boolean;
  model: string;
  species: string;
  route: string;
  evidenceLevel: string;
  references: string[];
  visualizationPermissions: VisualizationPermissions;
  limitations: string[];
}

export interface AppState {
  currentPreset: string | null;
  currentScene: string | null;
  currentScale: string;
  selectedStructure: string | null;
  selectedEvidence: string | null;
  selectedCitation: string | null;
  ui: Record<string, unknown>;
  camera: Record<string, unknown> | null;
  debug: boolean;
}
