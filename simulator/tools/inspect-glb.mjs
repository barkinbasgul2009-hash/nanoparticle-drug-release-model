// Headless GLB inspector (Phase-0 completion patch). Parses the glTF JSON chunk of a .glb
// directly — no browser, no DOM, no three.js — so asset statistics can be produced and asserted
// in CI. Reports everything the asset quality gate needs.
//
//   node simulator/tools/inspect-glb.mjs <file.glb> [--json]

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const GLB_MAGIC = 0x46546c67;                 // 'glTF'
const CHUNK_JSON = 0x4e4f534a;                // 'JSON'
const CHUNK_BIN = 0x004e4942;                 // 'BIN'

/** Parse a .glb into { json, binLength, fileSize }. Throws on a malformed container. */
export function parseGlb(filePath) {
  const abs = resolve(filePath);
  const buf = readFileSync(abs);
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== GLB_MAGIC) throw new Error(`${abs}: not a GLB (bad magic)`);
  const version = dv.getUint32(4, true);
  let off = 12, json = null, binLength = 0;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(buf.subarray(start, start + len)));
    else if (type === CHUNK_BIN) binLength = len;
    off = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error(`${abs}: no JSON chunk`);
  return { json, binLength, version, fileSize: statSync(abs).size };
}

const MODES = { 0: 'POINTS', 1: 'LINES', 2: 'LINE_LOOP', 3: 'LINE_STRIP', 4: 'TRIANGLES', 5: 'TRIANGLE_STRIP', 6: 'TRIANGLE_FAN' };

/** Full statistics + quality-gate facts for one GLB. */
export function inspectGlb(filePath) {
  const { json: g, binLength, version, fileSize } = parseGlb(filePath);
  const acc = g.accessors || [], meshes = g.meshes || [], nodes = g.nodes || [];
  const materials = g.materials || [], images = g.images || [], textures = g.textures || [];
  const skins = g.skins || [], animations = g.animations || [];

  // triangles: prefer indices count, else position count; only TRIANGLES-mode primitives
  let triangles = 0, primitives = 0, morphTargets = 0;
  const modes = new Set();
  for (const m of meshes) for (const p of (m.primitives || [])) {
    primitives += 1;
    const mode = p.mode === undefined ? 4 : p.mode;
    modes.add(MODES[mode] || String(mode));
    const n = p.indices !== undefined ? (acc[p.indices] || {}).count : ((acc[(p.attributes || {}).POSITION] || {}).count || 0);
    if (mode === 4 && n) triangles += Math.floor(n / 3);
    if (p.targets) morphTargets = Math.max(morphTargets, p.targets.length);
  }

  // texture dimensions are not in the JSON chunk for embedded images; report what is declared
  const imageInfo = images.map((im, i) => ({ index: i, name: im.name || null, mimeType: im.mimeType || null, embedded: im.bufferView !== undefined, uri: im.uri || null }));

  // skeleton / bones
  const boneIdx = new Set();
  for (const s of skins) for (const j of (s.joints || [])) boneIdx.add(j);
  const boneNames = [...boneIdx].map((i) => (nodes[i] || {}).name).filter(Boolean);

  const skinnedMeshNodes = nodes.filter((n) => n.skin !== undefined).length;
  const clips = animations.map((a, i) => ({ index: i, name: a.name || `clip_${i}`, channels: (a.channels || []).length, samplers: (a.samplers || []).length }));

  // external references (must be none for a self-contained GLB)
  const externalRefs = [
    ...images.filter((im) => im.uri && !String(im.uri).startsWith('data:')).map((im) => im.uri),
    ...(g.buffers || []).filter((b) => b.uri && !String(b.uri).startsWith('data:')).map((b) => b.uri),
  ];

  // duplicate materials (same name)
  const matNames = materials.map((m) => m.name || '(unnamed)');
  const dupMaterials = matNames.filter((n, i) => matNames.indexOf(n) !== i && n !== '(unnamed)');

  return {
    file: filePath, fileSizeBytes: fileSize, fileSizeMB: +(fileSize / 1048576).toFixed(2), glbVersion: version, binChunkBytes: binLength,
    generator: (g.asset || {}).generator || null, gltfVersion: (g.asset || {}).version || null, copyright: (g.asset || {}).copyright || null,
    nodes: nodes.length, meshes: meshes.length, primitives, triangles, primitiveModes: [...modes],
    materials: materials.length, materialNames: matNames, duplicateMaterials: [...new Set(dupMaterials)],
    textures: textures.length, images: images.length, imageInfo,
    skins: skins.length, skinnedMeshNodes, bones: boneNames.length, boneNames,
    animations: animations.length, clips, morphTargets,
    extensionsUsed: g.extensionsUsed || [], extensionsRequired: g.extensionsRequired || [],
    externalReferences: externalRefs,
    selfContained: externalRefs.length === 0,
  };
}

/** Match the model's bones against the roles the topical-application animation needs. */
export function resolveBoneRoles(boneNames) {
  const need = {
    root: [/^hips$/i, /mixamorig:?Hips/i, /root/i],
    spine: [/^spine$/i, /mixamorig:?Spine$/i],
    chest: [/chest/i, /mixamorig:?Spine[12]/i],
    neck: [/^neck$/i, /mixamorig:?Neck/i],
    head: [/^head$/i, /mixamorig:?Head$/i],
    shoulderL: [/left.*shoulder/i, /mixamorig:?LeftShoulder/i],
    shoulderR: [/right.*shoulder/i, /mixamorig:?RightShoulder/i],
    upperArmL: [/left.*(upperarm|arm$)/i, /mixamorig:?LeftArm$/i],
    upperArmR: [/right.*(upperarm|arm$)/i, /mixamorig:?RightArm$/i],
    forearmL: [/left.*(forearm|lowerarm)/i, /mixamorig:?LeftForeArm/i],
    forearmR: [/right.*(forearm|lowerarm)/i, /mixamorig:?RightForeArm/i],
    handL: [/left.*hand$/i, /mixamorig:?LeftHand$/i],
    handR: [/right.*hand$/i, /mixamorig:?RightHand$/i],
  };
  const map = {}; const missing = [];
  for (const [role, pats] of Object.entries(need)) {
    const hit = boneNames.find((b) => pats.some((p) => p.test(b)));
    if (hit) map[role] = hit; else missing.push(role);
  }
  const fingers = boneNames.filter((b) => /(thumb|index|middle|ring|pinky|finger)/i.test(b));
  return { map, missing, fingerBones: fingers, fingerBoneCount: fingers.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node inspect-glb.mjs <file.glb> [--json]'); process.exit(2); }
  const info = inspectGlb(file);
  const roles = resolveBoneRoles(info.boneNames);
  if (process.argv.includes('--json')) { console.log(JSON.stringify({ ...info, boneRoles: roles }, null, 2)); process.exit(0); }
  console.log(`\n${info.file}`);
  console.log(`  size ${info.fileSizeMB} MB · glTF ${info.gltfVersion} · generator: ${info.generator}`);
  console.log(`  nodes ${info.nodes} · meshes ${info.meshes} · primitives ${info.primitives} · TRIANGLES ${info.triangles.toLocaleString()}`);
  console.log(`  materials ${info.materials} ${info.duplicateMaterials.length ? '(dupes: ' + info.duplicateMaterials.join(',') + ')' : ''} · textures ${info.textures} · images ${info.images}`);
  console.log(`  skins ${info.skins} · skinnedMeshNodes ${info.skinnedMeshNodes} · bones ${info.bones} · morphTargets ${info.morphTargets}`);
  console.log(`  animations ${info.animations}: ${info.clips.map((c) => c.name).join(', ') || '(none)'}`);
  console.log(`  extensions used: ${info.extensionsUsed.join(', ') || '(none)'} · required: ${info.extensionsRequired.join(', ') || '(none)'}`);
  console.log(`  self-contained: ${info.selfContained ? 'YES' : 'NO -> ' + info.externalReferences.join(', ')}`);
  console.log(`  bone roles resolved: ${Object.keys(roles.map).length}/13  missing: ${roles.missing.join(', ') || 'none'}`);
  console.log(`  finger bones: ${roles.fingerBoneCount}`);
  console.log('');
}
