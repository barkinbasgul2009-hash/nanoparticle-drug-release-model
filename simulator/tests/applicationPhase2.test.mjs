// Phase-2 tests: the NANODERM topical application sequence.
//
// The choreography is pure data, so most of it is asserted directly. The RIG is exercised against
// the model's REAL skeleton, rebuilt from the glTF node graph as THREE.Bone objects — the same
// approach used by humanAsset.test.mjs. Contact distance, TORSO CLEARANCE, joint angles and replay
// determinism are therefore measured on the actual bone lengths shipped in human.glb, headless,
// with no browser and no WebGL.
//
// The torso-clearance assertions exist because of a real regression: the first Phase-2 pass drove
// the applying wrist 36.9 mm INSIDE the trunk, which read on screen as the hand emerging from the
// body. That must never silently come back.

import { ok, eq, section, REPO_ROOT } from './harness.mjs';
import { join } from 'node:path';
import * as THREE from '../vendor/three/three.module.js';
import { parseGlb } from '../tools/inspect-glb.mjs';
import {
  STAGES, SHOTS, CAMERA_KEYS, CONTACT_WINDOW, DISPENSE_WINDOW, PARAMS, TORSO,
  choreographyAt, stageAt, stageProgress, shotAt, cameraAt, strokeAxial, creamCoverage, extrusion, ease,
} from '../src/three/applicationChoreography.js';
import { ApplicationRig, RIG_TUNING } from '../src/three/applicationRig.js';
import { solveTwoBoneIK } from '../src/three/twoBoneIK.js';
import { PRODUCT, TUBE, COLOURS } from '../src/three/creamProduct.js';
import { CREAM_DEFAULTS } from '../src/three/creamLayer.js';
import { DISPENSER_DEFAULTS } from '../src/three/creamDispenser.js';

const HUMAN = join(REPO_ROOT, 'simulator', 'assets', 'human', 'human.glb');

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
    applyingSide: 'R', forearmRadius: 0.0315,
  });
}

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
  section('phase 2 — stage timeline covers product, dispensing and application');
  eq(STAGES[0].t0, 0, 'sequence starts at 0');
  eq(STAGES[STAGES.length - 1].t1, 1, 'sequence ends at 1');
  for (let i = 1; i < STAGES.length; i++) eq(STAGES[i].t0, STAGES[i - 1].t1, `no gap before ${STAGES[i].id}`);
  for (const id of ['neutral', 'present', 'product_raise', 'dispense_prep', 'dispense', 'stow',
    'contact', 'stroke_1', 'stroke_2', 'release', 'hold']) {
    ok(STAGES.some((s) => s.id === id), `required stage present: ${id}`);
  }
  // the story must be ordered: product before dispensing before contact before the hero hold
  const at = (id) => STAGES.findIndex((s) => s.id === id);
  ok(at('product_raise') < at('dispense'), 'the product is shown before it dispenses');
  ok(at('dispense') < at('contact'), 'cream is dispensed before the hand touches down');
  ok(at('contact') < at('stroke_1'), 'contact precedes the strokes');
  ok(at('stroke_2') < at('hold'), 'the strokes precede the hero hold');
  eq(stageAt(0).id, 'neutral', 'progress 0 is neutral');
  eq(stageAt(1).id, 'hold', 'progress 1 is the hold');

  section('phase 2 — product branding is present and legible-by-construction');
  eq(PRODUCT.brand, 'NANODERM', 'the drug name on the product is NANODERM');
  ok(/celastrol/i.test(PRODUCT.api) && /tripterine/i.test(PRODUCT.api),
    `the repository's real Profile-B active ingredient is carried on the label (${PRODUCT.api})`);
  ok(/NLC/.test(PRODUCT.api), 'the nanostructured lipid carrier is named on the label');
  ok(/topical/i.test(PRODUCT.form), 'the dosage form is stated');
  ok(/external use/i.test(PRODUCT.route), 'the route warning is stated');
  eq(PRODUCT.classification, 'Rx', 'it reads as a prescription product, not a cosmetic');
  ok(PRODUCT.netContent && PRODUCT.strength, 'net content and strength are stated');
  // proportions must read as a pharmacy tube, not a bottle
  ok(TUBE.bodyRadius * 2 < 0.035, `barrel is tube-scale (${(TUBE.bodyRadius * 2 * 1000).toFixed(0)} mm across)`);
  ok(TUBE.bodyLength > TUBE.bodyRadius * 4, 'the tube is much longer than it is wide');
  ok(TUBE.crimpWidth > TUBE.bodyRadius * 1.5, 'the crimped tail is wider than the barrel');
  ok(TUBE.capRadius < TUBE.bodyRadius, 'the cap is narrower than the barrel');
  ok(typeof COLOURS.accent === 'string' && COLOURS.accent.startsWith('#'), 'a clinical accent colour is defined');

  section('phase 2 — camera tells the story: product -> dispense -> apply -> forearm');
  eq(SHOTS[0].t0, 0, 'shot list starts at 0');
  eq(SHOTS[SHOTS.length - 1].t1, 1, 'shot list ends at 1');
  for (let i = 1; i < SHOTS.length; i++) eq(SHOTS[i].t0, SHOTS[i - 1].t1, `shots are contiguous at ${SHOTS[i].id}`);
  const shotIds = SHOTS.map((s) => s.id);
  for (const id of ['product_establish', 'dispense_prep', 'dispense', 'initial_contact', 'application', 'forearm_hero']) {
    ok(shotIds.includes(id), `required shot present: ${id}`);
  }
  eq(shotAt(1).id, 'forearm_hero', 'ends on the forearm hero');
  eq(cameraAt(1).toAnchor, 'forearm', 'the final frame is anchored on the forearm');
  // the product must actually be framed during the product beat
  ok(CAMERA_KEYS.some((k) => k.anchor === 'product'), 'a camera key is anchored on the product');
  const prodKey = CAMERA_KEYS.find((k) => k.anchor === 'product');
  ok(prodKey.dist < 0.5, `the product beat is a close shot so the label reads (${prodKey.dist} m)`);
  ok(CAMERA_KEYS.some((k) => k.anchor === 'dispense'), 'a camera key is anchored on the dispensing');
  ok(cameraAt(0).dist > 1.5, 'opens wide');
  ok(cameraAt(1).dist < 0.3, 'ends tight on the forearm');
  for (let i = 1; i < CAMERA_KEYS.length; i++) ok(CAMERA_KEYS[i].t > CAMERA_KEYS[i - 1].t, 'camera keys are ordered');

  section('phase 2 — dispensing precedes and causes the deposit');
  eq(extrusion(0), 0, 'nothing is extruded at the start');
  eq(extrusion(1), 1, 'extrusion completes');
  for (let i = 0; i <= 100; i++) {
    const p = i / 100;
    if (p < DISPENSE_WINDOW.t0) {
      eq(creamCoverage(p), 0, `no cream on the skin before dispensing (p=${p.toFixed(2)})`);
      ok(!choreographyAt(p).cream.present, `cream not present before dispensing (p=${p.toFixed(2)})`);
    }
  }
  ok(choreographyAt(DISPENSE_WINDOW.t0 + 0.06).cream.present, 'cream appears during the dispense stage');
  ok(DISPENSE_WINDOW.t1 <= CONTACT_WINDOW.t0, 'dispensing finishes before the palm makes contact');
  // the bead must be flattened by the arriving palm, not left sitting there in the hero shot
  ok(choreographyAt(0.50).dispense.beadRadius > 0.008, 'a substantial bead is deposited');
  eq(choreographyAt(0.95).dispense.beadRadius, 0, 'the bead is gone by the hero shot (flattened by the palm)');
  eq(choreographyAt(1.0).dispense.strandLength, 0, 'no strand remains at the end');
  ok(!choreographyAt(0.95).dispense.active, 'dispensing is over by the hero shot');
  ok(DISPENSER_DEFAULTS.strandTipRadius > DISPENSER_DEFAULTS.strandTopRadius,
    'the strand is fatter at the falling tip than at the nozzle');

  section('phase 2 — cream is readable and only ever spreads');
  let prevCov = -1;
  for (let i = 0; i <= 200; i++) {
    const cov = creamCoverage(i / 200);
    ok(cov >= prevCov - 1e-12, `coverage never decreases (p=${(i / 200).toFixed(3)})`);
    prevCov = cov;
  }
  ok(creamCoverage(0.70) > creamCoverage(0.64), 'coverage grows during stroke 1');
  ok(creamCoverage(0.84) > creamCoverage(0.70), 'coverage grows during stroke 2');
  eq(Number(creamCoverage(1).toFixed(6)), PARAMS.coverageFinal, 'final coverage reaches the authored maximum');
  const heroCream = choreographyAt(1).cream;
  ok(heroCream.present, 'cream is still present in the hero hold');
  ok(heroCream.opacity > 0.8, `cream stays clearly visible at the end (opacity ${heroCream.opacity.toFixed(2)})`);
  ok(heroCream.thickness > 0.3, 'the film still has body at the end, not a flat tint');
  // the readability fix: real height + a distinct specular, not just a whiter colour
  ok(CREAM_DEFAULTS.maxThickness > 0.002, 'the cream layer has real geometric thickness');
  ok(CREAM_DEFAULTS.wetRoughness < CREAM_DEFAULTS.baseRoughness - 0.2,
    'wet cream is markedly glossier than the dry film, giving it its own specular');
  eq(JSON.stringify(choreographyAt(0.95).cream), JSON.stringify(choreographyAt(1.0).cream),
    'cream state is settled through the hold');

  section('phase 2 — stroke path stays on the forearm');
  for (let i = 0; i <= 200; i++) {
    const a = strokeAxial(i / 200);
    ok(a >= PARAMS.axialMin && a <= PARAMS.axialMax, `stroke stays on the forearm (p=${(i / 200).toFixed(3)})`);
  }
  ok(strokeAxial(0.70) > PARAMS.depositAxial, 'stroke 1 travels toward the wrist');
  ok(strokeAxial(0.80) < PARAMS.depositAxial, 'stroke 2 travels toward the elbow');

  section('phase 2 — two-bone IK reaches, and refuses to hyperextend');
  {
    const root = new THREE.Bone(), mid = new THREE.Bone(), tip = new THREE.Bone();
    root.add(mid); mid.add(tip);
    mid.position.set(0, -1, 0); tip.position.set(0, -1, 0);
    root.updateMatrixWorld(true);
    const r1 = solveTwoBoneIK({ root, mid, tip }, new THREE.Vector3(1.2, -1.2, 0), new THREE.Vector3(2, -1, 0));
    ok(r1.gap < 1e-3, `IK reaches a reachable target (gap ${r1.gap.toExponential(2)})`);
    root.updateMatrixWorld(true);
    const r2 = solveTwoBoneIK({ root, mid, tip }, new THREE.Vector3(0, -9, 0), new THREE.Vector3(2, -1, 0));
    ok(!r2.reached, 'out-of-range target reports not reached');
    ok(r2.elbowAngle < Math.PI, 'elbow never locks fully straight');
  }

  const rig = makeRig();
  ok(rig.ready, 'rig resolves every required bone on human.glb');
  ok(rig.handFrame.ok, 'palm/finger axes measured from the bind pose');

  section('phase 2 — THE HAND NEVER PASSES THROUGH THE BODY');
  ok(TORSO.radius > 0.1 && TORSO.margin > 0, 'a torso capsule with a real margin is declared');
  let worst = Infinity, worstAt = 0;
  for (let i = 0; i <= 200; i++) {
    const p = i / 200;
    const f = rig.solve(p);
    if (f.clearance.min < worst) { worst = f.clearance.min; worstAt = p; }
    ok(f.clearance.safe, `applying arm is outside the torso at p=${p.toFixed(3)} (min ${(f.clearance.min * 1000).toFixed(1)} mm)`);
    ok(f.clearance.wrist > 0, `wrist is outside the torso at p=${p.toFixed(3)}`);
    ok(f.clearance.elbow > 0, `applying elbow is outside the torso at p=${p.toFixed(3)}`);
  }
  ok(worst > 0.01, `worst clearance over the whole sequence is ${(worst * 1000).toFixed(1)} mm at p=${worstAt.toFixed(3)}`);
  // the clamp itself must work even when handed a point at the very centre of the chest
  {
    const centre = rig.torso.p0.clone().lerp(rig.torso.p1, 0.5);
    const pushed = rig.pushOutOfTorso(centre.clone());
    ok(rig.torsoClearance(pushed) >= rig.torso.margin - 1e-6, 'a point at the chest centre is pushed clear');
  }

  section('phase 2 — the hand actually reaches the forearm on the REAL skeleton');
  let contactFrames = 0;
  for (let i = 0; i <= 200; i++) {
    const p = i / 200;
    const f = rig.solve(p);
    if (!f.contact.expected) continue;
    contactFrames += 1;
    ok(Math.abs(f.contact.gap) <= PARAMS.contactGapTolerance,
      `palm is on the skin through the contact window (p=${p.toFixed(3)}, gap ${(f.contact.gap * 1000).toFixed(1)} mm)`);
    ok(f.contact.valid, `contact reported valid at p=${p.toFixed(3)}`);
    ok(f.contact.axial >= PARAMS.axialMin - 0.05 && f.contact.axial <= PARAMS.axialMax + 0.05,
      `contact stays on the forearm (p=${p.toFixed(3)})`);
  }
  ok(contactFrames > 40, `contact window is a real span (${contactFrames} frames)`);
  ok(rig.solve(0.02).contact.gap > 0.2, 'the hands are nowhere near each other at rest');
  ok(rig.solve(0.43).contact.gap > 0.03, 'during dispensing the palm is held clear of the skin');

  section('phase 2 — joints stay anatomically plausible');
  for (let i = 0; i <= 100; i++) {
    const f = rig.solve(i / 100);
    const tEl = f.ik.treated.elbowAngle * 180 / Math.PI;
    const aEl = f.ik.applying.elbowAngle * 180 / Math.PI;
    ok(tEl > 25 && tEl < 178, `treated elbow plausible (p=${(i / 100).toFixed(2)}: ${tEl.toFixed(0)}°)`);
    ok(aEl > 25 && aEl < 178, `applying elbow plausible (p=${(i / 100).toFixed(2)}: ${aEl.toFixed(0)}°)`);
  }

  section('phase 2 — the product is held, then stowed');
  ok(!choreographyAt(0.05).product.visible, 'no tube during the opening beat');
  ok(choreographyAt(0.23).product.visible && choreographyAt(0.23).product.inHand, 'the tube is in hand for the product shot');
  ok(choreographyAt(0.43).product.inHand, 'the tube is still held while dispensing');
  ok(!choreographyAt(0.95).product.inHand, 'the tube has been put down by the hero shot');
  {
    const held = rig.solve(0.43).productPose;
    ok(held && !held.stowed, 'a product pose is produced while dispensing');
    const stowed = rig.solve(0.95).productPose;
    ok(stowed && stowed.stowed, 'the product pose reports stowed at the end');
    // the nozzle must be above the deposit, not somewhere random
    const f = rig.solve(0.43);
    const toSkin = f.nozzleWorld.distanceTo(f.deposit.point);
    ok(toSkin > 0.02 && toSkin < 0.20, `the nozzle sits a plausible distance above the skin (${(toSkin * 1000).toFixed(0)} mm)`);
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

  let backwardOk = true;
  for (let i = 40; i >= 0; i--) { const p = i / 40; rig.solve(p); if (poseSignature(rig) !== play[p.toFixed(3)]) backwardOk = false; }
  ok(backwardOk, 'REVERSE SEEK: scrubbing backwards reproduces the same poses');

  // the product transform must be deterministic too, not just the skeleton
  const poseA = rig.solve(0.43).productPose;
  rig.solve(0.1); rig.solve(0.9);
  const poseB = rig.solve(0.43).productPose;
  ok(poseA.position.distanceTo(poseB.position) < 1e-9, 'the product lands in the same place on replay');
  // Compare COMPONENTS, not q·q against 1: these quaternions come out of a matrix decomposition and
  // are only unit to ~6e-8, so a dot-product test would fail on normalisation noise rather than on
  // any real difference. Component-wise they are bit-identical.
  ok(['x', 'y', 'z', 'w'].every((k) => Math.abs(poseA.quaternion[k] - poseB.quaternion[k]) < 1e-12),
    'the product holds the same orientation on replay');

  section('phase 2 — choreography is pure and does not mutate shared state');
  const snap = JSON.stringify(choreographyAt(0.5));
  choreographyAt(0.1); choreographyAt(0.9); choreographyAt(0.5);
  eq(JSON.stringify(choreographyAt(0.5)), snap, 'choreographyAt is order-independent');
  ok(Object.isFrozen(choreographyAt(0.5)), 'returned frames are frozen');
  ok(Object.isFrozen(STAGES) && Object.isFrozen(PARAMS) && Object.isFrozen(SHOTS) && Object.isFrozen(TORSO),
    'authored tables are frozen');
  eq(ease(0), 0, 'ease(0) = 0'); eq(ease(1), 1, 'ease(1) = 1');
  eq(choreographyAt(-5).progress, 0, 'progress is clamped below');
  eq(choreographyAt(5).progress, 1, 'progress is clamped above');
  ok(Number.isFinite(choreographyAt(NaN).progress), 'NaN progress does not produce NaN state');
  ok(RIG_TUNING.presentOffset && RIG_TUNING.neutralOffset && RIG_TUNING.stowOffset,
    'carry positions are declared as anatomy-relative offsets');
}
