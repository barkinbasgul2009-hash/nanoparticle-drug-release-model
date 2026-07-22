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

  // Phase 5D: translation / protein-synthesis runtime. The translation engine reads the
  // Phase-5C mRNA output + these registries read-only and drives ribosome recruitment ->
  // initiation -> elongation -> termination -> nascent protein -> schematic folding /
  // maturation -> mature protein abundance -> turnover (STOP at protein; no function).
  // Human HaCaT is a labelled prediction; mouse/rat are NOT_REPORTED (idle).
  translationSources: Object.freeze({
    context: 'translation-context.registry.json',
    machinery: 'translation-machinery.registry.json',
    protein: 'protein.registry.json',
  }),
  translation: Object.freeze({ dtHours: 0.5 }),

  // Phase 6A: protein function & early cellular response. The engine reads the Phase-5D
  // mature proteins + Phase-5B signaling + these registries read-only and drives functional
  // eligibility -> functional activation -> reversible early cellular-state change (STOP
  // before cell fate). Human HaCaT + mouse melanoma early-response profiles; rat NOT_REPORTED.
  proteinFunctionSources: Object.freeze({
    context: 'protein-function-context.registry.json',
    cellularState: 'cellular-state.registry.json',
    edges: 'functional-edges.registry.json',
    evidence: 'functional-evidence.registry.json',
  }),
  proteinFunction: Object.freeze({ dtHours: 0.5 }),

  // Phase 6B: apoptosis commitment & execution. The engine reads the Phase-6A cellular-
  // stress states + Phase-5B signaling + these registries read-only and drives apoptosis
  // eligibility -> reversible pre-commitment -> irreversible commitment -> mitochondrial
  // transition -> caspase and/or AIF execution -> apoptotic cell state (STOP; single cell,
  // no population/tumour outcome). Mouse B16BL6 = context-transfer prediction (default);
  // B16 / B16-F10 selectable; HaCaT + rat NOT_REPORTED.
  apoptosisSources: Object.freeze({
    context: 'apoptosis-context.registry.json',
    dynamics: 'apoptosis-dynamics.registry.json',
    interventions: 'apoptosis-interventions.registry.json',
    evidence: 'apoptosis-evidence.registry.json',
  }),
  apoptosis: Object.freeze({ dtHours: 0.5 }),

  // Phase 6C: population-response registries (schematic virtual population derived from the
  // Phase-6B single-cell apoptosis trajectory; normalized fractions only; STOP at population
  // composition - no tumour/survival/clinical outcome). Mouse B16BL6 = context-transfer
  // prediction (default); B16 / B16-F10 mechanistic predictions; HaCaT + rat NOT_REPORTED.
  populationSources: Object.freeze({
    context: 'population-context.registry.json',
    state: 'population-state.registry.json',
    transitions: 'population-transitions.registry.json',
    evidence: 'population-evidence.registry.json',
    prediction: 'population-prediction.registry.json',
    interventions: 'population-interventions.registry.json',
  }),
  population: Object.freeze({ dtHours: 0.5 }),

  // Phase 6D: tumour growth / treatment-response registries (schematic normalized burden
  // derived from the Phase-6C population; STOP at the treatment-response trajectory - no
  // clinical/RECIST/survival/patient outcome). Mouse B16BL6 = experimental tumour-model
  // (Chen 2012 direction + formulation ranking); B16 / B16-F10 separate; human predictive-
  // exploratory / UNAVAILABLE; rat NOT_REPORTED.
  tumorSources: Object.freeze({
    context: 'tumor-context.registry.json',
    response: 'tumor-response.registry.json',
    transitions: 'tumor-transitions.registry.json',
    model: 'tumor-model.registry.json',
    formulation: 'tumor-formulation.registry.json',
    treatment: 'tumor-treatment.registry.json',
    evidence: 'tumor-evidence.registry.json',
    prediction: 'tumor-prediction.registry.json',
  }),
  tumor: Object.freeze({ dtHours: 0.5 }),

  // Phase 7A: passive tumour-microenvironment (TME) registries. A PASSIVE modulator that
  // modifies drug penetration (ECM / collagen / hyaluronic acid / interstitial / oxygen /
  // hypoxia / mechanical) - it never replaces upstream engines or alters upstream biological
  // logic. STOP at penetration modification. Mouse B16BL6 = MECHANISTIC_PREDICTION (default);
  // human = predictive-exploratory; rat = NOT_REPORTED.
  // (key is `tmeSources`, distinct from the frozen Phase-4B `microenvironmentSources`.)
  tmeSources: Object.freeze({
    context: 'microenvironment-context.registry.json',
    ecm: 'ecm.registry.json',
    diffusion: 'diffusion.registry.json',
    mechanical: 'mechanical.registry.json',
    oxygen: 'oxygen.registry.json',
    hypoxia: 'hypoxia.registry.json',
    penetration: 'penetration.registry.json',
    evidence: 'microenvironment-evidence.registry.json',
    prediction: 'microenvironment-prediction.registry.json',
  }),
  tme: Object.freeze({ dtHours: 0.5 }),

  // Phase 7B: tumour-vasculature / angiogenesis registries. The ACTIVE vascular component of
  // the microenvironment (vessel architecture / perfusion / oxygen + nutrient supply /
  // permeability) that MODIFIES drug delivery. It never signals / induces apoptosis / remodels
  // or alters upstream logic. STOP at delivery modification. Mouse B16BL6 = MECHANISTIC_
  // PREDICTION (default); human = predictive-exploratory; rat = NOT_REPORTED.
  vascularSources: Object.freeze({
    context: 'vascular-context.registry.json',
    angiogenesis: 'angiogenesis.registry.json',
    perfusion: 'perfusion.registry.json',
    oxygenSupply: 'oxygen-supply.registry.json',
    nutrient: 'nutrient.registry.json',
    permeability: 'permeability.registry.json',
    delivery: 'delivery.registry.json',
    evidence: 'vascular-evidence.registry.json',
    prediction: 'vascular-prediction.registry.json',
  }),
  vascular: Object.freeze({ dtHours: 0.5 }),

  // Phase 8A: adaptive & acquired drug-resistance registries. The resistance runtime represents
  // resistance as a TIME-DEPENDENT process (reversible tolerance / adaptive / acquired persistence /
  // selection / enrichment / re-sensitization) and produces an ADVISORY treatment-sensitivity
  // modifier consumed on the NEXT frame. It consumes validated population / tumour-response /
  // microenvironment / vascular outputs READ-ONLY and mutates NOTHING upstream. Prediction-only (NO
  // experimental tier); mouse B16BL6 = MECHANISTIC_PREDICTION (default); human = predictive-
  // exploratory; rat = NOT_REPORTED. Immune-associated resistance = UNAVAILABLE (Phase 7C not
  // implemented). STOP at resistance state + advisory modifier (no combination therapy / forecasting
  // / mutation / clinical outcome). Config key `resistanceSources` (distinct from all frozen keys).
  resistanceSources: Object.freeze({
    context: 'resistance-context.registry.json',
    baseline: 'baseline-resistance.registry.json',
    intrinsic: 'intrinsic-sensitivity.registry.json',
    exposure: 'treatment-exposure.registry.json',
    pressure: 'treatment-pressure.registry.json',
    survivor: 'survivor-state.registry.json',
    tolerance: 'drug-tolerance.registry.json',
    adaptive: 'adaptive-resistance.registry.json',
    acquired: 'acquired-resistance.registry.json',
    persistent: 'persistent-resistance.registry.json',
    mechanism: 'resistance-mechanism.registry.json',
    uptake: 'uptake-resistance.registry.json',
    efflux: 'efflux-resistance.registry.json',
    target: 'target-availability-resistance.registry.json',
    survivalSignaling: 'survival-signaling-resistance.registry.json',
    stress: 'stress-adaptation.registry.json',
    apoptosisEvasion: 'apoptosis-evasion.registry.json',
    cellState: 'cell-state-resistance.registry.json',
    microenvProtection: 'microenvironment-protection.registry.json',
    immune: 'immune-associated-resistance.registry.json',
    subpopulation: 'resistant-subpopulation.registry.json',
    selection: 'selection-pressure.registry.json',
    enrichment: 'population-enrichment.registry.json',
    resensitization: 'resensitization.registry.json',
    washout: 'washout.registry.json',
    rechallenge: 'rechallenge.registry.json',
    burden: 'resistance-burden.registry.json',
    modifier: 'resistance-modifier.registry.json',
    transition: 'resistance-transition.registry.json',
    evidence: 'resistance-evidence.registry.json',
    prediction: 'resistance-prediction.registry.json',
    validation: 'resistance-validation.registry.json',
  }),
  resistance: Object.freeze({ dtHours: 0.5 }),

  // Phase 7C: immune-microenvironment registries (Part 1 - Section 1 foundational contracts). A
  // bounded mechanistic immune runtime (tumour visibility / innate + adaptive immunity / antigen
  // presentation / endogenous checkpoint pressure / immune suppression / immune escape / net immune-
  // mediated tumour-loss potential) that reads validated tumour / TME (7A) / vascular (7B) outputs
  // READ-ONLY and publishes a versioned, immutable ImmuneFrame consumed READ-ONLY by Phase 8A - it
  // mutates NOTHING upstream and Phase 8A mutates nothing here. Prediction-only (NO experimental
  // tier); mouse B16BL6 = MECHANISTIC_PREDICTION; human = predictive-exploratory; rat = NOT_REPORTED.
  // Section 1 establishes contracts; the immune biology is populated in later sections (component
  // outputs are structurally valid but UNAVAILABLE for now). Config key `immuneSources`.
  immuneSources: Object.freeze({
    context: 'immune-context.registry.json',
    visibility: 'immune-visibility.registry.json',
    innate: 'innate-immunity.registry.json',
    antigenPresentation: 'antigen-presentation.registry.json',
    adaptive: 'adaptive-immunity.registry.json',
    checkpoint: 'immune-checkpoint.registry.json',
    suppression: 'immune-suppression.registry.json',
    escape: 'immune-escape.registry.json',
    effect: 'immune-effect.registry.json',
    transition: 'immune-transition.registry.json',
    evidence: 'immune-evidence.registry.json',
    prediction: 'immune-prediction.registry.json',
    validation: 'immune-validation.registry.json',
    // Part 1 - Section 2 shared runtime frameworks (aggregation + confidence).
    aggregation: 'immune-aggregation.registry.json',
    confidence: 'immune-confidence.registry.json',
    // Part 1 - Section 4 adaptive immunity / checkpoints / suppression / escape coefficients.
    adaptiveContext: 'adaptive-context.registry.json',
    cd8: 'adaptive-cd8.registry.json',
    cd4: 'adaptive-cd4.registry.json',
    treg: 'adaptive-treg.registry.json',
    adaptiveCheckpoint: 'adaptive-checkpoint.registry.json',
    adaptiveSuppression: 'adaptive-suppression.registry.json',
    adaptiveEscape: 'adaptive-escape.registry.json',
    adaptiveIntegration: 'adaptive-integration.registry.json',
  }),
  immune: Object.freeze({ dtHours: 0.5 }),

  // Default anatomy scene shown at boot (a clean cross-section of all layers).
  defaultScene: 'cross_section',

  logging: Object.freeze({ level: 'info' }),
  debug: Object.freeze({ enabled: true, showFps: true }),
});

export default APP_CONFIG;
