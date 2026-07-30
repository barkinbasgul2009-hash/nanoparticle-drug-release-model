// Phase-2B CAMERA DIRECTOR. Three.js owns the runtime camera in both presentation modes (ss26);
// the Blender preview camera exists only to guide composition and is never exported.
//
// Shots are anchored to MANIFEST EVENTS rather than hard-coded progress values, so re-timing the
// Blender animation re-times the camera automatically. Targets are resolved from LIVE posed
// geometry — the nozzle, the deposit point on the forearm, the hand — so the framing follows the
// actual pose instead of a position someone measured once and pasted in.
//
// Everything here is VISUAL_ONLY and a pure function of masterProgress: seeking to p and playing to
// p give the same camera, which is what makes the deterministic frame capture meaningful.

import * as THREE from '../../vendor/three/three.module.js';
import { minJerk } from './applicationChoreography.js';

/**
 * Shot list. `az` is the azimuth around the subject in radians (0 looks at the figure's front,
 * positive swings toward the applying side), `elev` the elevation, `dist` the distance in metres.
 */
export const SHOTS = Object.freeze([
  { event: 'neutral', anchor: 'upperBody', dist: 1.90, az: -0.22, elev: 0.06, fov: 40 },
  { event: 'productEstablishStart', anchor: 'product', dist: 0.90, az: -0.36, elev: 0.20, fov: 38 },
  { event: 'gripPreparation', anchor: 'product', dist: 0.52, az: -0.32, elev: 0.16, fov: 38 },
  { event: 'productGripEstablished', anchor: 'productLabel', dist: 0.42, az: -0.26, elev: 0.10, fov: 36 },
  { event: 'dispensePreparation', anchor: 'betweenProductAndArm', dist: 0.56, az: -0.22, elev: 0.14, fov: 38 },
  { event: 'dispenseStart', anchor: 'nozzle', dist: 0.36, az: -0.18, elev: 0.10, fov: 34 },
  { event: 'creamContact', anchor: 'deposit', dist: 0.30, az: -0.14, elev: 0.07, fov: 33 },
  { event: 'dispenseEnd', anchor: 'deposit', dist: 0.36, az: -0.12, elev: 0.09, fov: 34 },
  { event: 'productRetreatStart', anchor: 'betweenProductAndArm', dist: 0.48, az: -0.20, elev: 0.13, fov: 36 },
  { event: 'productRetreatEnd', anchor: 'forearm', dist: 0.66, az: -0.26, elev: 0.18, fov: 39 },
  { event: 'handApproach', anchor: 'forearm', dist: 0.52, az: -0.22, elev: 0.16, fov: 38 },
  { event: 'skinContact', anchor: 'palmContact', dist: 0.40, az: -0.16, elev: 0.13, fov: 35 },
  { event: 'spreadStart', anchor: 'palmContact', dist: 0.40, az: -0.14, elev: 0.12, fov: 35 },
  { event: 'strokeOne', anchor: 'deposit', dist: 0.42, az: -0.18, elev: 0.15, fov: 35 },
  { event: 'strokeTwo', anchor: 'deposit', dist: 0.41, az: -0.14, elev: 0.14, fov: 35 },
  { event: 'releaseStart', anchor: 'deposit', dist: 0.38, az: -0.12, elev: 0.13, fov: 34 },
  { event: 'releaseEnd', anchor: 'deposit', dist: 0.35, az: -0.10, elev: 0.11, fov: 33 },
  { event: 'heroStart', anchor: 'deposit', dist: 0.32, az: -0.08, elev: 0.10, fov: 32 },
  { event: 'heroHold', anchor: 'deposit', dist: 0.30, az: -0.06, elev: 0.09, fov: 32 },
  { event: 'sequenceEnd', anchor: 'deposit', dist: 0.30, az: -0.05, elev: 0.09, fov: 32 },
]);

/**
 * @param {object} manifest validated Phase-2B manifest
 * @param {() => Record<string, THREE.Vector3>} resolveAnchors called once per frame
 */
export class ApplicationCameraDirector {
  constructor(manifest, resolveAnchors, opts = {}) {
    this.manifest = manifest;
    this.resolveAnchors = resolveAnchors;
    this.camera = new THREE.PerspectiveCamera(38, opts.aspect || 1, 0.01, 60);
    this._target = new THREE.Vector3();
    this._from = new THREE.Vector3();
    this._to = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._shots = SHOTS.filter((s) => Number.isFinite(manifest.events[s.event]))
      .map((s) => ({ ...s, at: manifest.events[s.event] }))
      .sort((a, b) => a.at - b.at);
    if (this._shots.length < 2) throw new Error('camera director: manifest exposes too few events');
    this.lastShot = null;
  }

  setAspect(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /** Pure in `progress`. Returns the resolved shot state for diagnostics. */
  update(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const shots = this._shots;
    let i = 0;
    while (i < shots.length - 2 && p >= shots[i + 1].at) i += 1;
    const a = shots[i];
    const b = shots[i + 1] || a;
    const span = Math.max(1e-6, b.at - a.at);
    // minimum-jerk between shots: zero velocity at each cut point, so no camera snap (ss26)
    const t = minJerk(Math.max(0, Math.min(1, (p - a.at) / span)));

    const anchors = this.resolveAnchors() || {};
    const fallback = anchors.upperBody || new THREE.Vector3(0, 1.2, 0);
    this._from.copy(anchors[a.anchor] || fallback);
    this._to.copy(anchors[b.anchor] || fallback);
    this._target.copy(this._from).lerp(this._to, t);

    const dist = a.dist + (b.dist - a.dist) * t;
    const az = a.az + (b.az - a.az) * t;
    const elev = a.elev + (b.elev - a.elev) * t;
    const fov = a.fov + (b.fov - a.fov) * t;

    const ce = Math.cos(elev);
    // the subject faces +Z in glTF space, so the camera lives on the +Z side
    this._dir.set(Math.sin(az) * ce, Math.sin(elev), Math.cos(az) * ce).normalize();
    this.camera.position.copy(this._target).addScaledVector(this._dir, dist);
    this.camera.lookAt(this._target);
    if (Math.abs(this.camera.fov - fov) > 1e-4) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();

    this.lastShot = {
      from: a.event, to: b.event, mix: t, anchor: a.anchor,
      dist, fov, target: this._target.clone(),
    };
    return this.lastShot;
  }
}

export default ApplicationCameraDirector;
