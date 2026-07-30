import { section, ok, eq } from './harness.mjs';
import APP_CONFIG from '../src/config/app.config.js';

export default function run() {
  section('config loading');
  ok(APP_CONFIG && typeof APP_CONFIG === 'object', 'APP_CONFIG is an object');
  ok(Object.isFrozen(APP_CONFIG), 'APP_CONFIG is frozen (immutable)');
  eq(APP_CONFIG.phase, 1, 'phase is 1');
  eq(APP_CONFIG.scaleLevels.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'], 'six scale levels L1..L6');
  eq(APP_CONFIG.panels.length, 8, 'eight panels declared');
  eq(APP_CONFIG.presets.map((p) => p.id), ['B1', 'B2', 'B3'], 'presets B1/B2/B3 declared');
  // No hardcoded scientific numbers: data sources are file names only.
  const values = Object.values(APP_CONFIG.dataSources);
  ok(values.every((v) => typeof v === 'string' && v.endsWith('.json')), 'dataSources are file names only');
}
