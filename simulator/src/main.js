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
  const scenes = new SceneManager({ bus, logger });     // no scenes registered in Phase 1
  const renderer = createRenderer({ logger });          // NullRenderer

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
  };

  if (opts.mount !== false && typeof document !== 'undefined') {
    mountBrowser(app, opts.containerResolver);
  }

  logger.info('app', 'foundation ready (no biological rendering)');
  bus.emit('app:ready', { presets: presets.list().map((p) => p.id) });
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
