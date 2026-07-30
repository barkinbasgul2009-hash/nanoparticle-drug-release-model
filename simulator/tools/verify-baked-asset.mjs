// PHASE 2B GENERATED-ASSET GATE — validates human_application_baked.glb against its manifest and
// against the immutable original it was built from (ss21).
//
//   node simulator/tools/verify-baked-asset.mjs [baked.glb] [manifest.json] [original.glb]
//
// Exit code 0 = every check passed. Exit code 1 = at least one fatal check failed.
//
// This deliberately reads the GLB's own JSON chunk rather than trusting the build report: the build
// report says what the build INTENDED, and the point of this gate is to confirm what it actually
// produced. The skeleton is compared bone-for-bone against the original so a renamed, removed or
// re-parented bone is caught here rather than as a mystery in the browser.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inspectGlb, resolveBoneRoles } from './inspect-glb.mjs';
import { validateManifest, validateAgainstAsset, REQUIRED_MORPH_SEMANTICS } from '../src/three/applicationManifest.js';

const DEFAULTS = {
  baked: 'simulator/assets/human/human_application_baked.glb',
  manifest: 'simulator/assets/human/human_application_manifest.json',
  original: 'simulator/assets/human/human.glb',
};

/** Helper-object name patterns that must never reach the runtime asset (ss20). */
export const FORBIDDEN_NODE_PATTERNS = [
  /^CTRL_/i, /^LIGHT_/i, /^PREVIEW/i, /^Icosphere$/i, /_pole$/i, /^IK_/i, /^GUIDE_/i, /^Camera/i,
];

function readGlbJson(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`);
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** node index -> parent index, so hierarchy can be compared without three.js. */
function parentMap(gltf) {
  const parents = new Map();
  (gltf.nodes || []).forEach((n, i) => {
    for (const c of (n.children || [])) parents.set(c, i);
    if (!parents.has(i)) parents.set(i, parents.get(i) ?? null);
  });
  return parents;
}

/**
 * bone name -> parent BONE name (null at the root of the chain).
 *
 * A joint's parent is only recorded when the parent is itself a joint. The armature's own container
 * node is renamed at build time so three.js does not rewrite it, and that rename is not a skeleton
 * change — comparing against it would report a false hierarchy break on every build.
 */
function boneHierarchy(gltf) {
  const nodes = gltf.nodes || [];
  const parents = parentMap(gltf);
  const boneIndices = new Set();
  for (const skin of (gltf.skins || [])) for (const j of (skin.joints || [])) boneIndices.add(j);
  const out = new Map();
  for (const i of boneIndices) {
    const p = parents.get(i);
    const parentIsBone = p !== undefined && p !== null && boneIndices.has(p);
    out.set(nodes[i].name, parentIsBone ? nodes[p].name : null);
  }
  return out;
}

export function verifyBakedAsset(paths = {}) {
  const baked = paths.baked || DEFAULTS.baked;
  const manifestPath = paths.manifest || DEFAULTS.manifest;
  const original = paths.original || DEFAULTS.original;

  const checks = [];
  const add = (id, pass, detail, fatal = true) => checks.push({ id, pass: !!pass, detail, fatal });

  for (const [label, file] of [['baked_glb_exists', baked], ['manifest_exists', manifestPath],
    ['original_exists', original]]) {
    if (!existsSync(file)) {
      add(label, false, `missing: ${file}`);
      return { ok: false, checks };
    }
    add(label, true, file);
  }

  // ---- manifest, on its own terms -------------------------------------------------------------
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
  catch (e) { add('manifest_parses', false, String(e.message || e)); return { ok: false, checks }; }
  add('manifest_parses', true, `schemaVersion ${manifest.schemaVersion}, assetVersion ${manifest.assetVersion}`);

  const mv = validateManifest(manifest);
  add('manifest_valid', mv.ok, mv.ok ? 'all manifest rules pass'
    : `${mv.errors.length} error(s): ${mv.errors.slice(0, 6).join(' | ')}`);
  for (const w of mv.warnings) add(`manifest_warning`, true, w, false);

  // ---- the original must be untouched ----------------------------------------------------------
  const originalHash = sha256(original);
  add('original_checksum_unchanged', originalHash === manifest.source.originalAssetChecksum,
    originalHash === manifest.source.originalAssetChecksum
      ? `sha256 ${originalHash.slice(0, 16)}… matches the manifest`
      : `sha256 ${originalHash} does NOT match the manifest's ${manifest.source.originalAssetChecksum}`);

  // ---- the generated GLB, read back independently ----------------------------------------------
  let info; let gltf;
  try { info = inspectGlb(baked); gltf = readGlbJson(baked); }
  catch (e) { add('baked_parses', false, String(e.message || e)); return { ok: false, checks }; }
  add('baked_parses', true, `glTF ${info.gltfVersion}, ${info.fileSizeMB} MB, generator ${info.generator}`);
  add('self_contained', info.selfContained, info.selfContained
    ? 'no remote or missing local dependency' : `external refs: ${info.externalReferences.join(', ')}`);
  add('textures_embedded', info.images > 0 && info.images === (gltf.images || []).filter((i) => i.bufferView !== undefined).length,
    `${info.images} image(s), all in the binary chunk`);

  // ---- skeleton compared against the original ---------------------------------------------------
  const originalGltf = readGlbJson(original);
  const originalBones = boneHierarchy(originalGltf);
  const bakedBones = boneHierarchy(gltf);
  const missing = [...originalBones.keys()].filter((b) => !bakedBones.has(b));
  const added = [...bakedBones.keys()].filter((b) => !originalBones.has(b));
  const reparented = [...originalBones.keys()]
    .filter((b) => bakedBones.has(b) && bakedBones.get(b) !== originalBones.get(b))
    .map((b) => `${b}: ${originalBones.get(b)} -> ${bakedBones.get(b)}`);
  add('skeleton_bone_count', bakedBones.size === originalBones.size,
    `${bakedBones.size} bones (original ${originalBones.size})`);
  add('skeleton_no_removed_bones', missing.length === 0, missing.length ? `removed: ${missing.join(', ')}` : 'none removed');
  add('skeleton_no_renamed_bones', added.length === 0, added.length ? `unexpected: ${added.join(', ')}` : 'no unexpected bones');
  add('skeleton_hierarchy_unchanged', reparented.length === 0,
    reparented.length ? reparented.join(' | ') : 'every bone keeps its parent');
  const roles = resolveBoneRoles(info.boneNames);
  add('bone_roles_resolve', roles.missing.length === 0,
    roles.missing.length ? `missing roles: ${roles.missing.join(', ')}` : `${Object.keys(roles.map).length} roles resolve`);
  add('finger_chains_present', roles.fingerBoneCount >= 10, `${roles.fingerBoneCount} finger bones`);
  add('skinning_present', info.skins > 0 && info.skinnedMeshNodes > 0,
    `${info.skins} skin(s) over ${info.skinnedMeshNodes} skinned mesh node(s)`);

  // ---- animation --------------------------------------------------------------------------------
  const clipNames = info.clips.map((c) => c.name);
  add('clip_present', clipNames.includes(manifest.clip.name),
    `clips: ${clipNames.join(', ') || 'none'} (manifest wants "${manifest.clip.name}")`);
  const clip = info.clips.find((c) => c.name === manifest.clip.name);
  if (clip && Number.isFinite(clip.duration)) {
    add('clip_duration_matches', Math.abs(clip.duration - manifest.clip.durationSeconds) <= 0.05,
      `${clip.duration.toFixed(3)}s vs manifest ${manifest.clip.durationSeconds}s`);
  }
  add('single_clip', info.animations === 1, `${info.animations} animation(s) — one self-contained clip is required`);

  // animation channels must target real nodes and carry finite values
  const nodeCount = (gltf.nodes || []).length;
  let badTargets = 0; let channels = 0;
  for (const anim of (gltf.animations || [])) {
    for (const ch of (anim.channels || [])) {
      channels += 1;
      const t = ch.target || {};
      if (!(Number.isInteger(t.node) && t.node >= 0 && t.node < nodeCount)) badTargets += 1;
    }
  }
  add('animation_targets_valid', badTargets === 0, `${channels} channels, ${badTargets} bad target(s)`);
  const finite = checkAccessorsFinite(baked, gltf);
  add('animation_values_finite', finite.ok,
    finite.ok ? `${finite.checked} sampler accessors are finite`
      : `${finite.bad} non-finite value(s) in ${finite.badAccessors.join(', ')}`);
  add('quaternions_normalised', finite.badQuats === 0,
    finite.badQuats === 0 ? 'all rotation samples are unit quaternions' : `${finite.badQuats} non-unit quaternion(s)`);
  add('morph_weights_in_range', finite.badWeights === 0,
    finite.badWeights === 0 ? 'all morph weights are within 0..1' : `${finite.badWeights} out-of-range weight(s)`);

  // ---- object + morph resolution against the manifest ---------------------------------------------
  const nodeNames = new Set((gltf.nodes || []).map((n) => n.name).filter(Boolean));
  const morphDicts = {};
  (gltf.nodes || []).forEach((n) => {
    if (n.mesh === undefined) return;
    const mesh = gltf.meshes[n.mesh];
    const names = (mesh.extras && mesh.extras.targetNames) || [];
    if (!names.length) return;
    const dict = Object.fromEntries(names.map((t, i) => [t, i]));
    morphDicts[n.name] = Object.assign(morphDicts[n.name] || {}, dict);
    // multi-primitive meshes load as a Group in three; index under the node name either way
    morphDicts[mesh.name] = Object.assign(morphDicts[mesh.name] || {}, dict);
  });
  const av = validateAgainstAsset(manifest, {
    objectNames: nodeNames, morphDictionaries: morphDicts, clipNames,
    clipDuration: clip ? clip.duration : undefined,
  });
  add('manifest_matches_asset', av.ok, av.ok
    ? `${REQUIRED_MORPH_SEMANTICS.length} morph semantics and every named object resolve`
    : av.errors.slice(0, 6).join(' | '));

  // ---- no helper leakage --------------------------------------------------------------------------
  const leaked = [...nodeNames].filter((n) => FORBIDDEN_NODE_PATTERNS.some((re) => re.test(n)));
  add('no_helper_objects_exported', leaked.length === 0,
    leaked.length ? `leaked: ${leaked.join(', ')}` : 'no control rig, light, camera or scratch object in the asset');
  add('no_preview_camera', (gltf.cameras || []).length === 0, `${(gltf.cameras || []).length} camera(s)`);
  add('no_lights', !(gltf.extensions && gltf.extensions.KHR_lights_punctual), 'no punctual lights exported');

  // ---- scale / orientation / bounds ----------------------------------------------------------------
  const figure = positionBounds(gltf, (n) => /^Human/i.test(n.name || ''));
  const bounds = positionBounds(gltf);
  add('scale_is_metres', figure.height > 1.4 && figure.height < 2.2,
    `figure height ${figure.height.toFixed(3)} m (expected 1.4–2.2)`);
  add('orientation_y_up', figure.height >= figure.depth && figure.height >= figure.width,
    `figure bbox ${figure.width.toFixed(2)} x ${figure.height.toFixed(2)} x ${figure.depth.toFixed(2)} m — tallest axis is Y`);
  add('origin_at_feet', Math.abs(figure.min[1]) < 0.12, `figure bbox min Y = ${figure.min[1].toFixed(3)} m`);
  add('bounding_box_plausible', bounds.width < 3 && bounds.depth < 3 && bounds.height < 3,
    `whole-scene bbox ${bounds.width.toFixed(2)} x ${bounds.height.toFixed(2)} x ${bounds.depth.toFixed(2)} m`);

  // ---- statistics agree with the file ---------------------------------------------------------------
  const st = manifest.statistics;
  add('statistics_file_size', st.fileSizeBytes === statSync(baked).size,
    `manifest ${st.fileSizeBytes} vs actual ${statSync(baked).size}`, false);
  add('statistics_triangles', Math.abs(st.triangleCount - info.triangles) <= 2,
    `manifest ${st.triangleCount} vs actual ${info.triangles}`, false);

  const fatalFails = checks.filter((c) => !c.pass && c.fatal);
  return {
    ok: fatalFails.length === 0,
    baked, manifest: manifestPath, original,
    stats: {
      triangles: info.triangles, meshes: info.meshes, materials: info.materials,
      textures: info.textures, bones: info.bones, morphTargets: info.morphTargets,
      animations: info.animations, fileSizeMB: info.fileSizeMB, channels,
    },
    checks,
  };
}

/** Walk every animation sampler accessor and confirm the samples are usable. */
function checkAccessorsFinite(file, gltf) {
  const buf = readFileSync(file);
  const jsonLength = buf.readUInt32LE(12);
  let offset = 20 + jsonLength;
  // the BIN chunk header follows the JSON chunk (length + type)
  const binLength = buf.readUInt32LE(offset);
  const bin = buf.subarray(offset + 8, offset + 8 + binLength);
  const views = gltf.bufferViews || [];
  const accessors = gltf.accessors || [];
  const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

  const read = (accessorIndex) => {
    const a = accessors[accessorIndex];
    if (!a || a.componentType !== 5126 || a.bufferView === undefined) return null;  // FLOAT only
    const v = views[a.bufferView];
    const start = (v.byteOffset || 0) + (a.byteOffset || 0);
    const n = a.count * (COMPONENTS[a.type] || 1);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i += 1) out[i] = bin.readFloatLE(start + i * 4);
    return { values: out, type: a.type, count: a.count };
  };

  let bad = 0; let checked = 0; let badQuats = 0; let badWeights = 0;
  const badAccessors = [];
  for (const anim of (gltf.animations || [])) {
    for (const ch of (anim.channels || [])) {
      const sampler = (anim.samplers || [])[ch.sampler];
      if (!sampler) continue;
      for (const idx of [sampler.input, sampler.output]) {
        const data = read(idx);
        if (!data) continue;
        checked += 1;
        let localBad = 0;
        for (const value of data.values) if (!Number.isFinite(value)) localBad += 1;
        if (localBad) { bad += localBad; badAccessors.push(String(idx)); }
      }
      const out = read(sampler.output);
      if (!out) continue;
      const path = (ch.target || {}).path;
      if (path === 'rotation' && out.type === 'VEC4') {
        for (let i = 0; i < out.count; i += 1) {
          const x = out.values[i * 4], y = out.values[i * 4 + 1];
          const z = out.values[i * 4 + 2], w = out.values[i * 4 + 3];
          if (Math.abs(Math.hypot(x, y, z, w) - 1) > 1e-3) badQuats += 1;
        }
      }
      if (path === 'weights') {
        for (const value of out.values) if (!(value >= -0.001 && value <= 1.001)) badWeights += 1;
      }
    }
  }
  return { ok: bad === 0, bad, checked, badAccessors: [...new Set(badAccessors)], badQuats, badWeights };
}

/**
 * World-space bounding box from POSITION accessor min/max, with node transforms applied.
 *
 * Reading the accessor extents straight out of the file mixes local spaces: the tray stand's mesh is
 * modelled centred on its own origin, so an untransformed union put the figure's "feet" 460 mm
 * underground and its height at 2.22 m. `filter` narrows the box to the nodes that matter, which is
 * how the scale and origin checks stay about the FIGURE.
 */
function positionBounds(gltf, filter = null) {
  const nodes = gltf.nodes || [];
  const parents = parentMap(gltf);
  const worldOf = (index) => {
    // compose local TRS up the parent chain; glTF nodes are TRS or a raw matrix
    const chain = [];
    for (let i = index; i !== null && i !== undefined; i = parents.get(i)) {
      chain.unshift(i);
      if (parents.get(i) === i) break;
    }
    let m = identity();
    for (const i of chain) m = multiply(m, localMatrix(nodes[i]));
    return m;
  };

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  nodes.forEach((node, index) => {
    if (node.mesh === undefined) return;
    if (filter && !filter(node)) return;
    const world = worldOf(index);
    for (const prim of ((gltf.meshes[node.mesh] || {}).primitives || [])) {
      const a = (gltf.accessors || [])[(prim.attributes || {}).POSITION];
      if (!a || !a.min || !a.max) continue;
      for (let cx = 0; cx < 2; cx += 1) {
        for (let cy = 0; cy < 2; cy += 1) {
          for (let cz = 0; cz < 2; cz += 1) {
            const p = transform(world, [cx ? a.max[0] : a.min[0], cy ? a.max[1] : a.min[1], cz ? a.max[2] : a.min[2]]);
            for (let i = 0; i < 3; i += 1) {
              min[i] = Math.min(min[i], p[i]);
              max[i] = Math.max(max[i], p[i]);
            }
          }
        }
      }
    }
  });
  return {
    min, max,
    width: max[0] - min[0], height: max[1] - min[1], depth: max[2] - min[2],
  };
}

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function localMatrix(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale || [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

/** column-major 4x4 multiply, glTF/three convention */
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

function transform(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [baked, manifest, original] = process.argv.slice(2);
  const r = verifyBakedAsset({ baked, manifest, original });
  const pad = (s) => String(s).padEnd(30);
  console.log(`PHASE 2B GENERATED-ASSET GATE — ${r.baked}`);
  for (const c of r.checks) {
    const tag = c.pass ? 'PASS' : (c.fatal ? 'FAIL' : 'WARN');
    console.log(`  ${tag}  ${pad(c.id)} ${c.detail}`);
  }
  if (r.stats) {
    console.log(`\n  stats: ${r.stats.triangles.toLocaleString()} tris · ${r.stats.meshes} meshes · `
      + `${r.stats.materials} materials · ${r.stats.textures} textures · ${r.stats.bones} bones · `
      + `${r.stats.morphTargets} morph slots · ${r.stats.animations} clip · ${r.stats.channels} channels · `
      + `${r.stats.fileSizeMB} MB`);
  }
  console.log(`\n  RESULT: ${r.ok ? 'PASS' : 'FAIL'}`);
  process.exit(r.ok ? 0 : 1);
}
