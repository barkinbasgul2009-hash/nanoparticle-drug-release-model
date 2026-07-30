// HUMAN ASSET QUALITY GATE — run this on any candidate GLB before accepting it as the final
// presentation human. Automates every machine-checkable item of the Phase-0 gate so the model can be
// accepted (or rejected) objectively, then tells you which checks still need a human eye.
//
//   node simulator/tools/verify-human-asset.mjs simulator/assets/human/human.glb
//
// Exit code 0 = all automated checks pass (visual review still required).
// Exit code 1 = at least one automated check failed.

import { inspectGlb, resolveBoneRoles } from './inspect-glb.mjs';
import { existsSync } from 'node:fs';

export const GATE = Object.freeze({
  minTriangles: 15000,     // below this the model reads as a low-poly mannequin
  maxTriangles: 400000,    // above this it is too heavy for a web presentation
  maxFileMB: 30,
  minBones: 25,
  minFingerBones: 10,
  requiredRoles: ['root', 'spine', 'head', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR'],
});

export function verifyHumanAsset(filePath) {
  const checks = [];
  const add = (id, pass, detail, fatal = true) => checks.push({ id, pass: !!pass, detail, fatal });

  if (!existsSync(filePath)) {
    return { file: filePath, ok: false, checks: [{ id: 'file_exists', pass: false, detail: 'file not found', fatal: true }], manualReview: [] };
  }

  let info;
  try { info = inspectGlb(filePath); }
  catch (e) { return { file: filePath, ok: false, checks: [{ id: 'parses', pass: false, detail: String(e.message || e), fatal: true }], manualReview: [] }; }

  const roles = resolveBoneRoles(info.boneNames);

  add('parses', true, `glTF ${info.gltfVersion}, generator ${info.generator || 'unknown'}`);
  add('self_contained', info.selfContained, info.selfContained ? 'no external refs (no runtime CDN dependency)' : `external refs: ${info.externalReferences.join(', ')}`);
  add('file_size', info.fileSizeMB <= GATE.maxFileMB, `${info.fileSizeMB} MB (limit ${GATE.maxFileMB} MB)`);
  add('has_geometry', info.triangles >= GATE.minTriangles, `${info.triangles.toLocaleString()} triangles (min ${GATE.minTriangles.toLocaleString()} — below this reads as a low-poly mannequin)`);
  add('not_too_heavy', info.triangles <= GATE.maxTriangles, `${info.triangles.toLocaleString()} triangles (max ${GATE.maxTriangles.toLocaleString()})`);
  add('has_textures', info.textures > 0, `${info.textures} textures / ${info.images} images (an untextured model cannot look believable)`);
  add('has_skeleton', info.skins > 0 && info.bones >= GATE.minBones, `${info.skins} skin(s), ${info.bones} bones (min ${GATE.minBones})`);
  add('required_bone_roles', GATE.requiredRoles.every((r) => roles.map[r]), roles.missing.length ? `missing roles: ${roles.missing.join(', ')}` : 'all required arm/torso roles resolve');
  add('finger_bones', roles.fingerBoneCount >= GATE.minFingerBones, `${roles.fingerBoneCount} finger bones (min ${GATE.minFingerBones} — the subject must rub cream onto the forearm)`, false);
  add('no_required_extensions', (info.extensionsRequired || []).length === 0 || info.extensionsRequired.every((e) => /draco|meshopt|texture_basisu/i.test(e)), `required extensions: ${(info.extensionsRequired || []).join(', ') || 'none'}`, false);
  add('no_duplicate_materials', info.duplicateMaterials.length === 0, info.duplicateMaterials.length ? `duplicates: ${info.duplicateMaterials.join(', ')}` : 'no duplicate material names', false);

  const fatalFails = checks.filter((c) => !c.pass && c.fatal);
  return {
    file: filePath,
    ok: fatalFails.length === 0,
    stats: { triangles: info.triangles, bones: info.bones, fingerBones: roles.fingerBoneCount, textures: info.textures, materials: info.materials, clips: info.clips.map((c) => c.name), fileSizeMB: info.fileSizeMB, morphTargets: info.morphTargets },
    boneRoles: roles.map,
    checks,
    manualReview: [
      'FACE: eyes present + correctly placed, natural eyelids, undistorted mouth, no broken teeth, no empty sockets',
      'FACE: no severe hair/eye/face clipping; no uncanny frozen expression; stable at close + medium range',
      'SKIN: not glossy/waxy/plastic under the studio environment',
      'HANDS: believable finger proportions; no fused or collapsed digits',
      'FOREARM: clean topology + even UVs in the cream-application region (bare skin, not covered by armour/sleeves)',
      'LICENCE: source, author, licence and redistribution rights recorded in simulator/assets/ASSET_LICENCES.json',
    ],
    previewCommand: 'cd simulator && python3 -m http.server 8080  ->  http://localhost:8080/human-preview.html?model=<filename>',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = process.argv[2];
  if (!f) { console.error('usage: node verify-human-asset.mjs <human.glb>'); process.exit(2); }
  const r = verifyHumanAsset(f);
  console.log(`\nHUMAN ASSET GATE — ${r.file}`);
  for (const c of r.checks) console.log(`  ${c.pass ? 'PASS' : (c.fatal ? 'FAIL' : 'WARN')}  ${c.id.padEnd(24)} ${c.detail}`);
  if (r.stats) console.log(`\n  stats: ${r.stats.triangles.toLocaleString()} tris · ${r.stats.bones} bones · ${r.stats.fingerBones} finger bones · ${r.stats.textures} textures · clips: ${r.stats.clips.join(', ') || 'none'}`);
  console.log(`\n  AUTOMATED RESULT: ${r.ok ? 'PASS — proceed to visual review' : 'FAIL — asset rejected'}`);
  console.log('\n  STILL REQUIRES A HUMAN EYE:');
  for (const m of r.manualReview) console.log(`    - ${m}`);
  console.log(`\n  preview: ${r.previewCommand}\n`);
  process.exit(r.ok ? 0 : 1);
}
