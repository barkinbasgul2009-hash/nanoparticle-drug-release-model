// Phase-2 APPLICATION RIG — turns choreography numbers into an actual posed skeleton, and
// MEASURES whether the palm really reached the skin.
//
// Deliberately mesh-free: it operates on a bone hierarchy plus a name lookup, so the whole contact
// solution can be exercised headlessly in Node against the real skeleton rebuilt from the glTF
// node graph. humanApplicationScene.js adds the meshes, cream, lights and camera on top.
//
// DETERMINISM: IK is incremental by nature — it reads a bone's current world rotation and rotates
// from there. Left alone, that would make frame N depend on frame N-1 and seek/replay would drift.
// `restorePose()` resets every driven bone to its captured rest transform at the START of every
// solve, so solve(p) depends only on p. This is the single most important invariant in this file.

import * as THREE from '../../vendor/three/three.module.js';
import { solveTwoBoneIK, orientHand, measureHandFrame } from './twoBoneIK.js';
import { choreographyAt, PARAMS } from './applicationChoreography.js';
import { buildBoneMap } from './boneMap.js';

/** Authored offsets, expressed relative to measured anatomy so they survive a re-export. */
export const RIG_TUNING = Object.freeze({
  // where the treated hand is carried once presented, as an offset from the chest bone
  // a closer, higher carry folds the elbow to ~90° — an arm held across the body, not a straight
  // arm poked forwards
  presentOffset: { x: -0.05, y: 0.06, z: 0.26 },
  // Relaxed standing pose. The GLB's bind pose is a wide A-pose, which reads as a shop mannequin;
  // both arms are eased to hang near the hips before anything else happens. Offset is from the
  // SHOULDER and its x is mirrored per side (negative = toward the body).
  // x is slightly OUTWARD so the hands hang beside the hips rather than meeting in front
  neutralOffset: { x: 0.015, y: -0.48, z: 0.04 },
  // elbow direction hints (offsets from the shoulder); keep elbows out and low, never behind
  poleTreated: { x: 0.60, y: -0.70, z: 0.10 },
  poleApplying: { x: -0.60, y: -0.62, z: 0.16 },
  fingerCurl: { prox: 0.18, mid: 0.26 },   // radians — a soft, purposeful hand, not a splayed one
  fallbackRadius: 0.045,                    // forearm radius if geometry could not be measured
});

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _axis = new THREE.Vector3(), _up = new THREE.Vector3(), _n = new THREE.Vector3();
const _target = new THREE.Vector3(), _pole = new THREE.Vector3(), _palm = new THREE.Vector3();

const FINGER_ROOTS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

export class ApplicationRig {
  /**
   * @param {{ boneNames:string[], lookupBone:(n:string)=>any, applyingSide?:'L'|'R',
   *           forearmRadius?:number, tuning?:object }} opts
   */
  constructor(opts = {}) {
    this.lookupBone = opts.lookupBone || (() => null);
    this.applyingSide = opts.applyingSide === 'L' ? 'L' : 'R';
    this.treatedSide = this.applyingSide === 'R' ? 'L' : 'R';
    this.tuning = { ...RIG_TUNING, ...(opts.tuning || {}) };
    this.forearmRadius = Number.isFinite(opts.forearmRadius) && opts.forearmRadius > 0
      ? opts.forearmRadius : RIG_TUNING.fallbackRadius;

    this.boneMap = buildBoneMap(opts.boneNames || []);
    const A = this.applyingSide, T = this.treatedSide;
    const get = (role) => this.lookupBone(this.boneMap.map[role]) || null;

    this.bones = {
      chest: get('chest') || get('spine'),
      applyShoulder: get(`shoulder${A}`), applyUpper: get(`upperArm${A}`),
      applyFore: get(`forearm${A}`), applyHand: get(`hand${A}`),
      treatShoulder: get(`shoulder${T}`), treatUpper: get(`upperArm${T}`),
      treatFore: get(`forearm${T}`), treatHand: get(`hand${T}`),
    };

    // finger bones of the APPLYING hand, for the contact curl
    this.fingers = [];
    const suffix = A === 'R' ? '_r' : '_l';
    for (const f of FINGER_ROOTS) {
      const prox = this.lookupBone(`${f}_01${suffix}`);
      const mid = this.lookupBone(`${f}_02${suffix}`);
      if (prox || mid) this.fingers.push({ name: f, prox, mid });
    }

    this.ready = !!(this.bones.applyUpper && this.bones.applyFore && this.bones.applyHand
      && this.bones.treatUpper && this.bones.treatFore && this.bones.treatHand);

    // ---- capture the rest pose (the determinism anchor) ----
    this.rest = new Map();
    for (const b of Object.values(this.bones)) this._capture(b);
    for (const f of this.fingers) { this._capture(f.prox); this._capture(f.mid); }

    // Relaxed neutral hand positions, derived from each shoulder. Everything blends FROM here, so
    // the figure never shows the bind A-pose.
    this.neutral = { treated: new THREE.Vector3(), applying: new THREE.Vector3() };
    const no = this.tuning.neutralOffset;
    const place = (shoulderBone, sign, out) => {
      if (!shoulderBone) return;
      shoulderBone.getWorldPosition(out);
      out.set(out.x + no.x * sign, out.y + no.y, out.z + no.z);
    };
    place(this.bones.treatUpper, T === 'L' ? 1 : -1, this.neutral.treated);
    place(this.bones.applyUpper, A === 'L' ? 1 : -1, this.neutral.applying);

    // palm/finger axes of the applying hand, measured once in bind pose
    this.handFrame = { ok: false, palmLocal: new THREE.Vector3(0, 1, 0), fingersLocal: new THREE.Vector3(1, 0, 0) };
    if (this.bones.applyHand) {
      this.handFrame = measureHandFrame(this.bones.applyHand, {
        middle: this.lookupBone(`middle_01${suffix}`),
        index: this.lookupBone(`index_01${suffix}`),
        pinky: this.lookupBone(`pinky_01${suffix}`),
      }, A === 'L' ? 1 : -1);
    }

    this.lastFrame = null;
  }

  _capture(bone) {
    if (!bone || this.rest.has(bone)) return;
    this.rest.set(bone, {
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone(),
    });
  }

  /** Reset every driven bone to its rest transform. Called at the start of each solve. */
  restorePose() {
    for (const [bone, r] of this.rest) {
      bone.position.copy(r.position);
      bone.quaternion.copy(r.quaternion);
      bone.scale.copy(r.scale);
    }
    const root = this.bones.chest || this.bones.applyUpper;
    if (root) {
      let top = root; while (top.parent) top = top.parent;
      top.updateMatrixWorld(true);
    }
  }

  /** Outward (upper-surface) normal of the treated forearm at the current pose. */
  _forearmFrame() {
    this.bones.treatFore.getWorldPosition(_a);      // elbow
    this.bones.treatHand.getWorldPosition(_b);      // wrist
    _axis.copy(_b).sub(_a);
    const len = _axis.length() || 1;
    _axis.divideScalar(len);
    _up.set(0, 1, 0).addScaledVector(_axis, -_axis.y);
    if (_up.lengthSq() < 1e-8) _up.set(0, 0, 1);
    _up.normalize();
    return { elbow: _a.clone(), wrist: _b.clone(), axis: _axis.clone(), up: _up.clone(), length: len };
  }

  /**
   * Pose the skeleton for a normalized progress. PURE in `progress`.
   * @returns frame state including the MEASURED contact gap (never the authored assumption).
   */
  solve(progress) {
    const ch = choreographyAt(progress);
    if (!this.ready) return Object.freeze({ ...ch, contact: Object.freeze({ valid: false, gap: Infinity, reason: 'rig not ready' }), anchors: null });

    this.restorePose();

    // ---------- 1. treated arm presents the forearm ----------
    const chestPos = this.bones.chest ? this.bones.chest.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const o = this.tuning.presentOffset;
    _target.set(chestPos.x + o.x, chestPos.y + o.y, chestPos.z + o.z);
    // blend out of the RELAXED NEUTRAL carry (not the bind A-pose)
    _target.lerpVectors(this.neutral.treated, _target, ch.present.blend);

    this.bones.treatUpper.getWorldPosition(_c);
    const pt = this.tuning.poleTreated;
    _pole.set(_c.x + pt.x, _c.y + pt.y, _c.z + pt.z);
    const treatIK = solveTwoBoneIK(
      { root: this.bones.treatUpper, mid: this.bones.treatFore, tip: this.bones.treatHand },
      _target, _pole,
    );

    // ---------- 2. contact geometry, derived from the POSED forearm ----------
    const fa = this._forearmFrame();
    const axial = ch.apply.axial;
    const centre = fa.elbow.clone().lerp(fa.wrist, axial);
    _n.copy(fa.up);
    const skinPoint = centre.clone().addScaledVector(_n, this.forearmRadius);
    // Place the WRIST JOINT such that the PALM PATCH lands on skinPoint:
    //   palmPatch = wrist + fingers*palmForward + palmNormal*palmDepth,  palmNormal = -n
    // and the fingers are oriented along the forearm axis (step 4), so:
    //   wrist = skinPoint - axis*palmForward + n*palmDepth
    // Solving for the wrist this way is what actually removes the hover — targeting the wrist
    // directly leaves the palm one hand-thickness off the skin.
    const standoff = PARAMS.palmDepth - ch.apply.press + ch.apply.lift;
    const wristTarget = skinPoint.clone()
      .addScaledVector(fa.axis, -PARAMS.palmForward)
      .addScaledVector(_n, standoff);

    // ---------- 3. applying arm reaches the target ----------
    this.bones.applyUpper.getWorldPosition(_c);
    const pa = this.tuning.poleApplying;
    _pole.set(_c.x + pa.x, _c.y + pa.y, _c.z + pa.z);
    // before the approach starts the applying arm rests at its relaxed neutral position
    const applyTarget = this.neutral.applying.clone().lerp(wristTarget, ch.apply.blend);
    const applyIK = solveTwoBoneIK(
      { root: this.bones.applyUpper, mid: this.bones.applyFore, tip: this.bones.applyHand },
      applyTarget, _pole,
    );

    // ---------- 4. hand orientation: palm onto the skin, fingers along the arm ----------
    let palmDot = 0;
    if (this.handFrame.ok && ch.apply.blend > 1e-4) {
      const restQ = this.rest.get(this.bones.applyHand).quaternion;
      _palm.copy(_n).negate();                                  // palm faces INTO the forearm
      const r = orientHand(this.bones.applyHand, this.handFrame.palmLocal, this.handFrame.fingersLocal,
        _palm, fa.axis);
      palmDot = r.palmDot;
      // ease in from the rest orientation so the wrist never snaps
      const w = ch.apply.blend;
      const desired = this.bones.applyHand.quaternion.clone();
      this.bones.applyHand.quaternion.copy(restQ).slerp(desired, w);
      this.bones.applyHand.updateMatrixWorld(true);
    }

    // ---------- 5. soft finger curl while in contact ----------
    const curl = ch.apply.blend * (ch.apply.expectContact ? 1 : 0.35);
    if (curl > 1e-4) {
      for (const f of this.fingers) {
        const s = f.name === 'thumb' ? 0.5 : 1;
        if (f.prox) { f.prox.rotation.x -= this.tuning.fingerCurl.prox * curl * s; }
        if (f.mid) { f.mid.rotation.x -= this.tuning.fingerCurl.mid * curl * s; }
      }
      this.bones.applyHand.updateMatrixWorld(true);
    }

    // ---------- 6. MEASURE the result — never assume it ----------
    // The palm CONTACT PATCH, reconstructed from where the hand actually ended up — using the real
    // posed orientation, not the requested one, so a failed solve shows up as a real gap.
    const handWorldQ = this.bones.applyHand.getWorldQuaternion(new THREE.Quaternion());
    const wristPos = this.bones.applyHand.getWorldPosition(new THREE.Vector3());
    const fingersWorld = this.handFrame.fingersLocal.clone().applyQuaternion(handWorldQ).normalize();
    const palmWorld = this.handFrame.palmLocal.clone().applyQuaternion(handWorldQ).normalize();
    const palmCentre = wristPos.clone()
      .addScaledVector(fingersWorld, PARAMS.palmForward)
      .addScaledVector(palmWorld, PARAMS.palmDepth);
    // distance from the palm centre to the forearm SURFACE (cylinder of radius r about the axis)
    const rel = palmCentre.clone().sub(fa.elbow);
    const along = THREE.MathUtils.clamp(rel.dot(fa.axis), 0, fa.length);
    const nearestAxisPt = fa.elbow.clone().addScaledVector(fa.axis, along);
    const gap = palmCentre.distanceTo(nearestAxisPt) - this.forearmRadius;

    const contactAxial = fa.length > 1e-6 ? along / fa.length : 0;
    const valid = ch.apply.expectContact
      && Math.abs(gap) <= PARAMS.contactGapTolerance
      && contactAxial >= PARAMS.axialMin - 0.05 && contactAxial <= PARAMS.axialMax + 0.05;

    const anchors = {
      upper_body: chestPos.clone().add(new THREE.Vector3(0, 0.12, 0)),
      application: skinPoint.clone(),
      forearm: fa.elbow.clone().lerp(fa.wrist, 0.5).addScaledVector(fa.up, this.forearmRadius),
    };

    const frame = Object.freeze({
      progress: ch.progress,
      stage: ch.stage,
      choreography: ch,
      contact: Object.freeze({
        valid,
        gap,                       // >0 hovering, <0 penetrating, ~0 touching
        axial: contactAxial,
        palmDot,                   // 1 = palm squarely on the skin
        expected: ch.apply.expectContact,
        skinPoint: skinPoint.clone(),
        palmCentre,
      }),
      ik: Object.freeze({
        treated: { gap: treatIK.gap, elbowAngle: treatIK.elbowAngle, reached: treatIK.reached },
        applying: { gap: applyIK.gap, elbowAngle: applyIK.elbowAngle, reached: applyIK.reached },
      }),
      forearm: Object.freeze({ elbow: fa.elbow, wrist: fa.wrist, axis: fa.axis, up: fa.up, length: fa.length }),
      anchors,
    });
    this.lastFrame = frame;
    return frame;
  }

  /** Seek and reset are the same pure call — the determinism guarantee. */
  seek(p) { return this.solve(p); }
  reset() { return this.solve(0); }

  dispose() { this.rest.clear(); this.fingers.length = 0; this.lastFrame = null; }
}

export default ApplicationRig;
