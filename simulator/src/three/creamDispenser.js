// Phase-2 CREAM DISPENSER — the cream visibly leaving the NANODERM nozzle and landing on the skin.
//
// THIS IS NOT A FLUID SIMULATION, and it is not presented as one. It is an art-directed,
// deterministic approximation with two pieces:
//   * STRAND — a tapered cylinder stretched from the nozzle orifice down to the descending tip.
//     A fixed-topology mesh that is repositioned/rescaled per frame, so there is no per-frame
//     geometry rebuild and no allocation churn.
//   * BEAD — a squashed sphere that grows where the strand meets the skin, then flattens as the
//     cream layer's own coverage takes over.
// Both are pure functions of the choreography's `dispense` state, so the deposit lands identically
// on every replay. A real SPH/PBF fluid solve would be non-deterministic frame-to-frame and far
// outside this phase's scope; the requirement is that it READS as cream leaving the tube.
//
// Material matches creamLayer.js (bright cool off-white + clearcoat) so the strand, the bead and the
// film on the skin are recognisably the same substance.

import * as THREE from '../../vendor/three/three.module.js';

export const DISPENSER_DEFAULTS = Object.freeze({
  colour: 0xf6ecd9,     // matches creamLayer: strand, bead and film must be one substance
  strandTopRadius: 0.0050,     // at the nozzle
  strandTipRadius: 0.0072,     // fatter at the falling tip — surface-tension read, and legible at
                               // the shot distance the dispense beat actually uses
  beadSquash: 0.42,            // bead is flattened onto the skin, not a floating ball
  roughness: 0.16,
});

/**
 * @param {object} [opts]
 * @returns {{ group:THREE.Group, setState:(d:object, nozzle:THREE.Vector3, deposit:THREE.Vector3,
 *             normal:THREE.Vector3)=>void, dispose:()=>void }}
 */
export function buildCreamDispenser(opts = {}) {
  const cfg = { ...DISPENSER_DEFAULTS, ...opts };
  const group = new THREE.Group();
  group.name = 'cream_dispenser';

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(cfg.colour),
    roughness: cfg.roughness,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    sheen: 0.3,
    sheenColor: new THREE.Color(0xdfe8f2),
  });
  mat.name = 'cream_substance';

  // Unit strand: 1 m tall, centred on the origin, +Y up. Repositioned and scaled every frame.
  const strand = new THREE.Mesh(
    new THREE.CylinderGeometry(cfg.strandTopRadius, cfg.strandTipRadius, 1, 14, 1, false), mat,
  );
  strand.name = 'cream_strand';
  strand.castShadow = true;
  strand.visible = false;
  group.add(strand);

  // Bead on the skin.
  const bead = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat);
  bead.name = 'cream_bead';
  bead.castShadow = true;
  bead.visible = false;
  group.add(bead);

  const _dir = new THREE.Vector3();
  const _mid = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  return {
    group, material: mat, strand, bead,

    /**
     * @param {{active:boolean, extrusion:number, strandLength:number, beadRadius:number, landed:boolean}} d
     * @param {THREE.Vector3} nozzle world position of the nozzle orifice
     * @param {THREE.Vector3} deposit world position of the deposit point on the skin
     * @param {THREE.Vector3} normal outward skin normal at the deposit point
     */
    setState(d, nozzle, deposit, normal) {
      if (!d || !nozzle || !deposit) { strand.visible = false; bead.visible = false; return; }

      // ---- strand: from the nozzle toward the skin, length driven by the extrusion ----
      const showStrand = d.active && d.strandLength > 1e-4;
      strand.visible = showStrand;
      if (showStrand) {
        _dir.copy(deposit).sub(nozzle);
        const reach = _dir.length() || 1;
        _dir.divideScalar(reach);
        // never overshoot the skin
        const len = Math.min(d.strandLength, reach);
        _mid.copy(nozzle).addScaledVector(_dir, len * 0.5);
        strand.position.copy(_mid);
        _q.setFromUnitVectors(UP, _dir);
        strand.quaternion.copy(_q);
        strand.scale.set(1, len, 1);
      }

      // ---- bead: grows on the skin once the strand has arrived ----
      const r = d.beadRadius || 0;
      const showBead = d.landed && r > 1e-4;
      bead.visible = showBead;
      if (showBead) {
        const nrm = normal && normal.lengthSq() > 1e-8 ? normal.clone().normalize() : UP.clone();
        // sit the bead so its flattened underside rests on the skin
        bead.position.copy(deposit).addScaledVector(nrm, r * cfg.beadSquash * 0.55);
        bead.quaternion.copy(_q.setFromUnitVectors(UP, nrm));
        bead.scale.set(r, r * cfg.beadSquash, r * 1.35);   // elongated along the arm
      }
    },

    dispose() {
      strand.geometry.dispose();
      bead.geometry.dispose();
      mat.dispose();
      if (group.parent) group.parent.remove(group);
    },
  };
}

export default buildCreamDispenser;
