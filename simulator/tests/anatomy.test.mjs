import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { AnatomyModel } from '../src/anatomy/anatomyModel.js';
import { computeAnatomyLayout, computeLabelPlacements } from '../src/render/anatomyLayout.js';
import { ZoomController } from '../src/anatomy/zoomController.js';
import { ScaleSystem } from '../src/scale/scaleSystem.js';
import { createApp } from '../src/main.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('anatomy (Phase 2)');

  // --- JSON loading of the anatomy registry ---
  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const reg = await loader.load(APP_CONFIG.anatomySources.anatomy, 'generic');
  const model = new AnatomyModel(reg);

  // --- layer ordering (biologically correct top -> bottom) ---
  eq(model.order(), ['air', 'skin_surface', 'stratum_corneum', 'viable_epidermis', 'dermis', 'subcutis'], 'layer order correct');
  ok(model.validateOrdering().ok, 'ordering validates (monotonic + correct sequence + all present)');
  eq(model.tissueLayers().length, 5, 'five tissue layers');

  // --- proportions (schematic ordinal; SC < epidermis < dermis; not to scale) ---
  const w = model.weights();
  ok(w.stratum_corneum < w.viable_epidermis, 'SC thinner than viable epidermis (ordinal)');
  ok(w.viable_epidermis < w.dermis, 'viable epidermis thinner than dermis (ordinal)');
  ok(model.notToScale === true, 'cross-section flagged not-to-scale');

  // --- clip-plane cross section: overview exposes ALL tissue layers ---
  const viewport = { width: 640, height: 400 };
  const l1 = computeAnatomyLayout(model, 'L1', viewport);
  const l1ids = l1.bands.map((b) => b.id);
  for (const id of ['skin_surface', 'stratum_corneum', 'viable_epidermis', 'dermis', 'subcutis']) {
    ok(l1ids.includes(id), `overview exposes ${id}`);
  }
  // bands stacked in order, non-overlapping, covering the viewport top-down
  for (let i = 1; i < l1.bands.length; i += 1) {
    ok(l1.bands[i].y >= l1.bands[i - 1].yBottom - 0.001, `band ${i} below previous (ordered, non-overlapping)`);
  }

  // --- zoom transitions: deeper zoom shows fewer layers ---
  const l4 = computeAnatomyLayout(model, 'L4', viewport);
  const l6 = computeAnatomyLayout(model, 'L6', viewport);
  ok(l4.bands.length < l1.bands.length, 'medium zoom shows fewer layers than overview');
  ok(l6.bands.length <= l4.bands.length, 'extreme zoom shows fewest layers');
  eq(l6.bands.map((b) => b.id), ['stratum_corneum'], 'extreme zoom = stratum corneum only');

  // --- label visibility: only tall enough, visible bands; non-overlapping ---
  const labels = computeLabelPlacements(l1.bands, 16);
  ok(labels.length >= 3, 'several anatomical labels visible at overview');
  for (let i = 1; i < labels.length; i += 1) {
    ok(labels[i].y - labels[i - 1].y >= 16 - 0.001, 'labels do not overlap');
  }
  ok(labels.every((l) => typeof l.text === 'string' && l.text.length > 0), 'labels are anatomical names');

  // --- ZoomController maps continuous zoom to levels ---
  const scale = new ScaleSystem({ levels: APP_CONFIG.scaleLevels });
  const zc = new ZoomController({ scaleSystem: scale });
  eq(zc.setZoom(0), 'L1', 'zoom 0 -> L1 (overview)');
  eq(zc.setZoom(1), 'L6', 'zoom 1 -> L6 (extreme)');
  eq(zc.setLevel('L4'), 'L4', 'jump to level works');

  // --- full app: scale population + scene registration + camera framing ---
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.anatomy, 'app has anatomy model');
  // scale populated from registry
  const L1 = app.scale.get('L1');
  ok(L1.visibleStructures.includes('dermis'), 'L1 scale populated with layers from registry');
  ok(L1.cameraLimits && Array.isArray(L1.cameraLimits.depthWindow), 'L3/L1 camera framing (depth window) set');
  // scenes registered
  const sceneIds = app.scenes.list().map((s) => s.id);
  for (const s of ['overview_skin', 'cross_section', 'sc_focus', 'epidermis_focus', 'dermis_focus', 'subcutaneous_layer']) {
    ok(sceneIds.includes(s), `scene registered: ${s}`);
  }
  // renderer is canvas + has a computed layout (headless: computed, not painted)
  eq(app.renderer.kind, 'canvas', 'canvas renderer active');
  ok(app.renderer.lastLayout && Array.isArray(app.renderer.lastLayout.bands), 'renderer computed a static layout');

  // switching a scene changes the level statically (no motion)
  await app.scenes.transitionTo('sc_focus');
  eq(app.state.get().currentScale, 'L5', 'sc_focus scene sets scale L5');
  await app.scenes.transitionTo('overview_skin');
  eq(app.state.get().currentScale, 'L1', 'overview scene sets scale L1');

  // panel models populated with anatomy content (no biology)
  ok(app.panelModels && app.panelModels.legend.layers.length === 5, 'legend panel lists five anatomical layers');
  ok(app.panelModels.timeline.scenes.length === 7, 'scene selector lists seven scenes');
}
