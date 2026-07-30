// RENDERER-SIDE presentation pass for the human GLB. Touches ONLY three.js material/render state —
// it never edits the asset, the geometry, the skeleton, the timeline or any biology.
//
// WHY THIS EXISTS
// ---------------
// simulator/assets/human/human.glb is a MakeHuman/MPFB figure exported through "Khronos glTF
// Blender I/O". That exporter writes `alphaMode: BLEND` + `doubleSided: true` for EVERY material
// when the Blender material Blend Mode is left at "Alpha Blend" — which is what happened here:
// all 9 materials are BLEND, including skin, suit and tongue whose base-colour textures are plain
// RGB with no alpha channel at all.
//
// In three.js `alphaMode: BLEND` maps to `material.transparent = true`, which turns OFF depth
// writing and switches the mesh to coarse per-object sorting. The observable damage:
//   * face skin stops occluding the teeth/tongue meshes behind it -> the head reads as a gaping
//     mouth full of teeth,
//   * the hair / eyebrow / eyelash alpha CARDS are drawn as unsorted slabs across the face and
//     eyes -> a black mask over the forehead, eyes and cheeks,
//   * the eyeballs sort incorrectly against the eyelashes.
//
// THE FIX (presentation only)
//   * textures with no meaningful alpha  -> genuinely OPAQUE (transparent off, depthWrite on)
//   * true cut-out cards (hair/brows/lashes) -> ALPHA TEST (glTF "MASK") instead of blending, which
//     is the correct mode for foliage-style cards: correct depth, correct sorting, no black slabs.
// Alpha-tested materials still cut out correctly in the shadow pass — three derives the depth
// material from `map` + `alphaTest`.

import * as THREE from '../../vendor/three/three.module.js';

/**
 * Material-name classification for the MakeHuman/MPFB export.
 *
 * ORDER MATTERS — `roleForMaterial` returns the FIRST match, so the most specific parts come first
 * and `skin` (the broadest pattern) comes last. Without this, "Human.teeth_base" is captured by the
 * skin pattern and the teeth are silently given skin settings.
 */
export const MATERIAL_ROLES = Object.freeze({
  brows:  /eyebrow/i,
  lashes: /eyelash/i,
  hair:   /afro|hair|ponytail|braid|bob0|fhair/i,
  eyes:   /high-?poly|eyeball|\beye\b|cornea|iris/i,
  teeth:  /teeth|tooth/i,
  tongue: /tongue/i,
  shoes:  /shoe|boot|sneaker/i,
  cloth:  /suit|shirt|trouser|jean|cloth|dress|top\d|bottom\d/i,
  skin:   /\bbody\b|skin|(^|[.\s_-])base\b/i,
});

/**
 * Roles whose alpha is real geometry-shaping data, so they must be alpha-TESTED (glTF "MASK")
 * rather than blended.
 *
 * `eyes` is in this list for a MakeHuman-specific reason: the "high-poly" eye is a TWO-LAYER mesh —
 * an inner iris/sclera surface wrapped in an outer cornea shell whose texture alpha is ~0. Forcing
 * it fully opaque renders the cornea as a blank white-blue dome and hides the iris entirely; alpha
 * testing discards the cornea texels and reveals the iris beneath, while still writing depth.
 */
export const CUTOUT_ROLES = Object.freeze(['hair', 'brows', 'lashes', 'eyes']);

/** Per-role alpha-test thresholds. */
export const ALPHA_TEST = Object.freeze({ hair: 0.5, brows: 0.5, lashes: 0.5, eyes: 0.5 });

/** Cut-out roles that are closed solids rather than flat cards (so they stay single-sided). */
export const SOLID_CUTOUT_ROLES = Object.freeze(['eyes']);

/** Roles whose roughness is SET outright rather than treated as a minimum (see applyHumanPresentation). */
export const FORCED_ROUGHNESS_ROLES = Object.freeze(['eyes', 'hair']);

/**
 * Presentation targets. `roughness`/`metalness` are floors applied to the IMPORTED PBR values so
 * skin never reads as polished plastic and eyes stay wet-looking under the studio environment.
 */
export const SURFACE = Object.freeze({
  skin:   { roughness: 0.62, metalness: 0.0, envMapIntensity: 0.85 },
  eyes:   { roughness: 0.12, metalness: 0.0, envMapIntensity: 1.60 },  // specular catch-light
  teeth:  { roughness: 0.32, metalness: 0.0, envMapIntensity: 1.00 },
  tongue: { roughness: 0.55, metalness: 0.0, envMapIntensity: 0.80 },
  // the afro texture is near-black, so without some specular sheen it reads as a flat blob and the
  // shell seams dominate; a lower roughness + stronger environment gives it hair-like highlights
  hair:   { roughness: 0.38, metalness: 0.0, envMapIntensity: 1.15 },
  brows:  { roughness: 0.70, metalness: 0.0, envMapIntensity: 0.60 },
  lashes: { roughness: 0.70, metalness: 0.0, envMapIntensity: 0.60 },
  cloth:  { roughness: 0.85, metalness: 0.0, envMapIntensity: 0.70 },
  shoes:  { roughness: 0.45, metalness: 0.0, envMapIntensity: 0.80 },
  default:{ roughness: 0.65, metalness: 0.0, envMapIntensity: 0.80 },
});

/** Classify a material by its name. Returns a role key, or 'default' when unrecognised. */
export function roleForMaterial(name = '') {
  for (const [role, re] of Object.entries(MATERIAL_ROLES)) if (re.test(name)) return role;
  return 'default';
}

const materialsOf = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);

/**
 * Clean clinical tones used when a source texture is rejected (see `cleanClothing`).
 * The MakeHuman "casualsuit" is a SINGLE material covering both the top and the trousers, so the
 * garment cannot be re-coloured piecewise — it becomes one neutral clinical tone. Footwear is a
 * separate material and is kept dark, otherwise the figure reads as an undifferentiated white mass.
 */
export const CLEAN_GARMENT_COLOURS = Object.freeze({ cloth: 0xe9ebee, shoes: 0x4a4f57 });
/** @deprecated kept for callers that referenced the single-colour constant */
export const CLINICAL_GARMENT_COLOUR = CLEAN_GARMENT_COLOURS.cloth;

/**
 * Apply the presentation pass to a loaded human GLB scene.
 * Idempotent and side-effect-free outside three.js material state.
 *
 * @param {THREE.Object3D} root gltf.scene
 * @param {{ shadows?:boolean, colorSpace?:boolean, cleanClothing?:boolean }} [opts]
 *   `cleanClothing` drops the garment's base-colour texture and substitutes a flat clinical tone.
 *   The MakeHuman t-shirt diffuse has the project's logo watermark baked into it, which is legible
 *   in medium shots; the NORMAL map is kept, so the fabric still creases and catches light. Off by
 *   default so Phase-0 behaviour is unchanged.
 * @returns {{ materials:number, byRole:Record<string,string[]>, cutouts:string[], opaque:string[],
 *             cleanedClothing:string[] }}
 */
export function applyHumanPresentation(root, opts = {}) {
  const { shadows = true, colorSpace = true, cleanClothing = false } = opts;
  const byRole = {}; const cutouts = []; const opaque = []; const cleanedClothing = []; const seen = new Set();

  root.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (shadows) { o.castShadow = true; o.receiveShadow = true; }
    o.frustumCulled = false;               // skinned meshes deform outside their bind-pose bounds

    for (const m of materialsOf(o)) {
      if (seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      const role = roleForMaterial(m.name || o.name || '');
      (byRole[role] || (byRole[role] = [])).push(m.name || '(unnamed)');

      // --- colour management: base colour + emissive are sRGB, data maps stay linear ---
      if (colorSpace) {
        for (const k of ['map', 'emissiveMap', 'specularMap']) if (m[k]) m[k].colorSpace = THREE.SRGBColorSpace;
        for (const k of ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]) m[k].colorSpace = THREE.NoColorSpace;
      }

      // --- transparency: the actual defect ---
      if (CUTOUT_ROLES.includes(role)) {
        m.transparent = false;                       // MASK, not BLEND
        m.alphaTest = ALPHA_TEST[role] ?? 0.5;
        m.depthWrite = true;
        // flat cards need both faces; closed solids (eyeballs) must stay single-sided or the
        // far hemisphere z-fights with the near one
        m.side = SOLID_CUTOUT_ROLES.includes(role) ? THREE.FrontSide : THREE.DoubleSide;
        cutouts.push(m.name || '(unnamed)');
      } else {
        m.transparent = false;
        m.alphaTest = 0;
        m.depthWrite = true;
        m.side = THREE.FrontSide;                    // solid bodies: correct shadows + no z-fighting
        opaque.push(m.name || '(unnamed)');
      }

      // --- surface response ---
      const s = SURFACE[role] || SURFACE.default;
      if (m.isMeshStandardMaterial) {
        // Roughness is normally a FLOOR (never let an import look like polished plastic), but for
        // eyes and hair the target is a deliberate gloss value, so it is set outright.
        if (FORCED_ROUGHNESS_ROLES.includes(role)) m.roughness = s.roughness;
        else if (typeof m.roughness === 'number' && m.roughness < s.roughness) m.roughness = s.roughness;
        m.metalness = s.metalness;
        m.envMapIntensity = s.envMapIntensity;
      }
      // --- watermark mitigation on garments (opt-in) ---
      if (cleanClothing && (role === 'cloth' || role === 'shoes')) {
        if (m.map) { m.map = null; }                   // the watermarked diffuse
        const hex = CLEAN_GARMENT_COLOURS[role] ?? CLEAN_GARMENT_COLOURS.cloth;
        if (m.color && m.color.setHex) m.color.setHex(hex);
        // keep m.normalMap — surface detail survives, only the printed artwork is gone
        cleanedClothing.push(m.name || '(unnamed)');
      }

      m.needsUpdate = true;
    }
  });

  return { materials: seen.size, byRole, cutouts, opaque, cleanedClothing };
}

export default applyHumanPresentation;
