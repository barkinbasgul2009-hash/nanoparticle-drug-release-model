// Phase-2 CREAM LAYER — the visible product on the forearm.
//
// APPROACH: rather than painting into the body's shared 2048² skin texture (which would need the
// MakeHuman UV atlas and would fight the diffuse map), the cream is a thin SKINNED OVERLAY PATCH
// cut from the body mesh itself: every triangle whose vertices are weighted to the treated forearm
// bone, copied into its own geometry, nudged ~1.8 mm along the surface normal and bound to the SAME
// skeleton. Consequences that matter:
//   * it deforms exactly with the arm for free — no projection, no decal re-fitting per frame;
//   * it can never slide off the arm, because it IS the arm's surface;
//   * coverage is driven entirely by uniforms, so a given progress always paints the same pixels.
//
// Coverage is expressed in a forearm-local coordinate baked into the geometry at build time:
//   aAxial : 0 at the elbow .. 1 at the wrist
//   aUp    : -1 underside .. +1 upper/outer surface (cream sits on top, as applied)
// Both are pure functions of the BIND pose, so they are stable across every frame and replay.

import * as THREE from '../../vendor/three/three.module.js';

export const CREAM_DEFAULTS = Object.freeze({
  weightThreshold: 0.35,   // min forearm-bone weight for a vertex to join the patch
  surfaceOffset: 0.0018,   // metres along the normal — clears z-fighting without floating
  colour: 0xf8f7f5,        // off-white, a touch cooler than skin so it separates on a pale forearm
  baseRoughness: 0.55,
  wetRoughness: 0.16,
});

/** Sum the skin weights a vertex assigns to one bone index. */
function weightForBone(skinIndex, skinWeight, vertex, boneIndex) {
  let w = 0;
  for (let k = 0; k < 4; k++) {
    if (skinIndex.getComponent(vertex, k) === boneIndex) w += skinWeight.getComponent(vertex, k);
  }
  return w;
}

/**
 * Bind-pose world matrix of a bone, recovered from the skeleton's inverse-bind matrices.
 * (Reading bone.matrixWorld would give the CURRENT pose, which changes every frame; the patch's
 * coordinates must be measured once, in bind pose, or the cream would swim across the arm.)
 */
export function bindMatrixOf(skeleton, boneIndex) {
  const inv = skeleton.boneInverses[boneIndex];
  return inv ? inv.clone().invert() : new THREE.Matrix4();
}

/**
 * Build the cream patch.
 *
 * @param {THREE.SkinnedMesh} bodyMesh   the skin mesh to cut the patch from
 * @param {{forearm:string, hand:string}} boneNames  treated-side forearm + hand bone names
 * @param {object} [opts]
 * @returns {{ mesh:THREE.SkinnedMesh|null, material:THREE.Material|null, uniforms:object|null,
 *             stats:object, setState:(s:object)=>void, dispose:()=>void }}
 */
export function buildCreamLayer(bodyMesh, boneNames, opts = {}) {
  const cfg = { ...CREAM_DEFAULTS, ...opts };
  const empty = {
    mesh: null, material: null, uniforms: null,
    stats: { built: false, reason: 'not built', triangles: 0, vertices: 0 },
    setState: () => {}, dispose: () => {},
  };
  if (!bodyMesh || !bodyMesh.isSkinnedMesh || !bodyMesh.skeleton) {
    return { ...empty, stats: { ...empty.stats, reason: 'no skinned body mesh' } };
  }

  const skeleton = bodyMesh.skeleton;
  const fIdx = skeleton.bones.findIndex((b) => b.name === boneNames.forearm);
  const hIdx = skeleton.bones.findIndex((b) => b.name === boneNames.hand);
  if (fIdx < 0) return { ...empty, stats: { ...empty.stats, reason: `forearm bone ${boneNames.forearm} not in skeleton` } };

  const src = bodyMesh.geometry;
  const pos = src.attributes.position, nrm = src.attributes.normal;
  const uv = src.attributes.uv, si = src.attributes.skinIndex, sw = src.attributes.skinWeight;
  if (!pos || !si || !sw) return { ...empty, stats: { ...empty.stats, reason: 'body geometry lacks skinning attributes' } };

  // ---- forearm-local frame, measured in BIND pose ----
  const mF = bindMatrixOf(skeleton, fIdx);
  const elbow = new THREE.Vector3().setFromMatrixPosition(mF);
  const wrist = hIdx >= 0
    ? new THREE.Vector3().setFromMatrixPosition(bindMatrixOf(skeleton, hIdx))
    : elbow.clone().add(new THREE.Vector3(0, -0.25, 0));
  const axis = wrist.clone().sub(elbow);
  const armLength = axis.length() || 1;
  axis.normalize();
  // "up" on the forearm = world up with the along-arm component removed
  const upRef = new THREE.Vector3(0, 1, 0);
  const up = upRef.clone().addScaledVector(axis, -upRef.dot(axis));
  if (up.lengthSq() < 1e-8) up.set(0, 0, 1);
  up.normalize();

  // ---- select vertices belonging to the forearm ----
  const count = pos.count;
  const keep = new Uint8Array(count);
  for (let v = 0; v < count; v++) if (weightForBone(si, sw, v, fIdx) >= cfg.weightThreshold) keep[v] = 1;

  const index = src.index;
  const triCount = index ? index.count / 3 : count / 3;
  const remap = new Int32Array(count).fill(-1);
  const outIdx = [];
  let next = 0;
  const tri = [0, 0, 0];
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) tri[k] = index ? index.getX(t * 3 + k) : t * 3 + k;
    if (!(keep[tri[0]] && keep[tri[1]] && keep[tri[2]])) continue;   // whole triangle on the forearm
    for (let k = 0; k < 3; k++) {
      if (remap[tri[k]] < 0) { remap[tri[k]] = next++; }
      outIdx.push(remap[tri[k]]);
    }
  }
  if (outIdx.length === 0) {
    return { ...empty, stats: { ...empty.stats, reason: 'no triangles matched the forearm bone' } };
  }

  // ---- pack the patch geometry ----
  const n = next;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), UV = new Float32Array(n * 2);
  const SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  const AX = new Float32Array(n), UPA = new Float32Array(n);
  const p = new THREE.Vector3(), nv = new THREE.Vector3(), rel = new THREE.Vector3();
  // mean distance from the bone centreline = the forearm's radius. The contact solver needs it to
  // put the palm ON the skin rather than on the bone axis.
  let radialSum = 0;

  for (let v = 0; v < count; v++) {
    const o = remap[v];
    if (o < 0) continue;
    p.fromBufferAttribute(pos, v);
    if (nrm) nv.fromBufferAttribute(nrm, v); else nv.set(0, 1, 0);

    // forearm-local coordinates (bind pose)
    rel.copy(p).sub(elbow);
    AX[o] = Math.max(0, Math.min(1, rel.dot(axis) / armLength));
    const radial = rel.clone().addScaledVector(axis, -rel.dot(axis));
    const r = radial.length();
    radialSum += r;
    UPA[o] = r > 1e-5 ? radial.divideScalar(r).dot(up) : 0;

    // lift off the skin along the normal so the patch never z-fights
    P[o * 3] = p.x + nv.x * cfg.surfaceOffset;
    P[o * 3 + 1] = p.y + nv.y * cfg.surfaceOffset;
    P[o * 3 + 2] = p.z + nv.z * cfg.surfaceOffset;
    N[o * 3] = nv.x; N[o * 3 + 1] = nv.y; N[o * 3 + 2] = nv.z;
    if (uv) { UV[o * 2] = uv.getX(v); UV[o * 2 + 1] = uv.getY(v); }
    for (let k = 0; k < 4; k++) {
      SI[o * 4 + k] = si.getComponent(v, k);
      SW[o * 4 + k] = sw.getComponent(v, k);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  geo.setAttribute('aAxial', new THREE.BufferAttribute(AX, 1));
  geo.setAttribute('aUp', new THREE.BufferAttribute(UPA, 1));
  geo.setIndex(outIdx);

  // ---- material: standard PBR plus a coverage mask driven entirely by uniforms ----
  const uniforms = {
    uCoverage: { value: 0 },
    uDeposit: { value: 0.5 },
    uOpacity: { value: 0 },
    uGloss: { value: 0 },
  };

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cfg.colour),
    roughness: cfg.baseRoughness,
    metalness: 0.0,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.name = 'CreamLayer';

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = `attribute float aAxial;\nattribute float aUp;\nvarying float vAxial;\nvarying float vUp;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAxial = aAxial;\n  vUp = aUp;');

    shader.fragmentShader = `uniform float uCoverage;\nuniform float uDeposit;\nuniform float uOpacity;\nuniform float uGloss;\nvarying float vAxial;\nvarying float vUp;\n${shader.fragmentShader}`
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec4 diffuseColor = vec4( diffuse, opacity );
        // distance from the deposit point, along the arm
        float d = abs( vAxial - uDeposit );
        float edge = 0.05 + 0.06 * uCoverage;
        float band = 1.0 - smoothstep( uCoverage - edge, uCoverage + edge, d );
        // break the edge up so it reads as smeared by a hand, not masked by a machine
        float wob = sin( vAxial * 61.0 ) * 0.5 + sin( vAxial * 27.0 + vUp * 11.0 ) * 0.5;
        band *= 0.82 + 0.18 * wob;
        // product sits on the upper/outer surface and thins around the sides
        float facing = smoothstep( -0.30, 0.60, vUp );
        float m = clamp( band * facing, 0.0, 1.0 );
        diffuseColor.a *= m * uOpacity;
        if ( diffuseColor.a < 0.012 ) discard;`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix( ${cfg.baseRoughness.toFixed(3)}, ${cfg.wetRoughness.toFixed(3)}, uGloss );`
      );
  };

  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.name = 'cream_layer';
  mesh.bind(skeleton, bodyMesh.bindMatrix);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  if (bodyMesh.parent) bodyMesh.parent.add(mesh); else mesh.applyMatrix4(bodyMesh.matrixWorld);

  return {
    mesh,
    material,
    uniforms,
    stats: {
      built: true,
      reason: 'ok',
      vertices: n,
      triangles: outIdx.length / 3,
      forearmBone: boneNames.forearm,
      armLength,
      meanRadius: radialSum / n,
      axialRange: [Math.min(...AX), Math.max(...AX)],
    },
    /** Drive the layer from a choreography cream state. Pure: same state -> same pixels. */
    setState(s) {
      if (!s) return;
      uniforms.uCoverage.value = Number.isFinite(s.coverage) ? s.coverage : 0;
      uniforms.uDeposit.value = Number.isFinite(s.depositAxial) ? s.depositAxial : 0.5;
      uniforms.uOpacity.value = Number.isFinite(s.opacity) ? s.opacity : 0;
      uniforms.uGloss.value = Number.isFinite(s.gloss) ? s.gloss : 0;
      mesh.visible = !!s.present && uniforms.uOpacity.value > 0.001;
    },
    dispose() {
      if (mesh.parent) mesh.parent.remove(mesh);
      geo.dispose();
      material.dispose();
    },
  };
}

export default buildCreamLayer;
