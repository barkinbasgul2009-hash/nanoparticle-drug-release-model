// Phase-2 PRODUCT — the NANODERM topical cream tube and carton.
//
// Built procedurally (lathe/cylinder/box primitives + canvas label textures) rather than shipped as
// an asset: it stays in the repo's zero-dependency, no-binary-asset pattern, it needs no licence
// clearance, and the label text can be regenerated from data instead of being baked into a PNG.
//
// NAMING. The repository has a canonical ACTIVE INGREDIENT for Profile B —
// `data/profile-portfolio.json` -> B_celastrol_nlc_skin -> api: "celastrol (tripterine)",
// carrier "nanostructured lipid carrier (NLC)", route "topical". It has no brand name. So the brief's
// NANODERM is used as the product/brand name and the repository's real API is carried underneath it,
// which keeps the prop consistent with the science the rest of the simulator models.
//
// This is a fictional product for visualisation. It is not a real medicine and deliberately does not
// imitate any real brand's trade dress.

import * as THREE from '../../vendor/three/three.module.js';

export const PRODUCT = Object.freeze({
  brand: 'NANODERM',
  api: 'CELASTROL (TRIPTERINE) NLC',
  form: 'Topical Cream',
  strength: '0.05% w/w',
  netContent: '30 g',
  route: 'For External Use Only',
  classification: 'Rx',
  footer: 'Dermal Application · Nanostructured Lipid Carrier',
});

/** Dimensions in metres — a real 30 g pharmacy tube is ~135 mm tall, ~40 mm across the crimp. */
export const TUBE = Object.freeze({
  bodyRadius: 0.0150,     // 30 mm across the barrel — a 30 g pharmacy tube, not a bottle
  bodyLength: 0.0780,
  shoulderLength: 0.0190,
  neckRadius: 0.0060,
  neckLength: 0.0085,
  capRadius: 0.0092,
  capLength: 0.0225,
  crimpWidth: 0.0320,
  crimpHeight: 0.0065,
});

export const COLOURS = Object.freeze({
  tubeBody: 0xf7f9fa,
  cap: 0x11655f,        // clinical teal — reads medical, not cosmetic
  accent: '#11655f',
  ink: '#12202a',
  muted: '#5b6b78',
  card: '#ffffff',
});

/**
 * Draw the wrap-around tube label. Canvas UVs on a CylinderGeometry run u around the barrel and
 * v along its height, so the artwork is laid out landscape and the brand sits in the middle third
 * (the part facing camera in the product shots).
 */
export function makeTubeLabel(width = 1024, height = 512) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');

  g.fillStyle = COLOURS.card; g.fillRect(0, 0, width, height);

  // teal shoulder band
  g.fillStyle = COLOURS.accent;
  g.fillRect(0, 0, width, height * 0.14);
  // thin rule near the crimp
  g.fillRect(0, height * 0.88, width, height * 0.045);

  const cx = width * 0.5;
  g.textAlign = 'center';

  // Rx badge
  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(height * 0.085)}px Georgia, 'Times New Roman', serif`;
  g.fillText(PRODUCT.classification, width * 0.09, height * 0.105);

  // BRAND. The canvas wraps a full 360 deg, so only about a third of it is ever visible from one
  // viewpoint. Everything is sized to fit inside roughly the front 120 deg (~34% of the width) —
  // laid out any larger and "NANODERM" curves away at both ends and reads as "ANODER".
  const FRONT = width * 0.34;
  const fit = (text, px, weight = 'bold', spacing = '0px') => {
    let size = px;
    g.letterSpacing = spacing;
    for (let i = 0; i < 24; i++) {
      g.font = `${weight} ${Math.round(size)}px Helvetica, Arial, sans-serif`;
      if (g.measureText(text).width <= FRONT) break;
      size *= 0.94;
    }
  };

  g.fillStyle = COLOURS.ink;
  fit(PRODUCT.brand, height * 0.135, 'bold', '1px');
  g.fillText(PRODUCT.brand, cx, height * 0.40);
  g.letterSpacing = '0px';

  // active ingredient
  g.fillStyle = COLOURS.accent;
  fit(PRODUCT.api, height * 0.050);
  g.fillText(PRODUCT.api, cx, height * 0.49);

  // form + strength
  g.fillStyle = COLOURS.muted;
  fit(`${PRODUCT.form}   ${PRODUCT.strength}`, height * 0.045, 'normal');
  g.fillText(`${PRODUCT.form}   ${PRODUCT.strength}`, cx, height * 0.575);

  g.strokeStyle = '#c9d4dc'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - FRONT * 0.42, height * 0.635); g.lineTo(cx + FRONT * 0.42, height * 0.635); g.stroke();

  g.fillStyle = COLOURS.ink;
  fit(PRODUCT.route, height * 0.042);
  g.fillText(PRODUCT.route, cx, height * 0.71);

  g.fillStyle = COLOURS.muted;
  fit(PRODUCT.netContent, height * 0.055);
  g.fillText(PRODUCT.netContent, cx, height * 0.80);
  g.letterSpacing = '0px';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // three's CylinderGeometry maps u=0 to +Z and u=0.5 to -Z. The brand is drawn centred at u=0.5,
  // so without this half-shift it wraps to the BACK of the tube and the front shows only the band.
  tex.wrapS = THREE.RepeatWrapping;
  tex.offset.x = 0.5;
  return tex;
}

/** Front-of-carton artwork (portrait). */
export function makeCartonLabel(width = 512, height = 1024) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');

  g.fillStyle = COLOURS.card; g.fillRect(0, 0, width, height);
  g.fillStyle = COLOURS.accent; g.fillRect(0, 0, width, height * 0.22);

  g.textAlign = 'center';
  const cx = width * 0.5;

  g.fillStyle = '#ffffff';
  g.font = `bold ${Math.round(width * 0.075)}px Georgia, 'Times New Roman', serif`;
  g.textAlign = 'left';
  g.fillText(PRODUCT.classification, width * 0.07, height * 0.085);
  g.textAlign = 'center';

  g.font = `bold ${Math.round(width * 0.055)}px Helvetica, Arial, sans-serif`;
  g.fillText('DERMATOLOGY', cx, height * 0.165);

  g.fillStyle = COLOURS.ink;
  g.font = `bold ${Math.round(width * 0.155)}px Helvetica, Arial, sans-serif`;
  g.letterSpacing = '3px';
  g.fillText(PRODUCT.brand, cx, height * 0.40);
  g.letterSpacing = '0px';

  g.fillStyle = COLOURS.accent;
  g.font = `bold ${Math.round(width * 0.055)}px Helvetica, Arial, sans-serif`;
  g.fillText(PRODUCT.api, cx, height * 0.465);

  g.fillStyle = COLOURS.muted;
  g.font = `${Math.round(width * 0.052)}px Helvetica, Arial, sans-serif`;
  g.fillText(PRODUCT.form, cx, height * 0.545);
  g.fillText(PRODUCT.strength, cx, height * 0.60);

  g.strokeStyle = '#c9d4dc'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(width * 0.18, height * 0.66); g.lineTo(width * 0.82, height * 0.66); g.stroke();

  g.fillStyle = COLOURS.ink;
  g.font = `bold ${Math.round(width * 0.050)}px Helvetica, Arial, sans-serif`;
  g.fillText(PRODUCT.route, cx, height * 0.72);

  g.fillStyle = COLOURS.muted;
  g.font = `${Math.round(width * 0.042)}px Helvetica, Arial, sans-serif`;
  g.fillText(PRODUCT.footer, cx, height * 0.775);
  g.font = `bold ${Math.round(width * 0.070)}px Helvetica, Arial, sans-serif`;
  g.fillStyle = COLOURS.ink;
  g.fillText(PRODUCT.netContent, cx, height * 0.87);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Build the tube. Local frame: +Y runs from the crimped tail up to the nozzle, origin at the tube's
 * mid-body, so parenting it to a hand and tilting about X aims the nozzle naturally.
 *
 * @returns {{ group:THREE.Group, nozzleTip:THREE.Object3D, materials:THREE.Material[],
 *             textures:THREE.Texture[], dispose:()=>void }}
 */
export function buildCreamTube(opts = {}) {
  const t = { ...TUBE, ...opts };
  const group = new THREE.Group();
  group.name = 'nanoderm_tube';

  const labelTex = makeTubeLabel();
  const bodyMat = new THREE.MeshStandardMaterial({
    map: labelTex, color: 0xffffff, roughness: 0.34, metalness: 0.0, envMapIntensity: 1.0,
  });
  bodyMat.name = 'nanoderm_tube_body';
  const blankMat = new THREE.MeshStandardMaterial({
    color: COLOURS.tubeBody, roughness: 0.34, metalness: 0.0, envMapIntensity: 1.0,
  });
  const capMat = new THREE.MeshStandardMaterial({
    color: COLOURS.cap, roughness: 0.38, metalness: 0.05, envMapIntensity: 1.0,
  });

  // ---- barrel (carries the label) ----
  // Segmented along its height so the squeeze deformation has vertices to move; a 1-segment
  // cylinder can only translate its rims and reads as a rigid bottle however hard it is "squeezed".
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(t.bodyRadius, t.bodyRadius, t.bodyLength, 56, 24, true), bodyMat,
  );
  body.position.y = 0;
  group.add(body);

  // ---- squeeze deformation -------------------------------------------------------------------
  // A real tube flattens between finger and thumb and bulges on the free axis; its volume is
  // roughly preserved. This is a procedural vertex deformation (not a morph target) because it has
  // to stay a pure function of one uniform for determinism, and because the barrel is the only part
  // that moves — the crimp, shoulder and neck must stay rigid or the nozzle collapses.
  const squeezeUniforms = {
    uSqueeze: { value: 0 },        // 0..1 finger pressure
    uDeplete: { value: 0 },        // 0..1 how much product has been dispensed
    uHalfLen: { value: t.bodyLength * 0.5 },
  };
  const injectSqueeze = (mat) => {
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, squeezeUniforms);
      shader.vertexShader = `
        uniform float uSqueeze;
        uniform float uDeplete;
        uniform float uHalfLen;
        ${shader.vertexShader}
      `.replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // profile: no deformation at the crimp or the shoulder, maximum across the grip zone
          float yn = clamp(transformed.y / uHalfLen, -1.0, 1.0);
          float grip = 1.0 - smoothstep(0.0, 0.92, abs(yn - 0.05));
          float amt = grip * uSqueeze;
          // flatten across X (between finger pads and thumb), bulge on Z to conserve volume
          transformed.x *= 1.0 - 0.34 * amt;
          transformed.z *= 1.0 + 0.20 * amt;
          // depletion: the tail end collapses first, as an emptying tube does
          float tail = smoothstep(0.35, -1.0, yn);
          transformed.x *= 1.0 - 0.26 * uDeplete * tail;
          transformed.z *= 1.0 - 0.20 * uDeplete * tail;
        }`);
    };
    mat.customProgramCacheKey = () => 'nanoderm-squeeze';
    return mat;
  };
  injectSqueeze(bodyMat);

  // ---- shoulder: barrel -> neck ----
  const shoulder = new THREE.Mesh(
    new THREE.CylinderGeometry(t.neckRadius, t.bodyRadius, t.shoulderLength, 56, 1, true), blankMat,
  );
  shoulder.position.y = t.bodyLength / 2 + t.shoulderLength / 2;
  group.add(shoulder);

  // ---- threaded neck ----
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(t.neckRadius, t.neckRadius, t.neckLength, 32), blankMat,
  );
  neck.position.y = t.bodyLength / 2 + t.shoulderLength + t.neckLength / 2;
  group.add(neck);

  // ---- nozzle orifice: a dark recess so the opening reads as a hole, not a flat disc ----
  const orifice = new THREE.Mesh(
    new THREE.CircleGeometry(t.neckRadius * 0.42, 24),
    new THREE.MeshStandardMaterial({ color: 0x2b3339, roughness: 0.8 }),
  );
  orifice.rotation.x = -Math.PI / 2;
  orifice.position.y = neck.position.y + t.neckLength / 2 + 0.0002;
  group.add(orifice);

  // ---- cap, sitting beside the tube (removed, as it would be during use) ----
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(t.capRadius, t.capRadius, t.capLength, 32), capMat,
  );
  cap.name = 'tube_cap';
  // seated over the neck, slightly overlapping the shoulder — where a closed tube's cap actually is
  cap.position.set(0, neck.position.y + t.capLength / 2 - 0.0035, 0);
  cap.visible = false;                 // shown only when the product is presented closed
  group.add(cap);

  // ---- crimped tail seal ----
  const crimp = new THREE.Mesh(
    new THREE.BoxGeometry(t.crimpWidth, t.crimpHeight, t.bodyRadius * 0.5), blankMat,
  );
  crimp.position.y = -t.bodyLength / 2 - t.crimpHeight / 2 + 0.001;
  group.add(crimp);

  // ---- tail cap so the open-ended barrel is not see-through from below ----
  const tailDisc = new THREE.Mesh(new THREE.CircleGeometry(t.bodyRadius, 40), blankMat);
  tailDisc.rotation.x = Math.PI / 2;
  tailDisc.position.y = -t.bodyLength / 2;
  group.add(tailDisc);

  // ---- anchor at the orifice: the dispenser reads its WORLD position each frame ----
  const nozzleTip = new THREE.Object3D();
  nozzleTip.name = 'nozzle_tip';
  nozzleTip.position.y = orifice.position.y + 0.0015;
  group.add(nozzleTip);

  for (const o of group.children) { o.castShadow = true; o.receiveShadow = true; }

  return {
    group, nozzleTip, cap,
    /** Drive the deformation. Pure in its arguments — same values give the same shape. */
    setSqueeze(squeeze, deplete = 0) {
      squeezeUniforms.uSqueeze.value = Number.isFinite(squeeze) ? Math.max(0, Math.min(1, squeeze)) : 0;
      squeezeUniforms.uDeplete.value = Number.isFinite(deplete) ? Math.max(0, Math.min(1, deplete)) : 0;
    },
    squeezeUniforms,
    materials: [bodyMat, blankMat, capMat, orifice.material],
    textures: [labelTex],
    dispose() {
      group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
      bodyMat.dispose(); blankMat.dispose(); capMat.dispose(); orifice.material.dispose();
      labelTex.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}

/** Build the matching carton. Front face (+Z) carries the artwork; the rest is plain board. */
export function buildCarton(opts = {}) {
  const w = opts.width ?? 0.048, h = opts.height ?? 0.128, d = opts.depth ?? 0.030;
  const tex = makeCartonLabel();
  const board = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.72, metalness: 0 });
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 });
  front.name = 'nanoderm_carton_front';
  // BoxGeometry material order: +X, -X, +Y, -Y, +Z, -Z
  const mats = [board, board, board, board, front, board];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.name = 'nanoderm_carton';
  mesh.castShadow = true; mesh.receiveShadow = true;
  return {
    mesh, materials: mats, textures: [tex],
    dispose() {
      mesh.geometry.dispose(); board.dispose(); front.dispose(); tex.dispose();
      if (mesh.parent) mesh.parent.remove(mesh);
    },
  };
}

export default buildCreamTube;
