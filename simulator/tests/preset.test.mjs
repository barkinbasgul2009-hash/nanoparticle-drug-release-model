import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import { PresetEngine } from '../src/presets/presetEngine.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('preset engine');
  const loader = new JsonLoader({ basePath: APP_CONFIG.dataBasePath, fetcher: nodeFetcher() });
  const ev = await loader.load(APP_CONFIG.dataSources.evidencePackage, 'evidencePackage');
  const scenes = await loader.load(APP_CONFIG.dataSources.biologicalScenes, 'biologicalScenes');

  const engine = new PresetEngine();
  const built = engine.build(APP_CONFIG.presets, ev, scenes);

  eq(built.map((p) => p.id), ['B1', 'B2', 'B3'], 'B1/B2/B3 built');
  const b1 = engine.get('B1');
  ok(b1, 'B1 retrievable');
  ok(b1.evidenceLevel && b1.evidenceLevel.length > 0, 'B1 has an evidence level');
  ok(Array.isArray(b1.references) && b1.references.length > 0, 'B1 has references');
  ok(b1.visualizationPermissions, 'B1 has visualization permissions block');
  ok(Array.isArray(b1.visualizationPermissions.unsupportedDoNotAnimate), 'B1 has unsupported-do-not-animate list');
  eq(engine.activeList().length, 3, 'three active presets');
  // metadata only - no visualization/scientific values invented
  ok(!('particles' in b1) && !('geometry' in b1), 'preset carries metadata only');
}
