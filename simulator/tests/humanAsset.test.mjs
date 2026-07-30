// Phase-0 closure: assertions against the REAL exported human asset
// (simulator/assets/human/human.glb), not a fixture or a mock.
//
// Determinism is verified against the model's ACTUAL skeleton topology: the bone hierarchy and its
// rest transforms are rebuilt from the glTF node graph as real THREE.Bone objects, the animation
// controller drives them, and a signature is taken over every bone's world matrix. This exercises
// the same math the browser runs, headless and without WebGL.

import { ok, eq, section, REPO_ROOT } from './harness.mjs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.js';
import { parseGlb, inspectGlb } from '../tools/inspect-glb.mjs';
import { verifyHumanAsset, GATE } from '../tools/verify-human-asset.mjs';
import { buildBoneMap, REQUIRED_ROLES } from '../src/three/boneMap.js';
import { HumanAnimationController, poseFor } from '../src/three/humanAnimationController.js';
import { roleForMaterial, CUTOUT_ROLES, ALPHA_TEST, MATERIAL_ROLES } from '../src/three/humanPresentation.js';

const HUMAN = join(REPO_ROOT, 'simulator', 'assets', 'human', 'human.glb');

/** Rebuild the glTF skin's bone hierarchy as real THREE.Bone objects with their rest transforms. */
function buildSkeletonFromGltf(json) {
  const nodes = json.nodes || [];
  const bones = nodes.map((n) => {
    const b = new THREE.Bone();
    b.name = n.name || '';
    if (n.translation) b.position.fromArray(n.translation);
    if (n.rotation) b.quaternion.fromArray(n.rotation);
    if (n.scale) b.scale.fromArray(n.scale);
    if (n.matrix) {
      const m = new THREE.Matrix4().fromArray(n.matrix);
      m.decompose(b.position, b.quaternion, b.scale);
    }
    return b;
  });
  nodes.forEach((n, i) => { for (const c of n.children || []) bones[i].add(bones[c]); });
  const jointIdx = (json.skins && json.skins[0] && json.skins[0].joints) || [];
  const byName = {};
  for (const ji of jointIdx) byName[bones[ji].name] = bones[ji];
  const roots = bones.filter((b, i) => !nodes.some((n) => (n.children || []).includes(i)));
  return { bones, byName, roots, jointNames: jointIdx.map((i) => bones[i].name) };
}

/** FNV-1a over every joint's world matrix — one signature for the whole posed skeleton. */
function skeletonSignature(byName, roots) {
  for (const r of roots) r.updateMatrixWorld(true);
  let h = 0x811c9dc5;
  for (const name of Object.keys(byName).sort()) {
    for (const v of byName[name].matrixWorld.elements) {
      const s = v.toFixed(6);
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    }
  }
  return h.toString(16).padStart(8, '0');
}

export default function run() {
  section('human asset — file present and self-contained');
  ok(existsSync(HUMAN), 'simulator/assets/human/human.glb exists');

  const info = inspectGlb(HUMAN);
  const { json } = parseGlb(HUMAN);

  eq(info.gltfVersion, '2.0', 'glTF 2.0 container');
  ok(/Blender/i.test(info.generator || ''), `exported from Blender (generator: ${info.generator})`);
  ok(info.selfContained, 'no external references — nothing is fetched from a CDN at runtime');
  eq(info.externalReferences.length, 0, 'zero external URIs');
  eq((info.extensionsRequired || []).length, 0, 'no required glTF extensions');

  section('human asset — geometry, textures, skeleton statistics');
  ok(info.triangles >= GATE.minTriangles, `${info.triangles} triangles >= ${GATE.minTriangles} (not a low-poly mannequin)`);
  ok(info.triangles <= GATE.maxTriangles, `${info.triangles} triangles <= ${GATE.maxTriangles} (web-deliverable)`);
  ok(info.fileSizeMB <= GATE.maxFileMB, `${info.fileSizeMB} MB <= ${GATE.maxFileMB} MB`);
  eq(info.meshes, 9, '9 meshes (body, eyes, brows, lashes, hair, suit, shoes, teeth, tongue)');
  eq(info.materials, 9, '9 materials');
  eq(info.textures, 10, '10 textures');
  eq(info.images, 10, '10 embedded images');
  ok(info.imageInfo.every((i) => i.embedded && !i.uri), 'every texture is embedded in the GLB (resolves locally)');
  eq(info.skins, 1, 'exactly one skin');
  eq(info.skinnedMeshNodes, 9, 'all 9 mesh nodes are skinned to that skeleton');
  ok(info.bones >= GATE.minBones, `${info.bones} bones >= ${GATE.minBones}`);
  eq(info.duplicateMaterials.length, 0, 'no duplicate material names');

  section('human asset — the automated quality gate passes end to end');
  const gate = verifyHumanAsset(HUMAN);
  ok(gate.ok, 'verifyHumanAsset() returns ok');
  for (const c of gate.checks) ok(c.pass || !c.fatal, `gate ${c.pass ? 'PASS' : 'WARN'}: ${c.id} — ${c.detail}`);
  eq(gate.checks.filter((c) => !c.pass && c.fatal).length, 0, 'zero fatal gate failures');

  section('human asset — bone roles resolve on this Unreal/MakeHuman-style skeleton');
  const map = buildBoneMap(info.boneNames);
  ok(map.ok, 'all required roles resolve');
  eq(map.missingRequired.length, 0, 'no missing required roles');
  for (const r of REQUIRED_ROLES) ok(!!map.map[r], `role ${r} -> ${map.map[r]}`);
  // the export uses UE-style names; pin them so a future re-export that renames bones fails loudly
  eq(map.map.shoulderL, 'clavicle_l', 'shoulderL binds clavicle_l');
  eq(map.map.shoulderR, 'clavicle_r', 'shoulderR binds clavicle_r');
  eq(map.map.upperArmL, 'upperarm_l', 'upperArmL binds upperarm_l');
  eq(map.map.forearmL, 'lowerarm_l', 'forearmL binds lowerarm_l');
  eq(map.map.forearmR, 'lowerarm_r', 'forearmR binds lowerarm_r');
  eq(map.map.handL, 'hand_l', 'handL binds hand_l');
  eq(map.map.handR, 'hand_r', 'handR binds hand_r');
  eq(map.map.spine, 'spine_01', 'spine binds spine_01');
  eq(map.map.neck, 'neck_01', 'neck binds neck_01');
  ok(map.fingerBoneCount >= GATE.minFingerBones, `${map.fingerBoneCount} finger bones >= ${GATE.minFingerBones}`);
  // 5 digits x 3 joints x 2 hands
  eq(map.fingerBoneCount, 30, '30 finger bones (5 digits x 3 joints x 2 hands)');

  section('human asset — controller drives the real skeleton with nothing skipped');
  const skel = buildSkeletonFromGltf(json);
  ok(skel.jointNames.length === info.bones, 'rebuilt every joint of the skin');
  const ctrl = new HumanAnimationController({
    boneNames: skel.jointNames,
    lookupBone: (n) => skel.byName[n] || null,
    side: 'R',
  });
  ok(ctrl.ready, 'controller reports ready against the real bone names');
  eq(ctrl.missingRoles.length, 0, 'controller is missing no required role');

  const at70 = ctrl.apply(0.70);
  eq(at70.stage, 'apply_cream', 'progress 0.70 is inside the cream-application stage');
  eq(at70.skipped.length, 0, 'no driven bone was skipped on the real skeleton');
  eq(at70.applied.length, 8, '8 bones driven (both arms: shoulder, upperArm, forearm, hand)');

  section('human asset — deterministic across play / pause / seek / reset / replay');
  const STEPS = 20;
  const play = {};
  for (let i = 0; i <= STEPS; i++) { const p = i / STEPS; ctrl.apply(p); play[p.toFixed(2)] = skeletonSignature(skel.byName, skel.roots); }
  ok(new Set(Object.values(play)).size > 1, 'the sweep actually moves the skeleton (poses are not all identical)');

  ctrl.apply(0.70);
  const pauseA = skeletonSignature(skel.byName, skel.roots);
  const pauseB = skeletonSignature(skel.byName, skel.roots);
  ctrl.apply(0.70);
  const pauseC = skeletonSignature(skel.byName, skel.roots);
  eq(pauseB, pauseA, 'PAUSE: re-reading a held pose does not drift');
  eq(pauseC, pauseA, 'PAUSE: re-applying the same progress reproduces the pose');

  for (const p of [0.85, 0.10, 0.70, 0.35, 1.00, 0.00, 0.55]) {
    ctrl.apply(p);
    eq(skeletonSignature(skel.byName, skel.roots), play[p.toFixed(2)], `SEEK to ${p.toFixed(2)} matches the sequential sweep`);
  }

  ctrl.apply(0.9); ctrl.reset();
  eq(skeletonSignature(skel.byName, skel.roots), play['0.00'], 'RESET reproduces progress 0 exactly');

  let replayOk = true;
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS; ctrl.apply(p);
    if (skeletonSignature(skel.byName, skel.roots) !== play[p.toFixed(2)]) replayOk = false;
  }
  ok(replayOk, 'REPLAY: a second full sweep reproduces the first bit-for-bit');

  // the controller is a pure function of progress, independent of the skeleton it drives
  eq(JSON.stringify(poseFor(0.7, { side: 'R' })), JSON.stringify(poseFor(0.7, { side: 'R' })), 'poseFor is pure');

  section('human asset — scale, orientation and origin suit the scene');
  // Bind-pose bounds computed from the skinned mesh POSITION accessors' declared min/max.
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes) {
    for (const prim of mesh.primitives) {
      const acc = json.accessors[prim.attributes.POSITION];
      if (!acc || !acc.min || !acc.max) continue;
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], acc.min[i]); hi[i] = Math.max(hi[i], acc.max[i]); }
    }
  }
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
  ok(size[1] > 1.5 && size[1] < 2.1, `height ${size[1].toFixed(3)} is metre-scale adult (1.5-2.1 m)`);
  ok(size[1] > size[0] && size[1] > size[2], 'Y is the long axis — the model is Y-up, not Z-up');
  ok(Math.abs(lo[1]) < 0.05, `feet sit on the ground plane (min Y = ${lo[1].toFixed(4)})`);
  ok(Math.abs((lo[0] + hi[0]) / 2) < 0.15, 'roughly centred on X');

  section('human presentation — the exporter\'s blanket alphaMode:BLEND is corrected');
  // Every material really is exported as BLEND; this is the defect the presentation pass fixes.
  ok(json.materials.every((m) => m.alphaMode === 'BLEND'), 'confirmed: the GLB declares alphaMode BLEND on all 9 materials');
  const expect = {
    'Human.afro01.001': 'hair', 'Human.eyebrow001': 'brows', 'Human.eyelashes02': 'lashes',
    'Human.high-poly': 'eyes', 'Human.male_casualsuit06': 'cloth', 'Human.shoes06': 'shoes',
    'Human.teeth_base': 'teeth', 'Human.tongue01': 'tongue', 'Human.body': 'skin',
  };
  for (const [name, role] of Object.entries(expect)) eq(roleForMaterial(name), role, `${name} classified as ${role}`);
  eq(Object.keys(expect).length, json.materials.length, 'every material in the file is classified');
  for (const n of json.materials.map((m) => m.name)) ok(n in expect, `material ${n} has an expected role`);

  // hair / brows / lashes carry genuine cut-out alpha; the eye needs it to reveal the iris under
  // MakeHuman's transparent cornea shell
  for (const r of ['hair', 'brows', 'lashes', 'eyes']) {
    ok(CUTOUT_ROLES.includes(r), `${r} is alpha-tested, not alpha-blended`);
    ok(ALPHA_TEST[r] > 0 && ALPHA_TEST[r] < 1, `${r} alphaTest ${ALPHA_TEST[r]} is a usable threshold`);
  }
  ok(!CUTOUT_ROLES.includes('skin'), 'skin is fully opaque (its texture has no alpha channel)');
  ok(!CUTOUT_ROLES.includes('cloth'), 'clothing is fully opaque');
  ok(!CUTOUT_ROLES.includes('teeth'), 'teeth are opaque — the face must occlude them');
  ok(Object.keys(MATERIAL_ROLES).length >= 9, 'the role table covers every part of the figure');
}
