// Application configuration for the Profile-B simulator foundation (Phase 1).
//
// RULE: no hardcoded SCIENTIFIC values live here. Scientific content (presets,
// evidence, atlases, references) is loaded at runtime from the repository's
// data/ JSON files that previous phases produced. This file holds only app
// wiring: data paths, scale-level identifiers, panel ids, and defaults.

export const APP_CONFIG = Object.freeze({
  appName: 'Profile-B Simulator (foundation)',
  phase: 1,
  // Base directory (relative to simulator/index.html) where the repo data lives.
  dataBasePath: '../data/',

  // Data files the loaders know about. Values are FILE NAMES only; the science
  // is inside them. Keeping this list here (not in code) means later phases add
  // sources by editing config, not logic.
  dataSources: Object.freeze({
    presetLibrary: 'profile-b-preset-library.json',
    simulatorPresets: 'profile-b-simulator-presets.json',
    evidencePackage: 'profile-b-evidence-package.json',
    biologicalScenes: 'profile-b-biological-scenes.json',
    sceneEvidenceMap: 'profile-b-scene-evidence-map.json',
    animationPipeline: 'profile-b-animation-pipeline.json',
    infoPanels: 'profile-b-animation-info-panels.json',
    referenceLibrary: 'profile-b-reference-library.json',
    licenseRegistry: 'profile-b-license-registry.json',
    cameraLanguage: 'profile-b-camera-language.json',
    visualDecisionMatrix: 'profile-b-visual-decision-matrix.json',
  }),

  // Presets exposed by the foundation. Metadata is derived from the loaded data;
  // this only declares which preset ids the app offers and their active state.
  presets: Object.freeze([
    { id: 'B1', active: true, sourceKey: 'chen_2012' },
    { id: 'B2', active: true, sourceKey: 'wang_2025' },
    { id: 'B3', active: true, sourceKey: 'shukla_2020' },
  ]),

  // Global scale hierarchy (architectural ids only; the biological structures
  // visible at each level are read from the loaded blueprint, not hardcoded).
  scaleLevels: Object.freeze([
    { id: 'L1', name: 'Body' },
    { id: 'L2', name: 'Organ' },
    { id: 'L3', name: 'Tissue' },
    { id: 'L4', name: 'Layer' },
    { id: 'L5', name: 'Cell' },
    { id: 'L6', name: 'Molecule' },
  ]),

  // UI panel ids (framework only; no biological content in Phase 1).
  panels: Object.freeze([
    'mainView', 'navigation', 'evidence', 'citation',
    'legend', 'information', 'timeline', 'debug',
  ]),

  camera: Object.freeze({
    defaultMode: 'perspective', // 'perspective' | 'orthographic'
    fovDegrees: 45,
    near: 0.1,
    far: 1000,
    clipPlanesEnabled: true, // Phase 2: cross-section clip plane is active
  }),

  // Phase 2 rendering: static-anatomy canvas renderer behind the Phase-1 interface.
  render: Object.freeze({ kind: 'canvas' }), // 'null' | 'canvas'

  // Simulator-local data (anatomy registry lives with the app, loaded not hardcoded).
  simulatorDataBasePath: './data/',
  anatomySources: Object.freeze({ anatomy: 'anatomy.registry.json' }),

  // Phase 2.6: species-driven anatomy. `species` is the BOOT selection (a choice),
  // NOT a fallback - a future Species selector calls app.setSpecies() to switch
  // between the independent human/mouse/rat profiles. Supported species come from
  // the registry's species_scope; there is no silent fallback to human.
  anatomy: Object.freeze({ species: 'human' }),

  // Phase 3: biological transport engine (topical NLC -> skin). Evidence-gated and
  // species-driven; the engine only animates species with reported transport
  // evidence (rat). autoStart stays false so the app boots as static anatomy.
  transportSources: Object.freeze({ transport: 'transport.registry.json' }),
  transport: Object.freeze({ autoStart: false, spawnCount: 14, seed: 12345 }),

  // Phase 4: drug release engine (SEPARATE from transport). First-order model from
  // evidence; schematicKPerHour is a SCHEMATIC simulation rate (k is NOT REPORTED),
  // anchored to span the reported 1-48 h release window - not a measured constant.
  releaseSources: Object.freeze({ release: 'release.registry.json' }),
  release: Object.freeze({ schematicKPerHour: 0.0625, emptyThreshold: 0.99 }),

  // Phase 4B: cellular microenvironment + PASSIVE uptake (SEPARATE layer). Released
  // payload becomes free molecules that diffuse and passively enter schematic cells.
  // Diffusion + crossing probability are SCHEMATIC (NOT REPORTED); passive only.
  microenvironmentSources: Object.freeze({ microenvironment: 'microenvironment.registry.json' }),
  uptake: Object.freeze({ moleculesPerCarrier: 5, crossProbability: 0.35, seed: 24680 }),

  // Phase 4C: endocytosis & intracellular trafficking (SEPARATE layer; reads
  // uptake/transport read-only). Pathways/probabilities/escape/dwell come from the
  // registry; only schematic motion constants live here. Applies to carriers only.
  endocytosisSources: Object.freeze({ endocytosis: 'endocytosis.registry.json' }),
  endocytosis: Object.freeze({ formulationId: 'B1_nlc', seed: 1357 }),

  // Phase 4D: intracellular drug release (SEPARATE layer; reads endocytosis/uptake
  // read-only). Models/degradation/targeting come from the registry (B1 = NOT REPORTED
  // -> idle); only schematic motion constants live here. Applies to cytoplasmic carriers.
  intracellularSources: Object.freeze({ intracellular: 'intracellular.registry.json' }),
  intracellular: Object.freeze({ formulationId: 'B1_nlc', seed: 9753 }),

  // Phase 5A: target engagement (SEPARATE pharmacology layer; reads intracellular
  // read-only). Targets/kon/koff/affinity come from the registry (B1 = NOT REPORTED
  // -> idle); only the schematic encounter radius lives here. Binding only.
  targetEngagementSources: Object.freeze({ targetEngagement: 'target-engagement.registry.json' }),
  targetEngagement: Object.freeze({ formulationId: 'B1_nlc', seed: 8642 }),

  // Phase 5B.1: signal-transduction EVIDENCE + GRAPH ARCHITECTURE ONLY (no runtime
  // engine, no renderer, no animation). Six separable registries describe the
  // directed signaling graph; signalGraph.js only LOADS + VALIDATES them.
  signalSources: Object.freeze({
    context: 'signal-context.registry.json',
    nodes: 'signal-nodes.registry.json',
    edges: 'signal-edges.registry.json',
    pathways: 'signal-pathways.registry.json',
    evidence: 'signal-evidence.registry.json',
    prediction: 'signal-prediction.registry.json',
  }),

  // Phase 5B.2: signal PROPAGATION runtime. The engine consumes the 5B.1 graph +
  // this registry read-only and propagates activity over simulated time. Predictions
  // are labelled + toggleable; the overlay mode controls which evidence tier is shown.
  signalPropagationSources: Object.freeze({ propagation: 'signal-propagation.registry.json' }),
  signalPropagation: Object.freeze({ includePredictions: true, overlayMode: 'combined', dtHours: 0.5 }),

  // Phase 5C: gene regulation / transcription runtime. The transcription engine reads the
  // signal-propagation output + this registry read-only and drives TF activation ->
  // nuclear translocation -> DNA binding -> gene transcription -> mRNA (STOP at mRNA).
  // Human HaCaT is a labelled prediction; mouse/rat are NOT_REPORTED (idle).
  transcriptionSources: Object.freeze({ transcription: 'transcription.registry.json' }),
  transcription: Object.freeze({ dtHours: 0.5 }),

  // Default anatomy scene shown at boot (a clean cross-section of all layers).
  defaultScene: 'cross_section',

  logging: Object.freeze({ level: 'info' }),
  debug: Object.freeze({ enabled: true, showFps: true }),
});

export default APP_CONFIG;
