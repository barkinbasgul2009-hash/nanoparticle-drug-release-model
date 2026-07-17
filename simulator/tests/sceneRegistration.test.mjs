import { section, ok, eq, throwsAsync } from './harness.mjs';
import { SceneManager } from '../src/scene/sceneManager.js';

export default async function run() {
  section('scene manager');
  const mgr = new SceneManager();
  eq(mgr.list().length, 0, 'no scenes registered by default (Phase 1)');

  const order = [];
  const sceneA = {
    meta: { id: 'A', title: 'A' },
    init: () => { order.push('A:init'); },
    enter: () => { order.push('A:enter'); },
    exit: () => { order.push('A:exit'); },
    dispose: () => { order.push('A:dispose'); },
  };
  const sceneB = { meta: { id: 'B' }, enter: () => order.push('B:enter') };

  mgr.register(sceneA);
  mgr.register(sceneB);
  ok(mgr.has('A') && mgr.has('B'), 'scenes registered');

  // Duplicate registration throws.
  await throwsAsync(async () => mgr.register(sceneA), 'duplicate registration throws');
  // Missing meta.id throws.
  await throwsAsync(async () => mgr.register({ meta: {} }), 'scene without id throws');

  await mgr.transitionTo('A');
  eq(mgr.activeId, 'A', 'A active');
  await mgr.transitionTo('B');
  eq(mgr.activeId, 'B', 'B active after transition');
  eq(order, ['A:init', 'A:enter', 'A:exit', 'B:enter'], 'lifecycle order correct');

  // Unknown scene transition throws.
  await throwsAsync(() => mgr.transitionTo('nope'), 'unknown scene throws');

  mgr.clear();
  eq(mgr.list().length, 0, 'clear disposes all scenes');
  ok(order.includes('A:dispose'), 'dispose hook ran on clear');
}
