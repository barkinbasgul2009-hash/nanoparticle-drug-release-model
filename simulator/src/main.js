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
    anatomy = new AnatomyModel(anatomyReg);
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
      model: anatomy, state, presets, citations, scaleLevels: scale.ids(),
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
