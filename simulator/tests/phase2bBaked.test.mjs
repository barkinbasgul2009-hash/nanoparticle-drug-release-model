// Phase-2B tests: build/asset, manifest, master timeline, presentation-mode ownership, visual
// state and resource discipline (ss36 A-F).
//
// These run headless. Anything that genuinely needs WebGL — actual pixels, actual GPU memory — is
// covered by the browser capture pass instead; what is asserted here is everything that can be
// checked deterministically from the generated files and the pure modules, which is where the real
// contracts live. The clip-time mapping in particular is tested against a fake AnimationMixer, so
// "seek equals playback" is proved arithmetically rather than by eyeballing a video.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ok, eq, section, REPO_ROOT } from './harness.mjs';

import {
  SCHEMA_VERSION, PRESENTATION_MODES as MANIFEST_MODES, EVENT_ORDER, REQUIRED_OBJECTS,
  REQUIRED_MORPH_SEMANTICS, validateManifest, validateAgainstAsset, eventAt, betweenEvents,
} from '../src/three/applicationManifest.js';
import {
  PRESENTATION_MODES, ALL_MODES, DEFAULT_PRESENTATION_MODE, CHANNELS, ownershipFor,
  assertExclusive, resolvePresentationMode, modeFromQuery, bakedClipEnabled,
  proceduralControllersEnabled,
} from '../src/three/presentationMode.js';
import { verifyBakedAsset } from '../tools/verify-baked-asset.mjs';
import { SHOTS } from '../src/three/applicationCameraDirector.js';

const P = (rel) => resolve(REPO_ROOT, rel);
const BLEND = P('simulator/assets/blender/phase2_application_source.blend');
const BAKED = P('simulator/assets/human/human_application_baked.glb');
const MANIFEST = P('simulator/assets/human/human_application_manifest.json');
const SCHEMA = P('simulator/assets/human/human_application_manifest.schema.json');
const ORIGINAL = P('simulator/assets/human/human.glb');
const BUILD_SCRIPT = P('simulator/tools/blender/build_phase2_realism.py');
const BAT = P('simulator/tools/blender/run_phase2_blender_build.bat');
const REPORT = P('simulator/artifacts/phase2b/build-report.json');

/** The checksum recorded when the immutable input was accepted at the end of Phase 0. */
export const ORIGINAL_SHA256 = '6114fceafe6c4840c225eec98bc57eaf622886ed168d9d4b1cf4d09fa4415b7e';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/**
 * A stand-in for THREE.AnimationMixer that records exactly how the scene drives it.
 *
 * The point is not to simulate animation — it is to prove the two properties ss25 demands:
 * `action.time` is written from masterProgress, and the mixer is only ever flushed with a ZERO
 * delta. Any use of `mixer.update(delta)` as a playback source shows up here as a non-zero delta.
 */
function fakeMixer() {
  const calls = [];
  const action = { time: 0, paused: false, weight: 1, enabled: true };
  return {
    action,
    calls,
    update(delta) { calls.push({ delta, time: action.time }); },
    /** the mapping bakedApplicationScene.js performs, isolated */
    apply(progress, duration) {
      const p = Math.max(0, Math.min(1, progress));
      action.paused = true;
      action.time = p * duration;
      this.update(0);
      return action.time;
    },
  };
}

export default function run() {
  // ==========================================================================================
  section('phase 2B / A — build outputs exist and are separated from the source asset');
  // ==========================================================================================
  ok(existsSync(ORIGINAL), 'the original human asset is still present');
  eq(sha256(ORIGINAL), ORIGINAL_SHA256, 'original human.glb checksum is UNCHANGED by the build');
  ok(existsSync(BLEND), 'editable Blender source exists');
  ok(existsSync(BAKED), 'generated runtime GLB exists');
  ok(existsSync(MANIFEST), 'generated manifest exists');
  ok(existsSync(SCHEMA), 'manifest schema contract exists');
  ok(existsSync(BUILD_SCRIPT), 'Blender build script exists');
  ok(existsSync(BAT), 'Windows one-command build entry point exists');
  ok(BLEND !== BAKED && !BLEND.startsWith(P('simulator/assets/human')),
    'authoring source and generated runtime output live in separate directories');
  ok(statSync(BAKED).size > 1_000_000, `generated GLB is a real asset (${(statSync(BAKED).size / 1e6).toFixed(1)} MB)`);

  const bat = readFileSync(BAT, 'utf8');
  ok(/BLENDER_EXE/.test(bat), 'the .bat prefers a BLENDER_EXE override');
  ok(/Blender 4\.5/.test(bat), 'the .bat checks for Blender 4.5 LTS specifically');
  ok(/--background/.test(bat) && /--python-exit-code 1/.test(bat),
    'the .bat runs Blender headless with a non-zero exit code on Python failure');
  ok(/lastgood/.test(bat), 'the .bat preserves the last known-good generated output');
  ok(/human\.glb CHANGED/.test(bat), 'the .bat fails if the immutable original changes');
  ok(/verify-baked-asset\.mjs/.test(bat) && /tests\\run\.mjs/.test(bat),
    'the .bat runs asset verification and the test suite as gates');

  const py = readFileSync(BUILD_SCRIPT, 'utf8');
  ok(/refusing to write the immutable original/.test(py),
    'the build script refuses to overwrite human.glb');
  ok(/MIN_BLENDER = \(4, 5, 0\)/.test(py), 'the build script pins a Blender 4.5 floor');
  ok(/Refusing to substitute another version/.test(py),
    'the build script refuses a substituted Blender version');

  // ==========================================================================================
  section('phase 2B / A — the generated asset passes its own gate');
  // ==========================================================================================
  const gate = verifyBakedAsset({ baked: BAKED, manifest: MANIFEST, original: ORIGINAL });
  for (const c of gate.checks) {
    if (c.fatal) ok(c.pass, `asset gate: ${c.id} — ${c.detail}`);
  }
  ok(gate.ok, 'generated-asset gate passes overall');
  eq(gate.stats.animations, 1, 'exactly one animation clip is exported');

  // ==========================================================================================
  section('phase 2B / B — manifest');
  // ==========================================================================================
  const manifest = readJson(MANIFEST);
  const v = validateManifest(manifest);
  ok(v.ok, `manifest is schema-valid${v.ok ? '' : ': ' + v.errors.join(' | ')}`);
  eq(manifest.schemaVersion, SCHEMA_VERSION, 'manifest declares the supported schema version');
  for (const key of REQUIRED_OBJECTS) ok(manifest.objects[key], `manifest names objects.${key}`);
  for (const key of REQUIRED_MORPH_SEMANTICS) {
    ok(manifest.morphTargets[key] && manifest.morphTargets[key].targets.length,
      `manifest declares morph semantic ${key}`);
  }
  eq(manifest.events.neutral, 0, 'events.neutral is exactly 0');
  eq(manifest.events.sequenceEnd, 1, 'events.sequenceEnd is exactly 1.0');
  let prev = -1;
  for (const name of EVENT_ORDER) {
    ok(manifest.events[name] >= prev, `event ordering holds at ${name} (${manifest.events[name]})`);
    prev = manifest.events[name];
  }
  eq(manifest.source.originalAssetChecksum, ORIGINAL_SHA256,
    'the manifest records the original asset checksum');
  eq(manifest.ownership.camera, 'threejs', 'the manifest gives the camera to Three.js');
  eq(manifest.ownership.timeline, 'master-progress', 'the manifest gives time to masterProgress');
  for (const value of Object.values(manifest.provenance)) {
    eq(value, 'VISUAL_ONLY', 'every Phase 2B provenance value is VISUAL_ONLY');
  }
  eq([...manifest.compatibility.presentationModes].sort(), [...MANIFEST_MODES].sort(),
    'the manifest advertises exactly the two supported presentation modes');
  eq(manifest.statistics.fileSizeBytes, statSync(BAKED).size,
    'manifest file size matches the generated GLB');
  eq(Math.round(manifest.clip.durationSeconds * 1000),
    Math.round(((manifest.clip.frameEnd - manifest.clip.frameStart) / manifest.clip.fps) * 1000),
    'clip duration agrees with the frame range');

  // the published schema and the executable validator must agree on what is required
  const schema = readJson(SCHEMA);
  eq([...schema.properties.objects.required].sort(), [...REQUIRED_OBJECTS].sort(),
    'schema and validator require the same objects');
  eq([...schema.properties.morphTargets.required].sort(), [...REQUIRED_MORPH_SEMANTICS].sort(),
    'schema and validator require the same morph semantics');
  eq([...schema.properties.events.required].sort(), [...EVENT_ORDER].sort(),
    'schema and validator require the same events');

  section('phase 2B / B — a bad manifest is REJECTED, not defaulted');
  const clone = () => JSON.parse(JSON.stringify(manifest));
  const rejects = (mutate, why) => {
    const m = clone();
    mutate(m);
    ok(!validateManifest(m).ok, `rejected: ${why}`);
  };
  rejects((m) => { delete m.clip.name; }, 'missing clip name');
  rejects((m) => { m.clip.durationSeconds = 0; }, 'zero clip duration');
  rejects((m) => { m.clip.fps = -1; }, 'negative fps');
  rejects((m) => { m.events.sequenceEnd = 0.98; }, 'sequenceEnd is not 1.0');
  rejects((m) => { m.events.skinContact = 1.4; }, 'event outside 0..1');
  rejects((m) => { m.events.skinContact = m.events.dispenseStart - 0.01; }, 'events out of order');
  rejects((m) => { delete m.morphTargets.skinIndent; }, 'missing morph semantic');
  rejects((m) => { m.morphTargets.tubeSqueeze.targets = []; }, 'empty morph target list');
  rejects((m) => { m.provenance.humanMotion = 'MEASURED'; }, 'unknown provenance value');
  rejects((m) => { m.ownership.camera = 'blender'; }, 'camera ownership outside Three.js');
  rejects((m) => { m.schemaVersion = 99; }, 'unsupported schema version');
  rejects((m) => { m.asset = 'https://cdn.example.com/a.glb'; }, 'remote asset path');
  rejects((m) => { m.source.originalAssetChecksum = 'nope'; }, 'malformed original checksum');
  rejects((m) => { m.skeleton.compatibilityStatus = 'unknown'; }, 'unverified skeleton');
  rejects((m) => { delete m.statistics.triangleCount; }, 'missing statistic');
  rejects((m) => { m.compatibility.presentationModes = ['blender-baked']; }, 'only one presentation mode');

  section('phase 2B / B — manifest promises are checked against the asset');
  // several semantics share a mesh (the cream film carries both the deposit and the spread keys),
  // so the fixture has to MERGE their target lists rather than let the last one win
  const mergedDicts = {};
  for (const entry of Object.values(manifest.morphTargets)) {
    const dict = mergedDicts[entry.mesh] || (mergedDicts[entry.mesh] = {});
    entry.targets.forEach((t) => { if (!(t in dict)) dict[t] = Object.keys(dict).length; });
  }
  const fakeAsset = {
    objectNames: new Set(Object.values(manifest.objects)),
    morphDictionaries: mergedDicts,
    clipNames: [manifest.clip.name],
    clipDuration: manifest.clip.durationSeconds,
  };
  ok(validateAgainstAsset(manifest, fakeAsset).ok, 'a matching asset validates');
  ok(!validateAgainstAsset(manifest, { ...fakeAsset, clipNames: ['other'] }).ok,
    'a wrong clip name is rejected');
  ok(!validateAgainstAsset(manifest, { ...fakeAsset, clipDuration: 3 }).ok,
    'a wrong clip duration is rejected');
  ok(!validateAgainstAsset(manifest, { ...fakeAsset, objectNames: new Set() }).ok,
    'missing objects are rejected');
  ok(!validateAgainstAsset(manifest, { ...fakeAsset, morphDictionaries: {} }).ok,
    'missing morph targets are rejected');

  // ==========================================================================================
  section('phase 2B / C — master timeline: one clock, seek == playback');
  // ==========================================================================================
  const duration = manifest.clip.durationSeconds;
  const mixer = fakeMixer();
  eq(mixer.apply(0, duration), 0, 'masterProgress 0 maps to clip start');
  eq(mixer.apply(1, duration), duration, 'masterProgress 1 maps to clip end');
  eq(mixer.apply(0.5, duration), duration / 2, 'the midpoint maps to half the clip');
  ok(mixer.calls.every((c) => c.delta === 0),
    'the mixer is only ever flushed with a ZERO delta (no mixer.update(delta) playback)');

  // continuous playback to p, versus a direct seek to p, must land on the same clip time
  const continuous = fakeMixer();
  const STEPS = 210;
  for (let i = 0; i <= STEPS; i += 1) continuous.apply(i / STEPS, duration);
  const direct = fakeMixer();
  direct.apply(1, duration);
  eq(continuous.action.time, direct.action.time, 'continuous playback and a direct seek agree at 1.0');

  for (const [from, to] of [[0.95, 0.20], [0.20, 0.95], [1, 0], [0.42, 0.42]]) {
    const a = fakeMixer(); a.apply(from, duration); a.apply(to, duration);
    const b = fakeMixer(); b.apply(to, duration);
    eq(a.action.time, b.action.time, `jump ${from} -> ${to} reconstructs the same clip time`);
  }
  const reset = fakeMixer();
  reset.apply(0.77, duration); reset.apply(0, duration);
  eq(reset.action.time, 0, 'reset reconstructs frame zero');
  for (let r = 0; r < 4; r += 1) {
    const replay = fakeMixer();
    for (let i = 0; i <= 20; i += 1) replay.apply(i / 20, duration);
    eq(replay.action.time, duration, `replay ${r + 1} is deterministic`);
  }
  eq(fakeMixer().apply(-3, duration), 0, 'progress below 0 clamps to the clip start');
  eq(fakeMixer().apply(9, duration), duration, 'progress above 1 clamps to the clip end');
  ok(fakeMixer().apply(0.5, duration) === fakeMixer().apply(0.5, duration),
    'the mapping is pure in progress');

  const rawSceneSource = readFileSync(P('simulator/src/three/bakedApplicationScene.js'), 'utf8');
  // strip comments: the file DOCUMENTS the forbidden `mixer.update(delta)` pattern in prose, and a
  // naive source scan would flag its own explanation of why it does not do that
  const sceneSource = rawSceneSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok(!/new THREE\.Clock/.test(sceneSource), 'the baked scene creates no Clock');
  ok(!/setInterval|setTimeout/.test(sceneSource), 'the baked scene creates no timer');
  ok(/this\.mixer\.update\(0\)/.test(sceneSource), 'the baked scene flushes the mixer with delta 0');
  ok(!/mixer\.update\(\s*(delta|dt|deltaTime)/.test(sceneSource),
    'the baked scene never advances the mixer by a delta');
  ok(!/requestAnimationFrame/.test(sceneSource), 'the baked scene owns no render loop');
  ok(/action\.paused = true/.test(sceneSource), 'the baked action stays paused');

  // ==========================================================================================
  section('phase 2B / D — presentation-mode feature flag');
  // ==========================================================================================
  eq([...ALL_MODES].sort(), ['blender-baked', 'procedural-fallback'], 'exactly two modes exist');
  ok(ALL_MODES.includes(DEFAULT_PRESENTATION_MODE), 'the default is one of the two modes');
  const bakedOwn = ownershipFor(PRESENTATION_MODES.BAKED);
  const procOwn = ownershipFor(PRESENTATION_MODES.PROCEDURAL);
  for (const channel of CHANNELS) {
    ok(bakedOwn[channel] && procOwn[channel], `${channel} has a declared owner in both modes`);
  }
  for (const channel of ['humanBones', 'fingerPose', 'productTransform', 'tubeSqueeze',
    'skinIndent', 'creamGeometry']) {
    eq(bakedOwn[channel], 'baked', `baked mode owns ${channel}`);
    eq(procOwn[channel], 'procedural', `procedural mode owns ${channel}`);
  }
  eq(bakedOwn.camera, 'threejs', 'Three.js owns the camera in baked mode');
  eq(procOwn.camera, 'threejs', 'Three.js owns the camera in procedural mode');
  ok(bakedClipEnabled(PRESENTATION_MODES.BAKED), 'the baked clip drives baked mode');
  ok(!bakedClipEnabled(PRESENTATION_MODES.PROCEDURAL), 'the baked clip is inert in fallback mode');
  ok(proceduralControllersEnabled(PRESENTATION_MODES.PROCEDURAL), 'procedural controllers run in fallback mode');
  ok(!proceduralControllersEnabled(PRESENTATION_MODES.BAKED),
    'procedural controllers are DISABLED in baked mode');

  const exclusive = ['humanBones', 'fingerPose', 'productTransform', 'tubeSqueeze',
    'skinIndent', 'creamGeometry'];
  const drive = (on) => Object.fromEntries(exclusive.map((c) => [c, on]));
  ok(assertExclusive(PRESENTATION_MODES.BAKED, { baked: drive(true), procedural: drive(false) }).ok,
    'baked-only is exclusive');
  ok(assertExclusive(PRESENTATION_MODES.PROCEDURAL, { baked: drive(false), procedural: drive(true) }).ok,
    'procedural-only is exclusive');
  const both = assertExclusive(PRESENTATION_MODES.BAKED, { baked: drive(true), procedural: drive(true) });
  ok(!both.ok, 'both systems on the same channel is reported as a conflict');
  eq(both.conflicts.length, exclusive.length, 'every shared channel is named in the conflict list');
  ok(!assertExclusive(PRESENTATION_MODES.BAKED, { baked: drive(false), procedural: drive(false) }).ok,
    'a channel nobody drives is also a conflict');

  const failed = resolvePresentationMode(PRESENTATION_MODES.BAKED,
    { bakedAvailable: false, failureReason: 'manifest invalid' });
  eq(failed.mode, PRESENTATION_MODES.PROCEDURAL, 'a baked-asset failure falls back to procedural');
  ok(failed.fellBack, 'the fallback is reported, not hidden');
  eq(failed.reason, 'manifest invalid', 'the fallback reason is surfaced');
  eq(resolvePresentationMode(PRESENTATION_MODES.BAKED, { bakedAvailable: true }).mode,
    PRESENTATION_MODES.BAKED, 'baked mode is used when the asset is available');
  eq(resolvePresentationMode(null).mode, DEFAULT_PRESENTATION_MODE, 'no request uses the default');
  eq(resolvePresentationMode('nonsense').mode, DEFAULT_PRESENTATION_MODE,
    'an unknown mode falls back to the default');
  ok(resolvePresentationMode('nonsense').reason, 'an unknown mode reports why');
  eq(modeFromQuery('?presentationMode=blender-baked'), PRESENTATION_MODES.BAKED,
    'the mode can be selected from the query string');
  eq(modeFromQuery('?presentationMode=wrong'), null, 'an invalid query mode is ignored');
  eq(modeFromQuery(''), null, 'an absent query mode is null');

  // ==========================================================================================
  section('phase 2B / E — visual state is causal and monotonic where it must be');
  // ==========================================================================================
  const ev = manifest.events;
  const order = (a, b) => ok(ev[a] < ev[b], `${a} precedes ${b} (${ev[a]} < ${ev[b]})`);
  order('dispenseStart', 'creamContact');
  order('creamContact', 'dispenseEnd');
  order('dispenseEnd', 'productRetreatStart');
  order('productRetreatEnd', 'handApproach');
  order('handApproach', 'skinContact');
  order('skinContact', 'spreadStart');
  order('spreadStart', 'strokeOne');
  order('strokeOne', 'strokeTwo');
  order('strokeTwo', 'releaseStart');
  order('releaseStart', 'heroStart');
  ok(ev.productRetreatStart >= ev.dispenseEnd, 'the product only retreats after dispensing ends');
  ok(ev.heroHold > ev.heroStart, 'the hero shot has a hold');

  const report = existsSync(REPORT) ? readJson(REPORT) : null;
  ok(report, 'the machine-readable build report exists');
  if (report) {
    eq(report.status, 'ok', 'the build reported success');
    ok(report.originalChecksumUnchanged, 'the build verified the original was untouched');
    ok(report.blenderVersion.startsWith('4.5'), `the build recorded Blender ${report.blenderVersion}`);
    ok(report.action.keyframes > 1000, `the baked action carries real keys (${report.action.keyframes})`);
    eq(report.action.frameRange, [manifest.clip.frameStart, manifest.clip.frameEnd],
      'the baked action covers the full declared frame range');
    ok(report.excludedObjects.some((n) => /^CTRL_/.test(n)),
      'the control rig was excluded from the export');
    ok(!report.exportedObjects.some((n) => /^CTRL_|^LIGHT_|^PREVIEW|Icosphere/.test(n)),
      'no helper object appears in the export list');
    ok(report.gripSolution && report.gripSolution.penetration <= 0.02,
      `the solved grip drives no finger through the tube (penetration ${report.gripSolution && report.gripSolution.penetration})`);
    for (const [finger, c] of Object.entries((report.gripSolution || {}).contact || {})) {
      ok(c.rn > 0.9, `${finger} pad is not inside the tube surface (rn ${c.rn})`);
    }
  }

  section('phase 2B / E — event lookup helpers');
  eq(eventAt(manifest, 0), 'neutral', 'progress 0 resolves to the neutral event');
  eq(eventAt(manifest, 1), 'sequenceEnd', 'progress 1 resolves to the final event');
  eq(eventAt(manifest, ev.skinContact + 1e-6), 'skinContact', 'progress just past an event resolves to it');
  eq(betweenEvents(manifest, 'creamContact', 'heroStart', ev.creamContact), 0,
    'betweenEvents starts at 0');
  eq(betweenEvents(manifest, 'creamContact', 'heroStart', ev.heroStart), 1,
    'betweenEvents ends at 1');
  ok(betweenEvents(manifest, 'creamContact', 'heroStart', -5) === 0, 'betweenEvents clamps low');
  ok(betweenEvents(manifest, 'creamContact', 'heroStart', 5) === 1, 'betweenEvents clamps high');

  section('phase 2B / E — camera shots are anchored to manifest events');
  for (const shot of SHOTS) {
    ok(EVENT_ORDER.includes(shot.event), `camera shot "${shot.event}" is a declared storyboard event`);
    ok(shot.dist > 0.15 && shot.dist < 3, `shot ${shot.event} keeps a sane distance (${shot.dist} m)`);
    ok(shot.fov >= 24 && shot.fov <= 55, `shot ${shot.event} keeps a sane FOV (${shot.fov})`);
  }
  let prevAt = -1;
  for (const shot of SHOTS) {
    ok(ev[shot.event] >= prevAt, `camera shots follow the storyboard order at ${shot.event}`);
    prevAt = ev[shot.event];
  }
  // no abrupt framing change: consecutive shots must not double or halve the distance
  for (let i = 1; i < SHOTS.length; i += 1) {
    const ratio = SHOTS[i].dist / SHOTS[i - 1].dist;
    ok(ratio > 0.45 && ratio < 2.3,
      `no abrupt camera jump between ${SHOTS[i - 1].event} and ${SHOTS[i].event} (x${ratio.toFixed(2)})`);
  }

  // ==========================================================================================
  section('phase 2B / F — resource discipline');
  // ==========================================================================================
  ok(/uncacheAction/.test(sceneSource) && /uncacheClip/.test(sceneSource) && /uncacheRoot/.test(sceneSource),
    'disposal uncaches the action, the clip and the root from the mixer');
  ok(/disposeObject\(this\.root\)/.test(sceneSource), 'disposal releases the loaded asset');
  ok(/disposeObject\(this\.ground\)/.test(sceneSource), 'disposal releases scene-owned geometry');
  ok(/this\.lighting\.dispose\(\)/.test(sceneSource), 'disposal releases the PMREM environment');
  ok(/this\.disposed = true/.test(sceneSource), 'disposal is idempotent via a flag');
  ok(/if \(this\.disposed\) return/.test(sceneSource), 'update() is inert after disposal');

  const previewSource = readFileSync(P('simulator/phase2b-preview.html'), 'utf8');
  ok(/scenes\[PRESENTATION_MODES\.BAKED\]/.test(previewSource),
    'the preview caches one scene per mode instead of rebuilding on every switch');
  ok(/addEventListener\('resize'/.test(previewSource) &&
     (previewSource.match(/addEventListener\('resize'/g) || []).length === 1,
    'the preview registers exactly one resize listener');
  ok(/window\.__captureMode/.test(previewSource),
    'the preview honours capture mode so the idle loop does not double-render');
}
