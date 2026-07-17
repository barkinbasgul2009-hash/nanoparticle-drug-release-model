import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { createApp } from '../src/main.js';

export default async function run() {
  section('bootstrap (headless)');
  // Runs the full foundation wiring in Node with the fs fetcher; mount disabled
  // (no DOM). Proves the app boots with zero biological rendering.
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });

  ok(app && app.config && app.config.phase === 1, 'app booted at phase 1');
  eq(app.presets.list().map((p) => p.id), ['B1', 'B2', 'B3'], 'presets built during boot');
  ok(app.citations.size() > 0, 'citation index built');
  eq(app.scale.ids().length, 6, 'six scale levels');
  ok(app.renderer.kind === 'null', 'NullRenderer in use (no rendering)');
  eq(app.scenes.list().length, 0, 'zero scenes registered');
  ok(app.ui.list().length === 8, 'eight ui panels registered');

  // Evidence gate works end-to-end.
  const blocked = app.evidence.make({ confidence: 'UNSUPPORTED_DO_NOT_ANIMATE', referenceIds: [] });
  ok(!app.evidence.canAnimate(blocked), 'evidence engine blocks unsupported events');
  const okDesc = app.evidence.make({ confidence: 'QUALITATIVELY_SUPPORTED', referenceIds: ['chen_2012'] });
  ok(app.evidence.canAnimate(okDesc), 'evidence engine permits supported events');

  // Debug snapshot reflects the loaded foundation.
  const snap = app.debug.snapshot();
  eq(snap.presetsLoaded, ['B1', 'B2', 'B3'], 'debug reports loaded presets');
  ok(snap.referencesLoaded >= 1, 'debug reports loaded reference files');

  // Default preset selected (metadata only).
  ok(app.state.get().currentPreset === 'B1', 'first active preset selected');
}
