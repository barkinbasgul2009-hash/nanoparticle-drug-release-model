// Phase-2 tests: the topical application sequence.
//
// The choreography is pure data, so most of it is asserted directly. The RIG is exercised against
// the model's REAL skeleton, rebuilt from the glTF node graph as THREE.Bone objects — the same
// approach used by humanAsset.test.mjs. That means contact distance, joint angles and replay
// determinism are measured on the actual bone lengths shipped in human.glb, headless, with no
// browser and no WebGL.

import { ok, eq, section, REPO_ROOT } from './harness.mjs';
import { join } from 'node:path';
import * as THREE from '../vendor/three/three.module.js';
import { parseGlb } from '../tools/inspect-glb.mjs';
import {
  STAGES, SHOTS, CAMERA_KEYS, CONTACT_WINDOW, PARAMS,
  choreographyAt, stageAt, stageProgress, shotAt, cameraAt, strokeAxial, creamCoverage, ease,
} from '../src/three/applicationChoreography.js';
import { ApplicationRig, RIG_TUNING } from '../src/three/applicationRig.js';
import { solveTwoBoneIK } from '../src/three/twoBoneIK.js';

const HUMAN = join(REPO_ROOT, 'simulator', 'assets', 'human', 'human.glb');

/** Rebuild the skin's bone hierarchy from the glTF, as real THREE.Bone objects. */
function realSkeleton() {
  const { json } = parseGlb(HUMAN);
  const nodes = json.nodes;
  const bones = nodes.map((n) => {
    const b = new THREE.Bone();
    b.name = n.name || '';
    if (n.translation) b.position.fromArray(n.translation);
    if (n.rotation) b.quaternion.fromArray(n.rotation);
    if (n.scale) b.scale.fromArray(n.scale);
    return b;
  });
  nodes.forEach((n, i) => { for (const c of n.children || []) bones[i].add(bones[c]); });
  bones.filter((b, i) => !nodes.some((n) => (n.children || []).includes(i)))
    .forEach((r) => r.updateMatrixWorld(true));
  const joints = json.skins[0].joints;
  const byName = {};
  joints.forEach((i) => { byName[bones[i].name] = bones[i]; });
  return { byName, names: joints.map((i) => bones[i].name) };
}

function makeRig() {
  const { byName, names } = realSkeleton();
  return new ApplicationRig({
    boneNames: names, lookupBone: (n) => byName[n] || null,
    applyingSide: 'R', forearmRadius: 0.0315,        // measured from the cream patch in-browser
  });
}

/** Signature over every driven bone's world matrix — the determinism probe. */
function poseSignature(rig) {
  let h = 0x811c9dc5;
  const bones = [...rig.rest.keys()].sort((a, b) => a.name.localeCompare(b.name));
  for (const b of bones) {
    b.updateMatrixWorld(true);
    for (const v of b.matrixWorld.elements) {
      const s = v.toFixed(6);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    }
  }
  return h.toString(16).padStart(8, '0');
}

export default function run() {
  section('phase 2 — stage timeline is contiguous and exhaustive');
  eq(STAGES[0].t0, 0, 'sequence starts at 0');
  eq(STAGES[STAGES.length - 1].t1, 1, 'sequence ends at 1');
  for (let i = 1; i < STAGES.length; i++) eq(STAGES[i].t0, STAGES[i - 1].t1, `no gap before ${STAGES[i].id}`);
  for (const id of ['neutral', 'prepare', 'approach', 'contact', 'stroke_1', 'stroke_2', 'release', 'hold']) {
    ok(STAGES.some((s) => s.id === id), `required stage present: ${id}`);
  }
  eq(stageAt(0).id, 'neutral', 'progress 0 is neutral');
  eq(stageAt(1).id, 'hold', 'progress 1 is the hold');
  eq(stageAt(0.41).id, 'contact', '0.41 lands in contact');

  section('phase 2 — camera choreography progresses and pushes in');
  eq(SHOTS[0].t0, 0, 'shot list starts at 0');
  eq(SHOTS[SHOTS.length - 1].t1, 1, 'shot list ends at 1');
  for (let i = 1; i < SHOTS.length; i++) eq(SHOTS[i].t0, SHOTS[i - 1].t1, `shots are contiguous at ${SHOTS[i].id}`);
  eq(shotAt(0).id, 'establish', 'opens on the establishing shot');
  eq(shotAt(1).id, 'hero_hold', 'ends on the forearm hero hold');
  eq(cameraAt(1).toAnchor, 'forearm', 'the final frame is anchored on the forearm');
  // monotonic push-in: the camera never retreats
  let prevDist = Infinity;
  for (let i = 0; i <= 100; i++) {
    const d = cameraAt(i / 100).dist;
    ok(d <= prevDist + 1e-9, `camera never pulls back (p=${(i / 100).toFixed(2)}: ${d.toFixed(3)}m)`);
    prevDist = d;
  }
  ok(cameraAt(0).dist > 2, 'opens wide (>2 m)');
  ok(cameraAt(1).dist < 0.35, 'ends tight on the forearm (<0.35 m)');
  for (let i = 1; i < CAMERA_KEYS.length; i++) ok(CAMERA_KEYS[i].t > CAMERA_KEYS[i - 1].t, 'camera keys are ordered');

  section('phase 2 — cream appears only after contact, and only ever spreads');
  eq(creamCoverage(0), 0, 'no cream at the start');
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    const c = choreographyAt(p);
    if (p < CONTACT_WINDOW.t0) {
      ok(!c.cream.present, `no cream before contact (p=${p.toFixed(2)})`);
      eq(c.cream.opacity, 0, `zero cream opacity before contact (p=${p.toFixed(2)})`);
    }
  }
  let prevCov = -1;
  for (let i = 0; i <= 200; i++) {
    const cov = creamCoverage(i / 200);
    ok(cov >= prevCov - 1e-12, `coverage never decreases (p=${(i / 200).toFixed(3)})`);
    prevCov = cov;
  }
  ok(creamCoverage(0.52) > creamCoverage(0.42), 'coverage grows during stroke 1');
  ok(creamCoverage(0.70) > creamCoverage(0.52), 'coverage grows during stroke 2');
  eq(Number(creamCoverage(1).toFixed(6)), PARAMS.coverageFinal, 'final coverage reaches the authored maximum');
  ok(choreographyAt(1).cream.present, 'cream is still present in the hero hold');
  ok(choreographyAt(1).cream.opacity > 0.5, 'cream is still clearly visible at the end');
  // the hold must be static — a hero shot that keeps changing cannot be handed to the next phase
  eq(JSON.stringify(choreographyAt(0.90).cream), JSON.stringify(choreographyAt(1.0).cream),
    'cream state is settled and unchanging through the hold');

  section('phase 2 — stroke path stays on the forearm');
  for (let i = 0; i <= 200; i++) {
    const a = strokeAxial(i / 200);
    ok(a >= PARAMS.axialMin && a <= PARAMS.axialMax, `stroke stays on the forearm (p=${(i / 200).toFixed(3)}, axial=${a.toFixed(3)})`);
  }
  ok(strokeAxial(0.52) > PARAMS.depositAxial, 'stroke 1 travels toward the wrist');
  ok(strokeAxial(0.67) < PARAMS.depositAxial, 'stroke 2 travels toward the elbow');

  section('phase 2 — two-bone IK reaches, and refuses to hyperextend');
  {
    const root = new THREE.Bone(), mid = new THREE.Bone(), tip = new THREE.Bone();
    root.add(mid); mid.add(tip);
    mid.position.set(0, -1, 0); tip.position.set(0, -1, 0);
    root.updateMatrixWorld(true);
    const r1 = solveTwoBoneIK({ root, mid, tip }, new THREE.Vector3(1.2, -1.2, 0), new THREE.Vector3(2, -1, 0));
    ok(r1.gap < 1e-3, `IK reaches a reachable target (gap ${r1.gap.toExponential(2)})`);
    ok(r1.reached, 'reachable target reports reached');
    // an out-of-range target must NOT snap the elbow straight
    root.updateMatrixWorld(true);
    const r2 = solveTwoBoneIK({ root, mid, tip }, new THREE.Vector3(0, -9, 0), new THREE.Vector3(2, -1, 0));
    ok(!r2.reached, 'out-of-range target reports not reached');
    ok(r2.elbowAngle < Math.PI, 'elbow never locks fully straight');
  }

  section('phase 2 — the hand actually reaches the forearm on the REAL skeleton');
  const rig = makeRig();
  ok(rig.ready, 'rig resolves every required bone on human.glb');
  ok(rig.handFrame.ok, 'palm/finger axes measured from the bind pose');

  let contactFrames = 0;
  for (let i = 0; i <= 200; i++) {
    const p = i / 200;
    const f = rig.solve(p);
    if (f.contact.expected) {
      contactFrames += 1;
      ok(Math.abs(f.contact.gap) <= PARAMS.contactGapTolerance,
        `palm is on the skin through the contact window (p=${p.toFixed(3)}, gap=${(f.contact.gap * 1000).toFixed(1)}mm)`);
      ok(f.contact.valid, `contact reported valid at p=${p.toFixed(3)}`);
      ok(f.contact.palmDot > 0.9, `palm faces the forearm at p=${p.toFixed(3)} (dot=${f.contact.palmDot.toFixed(3)})`);
      ok(f.contact.axial >= PARAMS.axialMin - 0.05 && f.contact.axial <= PARAMS.axialMax + 0.05,
        `contact is on the forearm, not past its ends (p=${p.toFixed(3)}, axial=${f.contact.axial.toFixed(3)})`);
    }
  }
  ok(contactFrames > 60, `contact window is a real span, not an instant (${contactFrames} frames)`);

  // no hovering and no impaling
  ok(rig.solve(0.41).contact.gap > -0.012, 'the palm does not sink into the arm at touchdown');
  ok(rig.solve(0.33).contact.gap > 0.005, 'the hand is still clear of the arm during the approach');
  ok(rig.solve(0.02).contact.gap > 0.2, 'the hands are nowhere near each other at rest');

  section('phase 2 — joints stay anatomically plausible');
  for (let i = 0; i <= 100; i++) {
    const f = rig.solve(i / 100);
    const tEl = f.ik.treated.elbowAngle * 180 / Math.PI;
    const aEl = f.ik.applying.elbowAngle * 180 / Math.PI;
    ok(tEl > 25 && tEl < 178, `treated elbow is plausible (p=${(i / 100).toFixed(2)}: ${tEl.toFixed(0)}°)`);
    ok(aEl > 25 && aEl < 178, `applying elbow is plausible (p=${(i / 100).toFixed(2)}: ${aEl.toFixed(0)}°)`);
  }

  section('phase 2 — deterministic across play / pause / seek / reset / replay');
  const play = {};
  for (let i = 0; i <= 40; i++) { const p = i / 40; rig.solve(p); play[p.toFixed(3)] = poseSignature(rig); }
  ok(new Set(Object.values(play)).size > 20, 'the sequence genuinely moves (distinct poses)');

  rig.solve(0.5); const a1 = poseSignature(rig); const a2 = poseSignature(rig);
  rig.solve(0.5); const a3 = poseSignature(rig);
  eq(a2, a1, 'PAUSE: holding a frame does not drift');
  eq(a3, a1, 'PAUSE: re-applying the same progress reproduces the pose');

  for (const p of [0.875, 0.1, 0.5, 0.3, 1.0, 0.0, 0.675, 0.425]) {
    rig.solve(p);
    eq(poseSignature(rig), play[p.toFixed(3)], `SEEK to ${p} matches sequential playback`);
  }

  rig.solve(0.9); rig.reset();
  eq(poseSignature(rig), play['0.000'], 'RESET reproduces progress 0 exactly');

  let replayOk = true;
  for (let i = 0; i <= 40; i++) { const p = i / 40; rig.solve(p); if (poseSignature(rig) !== play[p.toFixed(3)]) replayOk = false; }
  ok(replayOk, 'REPLAY: a second pass reproduces the first bit-for-bit');

  // seeking backwards must be identical to seeking forwards — the IK reset is what guarantees this
  let backwardOk = true;
  for (let i = 40; i >= 0; i--) { const p = i / 40; rig.solve(p); if (poseSignature(rig) !== play[p.toFixed(3)]) backwardOk = false; }
  ok(backwardOk, 'REVERSE SEEK: scrubbing backwards reproduces the same poses');

  section('phase 2 — choreography is pure and does not mutate shared state');
  const snap = JSON.stringify(choreographyAt(0.5));
  choreographyAt(0.1); choreographyAt(0.9); choreographyAt(0.5);
  eq(JSON.stringify(choreographyAt(0.5)), snap, 'choreographyAt is order-independent');
  ok(Object.isFrozen(choreographyAt(0.5)), 'returned frames are frozen');
  ok(Object.isFrozen(STAGES) && Object.isFrozen(PARAMS) && Object.isFrozen(SHOTS), 'authored tables are frozen');
  eq(stageProgress('contact', 0.38), 0, 'stage progress starts at 0');
  eq(stageProgress('contact', 0.44), 1, 'stage progress ends at 1');
  eq(ease(0), 0, 'ease(0) = 0'); eq(ease(1), 1, 'ease(1) = 1');
  eq(choreographyAt(-5).progress, 0, 'progress is clamped below');
  eq(choreographyAt(5).progress, 1, 'progress is clamped above');
  ok(Number.isFinite(choreographyAt(NaN).progress), 'NaN progress does not produce NaN state');

  section('phase 2 — rig tuning is anatomy-relative, not magic absolutes');
  ok(RIG_TUNING.presentOffset && RIG_TUNING.neutralOffset, 'carry positions are declared as offsets');
  ok(PARAMS.palmDepth > 0 && PARAMS.palmForward > 0, 'palm geometry is modelled (this is what removes the hover)');
  ok(PARAMS.contactGapTolerance > 0 && PARAMS.contactGapTolerance < 0.05, 'contact tolerance is tight (<5 cm)');
}
