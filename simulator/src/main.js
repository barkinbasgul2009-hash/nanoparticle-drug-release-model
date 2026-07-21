// Application bootstrap (Phase 1). Wires the foundation modules together and
// starts a NON-rendering application: it loads + validates data, builds preset
// and citation indexes, initializes scale/camera/scene/ui/debug, and mounts empty
// panels. NO biology, NO particles, NO animation, NO shaders, NO scenes.
//
// `createApp` accepts an injected fetcher so the same bootstrap runs headless in
// the architecture tests (Node) and in the browser.

import APP_CONFIG from './config/app.config.js';
import { Logger } from './core/logger.js';
import { EventBus, setEventErrorReporter } from './core/eventBus.js';
import { StateStore, createInitialState } from './core/state.js';
import { JsonLoader } from './data/jsonLoader.js';
import { PresetEngine } from './presets/presetEngine.js';
import { SceneManager } from './scene/sceneManager.js';
import { ScaleSystem } from './scale/scaleSystem.js';
import { CameraSystem } from './camera/cameraSystem.js';
import { createRenderer } from './render/renderer.js';
import { EvidenceEngine } from './evidence/evidenceEngine.js';
import { CitationEngine } from './references/citationEngine.js';
import { UiFramework } from './ui/uiFramework.js';
import { DebugTools } from './debug/debugTools.js';
import { JsonLoader as _JsonLoader } from './data/jsonLoader.js';
import { AnatomyModel } from './anatomy/anatomyModel.js';
import { ZoomController } from './anatomy/zoomController.js';
import { LabelSystem } from './anatomy/labelSystem.js';
import { registerAnatomyScenes } from './anatomy/anatomyScenes.js';
import { buildAnatomyPanelModels, renderAnatomyPanels } from './ui/panels/anatomyPanels.js';
import { TransportModel } from './biology/transportModel.js';
import { BiologicalStateMachine } from './biology/transportStates.js';
import { TransportEngine } from './biology/transportEngine.js';
import { TransportAnimator } from './biology/transportAnimator.js';
import { ReleaseModel } from './biology/releaseModel.js';
import { ReleaseEngine } from './biology/releaseEngine.js';
import { CellField } from './biology/cellField.js';
import { UptakeEngine } from './biology/uptakeEngine.js';
import { EndocytosisFSM } from './biology/endocytosisStates.js';
import { EndocytosisEngine } from './biology/endocytosisEngine.js';
import { IntracellularReleaseModel } from './biology/intracellularReleaseModel.js';
import { IntracellularReleaseEngine } from './biology/intracellularReleaseEngine.js';
import { TargetEngagementEngine } from './biology/targetEngagementEngine.js';
import { loadSignalGraph } from './biology/signalGraph.js';
import { SignalPropagationEngine } from './biology/signalPropagationEngine.js';
import { TranscriptionEngine } from './biology/transcriptionEngine.js';
import { TranslationEngine } from './biology/translationEngine.js';
import { ProteinFunctionEngine } from './biology/proteinFunctionEngine.js';
import { ApoptosisEngine } from './biology/apoptosisEngine.js';
import { PopulationEngine } from './biology/populationEngine.js';
import { TumorResponseEngine } from './biology/tumorResponseEngine.js';

/**
 * @param {{ config?: object, fetcher?: (url:string)=>Promise<string>, mount?: boolean, containerResolver?: (id:string)=>any }} [opts]
 */
export async function createApp(opts = {}) {
  const config = opts.config || APP_CONFIG;
  const logger = new Logger({ level: (config.logging && config.logging.level) || 'info' });
  const bus = new EventBus();
  setEventErrorReporter((type, err) => logger.error('app', `handler error for ${type}`, { err: String(err) }));

  logger.info('app', `booting ${config.appName} (phase ${config.phase})`);

  const state = new StateStore({ bus, initial: createInitialState() });
  const loader = new JsonLoader({
    basePath: config.dataBasePath,
    fetcher: opts.fetcher,          // undefined => browser fetch
    logger,
  });

  // Load the data the foundation needs (validated automatically).
  const src = config.dataSources;
  const data = await loadFoundationData(loader, src, logger);

  // Build indexes / engines.
  const evidence = new EvidenceEngine({ logger });
  const citations = new CitationEngine({ logger });
  citations.build(data.evidencePackage, data.licenseRegistry);

  const presets = new PresetEngine({ logger });
  presets.build(config.presets, data.evidencePackage, data.biologicalScenes);

  const scale = new ScaleSystem({ levels: config.scaleLevels, logger });
  const camera = new CameraSystem({ config, logger });
  const scenes = new SceneManager({ bus, logger });

  // Phase 2: load the simulator-local anatomy registry and build the model.
  const anatomyLoader = new _JsonLoader({
    basePath: config.simulatorDataBasePath,
    fetcher: opts.fetcher,
    logger,
  });
  let anatomy = null;
  try {
    const anatomyReg = await anatomyLoader.load(config.anatomySources.anatomy, 'generic');
    // Phase 2.6: species-driven. Boot species comes from config (a selection, not a
    // fallback); the model refuses unsupported species (no silent human fallback).
    anatomy = new AnatomyModel(anatomyReg, { species: config.anatomy && config.anatomy.species });
    state.setSpecies(anatomy.activeSpecies);
    // Populate the Phase-1 ScaleSystem from the registry (no hardcoded values).
    for (const levelId of scale.ids()) {
      const cfg = anatomy.levelConfig(levelId);
      if (cfg) {
        scale.configureLevel(levelId, {
          visibleStructures: cfg.visible || [],
          allowedLabels: (cfg.visible || []).filter((id) => anatomy.layer(id) && anatomy.layer(id).label),
          cameraLimits: { depthWindow: cfg.depth_window, framing: cfg.framing, clip: cfg.clip },
        });
      }
    }
  } catch (err) {
    logger.warn('load', 'anatomy registry not loaded', { err: String(err) });
  }

  // Renderer (Phase 2 default: static-anatomy canvas). createRenderer may return
  // a promise for non-null kinds.
  const renderer = await createRenderer({ kind: (config.render && config.render.kind) || 'null', logger });
  if (anatomy && renderer.setModel) renderer.setModel(anatomy);

  // Zoom + labels (anatomy only; static frames, no animation).
  const zoom = new ZoomController({
    scaleSystem: scale,
    state,
    logger,
    onChange: (levelId) => { if (renderer.setLevel) renderer.setLevel(levelId); },
  });
  const labels = anatomy ? new LabelSystem({ model: anatomy }) : null;

  // Register the anatomy scenes (contain anatomy only).
  if (anatomy) {
    registerAnatomyScenes({ model: anatomy, sceneManager: scenes, zoom, renderer, state, logger });
  }

  // Phase 3: biological transport engine (topical NLC -> skin). Built on the
  // anatomy model; evidence-gated + species-driven.
  // Phase 4: drug release engine (separate process; released alongside).
  let transport = null;
  let release = null;
  let uptake = null; // Phase 4B: cellular microenvironment + passive uptake layer
  let endocytosis = null; // Phase 4C: endocytosis + intracellular trafficking layer
  let intracellular = null; // Phase 4D: intracellular drug release layer
  let targetEngagement = null; // Phase 5A: target engagement (pharmacology) layer
  let signalPropagation = null; // Phase 5B.2: signal propagation (runtime signaling) layer
  let transcription = null; // Phase 5C: gene regulation / transcription (runtime) layer
  let translation = null; // Phase 5D: translation / protein-synthesis (runtime) layer
  let proteinFunction = null; // Phase 6A: protein function / early cellular response layer
  let apoptosis = null; // Phase 6B: apoptosis commitment / execution layer
  let population = null; // Phase 6C: population-response / composition layer
  let tumor = null; // Phase 6D: tumour growth / treatment-response layer
  if (anatomy) {
    try {
      const transportReg = await anatomyLoader.load(config.transportSources.transport, 'generic');
      const transportModel = new TransportModel(transportReg);
      const stateMachine = new BiologicalStateMachine(transportReg);
      const engine = new TransportEngine({
        transportModel, anatomyModel: anatomy, stateMachine,
        evidenceEngine: evidence, species: anatomy.activeSpecies,
        seed: config.transport && config.transport.seed, logger,
      });
      if (renderer.setEngine) renderer.setEngine(engine);

      // Phase 4: drug release engine - a SEPARATE process that releases payload from
      // ARRIVED particles (first-order model; schematic k). It never moves particles.
      try {
        const releaseReg = await anatomyLoader.load(config.releaseSources.release, 'generic');
        const releaseModel = new ReleaseModel(releaseReg);
        const releaseEngine = new ReleaseEngine({
          releaseModel, transportEngine: engine, evidenceEngine: evidence,
          params: config.release, logger,
        });
        if (renderer.setReleaseEngine) renderer.setReleaseEngine(releaseEngine);
        release = {
          model: releaseModel, engine: releaseEngine,
          step: (dt) => releaseEngine.step(dt),
          curve: () => releaseEngine.curve(),
          stats: () => releaseEngine.stats(),
          allEmpty: () => releaseEngine.allEmpty(),
          reset: () => releaseEngine.reset(),
        };
      } catch (err) {
        logger.warn('load', 'release registry not loaded', { err: String(err) });
      }

      // Phase 4B: cellular microenvironment + passive uptake - a SEPARATE layer that
      // turns released payload into free molecules, diffuses them, and lets them
      // passively enter schematic cells. It never moves carriers or touches release.
      if (release) {
        try {
          const microReg = await anatomyLoader.load(config.microenvironmentSources.microenvironment, 'generic');
          const cellField = new CellField(microReg);
          const uptakeEngine = new UptakeEngine({
            registry: microReg, cellField, transportEngine: engine, releaseEngine: release.engine,
            evidenceEngine: evidence, species: engine.species,
            params: config.uptake, seed: config.uptake && config.uptake.seed, logger,
          });
          if (renderer.setUptakeEngine) renderer.setUptakeEngine(uptakeEngine);
          uptake = {
            engine: uptakeEngine, cellField,
            step: (dt) => uptakeEngine.step(dt),
            stats: () => uptakeEngine.stats(),
            reset: () => uptakeEngine.reset(),
            evidenceLevel: () => uptakeEngine.evidenceLevelName(),
            message: () => uptakeEngine.message(),
          };
        } catch (err) {
          logger.warn('load', 'microenvironment registry not loaded', { err: String(err) });
        }
      }

      // Phase 4C: endocytosis + intracellular trafficking - a SEPARATE layer that reads
      // the uptake outputs (carriers + cells) read-only and never modifies them. Applies
      // to carrier nanoparticles only (never free drug molecules).
      if (uptake) {
        try {
          const endoReg = await anatomyLoader.load(config.endocytosisSources.endocytosis, 'generic');
          const endoEngine = new EndocytosisEngine({
            registry: endoReg, fsm: new EndocytosisFSM(endoReg), uptakeEngine: uptake.engine,
            evidenceEngine: evidence, species: engine.species,
            formulationId: config.endocytosis && config.endocytosis.formulationId,
            seed: config.endocytosis && config.endocytosis.seed, logger,
          });
          if (renderer.setEndocytosisEngine) renderer.setEndocytosisEngine(endoEngine);
          endocytosis = {
            engine: endoEngine, fsm: endoEngine.fsm,
            step: (dt) => endoEngine.step(dt),
            stats: () => endoEngine.stats(),
            reset: () => endoEngine.reset(),
            evidenceLevel: () => endoEngine.evidenceLevelName(),
            traffickingLevel: () => endoEngine.traffickingLevelName(),
            escapeAllowed: () => endoEngine.escapeAllowed(),
          };
        } catch (err) {
          logger.warn('load', 'endocytosis registry not loaded', { err: String(err) });
        }
      }

      // Phase 4D: intracellular drug release - a SEPARATE layer that reads the
      // endocytosis/uptake outputs read-only. For B1 the intracellular stage is
      // NOT REPORTED (idle); the engine only acts when the formulation evidence supports it.
      if (endocytosis) {
        try {
          const intraReg = await anatomyLoader.load(config.intracellularSources.intracellular, 'generic');
          const intraEngine = new IntracellularReleaseEngine({
            registry: intraReg, releaseModel: new IntracellularReleaseModel(intraReg),
            endocytosisEngine: endocytosis.engine, uptakeEngine: uptake.engine,
            evidenceEngine: evidence, species: engine.species,
            formulationId: config.intracellular && config.intracellular.formulationId,
            seed: config.intracellular && config.intracellular.seed, logger,
          });
          if (renderer.setIntracellularEngine) renderer.setIntracellularEngine(intraEngine);
          intracellular = {
            engine: intraEngine,
            step: (dt) => intraEngine.step(dt),
            stats: () => intraEngine.stats(),
            reset: () => intraEngine.reset(),
            evidenceLevel: () => intraEngine.evidenceLevelName(),
          };
        } catch (err) {
          logger.warn('load', 'intracellular registry not loaded', { err: String(err) });
        }
      }

      // Phase 5A: target engagement - the first pharmacology layer. Reads the
      // intracellular drug read-only; models molecular recognition (binding) only.
      // For B1 target identity + binding are NOT REPORTED (idle).
      if (intracellular) {
        try {
          const tgtReg = await anatomyLoader.load(config.targetEngagementSources.targetEngagement, 'generic');
          const tgtEngine = new TargetEngagementEngine({
            registry: tgtReg, intracellularEngine: intracellular.engine, uptakeEngine: uptake.engine,
            evidenceEngine: evidence, species: engine.species,
            formulationId: config.targetEngagement && config.targetEngagement.formulationId,
            seed: config.targetEngagement && config.targetEngagement.seed, logger,
          });
          if (renderer.setTargetEngagementEngine) renderer.setTargetEngagementEngine(tgtEngine);
          targetEngagement = {
            engine: tgtEngine,
            step: (dt) => tgtEngine.step(dt),
            stats: () => tgtEngine.stats(),
            reset: () => tgtEngine.reset(),
            evidenceLevel: () => tgtEngine.evidenceLevelName(),
          };
        } catch (err) {
          logger.warn('load', 'target-engagement registry not loaded', { err: String(err) });
        }
      }

      // Phase 5B.2: signal propagation - the first RUNTIME signaling layer. It loads the
      // frozen 5B.1 graph + the runtime-dynamics registry read-only and propagates
      // activity through the graph (activation, suppression, delay, decay, feedback,
      // competition, labelled predictions). SEPARATE from every prior engine.
      try {
        const sg = await loadSignalGraph(anatomyLoader, config.signalSources);
        const propReg = await anatomyLoader.load(config.signalPropagationSources.propagation, 'generic');
        const spCfg = config.signalPropagation || {};
        const spEngine = new SignalPropagationEngine({
          signalGraph: sg, propagationRegistry: propReg, species: engine.species,
          includePredictions: spCfg.includePredictions !== false,
          overlayMode: spCfg.overlayMode || 'combined', logger,
        });
        if (renderer.setSignalPropagationEngine) renderer.setSignalPropagationEngine(spEngine);
        signalPropagation = {
          engine: spEngine,
          step: (dt) => spEngine.step(dt),
          run: (steps, dt) => spEngine.run(steps, dt),
          stats: () => spEngine.stats(),
          frame: () => spEngine.frame(),
          timeline: () => spEngine.getTimeline(),
          restart: () => spEngine.restart(),
          play: (dt) => spEngine.play(dt),
          pause: () => spEngine.pause(),
          setSpeed: (m) => spEngine.setSpeed(m),
          setOverlayMode: (m) => spEngine.setOverlayMode(m),
          setPredictionsEnabled: (on) => spEngine.setPredictionsEnabled(on),
        };
      } catch (err) {
        logger.warn('load', 'signal-propagation not loaded', { err: String(err) });
      }

      // Phase 5C: transcription - the first biological RESPONSE downstream of signaling.
      // Reads the signal-propagation output + transcription registry read-only and drives
      // TF activation -> nuclear translocation -> DNA binding -> gene transcription -> mRNA.
      if (signalPropagation) {
        try {
          const txReg = await anatomyLoader.load(config.transcriptionSources.transcription, 'generic');
          const txEngine = new TranscriptionEngine({
            registry: txReg, signalEngine: signalPropagation.engine, species: engine.species, logger,
          });
          if (renderer.setTranscriptionEngine) renderer.setTranscriptionEngine(txEngine);
          transcription = {
            engine: txEngine,
            step: (dt) => txEngine.step(dt),
            run: (steps, dt) => txEngine.run(steps, dt),
            stats: () => txEngine.stats(),
            frame: () => txEngine.frame(),
            timeline: () => txEngine.getTimeline(),
            restart: () => txEngine.restart(),
            validate: () => txEngine.validate(),
          };
        } catch (err) {
          logger.warn('load', 'transcription not loaded', { err: String(err) });
        }
      }

      // Phase 5D: translation - the runtime layer after transcription. Reads the Phase-5C
      // mRNA output + translation/protein registries read-only and drives ribosome
      // recruitment -> initiation -> elongation -> termination -> nascent protein ->
      // schematic folding/maturation -> mature protein abundance -> turnover. STOP at protein.
      if (transcription) {
        try {
          const txtCtx = await anatomyLoader.load(config.translationSources.context, 'generic');
          const txtMach = await anatomyLoader.load(config.translationSources.machinery, 'generic');
          const txtProt = await anatomyLoader.load(config.translationSources.protein, 'generic');
          const trEngine = new TranslationEngine({
            contextRegistry: txtCtx, machineryRegistry: txtMach, proteinRegistry: txtProt,
            transcriptionEngine: transcription.engine, signalEngine: signalPropagation ? signalPropagation.engine : null,
            species: engine.species, logger,
          });
          if (renderer.setTranslationEngine) renderer.setTranslationEngine(trEngine);
          translation = {
            engine: trEngine,
            step: (dt) => trEngine.step(dt),
            run: (steps, dt) => trEngine.run(steps, dt),
            stats: () => trEngine.stats(),
            frame: () => trEngine.frame(),
            timeline: () => trEngine.getTimeline(),
            restart: () => trEngine.restart(),
            validate: () => trEngine.validate(),
          };
        } catch (err) {
          logger.warn('load', 'translation not loaded', { err: String(err) });
        }
      }

      // Phase 6A: protein function & early cellular response. Reads the Phase-5D mature
      // proteins + Phase-5B signaling + Phase-6A registries read-only and drives functional
      // eligibility -> activation -> reversible early cellular-state change. STOP before cell fate.
      if (translation) {
        try {
          const pfCtx = await anatomyLoader.load(config.proteinFunctionSources.context, 'generic');
          const pfState = await anatomyLoader.load(config.proteinFunctionSources.cellularState, 'generic');
          const pfEdges = await anatomyLoader.load(config.proteinFunctionSources.edges, 'generic');
          const pfEv = await anatomyLoader.load(config.proteinFunctionSources.evidence, 'generic');
          const pfEngine = new ProteinFunctionEngine({
            functionContextRegistry: pfCtx, cellularStateRegistry: pfState, functionalEdgeRegistry: pfEdges, functionalEvidenceRegistry: pfEv,
            translationEngine: translation.engine, signalEngine: signalPropagation ? signalPropagation.engine : null,
            species: engine.species, logger,
          });
          if (renderer.setProteinFunctionEngine) renderer.setProteinFunctionEngine(pfEngine);
          proteinFunction = {
            engine: pfEngine,
            step: (dt) => pfEngine.step(dt),
            run: (steps, dt) => pfEngine.run(steps, dt),
            stats: () => pfEngine.stats(),
            frame: () => pfEngine.frame(),
            timeline: () => pfEngine.getTimeline(),
            restart: () => pfEngine.restart(),
            validate: () => pfEngine.validate(),
          };
        } catch (err) {
          logger.warn('load', 'protein-function not loaded', { err: String(err) });
        }
      }

      // Phase 6B: apoptosis commitment & execution. Reads the Phase-6A cellular-stress
      // states + Phase-5B signaling + Phase-6B registries read-only and drives eligibility
      // -> reversible pre-commitment -> irreversible commitment -> mitochondrial + caspase/
      // AIF execution -> apoptotic cell state. STOP (single cell; no population/tumour).
      if (proteinFunction) {
        try {
          const apCtx = await anatomyLoader.load(config.apoptosisSources.context, 'generic');
          const apDyn = await anatomyLoader.load(config.apoptosisSources.dynamics, 'generic');
          const apInt = await anatomyLoader.load(config.apoptosisSources.interventions, 'generic');
          const apEv = await anatomyLoader.load(config.apoptosisSources.evidence, 'generic');
          const apEngine = new ApoptosisEngine({
            contextRegistry: apCtx, dynamicsRegistry: apDyn, interventionRegistry: apInt, evidenceRegistry: apEv,
            proteinFunctionEngine: proteinFunction.engine, signalEngine: signalPropagation ? signalPropagation.engine : null,
            species: engine.species, logger,
          });
          if (renderer.setApoptosisEngine) renderer.setApoptosisEngine(apEngine);
          apoptosis = {
            engine: apEngine,
            step: (dt) => apEngine.step(dt),
            run: (steps, dt) => apEngine.run(steps, dt),
            stats: () => apEngine.stats(),
            frame: () => apEngine.frame(),
            timeline: () => apEngine.getTimeline(),
            restart: () => apEngine.restart(),
            validate: () => apEngine.validate(),
            setIntervention: (t, a) => apEngine.setIntervention(t, a),
            setCellModel: (m) => apEngine.setCellModel(m),
          };
        } catch (err) {
          logger.warn('load', 'apoptosis not loaded', { err: String(err) });
        }
      }

      // Phase 6C: population response & composition. Reads the Phase-6B apoptosis trajectory
      // + Phase-6C registries read-only and derives a SCHEMATIC virtual population (normalized
      // fractions + a strict population state machine). STOP at population composition - no
      // tumour/immune/PK/PD/clinical outcome.
      if (apoptosis) {
        try {
          const popCtx = await anatomyLoader.load(config.populationSources.context, 'generic');
          const popState = await anatomyLoader.load(config.populationSources.state, 'generic');
          const popTrans = await anatomyLoader.load(config.populationSources.transitions, 'generic');
          const popEv = await anatomyLoader.load(config.populationSources.evidence, 'generic');
          const popPred = await anatomyLoader.load(config.populationSources.prediction, 'generic');
          const popInt = await anatomyLoader.load(config.populationSources.interventions, 'generic');
          const popEngine = new PopulationEngine({
            contextRegistry: popCtx, stateRegistry: popState, transitionsRegistry: popTrans,
            evidenceRegistry: popEv, predictionRegistry: popPred, interventionRegistry: popInt,
            apoptosisEngine: apoptosis.engine, species: engine.species, logger,
          });
          if (renderer.setPopulationEngine) renderer.setPopulationEngine(popEngine);
          population = {
            engine: popEngine,
            step: (dt) => popEngine.step(dt),
            run: (steps, dt) => popEngine.run(steps, dt),
            stats: () => popEngine.stats(),
            frame: () => popEngine.frame(),
            history: () => popEngine.getHistory(),
            timeline: () => popEngine.getTimeline(),
            restart: () => popEngine.restart(),
            validate: () => popEngine.validate(),
            setCellModel: (m) => popEngine.setCellModel(m),
          };
        } catch (err) {
          logger.warn('load', 'population not loaded', { err: String(err) });
        }
      }

      // Phase 6D: tumour growth / treatment-response. Reads the Phase-6C population + Phase-6D
      // registries read-only and derives a SCHEMATIC normalized tumour burden + treatment-
      // response trajectory. Population-gated. STOP at the response trajectory - no clinical/
      // RECIST/survival/PK outcome.
      if (population) {
        try {
          const tCtx = await anatomyLoader.load(config.tumorSources.context, 'generic');
          const tResp = await anatomyLoader.load(config.tumorSources.response, 'generic');
          const tTrans = await anatomyLoader.load(config.tumorSources.transitions, 'generic');
          const tModel = await anatomyLoader.load(config.tumorSources.model, 'generic');
          const tForm = await anatomyLoader.load(config.tumorSources.formulation, 'generic');
          const tTreat = await anatomyLoader.load(config.tumorSources.treatment, 'generic');
          const tEv = await anatomyLoader.load(config.tumorSources.evidence, 'generic');
          const tPred = await anatomyLoader.load(config.tumorSources.prediction, 'generic');
          const tumEngine = new TumorResponseEngine({
            contextRegistry: tCtx, responseRegistry: tResp, transitionsRegistry: tTrans, modelRegistry: tModel,
            formulationRegistry: tForm, treatmentRegistry: tTreat, evidenceRegistry: tEv, predictionRegistry: tPred,
            populationEngine: population.engine, species: engine.species, logger,
          });
          if (renderer.setTumorEngine) renderer.setTumorEngine(tumEngine);
          tumor = {
            engine: tumEngine,
            step: (dt) => tumEngine.step(dt),
            run: (steps, dt) => tumEngine.run(steps, dt),
            stats: () => tumEngine.stats(),
            frame: () => tumEngine.frame(),
            history: () => tumEngine.getHistory(),
            timeline: () => tumEngine.getTimeline(),
            responseCurve: () => tumEngine.responseCurve(),
            restart: () => tumEngine.restart(),
            validate: () => tumEngine.validate(),
            setCellModel: (m) => tumEngine.setCellModel(m),
            setFormulation: (f) => tumEngine.setFormulation(f),
            setSchedule: (s) => tumEngine.setSchedule(s),
            setTreatment: (a) => tumEngine.setTreatment(a),
          };
        } catch (err) {
          logger.warn('load', 'tumor not loaded', { err: String(err) });
        }
      }

      const animator = new TransportAnimator({
        engine, releaseEngine: release ? release.engine : null,
        uptakeEngine: uptake ? uptake.engine : null,
        endocytosisEngine: endocytosis ? endocytosis.engine : null,
        intracellularEngine: intracellular ? intracellular.engine : null,
        targetEngine: targetEngagement ? targetEngagement.engine : null,
        signalEngine: signalPropagation ? signalPropagation.engine : null,
        transcriptionEngine: transcription ? transcription.engine : null,
        translationEngine: translation ? translation.engine : null,
        proteinFunctionEngine: proteinFunction ? proteinFunction.engine : null,
        apoptosisEngine: apoptosis ? apoptosis.engine : null,
        populationEngine: population ? population.engine : null,
        tumorEngine: tumor ? tumor.engine : null, renderer, logger,
        spawnCount: (config.transport && config.transport.spawnCount) || 14,
        untilReleased: true,
      });
      transport = {
        model: transportModel, stateMachine, engine, animator,
        start: (dt) => animator.start(dt),
        stop: () => animator.stop(),
        reset: () => animator.reset(),
        spawn: (n) => engine.spawn(n),
        step: (dt) => engine.step(dt),
        isBlocked: () => engine.isBlocked(),
        evidenceLevel: () => engine.evidenceLevelName(),
        message: () => engine.message(),
        isPredictive: () => engine.isPredictive(),
        release, // Phase 4 (may be null if the release registry failed to load)
      };
      logger.info('transport', `engine ready (species ${engine.species}: evidence ${engine.evidenceLevelName()}${engine.isBlocked() ? ' BLOCKED - ' + engine.blockReason() : ''}${release ? '; release: ' + release.model.modelId() : ''})`);
    } catch (err) {
      logger.warn('load', 'transport registry not loaded', { err: String(err) });
    }
  }

  const ui = new UiFramework({ panels: config.panels, logger });
  const debug = new DebugTools({
    state, presetEngine: presets, sceneManager: scenes, citationEngine: citations,
    scaleSystem: scale, cameraSystem: camera, loader, logger,
    enabled: config.debug && config.debug.enabled, showFps: config.debug && config.debug.showFps,
  });

  // Default selection: first active preset (metadata only - nothing rendered).
  const firstActive = presets.activeList()[0];
  if (firstActive) state.setPreset(firstActive.id);

  const app = {
    config, logger, bus, state, loader, data,
    evidence, citations, presets, scale, camera, scenes, renderer, ui, debug,
    // Phase 2 additions:
    anatomy, anatomyLoader, zoom, labels,
    // Phase 3 addition (may be null if the transport registry failed to load):
    transport,
    // Phase 4 addition (may be null if the release registry failed to load):
    release,
    // Phase 4B addition (may be null if the microenvironment registry failed to load):
    uptake,
    // Phase 4C addition (may be null if the endocytosis registry failed to load):
    endocytosis,
    // Phase 4D addition (may be null if the intracellular registry failed to load):
    intracellular,
    // Phase 5A addition (may be null if the target-engagement registry failed to load):
    targetEngagement,
    // Phase 5B.2 addition (may be null if the signal-propagation registry failed to load):
    signalPropagation,
    // Phase 5C addition (may be null if the transcription registry failed to load):
    transcription,
    // Phase 5D addition (may be null if the translation registries failed to load):
    translation,
    // Phase 6A addition (may be null if the protein-function registries failed to load):
    proteinFunction,
    // Phase 6B addition (may be null if the apoptosis registries failed to load):
    apoptosis,
    // Phase 6C addition (may be null if the population registries failed to load):
    population,
    // Phase 6D addition (may be null if the tumour registries failed to load):
    tumor,
  };

  // Phase 2.6: species-driven switch. Prepares the architecture for a future
  // Species selector (no UI added here): selecting a species loads that profile
  // and redraws the current static frame. Throws on an unsupported species -
  // there is NO silent fallback to human.
  app.setSpecies = (speciesId) => {
    if (!anatomy) throw new Error('anatomy not loaded');
    anatomy.setSpecies(speciesId);
    state.setSpecies(speciesId);
    // Phase 3: the transport engine follows the selected species (recomputes barrier
    // depths + re-evaluates the evidence gate; unsupported species become blocked).
    if (transport) transport.engine.setSpecies(speciesId);
    // Phase 4: transport particles were cleared, so clear stale release + uptake state.
    if (release) release.engine.reset();
    if (uptake) uptake.engine.setSpecies(speciesId);
    if (endocytosis) endocytosis.engine.setSpecies(speciesId);
    if (intracellular) intracellular.engine.setSpecies(speciesId);
    if (targetEngagement) targetEngagement.engine.setSpecies(speciesId);
    if (signalPropagation) signalPropagation.engine.setSpecies(speciesId);
    if (transcription) transcription.engine.setSpecies(speciesId);
    if (translation) translation.engine.setSpecies(speciesId);
    if (proteinFunction) proteinFunction.engine.setSpecies(speciesId);
    if (apoptosis) apoptosis.engine.setSpecies(speciesId);
    // Phase 6C: the population layer follows the selected species (rebuilds from its profile;
    // unsupported / NOT_REPORTED species become idle). Only one population exists at a time.
    if (population) population.engine.setSpecies(speciesId);
    // Phase 6D: the tumour layer follows the selected species (rebuilds from its profile;
    // population-gated -> human/rat become idle). Only one tumour model runs at a time.
    if (tumor) tumor.engine.setSpecies(speciesId);
    const level = state.get().currentScale;
    if (renderer.setLevel) renderer.setLevel(level); // recompute layout with the new profile
    // Phase 3.1: refresh panels so the evidence-level label follows the species.
    if (app.panelModels) {
      app.panelModels = buildAnatomyPanelModels({ model: anatomy, state, presets, citations, scaleLevels: scale.ids(), transport, release, uptake, endocytosis, intracellular, targetEngagement, signalPropagation, transcription, translation, proteinFunction, apoptosis, population, tumor });
      renderAnatomyPanels(ui, app.panelModels);
    }
    logger.info('anatomy', `species -> ${speciesId}${transport ? ' (transport: ' + transport.engine.evidenceLevelName() + ')' : ''}`);
    bus.emit('anatomy:species', { species: speciesId });
    return speciesId;
  };

  if (opts.mount !== false && typeof document !== 'undefined') {
    mountBrowser(app, opts.containerResolver);
  }

  // Activate the default static anatomy scene (a clean cross-section).
  if (anatomy && scenes.has(config.defaultScene)) {
    await scenes.transitionTo(config.defaultScene);
  }

  // Populate the (previously empty) UI panels with anatomy content.
  if (anatomy) {
    const models = buildAnatomyPanelModels({
      model: anatomy, state, presets, citations, scaleLevels: scale.ids(), transport, release, uptake, endocytosis, intracellular, targetEngagement, signalPropagation, transcription, translation, proteinFunction, apoptosis, population, tumor,
    });
    app.panelModels = models;
    renderAnatomyPanels(ui, models);
  }

  logger.info('app', 'anatomy world ready (static; no biological processes)');
  bus.emit('app:ready', { presets: presets.list().map((p) => p.id), scenes: scenes.list().map((s) => s.id) });
  return app;
}

/** Load and validate the foundation data sources. */
async function loadFoundationData(loader, src, logger) {
  const out = {};
  const plan = [
    ['presetLibrary', src.presetLibrary, 'presetLibrary'],
    ['simulatorPresets', src.simulatorPresets, 'simulatorPresets'],
    ['evidencePackage', src.evidencePackage, 'evidencePackage'],
    ['biologicalScenes', src.biologicalScenes, 'biologicalScenes'],
    ['referenceLibrary', src.referenceLibrary, 'referenceLibrary'],
    ['licenseRegistry', src.licenseRegistry, 'licenseRegistry'],
  ];
  for (const [key, file, schema] of plan) {
    try {
      out[key] = await loader.load(file, schema);
    } catch (err) {
      logger.warn('load', `optional source failed: ${file}`, { err: String(err) });
      out[key] = null;
    }
  }
  return out;
}

/** Browser-only mounting of the renderer + empty panels. */
function mountBrowser(app, containerResolver) {
  const root = document.getElementById('sim-root');
  const resolve = containerResolver || ((id) => document.getElementById(`panel-${id}`) || root);
  app.renderer.mount(document.getElementById('panel-mainView') || root);
  app.ui.mountAll(resolve);
  app.debug.startFps();
  // expose for the debug panel / console
  // eslint-disable-next-line no-undef
  window.__SIM__ = app;
}

// Auto-boot in the browser only.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  createApp().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('bootstrap failed', err);
  });
}

export default createApp;
