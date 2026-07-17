import { section, ok, eq, throwsAsync } from './harness.mjs';
import { StateStore, createInitialState } from '../src/core/state.js';
import { EventBus } from '../src/core/eventBus.js';

export default async function run() {
  section('state transitions');
  const bus = new EventBus();
  let events = 0;
  bus.on('state:change', () => { events += 1; });

  const store = new StateStore({ bus, initial: createInitialState() });
  eq(store.get().currentScale, 'L1', 'initial scale L1');
  ok(store.get().currentPreset === null, 'no preset initially');

  store.setPreset('B1');
  eq(store.get().currentPreset, 'B1', 'preset set');
  store.setScene('scene-x');
  eq(store.get().currentScene, 'scene-x', 'scene set');
  store.setScale('L3');
  eq(store.get().currentScale, 'L3', 'scale set');
  store.select('structure', 'stratum_corneum');
  eq(store.get().selectedStructure, 'stratum_corneum', 'structure selected');
  store.select('citation', 'chen_2012');
  eq(store.get().selectedCitation, 'chen_2012', 'citation selected');

  ok(events >= 5, 'change events emitted for each transition');
  ok(store.history.length >= 5, 'history recorded');

  await throwsAsync(async () => store.select('nonsense', 'x'), 'invalid selection kind throws');

  store.reset();
  eq(store.get().currentPreset, null, 'reset clears preset');
  eq(store.get().currentScale, 'L1', 'reset restores L1');
}
