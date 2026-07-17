import { section, ok, eq, throwsAsync } from './harness.mjs';
import { CameraSystem } from '../src/camera/cameraSystem.js';
import { ScaleSystem } from '../src/scale/scaleSystem.js';
import APP_CONFIG from '../src/config/app.config.js';

export default async function run() {
  section('camera + scale init');
  const cam = new CameraSystem({ config: APP_CONFIG });
  const c = cam.get();
  eq(c.mode, 'perspective', 'default perspective camera');
  eq(c.fovDegrees, APP_CONFIG.camera.fovDegrees, 'fov from config');
  ok(Array.isArray(c.position) && c.position.length === 3, 'position is a 3-vector');
  eq(c.clipPlanes.length, 0, 'no clip planes yet');

  cam.setMode('orthographic');
  eq(cam.get().mode, 'orthographic', 'mode switch works');
  await throwsAsync(async () => cam.setMode('bogus'), 'bad camera mode throws');

  cam.setNavMode('guided');
  eq(cam.get().navMode, 'guided', 'nav mode set');

  cam.addClipPlane({ enabled: true, normal: [0, 1, 0], constant: 0 });
  eq(cam.get().clipPlanes.length, 1, 'clip plane stored');
  // clip planes are inert in Phase 1 (config disables them)
  eq(cam.get().clipPlanes[0].enabled, false, 'clip plane inert in Phase 1');

  // Scale system.
  const scale = new ScaleSystem({ levels: APP_CONFIG.scaleLevels });
  eq(scale.ids(), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'], 'scale ids L1..L6');
  ok(scale.canTransition('L1', 'L2'), 'adjacent transition allowed');
  ok(!scale.canTransition('L1', 'L6'), 'non-adjacent transition blocked');
  scale.configureLevel('L3', { visibleStructures: ['stratum_corneum'] });
  eq(scale.get('L3').visibleStructures, ['stratum_corneum'], 'level configurable from data');
}
