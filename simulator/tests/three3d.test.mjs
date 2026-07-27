// Phase-0 3D integration contract tests (headless; no WebGL needed). Locks the rules the later
// 3D phases must not break: the adapter performs NO biology, never converts unavailable/not-modelled
// to zero, tags provenance so VISUAL_ONLY can never pass as science, and the SceneDirector maps the
// master timeline to exactly one active scene (one loop, one narrative clock).

import { section, ok, eq } from './harness.mjs';
import { buildVisualState, vparam, mapRange, isBiological, PROVENANCE } from '../src/three/visualizationAdapter.js';
import { SceneDirector, shotAt, SHOTS } from '../src/three/sceneDirector.js';
import { ASSETS, ASSET_STATUS, missingFor } from '../src/three/assetManifest.js';

export default async function run() {
  section('3D integration contracts (Phase 0)');

  // ---- adapter: no biology, no unavailable->zero, provenance tagged ----
  const vs = buildVisualState({ progress: 0.5 });
  eq(vs.progress.value, 0.5, 'ADAPTER: master-timeline progress passes through');
  ok(vs.capillaryEntryFraction.value === null && vs.capillaryEntryFraction.provenance === PROVENANCE.NOT_MODELLED, 'ADAPTER: systemic capillary entry is NOT_MODELLED with value null (never 0)');
  ok(vs.bloodstreamFlowSpeed.value === null && vs.bloodstreamFlowSpeed.provenance === PROVENANCE.NOT_MODELLED, 'ADAPTER: bloodstream flow is NOT_MODELLED (topical route has no systemic stage)');
  ok(vs.releasedFraction.value === null && vs.releasedFraction.provenance === PROVENANCE.UNAVAILABLE, 'ADAPTER: absent release stats stay UNAVAILABLE (value null, never 0)');
  ok(vs.visibleParticleCount.provenance === PROVENANCE.VISUAL_ONLY && !isBiological(vs.visibleParticleCount), 'ADAPTER: visible particle count is VISUAL_ONLY and NOT biological');
  ok(isBiological(vparam(0.4, PROVENANCE.SIMULATION_DERIVED)), 'ADAPTER: simulation-derived values are flagged biological');
  ok(Object.isFrozen(vs) && Object.isFrozen(vs.progress), 'ADAPTER: emitted visual state is immutable');

  // real simulation values pass through untouched (no recomputation)
  const fed = buildVisualState({ progress: 0.2, releaseStats: { releasedFraction: 0.37 }, transportStats: { meanDepth: 0.42 } });
  eq(fed.releasedFraction.value, 0.37, 'ADAPTER: released fraction passes through unchanged (no new biology)');
  eq(fed.penetrationDepth.value, 0.42, 'ADAPTER: penetration depth passes through unchanged');
  eq(fed.releasedFraction.provenance, PROVENANCE.SIMULATION_DERIVED, 'ADAPTER: fed values are SIMULATION_DERIVED');

  // mapRange keeps provenance and never fabricates a value from nothing
  eq(mapRange(null, 0, 10).value, null, 'ADAPTER: mapRange(null) stays null (no fabrication)');
  eq(mapRange(0.5, 0, 10).value, 5, 'ADAPTER: mapRange maps a real value into the visual range');
  eq(mapRange(0.5, 0, 10).provenance, PROVENANCE.EVIDENCE_BACKED_MAPPING, 'ADAPTER: mapped values are EVIDENCE_BACKED_MAPPING');

  // ---- shot list covers the full narrative, contiguous, ordered ----
  eq(SHOTS[0].t0, 0, 'SHOTS: start at progress 0');
  eq(SHOTS[SHOTS.length - 1].t1, 1, 'SHOTS: end at progress 1');
  let contiguous = true; for (let i = 1; i < SHOTS.length; i++) if (Math.abs(SHOTS[i].t0 - SHOTS[i - 1].t1) > 1e-9) contiguous = false;
  ok(contiguous, 'SHOTS: contiguous coverage with no gaps');
  eq(shotAt(0).scene, 'human', 'SHOTS: opens on the human scene');
  eq(shotAt(1).scene, 'tissue', 'SHOTS: ends in the tissue/cellular scene');
  ok(new Set(SHOTS.map((s) => s.scene)).size === 4, 'SHOTS: four scenes (human, skin, bloodstream, tissue)');

  // ---- director: one active scene, deterministic seek, disposal ----
  const d = new SceneDirector();
  const entered = []; const exited = []; const updates = [];
  for (const id of ['human', 'skin', 'bloodstream', 'tissue']) {
    d.register({ id, enter: () => entered.push(id), exit: () => exited.push(id), update: (c) => updates.push(c.progress), dispose: () => {} });
  }
  d.update(buildVisualState({ progress: 0.02 }));
  eq(d.activeId, 'human', 'DIRECTOR: progress 0.02 activates the human scene');
  d.update(buildVisualState({ progress: 0.35 }));
  eq(d.activeId, 'skin', 'DIRECTOR: progress 0.35 activates the skin scene');
  ok(exited.includes('human'), 'DIRECTOR: previous scene exits (never two active scenes)');
  d.update(buildVisualState({ progress: 0.60 }));
  eq(d.activeId, 'bloodstream', 'DIRECTOR: progress 0.60 activates the bloodstream scene');
  d.update(buildVisualState({ progress: 0.90 }));
  eq(d.activeId, 'tissue', 'DIRECTOR: progress 0.90 activates the tissue scene');
  // seek is the same code path as play -> identical result (replay/seek safety)
  const before = d.lastShotId; d.seek(buildVisualState({ progress: 0.90 }));
  eq(d.lastShotId, before, 'DIRECTOR: seek reproduces the same shot as play (pure function of progress)');
  // unavailable progress renders nothing new (never invents time)
  eq(d.update(buildVisualState({})), null, 'DIRECTOR: unavailable progress produces no shot (no invented time)');
  d.dispose(); ok(d.disposed && d.scenes.size === 0, 'DIRECTOR: dispose clears every scene');

  // ---- asset manifest: the human is honestly reported missing ----
  eq(ASSETS.human.status, ASSET_STATUS.MISSING, 'ASSETS: no 3D human exists in the repository (reported MISSING, not faked)');
  ok(missingFor(2).includes('human'), 'ASSETS: Phase 2 is gated on the human asset');
  eq(missingFor(1).length, 0, 'ASSETS: Phase 1 (runtime shell) needs no assets — can start now');
  ok(/placeholder/i.test(ASSETS.human.fallbackIfMissing), 'ASSETS: placeholder dummy is explicitly rejected as the final human');
}
