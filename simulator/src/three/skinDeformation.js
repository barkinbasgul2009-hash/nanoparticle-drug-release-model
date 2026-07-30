// Phase-2 LOCALIZED SKIN COMPRESSION.
//
// Replaces the previous contact illusion, which was ~5 mm of authored palm-into-arm overlap. That
// is fine at a medium shot and indefensible in the close-up the sequence now ends on: the palm
// visibly sinks into rigid skin.
//
// APPROACH: displace the forearm surface AFTER skinning, inside the body material's vertex stage.
//   * it has to be post-skinning, because the arm is animated — a bind-pose displacement would
//     swim across the limb as it moves. The injection point is therefore after `#include <skinning>`,
//     where `transformed` is already in posed local space;
//   * the field is a smooth C2 radial falloff around the palm contact point, so there is no hard
//     edge and no faceting;
//   * the normal is tilted by the analytic gradient of that field, otherwise the dent moves the
//     silhouette but the shading stays flat and the eye does not read it as an indentation;
//   * a small compensating ridge just outside the contact radius stands in for displaced tissue.
//
// Only the treated forearm moves: the field is bounded by `uRadius`, and the caller places the
// centre on the palm, so the rest of the body is untouched.
//
// Every uniform is written from the choreography each frame, so a seek reproduces the same dent and
// a reset removes it completely.

import * as THREE from '../../vendor/three/three.module.js';

export const SKIN_DEFORM_DEFAULTS = Object.freeze({
  radius: 0.052,        // contact footprint radius (m) — a palm-sized patch
  maxDepth: 0.0075,     // deepest indentation (m); restrained on purpose
  ridgeHeight: 0.28,    // compensating bulge, as a fraction of depth
  ridgeWidth: 1.45,     // where the bulge peaks, as a multiple of radius
});

/**
 * Patch a material so it can be indented. Safe to call on any MeshStandardMaterial /
 * MeshPhysicalMaterial; returns the uniforms to drive.
 *
 * @param {THREE.Material} material
 * @param {object} [opts]
 * @returns {{uniforms:object, setContact:(o:object)=>void}}
 */
export function attachSkinDeformation(material, opts = {}) {
  const cfg = { ...SKIN_DEFORM_DEFAULTS, ...opts };

  const uniforms = {
    uContactPos: { value: new THREE.Vector3(0, -999, 0) },   // local space, parked far away
    uContactNrm: { value: new THREE.Vector3(0, 1, 0) },
    uContactRadius: { value: cfg.radius },
    uContactDepth: { value: 0 },                             // metres; 0 = no contact
    uRidge: { value: cfg.ridgeHeight },
    uRidgeWidth: { value: cfg.ridgeWidth },
  };

  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (typeof prev === 'function') prev(shader, renderer);
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = `
      uniform vec3  uContactPos;
      uniform vec3  uContactNrm;
      uniform float uContactRadius;
      uniform float uContactDepth;
      uniform float uRidge;
      uniform float uRidgeWidth;

      // C2 falloff: value 1 at the centre, 0 at r=1, zero derivative at both ends.
      float skinFalloff(float x) {
        float t = clamp(1.0 - x, 0.0, 1.0);
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      }
      ${shader.vertexShader}
    `.replace(
      '#include <skinning>',
      `#include <skinning>
      {
        // transformed is now the POSED position, so the dent follows the moving arm.
        if ( uContactDepth > 0.00001 ) {
          vec3 rel = transformed - uContactPos;
          // flatten the measurement along the contact normal: a palm presses a disc, not a ball
          float along = dot( rel, uContactNrm );
          vec3 tang = rel - uContactNrm * along;
          float rt = length( tang ) / max( uContactRadius, 1e-4 );

          // primary indentation
          float dent = skinFalloff( rt );
          // compensating ridge just outside the footprint (displaced tissue has to go somewhere)
          float ring = skinFalloff( abs( rt - uRidgeWidth ) / 0.75 ) * uRidge;

          float disp = ( -dent + ring ) * uContactDepth;
          // only push the side of the limb that is actually under the palm
          float facing = smoothstep( -0.25, 0.55, dot( normalize( rel + uContactNrm * 1e-4 ), uContactNrm ) );
          disp *= facing;
          transformed += uContactNrm * disp;

          // Tilt the normal by the field's slope, or the dent moves the silhouette but shades flat.
          if ( rt < 2.2 && length( tang ) > 1e-5 ) {
            float h = 0.02;
            float d0 = ( -skinFalloff( rt ) + skinFalloff( abs( rt - uRidgeWidth ) / 0.75 ) * uRidge );
            float d1 = ( -skinFalloff( rt + h ) + skinFalloff( abs( rt + h - uRidgeWidth ) / 0.75 ) * uRidge );
            float slope = ( d1 - d0 ) / ( h * uContactRadius ) * uContactDepth * facing;
            objectNormal = normalize( objectNormal - normalize( tang ) * slope );
            vNormal = normalize( normalMatrix * objectNormal );
          }
        }
      }`
    );
  };

  // A modified program needs its own cache key, or three hands back a cached program compiled
  // WITHOUT this injection for any other material that happens to share the same signature.
  const baseKey = material.customProgramCacheKey ? material.customProgramCacheKey() : '';
  material.customProgramCacheKey = () => `${baseKey}|skin-deform`;
  material.needsUpdate = true;

  return {
    uniforms,
    /**
     * @param {{position:THREE.Vector3, normal:THREE.Vector3, depth:number, radius?:number,
     *          worldToLocal?:THREE.Matrix4}} c
     */
    setContact(c) {
      if (!c || !(c.depth > 0)) { uniforms.uContactDepth.value = 0; return; }
      const p = c.position.clone();
      const n = c.normal.clone().normalize();
      if (c.worldToLocal) {
        p.applyMatrix4(c.worldToLocal);
        // direction: rotation part only
        n.transformDirection(c.worldToLocal).normalize();
      }
      uniforms.uContactPos.value.copy(p);
      uniforms.uContactNrm.value.copy(n);
      uniforms.uContactDepth.value = Math.min(c.depth, cfg.maxDepth);
      if (Number.isFinite(c.radius)) uniforms.uContactRadius.value = c.radius;
    },
  };
}

export default attachSkinDeformation;
