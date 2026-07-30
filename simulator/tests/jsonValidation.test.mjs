import { section, ok, eq, throwsAsync, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('json loader + validation');
  const loader = new JsonLoader({ basePath: APP_CONFIG.dataBasePath, fetcher: nodeFetcher() });

  // Loads and validates a real frozen data file.
  const preset = await loader.load(APP_CONFIG.dataSources.presetLibrary, 'presetLibrary');
  ok(Array.isArray(preset.presets), 'preset library has presets[]');

  const ev = await loader.load(APP_CONFIG.dataSources.evidencePackage, 'evidencePackage');
  ok(ev.sources && typeof ev.sources === 'object', 'evidence package has sources{}');

  // Caching: second load returns the same object.
  const again = await loader.load(APP_CONFIG.dataSources.presetLibrary, 'presetLibrary');
  ok(preset === again, 'loader caches parsed results');

  // Schema failure surfaces as a thrown error (wrong schema for the file).
  await throwsAsync(
    () => new JsonLoader({ basePath: APP_CONFIG.dataBasePath, fetcher: nodeFetcher() })
      .load(APP_CONFIG.dataSources.licenseRegistry, 'presetLibrary'),
    'schema mismatch throws',
  );

  // Missing file surfaces as a thrown error.
  await throwsAsync(
    () => loader.load('does-not-exist.json', 'generic'),
    'missing file throws',
  );

  eq(typeof preset, 'object', 'parsed result is an object');
}
