// Phase-2 APPLICATION RIG — turns choreography numbers into an actual posed skeleton and product
// transform, and MEASURES whether the palm really reached the skin and whether the arm stayed
// outside the torso.
//
// Deliberately mesh-free: it operates on a bone hierarchy plus a name lookup, so the whole contact
// and collision solution can be exercised headlessly in Node against the real skeleton rebuilt from
// the glTF node graph. humanApplicationScene.js adds meshes, cream, lights and camera on top.
//
// DETERMINISM: IK is incremental by nature — it reads a bone's current world rotation and rotates
// from there. Left alone, frame N would depend on frame N-1 and seek/replay would drift.
// `restorePose()` resets every driven bone to its captured rest transform at the START of every
// solve, so solve(p) depends only on p. This is the most important invariant in this file.
//
// TORSO AVOIDANCE (polish pass): the applying wrist previously passed 36.9 mm INSIDE the trunk,
// because its IK target was lerped along a straight chord from beside the hip to in front of the
// chest — that chord goes through the body, which is exactly the "hand coming out of the torso"
// artefact. Two mechanisms now prevent it:
//   1. travel follows an ARC that bows away from the body (quadratic Bezier, outward control point);
//   2. every applying-hand target is finally CLAMPED out of a torso capsule.
// (2) is the guarantee: even if the choreography asks for something silly, the target cannot end up
// inside the chest. The measured clearance is reported on every frame so tests can assert it.

import * as THREE from '../../vendor/three/three.module.js';
import { solveTwoBoneIK, orientHand, measureHandFrame } from './twoBoneIK.js';
import { choreographyAt, PARAMS, TORSO } from './applicationChoreography.js';
import { buildBoneMap } from './boneMap.js';

/** Authored offsets, expressed relative to measured anatomy so they survive a re-export. */
export const RIG_TUNING = Object.freeze({
  // a closer, higher carry folds the elbow to ~100° — an arm held across the body
  presentOffset: { x: -0.05, y: 0.06, z: 0.26 },
  // Relaxed standing pose. The GLB bind pose is a wide A-pose, which reads as a shop mannequin.
  // x is mirrored per side and slightly OUTWARD so hands hang beside the hips.
  neutralOffset: { x: 0.015, y: -0.48, z: 0.04 },
  poleTreated: { x: 0.60, y: -0.70, z: 0.10 },
  // pushed further out and FORWARD: with the old pole the applying elbow tucked back into
  // the ribs at the far end of stroke 2 (measured -15 mm inside the torso capsule)
  poleApplying: { x: -0.72, y: -0.52, z: 0.38 },
  // Flexion axis verified empirically on this rig: local X, NEGATIVE direction curls into the palm.
  fingerCurl: { prox: 0.18, mid: 0.26, dist: 0.14 },
  // A fist closed around a 40 mm tube needs far more than the light application curl, and the
  // distal joint matters — without it the fingers read as splayed and the tube passes through them.
  gripCurl: { prox: 0.95, mid: 1.15, dist: 0.65 },
  fallbackRadius: 0.045,
  // where the tube ends up once stowed (offset from the applying shoulder)
  stowOffset: { x: 0.02, y: -0.46, z: 0.16 },
});

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _axis = new THREE.Vector3(), _up = new THREE.Vector3(), _n = new THREE.Vector3();
const _target = new THREE.Vector3(), _pole = new THREE.Vector3();

const FINGER_ROOTS = ['index', 'middle', 'ring', 'pinky', 'thumb'];

/** Quadratic Bezier — one control point is enough to bow a reach away from the body. */
function bezier2(out, a, c, b, t) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}

export class ApplicationRig {
  constructor(opts = {}) {
    this.lookupBone = opts.lookupBone || (() => null);
    this.applyingSide = opts.applyingSide === 'L' ? 'L' : 'R';
    this.treatedSide = this.applyingSide === 'R' ? 'L' : 'R';
    this.tuning = { ...RIG_TUNING, ...(opts.tuning || {}) };
    this.forearmRadius = Number.isFinite(opts.forearmRadius) && opts.forearmRadius > 0
      ? opts.forearmRadius : RIG_TUNING.fallbackRadius;
    /** Local +Y height of the tube's nozzle orifice, in tube space. */
    this.nozzleLocalY = Number.isFinite(opts.nozzleLocalY) ? opts.nozzleLocalY : 0.062;

    this.boneMap = buildBoneMap(opts.boneNames || []);
    const A = this.applyingSide, T = this.treatedSide;
    const get = (role) => this.lookupBone(this.boneMap.map[role]) || null;

    this.bones = {
      root: get('root'), chest: get('chest') || get('spine'), neck: get('neck'),
      applyShoulder: get(`shoulder${A}`), applyUpper: get(`upperArm${A}`),
      applyFore: get(`forearm${A}`), applyHand: get(`hand${A}`),
      treatShoulder: get(`shoulder${T}`), treatUpper: get(`upperArm${T}`),
      treatFore: get(`forearm${T}`), treatHand: get(`hand${T}`),
    };

    const suffix = A === 'R' ? '_r' : '_l';
    this.fingers = [];
    for (const f of FINGER_ROOTS) {
      const prox = this.lookupBone(`${f}_01${suffix}`);
      const mid = this.lookupBone(`${f}_02${suffix}`);
      const dist = this.lookupBone(`${f}_03${suffix}`);
      if (prox || mid || dist) this.fingers.push({ name: f, prox, mid, dist });
    }

    this.ready = !!(this.bones.applyUpper && this.bones.applyFore && this.bones.applyHand
      && this.bones.treatUpper && this.bones.treatFore && this.bones.treatHand);

    // ---- capture the rest pose (the determinism anchor) ----
    this.rest = new Map();
    for (const b of Object.values(this.bones)) this._capture(b);
    for (const f of this.fingers) { this._capture(f.prox); this._capture(f.mid); this._capture(f.dist); }

    // ---- torso capsule, measured from the skeleton ----
    const pelvis = this.bones.root ? this.bones.root.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const neckP = this.bones.neck ? this.bones.neck.getWorldPosition(new THREE.Vector3())
      : pelvis.clone().add(new THREE.Vector3(0, 0.55, 0));
    this.torso = { p0: pelvis, p1: neckP, radius: TORSO.radius, margin: TORSO.margin };

    // ---- relaxed neutral hand positions, derived from each shoulder ----
    this.neutral = { treated: new THREE.Vector3(), applying: new THREE.Vector3() };
    const no = this.tuning.neutralOffset;
    const place = (bone, sign, out) => {
      if (!bone) return;
      bone.getWorldPosition(out);
      out.set(out.x + no.x * sign, out.y + no.y, out.z + no.z);
    };
    place(this.bones.treatUpper, T === 'L' ? 1 : -1, this.neutral.treated);
    place(this.bones.applyUpper, A === 'L' ? 1 : -1, this.neutral.applying);

    // ---- where the tube goes once stowed ----
    this.stowPoint = new THREE.Vector3();
    if (this.bones.applyUpper) {
      this.bones.applyUpper.getWorldPosition(this.stowPoint);
      const so = this.tuning.stowOffset;
      this.stowPoint.set(this.stowPoint.x + so.x * (A === 'L' ? 1 : -1), this.stowPoint.y + so.y, this.stowPoint.z + so.z);
    }

    // ---- hand frame, measured once in bind pose ----
    this.handFrame = { ok: false, palmLocal: new THREE.Vector3(0, 1, 0), fingersLocal: new THREE.Vector3(1, 0, 0) };
    if (this.bones.applyHand) {
      this.handFrame = measureHandFrame(this.bones.applyHand, {
        middle: this.lookupBone(`middle_01${suffix}`),
        index: this.lookupBone(`index_01${suffix}`),
        pinky: this.lookupBone(`pinky_01${suffix}`),
      }, A === 'L' ? 1 : -1);
    }

    // ---- grip frame: the tube lies ACROSS the fist, nozzle toward the thumb side ----
    // tubeAxis is perpendicular to both the fingers and the palm normal, which is the axis a closed
    // fist wraps around. Derived from the measured hand frame so it adapts to any rig.
    const f = this.handFrame.fingersLocal.clone().normalize();
    const pl = this.handFrame.palmLocal.clone().normalize();
    this.gripAxisLocal = new THREE.Vector3().crossVectors(f, pl).normalize();       // tube +Y
    this.gripFrontLocal = new THREE.Vector3().crossVectors(this.gripAxisLocal, f).normalize(); // tube +Z (label)
    // Seat the tube against the PALM surface (out along the palm normal by roughly a tube radius),
    // only slightly along the fingers. The first attempt offset mostly along the fingers, which put
    // the barrel inside the finger geometry and hid the label behind the hand.
    this.gripOffsetLocal = f.clone().multiplyScalar(0.014).addScaledVector(pl, 0.026);

    this.lastFrame = null;
  }

  _capture(bone) {
    if (!bone || this.rest.has(bone)) return;
    this.rest.set(bone, {
      position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(),
    });
  }

  restorePose() {
    for (const [bone, r] of this.rest) {
      bone.position.copy(r.position); bone.quaternion.copy(r.quaternion); bone.scale.copy(r.scale);
    }
    const root = this.bones.chest || this.bones.applyUpper;
    if (root) { let top = root; while (top.parent) top = top.parent; top.updateMatrixWorld(true); }
  }

  /** Signed clearance of a world point from the torso capsule surface (<0 = inside). */
  torsoClearance(pt) {
    const ax = _v.copy(this.torso.p1).sub(this.torso.p0);
    const L = ax.length() || 1;
    ax.divideScalar(L);
    const t = THREE.MathUtils.clamp(_v2.copy(pt).sub(this.torso.p0).dot(ax), 0, L);
    const near = _v3.copy(this.torso.p0).addScaledVector(ax, t);
    return pt.distanceTo(near) - this.torso.radius;
  }

  /**
   * Push a world point radially out of the torso capsule if it is inside (or within the margin).
   * This is the hard guarantee behind "the hand never comes through the body".
   */
  pushOutOfTorso(pt, margin = this.torso.margin) {
    const ax = _v.copy(this.torso.p1).sub(this.torso.p0);
    const L = ax.length() || 1;
    ax.divideScalar(L);
    const t = THREE.MathUtils.clamp(_v2.copy(pt).sub(this.torso.p0).dot(ax), 0, L);
    const near = new THREE.Vector3().copy(this.torso.p0).addScaledVector(ax, t);
    const radial = new THREE.Vector3().copy(pt).sub(near);
    let d = radial.length();
    const need = this.torso.radius + margin;
    if (d >= need) return pt;
    if (d < 1e-5) { radial.set(0, 0, 1); d = 1e-5; }     // dead centre: push straight forward
    radial.divideScalar(d);
    return pt.copy(near).addScaledVector(radial, need);
  }

  /** Outward (upper-surface) frame of the treated forearm at the current pose. */
  _forearmFrame() {
    this.bones.treatFore.getWorldPosition(_v);
    this.bones.treatHand.getWorldPosition(_v2);
    const elbow = _v.clone(), wrist = _v2.clone();
    _axis.copy(wrist).sub(elbow);
    const len = _axis.length() || 1;
    _axis.divideScalar(len);
    _up.set(0, 1, 0).addScaledVector(_axis, -_axis.y);
    if (_up.lengthSq() < 1e-8) _up.set(0, 0, 1);
    _up.normalize();
    return { elbow, wrist, axis: _axis.clone(), up: _up.clone(), length: len };
  }

  /**
   * Travel arc from `from` to `to` that bows AWAY from the torso, so the hand swings around the
   * body instead of cutting through it.
   */
  _arcTo(out, from, to, t) {
    const mid = _v.copy(from).lerp(to, 0.5);
    // outward = radially away from the torso axis at the midpoint, plus a forward bias
    const ax = _v2.copy(this.torso.p1).sub(this.torso.p0).normalize();
    const rel = _v3.copy(mid).sub(this.torso.p0);
    const radial = rel.addScaledVector(ax, -rel.dot(ax));
    if (radial.lengthSq() < 1e-8) radial.set(0, 0, 1);
    radial.normalize();
    const ctrl = mid.clone()
      .addScaledVector(radial, TORSO.arcBulge * 0.55)
      .add(new THREE.Vector3(0, 0, TORSO.arcBulge * 0.75));   // forward, in front of the chest
    bezier2(out, from, ctrl, to, t);
    return this.pushOutOfTorso(out);
  }

  /** Pose the skeleton (and the product) for a normalized progress. PURE in `progress`. */
  solve(progress) {
    const ch = choreographyAt(progress);
    if (!this.ready) {
      return Object.freeze({
        ...ch, contact: Object.freeze({ valid: false, gap: Infinity, reason: 'rig not ready' }),
        anchors: null, productPose: null,
      });
    }

    this.restorePose();

    // ---------- 1. treated arm presents the forearm ----------
    const chestPos = this.bones.chest ? this.bones.chest.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const o = this.tuning.presentOffset;
    _target.set(chestPos.x + o.x, chestPos.y + o.y, chestPos.z + o.z);
    _target.lerpVectors(this.neutral.treated, _target, ch.present.blend);
    this.bones.treatUpper.getWorldPosition(_v);
    const pt = this.tuning.poleTreated;
    _pole.set(_v.x + pt.x, _v.y + pt.y, _v.z + pt.z);
    const treatIK = solveTwoBoneIK(
      { root: this.bones.treatUpper, mid: this.bones.treatFore, tip: this.bones.treatHand }, _target, _pole,
    );

    // ---------- 2. contact geometry, derived from the POSED forearm ----------
    const fa = this._forearmFrame();
    const centre = fa.elbow.clone().lerp(fa.wrist, ch.apply.axial);
    _n.copy(fa.up);
    const skinPoint = centre.clone().addScaledVector(_n, this.forearmRadius);
    const depositCentre = fa.elbow.clone().lerp(fa.wrist, PARAMS.depositAxial);
    const depositPoint = depositCentre.clone().addScaledVector(_n, this.forearmRadius);

    // ---------- 3. applying arm ----------
    this.bones.applyUpper.getWorldPosition(_v);
    const pa = this.tuning.poleApplying;
    _pole.set(_v.x + pa.x, _v.y + pa.y, _v.z + pa.z);

    let wristTarget = new THREE.Vector3();
    let nozzleDir = null, nozzleTarget = null;
    const chain = { root: this.bones.applyUpper, mid: this.bones.applyFore, tip: this.bones.applyHand };

    if (ch.mode === 'product') {
      // The hand is placed so the NOZZLE lands where we want, not the palm.
      // nozzle direction: starts upright (label to camera), tilts over the site as `aim` rises.
      const theta = ch.product.aim * 2.7;                       // up -> ~155 degrees over
      nozzleDir = new THREE.Vector3(0, 1, 0).applyAxisAngle(fa.axis, theta).normalize();
      const height = PARAMS.productShowHeight + (PARAMS.nozzleHeight - PARAMS.productShowHeight) * ch.product.aim;
      nozzleTarget = depositPoint.clone().addScaledVector(_n, height);
      // during the raise, keep the tube forward of the body so the label is unobstructed
      nozzleTarget.z += 0.17 * (1 - ch.product.aim);   // forward, clear of the presented arm

      // label faces camera-ish; blended with the arm axis once tilted so the tube reads side-on
      const labelDir = new THREE.Vector3(0.25, 0.10, 1).normalize();
      const handQ = this._solveHandOrientation(nozzleDir, labelDir);
      // wrist = nozzleTarget - Q * (gripOffset + gripQuat * (0, nozzleY, 0))
      const gripToNozzle = this.gripAxisLocal.clone().multiplyScalar(this.nozzleLocalY);
      const armOffset = this.gripOffsetLocal.clone().add(gripToNozzle).applyQuaternion(handQ);
      wristTarget.copy(nozzleTarget).sub(armOffset);

      // arc up from the neutral carry, and out of the torso
      const raiseT = ch.product.raise * (1 - ch.product.stow) + (1 - ch.product.stow) * 0;
      const from = this.neutral.applying;
      this._arcTo(wristTarget, from, wristTarget, Math.max(raiseT, ch.product.aim > 0 ? 1 : raiseT));
      if (ch.product.stow > 0) {
        // lower back toward the neutral carry, again on an arc
        const down = new THREE.Vector3();
        this._arcTo(down, wristTarget.clone(), from, ch.product.stow);
        wristTarget.copy(down);
      }
      this.pushOutOfTorso(wristTarget);
      solveTwoBoneIK(chain, wristTarget, _pole);
      this._applyHandOrientation(handQ, Math.min(1, ch.product.raise * 1.6) * (1 - ch.product.stow * 0.85));
    } else {
      // Application act: place the wrist so the PALM PATCH lands on the skin.
      const standoff = PARAMS.palmDepth - ch.apply.press + ch.apply.lift;
      const palmWrist = skinPoint.clone()
        .addScaledVector(fa.axis, -PARAMS.palmForward)
        .addScaledVector(_n, standoff);
      this._arcTo(wristTarget, this.neutral.applying, palmWrist, ch.apply.blend);
      this.pushOutOfTorso(wristTarget);
      solveTwoBoneIK(chain, wristTarget, _pole);

      if (this.handFrame.ok && ch.apply.blend > 1e-4) {
        const q = this._solveHandOrientation(_n.clone().negate(), fa.axis, true);
        this._applyHandOrientation(q, ch.apply.blend);
      }
    }

    const applyIK = solveTwoBoneIK(chain, wristTarget, _pole);

    // ---------- 4. fingers ----------
    const gripping = ch.mode === 'product';
    const curlAmt = gripping
      ? Math.min(1, ch.product.raise * 1.5) * (1 - ch.product.stow)
      : ch.apply.blend * (ch.apply.expectContact ? 1 : 0.35);
    const curlSet = gripping ? this.tuning.gripCurl : this.tuning.fingerCurl;
    if (curlAmt > 1e-4) {
      for (const f of this.fingers) {
        const s = f.name === 'thumb' ? 0.45 : 1;
        if (f.prox) f.prox.rotation.x -= curlSet.prox * curlAmt * s;
        if (f.mid) f.mid.rotation.x -= curlSet.mid * curlAmt * s;
        if (f.dist) f.dist.rotation.x -= (curlSet.dist || 0) * curlAmt * s;
      }
      this.bones.applyHand.updateMatrixWorld(true);
    }

    // ---------- 5. product transform (never parented — keeps stowing deterministic) ----------
    const productPose = this._productPose(ch);

    // ---------- 6. MEASURE — never assume ----------
    const handWorldQ = this.bones.applyHand.getWorldQuaternion(new THREE.Quaternion());
    const wristPos = this.bones.applyHand.getWorldPosition(new THREE.Vector3());
    const fingersWorld = this.handFrame.fingersLocal.clone().applyQuaternion(handWorldQ).normalize();
    const palmWorld = this.handFrame.palmLocal.clone().applyQuaternion(handWorldQ).normalize();
    const palmCentre = wristPos.clone()
      .addScaledVector(fingersWorld, PARAMS.palmForward)
      .addScaledVector(palmWorld, PARAMS.palmDepth);

    const rel = palmCentre.clone().sub(fa.elbow);
    const along = THREE.MathUtils.clamp(rel.dot(fa.axis), 0, fa.length);
    const nearestAxisPt = fa.elbow.clone().addScaledVector(fa.axis, along);
    const gap = palmCentre.distanceTo(nearestAxisPt) - this.forearmRadius;
    const contactAxial = fa.length > 1e-6 ? along / fa.length : 0;

    const valid = ch.apply.expectContact
      && Math.abs(gap) <= PARAMS.contactGapTolerance
      && contactAxial >= PARAMS.axialMin - 0.05 && contactAxial <= PARAMS.axialMax + 0.05;

    // torso clearance for the whole applying chain, not just the wrist
    const elbowPos = this.bones.applyFore.getWorldPosition(new THREE.Vector3());
    const wristClear = this.torsoClearance(wristPos);
    const palmClear = this.torsoClearance(palmCentre);
    const elbowClear = this.torsoClearance(elbowPos);
    const minClear = Math.min(wristClear, palmClear, elbowClear);

    // nozzle in world space, for the dispenser
    const nozzleWorld = productPose
      ? new THREE.Vector3(0, this.nozzleLocalY, 0).applyQuaternion(productPose.quaternion).add(productPose.position)
      : null;

    const anchors = {
      upper_body: chestPos.clone().add(new THREE.Vector3(0, 0.12, 0)),
      application: skinPoint.clone(),
      forearm: fa.elbow.clone().lerp(fa.wrist, 0.5).addScaledVector(fa.up, this.forearmRadius),
      product: productPose ? productPose.position.clone() : chestPos.clone(),
      dispense: nozzleWorld ? nozzleWorld.clone().lerp(depositPoint, 0.5) : depositPoint.clone(),
    };

    const frame = Object.freeze({
      progress: ch.progress, stage: ch.stage, mode: ch.mode, choreography: ch,
      contact: Object.freeze({
        valid, gap, axial: contactAxial, expected: ch.apply.expectContact,
        palmDot: palmWorld.dot(_n.clone().negate()),
        skinPoint: skinPoint.clone(), palmCentre,
      }),
      clearance: Object.freeze({
        wrist: wristClear, palm: palmClear, elbow: elbowClear, min: minClear,
        safe: minClear > 0,
      }),
      ik: Object.freeze({
        treated: { gap: treatIK.gap, elbowAngle: treatIK.elbowAngle, reached: treatIK.reached },
        applying: { gap: applyIK.gap, elbowAngle: applyIK.elbowAngle, reached: applyIK.reached },
      }),
      forearm: Object.freeze({ ...fa, radius: this.forearmRadius }),
      deposit: Object.freeze({ point: depositPoint, normal: _n.clone() }),
      productPose, nozzleWorld, nozzleDir,
      anchors,
    });
    this.lastFrame = frame;
    return frame;
  }

  /** World quaternion for the applying hand that aims `primary`/`secondary` local axes. */
  _solveHandOrientation(worldPrimary, worldSecondary, usePalm = false) {
    const localPrimary = usePalm ? this.handFrame.palmLocal : this.gripAxisLocal;
    const localSecondary = usePalm ? this.handFrame.fingersLocal : this.gripFrontLocal;
    const saved = this.bones.applyHand.quaternion.clone();
    orientHand(this.bones.applyHand, localPrimary, localSecondary, worldPrimary, worldSecondary);
    const q = this.bones.applyHand.quaternion.clone();
    this.bones.applyHand.quaternion.copy(saved);
    this.bones.applyHand.updateMatrixWorld(true);
    return q;
  }

  /** Blend the hand from its rest orientation toward `q` (a LOCAL quaternion). */
  _applyHandOrientation(q, weight) {
    const restQ = this.rest.get(this.bones.applyHand).quaternion;
    this.bones.applyHand.quaternion.copy(restQ).slerp(q, THREE.MathUtils.clamp(weight, 0, 1));
    this.bones.applyHand.updateMatrixWorld(true);
  }

  /** World transform of the tube: in the grip while held, easing to the stow point afterwards. */
  _productPose(ch) {
    if (!ch.product.visible) return null;
    const handM = this.bones.applyHand.matrixWorld;
    const handPos = new THREE.Vector3().setFromMatrixPosition(handM);
    const handQ = new THREE.Quaternion().setFromRotationMatrix(handM);

    // grip pose: offset into the fist, tube axis along the grip axis
    const gripQ = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(
        new THREE.Vector3().crossVectors(this.gripAxisLocal, this.gripFrontLocal).normalize(),
        this.gripAxisLocal, this.gripFrontLocal,
      ),
    );
    const held = {
      position: this.gripOffsetLocal.clone().applyQuaternion(handQ).add(handPos),
      quaternion: handQ.clone().multiply(gripQ),
    };
    if (ch.product.stow <= 0) return held;

    const stowQ = new THREE.Quaternion();     // upright at the stow point
    const s = ch.product.stow;
    return {
      position: held.position.clone().lerp(this.stowPoint, s),
      quaternion: held.quaternion.clone().slerp(stowQ, s),
      stowed: s >= 0.999,
    };
  }

  seek(p) { return this.solve(p); }
  reset() { return this.solve(0); }
  dispose() { this.rest.clear(); this.fingers.length = 0; this.lastFrame = null; }
}

export default ApplicationRig;
