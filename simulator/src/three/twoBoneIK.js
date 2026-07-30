// Analytic two-bone IK (shoulder -> elbow -> wrist). Phase 2.
//
// WHY IK AND NOT FK: measured on the real rig, the right shoulder sits 0.662 m from the left
// forearm while the whole arm is only 0.518 m long (upper 0.2515 + fore 0.2667). Hand-authored
// FK Euler angles cannot guarantee contact — any change to the presented arm silently breaks it.
// Solving the applying arm TO A TARGET derived from the posed forearm makes contact structural:
// if the target is on the skin, the hand is on the skin.
//
// The solver is closed-form (law of cosines), so it is a PURE function of its inputs: no
// iteration, no convergence tolerance, no accumulated state. Same target -> same pose, which is
// what play / pause / seek / reset / replay determinism requires.

import * as THREE from '../../vendor/three/three.module.js';

// scratch objects — module-local and fully overwritten on every call, so they carry no state
// between invocations (determinism is unaffected).
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _root = new THREE.Vector3(), _mid = new THREE.Vector3(), _tip = new THREE.Vector3();
const _dirT = new THREE.Vector3(), _pole = new THREE.Vector3(), _newMid = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _oldDir = new THREE.Vector3(), _newDir = new THREE.Vector3();

/** Clamp helper that never returns NaN for degenerate input. */
const clamp = (v, lo, hi) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo);

/** Rotate `bone` so the world direction `oldDir` ends up pointing along `newDir`. */
function aimBone(bone, oldDir, newDir) {
  if (oldDir.lengthSq() < 1e-12 || newDir.lengthSq() < 1e-12) return;
  _q.setFromUnitVectors(oldDir.clone().normalize(), newDir.clone().normalize());
  bone.getWorldQuaternion(_qw);
  _qw.premultiply(_q);                                  // desired world rotation
  if (bone.parent) { bone.parent.getWorldQuaternion(_qp); _qp.invert(); _qw.premultiply(_qp); }
  bone.quaternion.copy(_qw);
  bone.updateMatrixWorld(true);
}

/**
 * Solve a two-bone chain so `tip` lands on `target`.
 *
 * @param {{root:THREE.Object3D, mid:THREE.Object3D, tip:THREE.Object3D}} chain
 * @param {THREE.Vector3} target   desired WORLD position of the tip
 * @param {THREE.Vector3} pole     world-space hint for which way the elbow points
 * @param {{ maxReachFactor?:number, minBend?:number }} [opts]
 *   maxReachFactor caps how straight the arm may lock (0.995 keeps a soft elbow instead of a
 *   hyperextended snap when the target is out of range).
 * @returns {{ reached:boolean, distance:number, reach:number, elbowAngle:number, gap:number }}
 *   `gap` is how far the tip ended up from the requested target (0 when the target is reachable).
 */
export function solveTwoBoneIK(chain, target, pole, opts = {}) {
  const { maxReachFactor = 0.995 } = opts;
  const { root, mid, tip } = chain;
  if (!root || !mid || !tip) return { reached: false, distance: 0, reach: 0, elbowAngle: 0, gap: Infinity };

  root.updateMatrixWorld(true);
  root.getWorldPosition(_root); mid.getWorldPosition(_mid); tip.getWorldPosition(_tip);

  const L1 = _root.distanceTo(_mid);
  const L2 = _mid.distanceTo(_tip);
  const reach = L1 + L2;
  if (L1 < 1e-6 || L2 < 1e-6) return { reached: false, distance: 0, reach, elbowAngle: 0, gap: Infinity };

  const rawDist = _root.distanceTo(target);
  // never ask for a fully locked or collapsed elbow — both read as a broken joint
  const d = clamp(rawDist, Math.abs(L1 - L2) + 1e-4, reach * maxReachFactor);

  _dirT.copy(target).sub(_root);
  if (_dirT.lengthSq() < 1e-12) _dirT.set(0, -1, 0);
  _dirT.normalize();

  // pole direction = the part of (pole - root) perpendicular to the target direction
  _pole.copy(pole).sub(_root);
  _pole.addScaledVector(_dirT, -_pole.dot(_dirT));
  if (_pole.lengthSq() < 1e-10) {
    // degenerate pole (collinear with the target): fall back to any stable perpendicular
    _pole.set(0, 1, 0).addScaledVector(_dirT, -_dirT.y);
    if (_pole.lengthSq() < 1e-10) _pole.set(1, 0, 0).addScaledVector(_dirT, -_dirT.x);
  }
  _pole.normalize();

  // law of cosines: angle at the root between the target line and the upper segment
  const cosRoot = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const angleRoot = Math.acos(cosRoot);
  const cosElbow = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
  const elbowAngle = Math.acos(cosElbow);

  // where the elbow must be
  _newMid.copy(_root)
    .addScaledVector(_dirT, Math.cos(angleRoot) * L1)
    .addScaledVector(_pole, Math.sin(angleRoot) * L1);

  // 1. aim the upper segment at the new elbow
  _oldDir.copy(_mid).sub(_root);
  _newDir.copy(_newMid).sub(_root);
  aimBone(root, _oldDir, _newDir);

  // 2. aim the lower segment from the (now moved) elbow at the target
  mid.getWorldPosition(_v1); tip.getWorldPosition(_v2);
  _oldDir.copy(_v2).sub(_v1);
  _newDir.copy(target).sub(_v1);
  aimBone(mid, _oldDir, _newDir);

  tip.getWorldPosition(_v3);
  return {
    reached: rawDist <= reach * maxReachFactor,
    distance: rawDist,
    reach,
    elbowAngle,
    gap: _v3.distanceTo(target),
  };
}

/**
 * Orient a hand so its palm faces `palmTarget` and its fingers point along `fingerTarget`.
 * `palmLocal` / `fingersLocal` are unit vectors in the BONE'S OWN local frame, measured once from
 * the bind pose (see measureHandFrame) — that keeps the solver independent of any particular rig's
 * axis conventions.
 *
 * @returns {{ palmDot:number }} how well the palm ended up facing the requested direction (1 = exact)
 */
export function orientHand(hand, palmLocal, fingersLocal, palmTarget, fingerTarget) {
  if (!hand) return { palmDot: 0 };
  // local basis: fingers (x), palm (y), and their cross (z)
  const fx = fingersLocal.clone().normalize();
  const py = palmLocal.clone().normalize();
  // orthonormalise the local pair so the basis is a pure rotation
  py.addScaledVector(fx, -py.dot(fx)).normalize();
  const fz = new THREE.Vector3().crossVectors(fx, py);
  const mLocal = new THREE.Matrix4().makeBasis(fx, py, fz);

  // desired world basis
  const wy = palmTarget.clone().normalize();
  const wx = fingerTarget.clone().normalize();
  wx.addScaledVector(wy, -wx.dot(wy));
  if (wx.lengthSq() < 1e-10) wx.set(1, 0, 0).addScaledVector(wy, -wy.x);
  wx.normalize();
  const wz = new THREE.Vector3().crossVectors(wx, wy);
  const mWorld = new THREE.Matrix4().makeBasis(wx, wy, wz);

  // R = worldBasis * localBasis^-1
  const r = mWorld.multiply(mLocal.invert());
  const qWorld = new THREE.Quaternion().setFromRotationMatrix(r);
  if (hand.parent) {
    const qp = new THREE.Quaternion();
    hand.parent.getWorldQuaternion(qp);
    qWorld.premultiply(qp.invert());
  }
  hand.quaternion.copy(qWorld);
  hand.updateMatrixWorld(true);

  const check = palmLocal.clone().applyQuaternion(hand.getWorldQuaternion(new THREE.Quaternion())).normalize();
  return { palmDot: check.dot(palmTarget.clone().normalize()) };
}

/**
 * Measure a hand's palm-normal and finger direction in ITS OWN local frame, from the current
 * (bind) pose. Done once at load so orientHand() works on any rig without hardcoded axes.
 *
 * @param {THREE.Object3D} hand
 * @param {{middle:THREE.Object3D, index:THREE.Object3D, pinky:THREE.Object3D}} digits
 * @param {number} sideSign +1 for the left hand, -1 for the right (flips the palm normal)
 */
export function measureHandFrame(hand, digits, sideSign = 1) {
  const out = { fingersLocal: new THREE.Vector3(1, 0, 0), palmLocal: new THREE.Vector3(0, 1, 0), ok: false };
  if (!hand || !digits || !digits.middle || !digits.index || !digits.pinky) return out;

  const hp = hand.getWorldPosition(new THREE.Vector3());
  const fingers = digits.middle.getWorldPosition(new THREE.Vector3()).sub(hp);
  const across = digits.pinky.getWorldPosition(new THREE.Vector3())
    .sub(digits.index.getWorldPosition(new THREE.Vector3()));
  if (fingers.lengthSq() < 1e-10 || across.lengthSq() < 1e-10) return out;
  fingers.normalize(); across.normalize();

  const palm = new THREE.Vector3().crossVectors(fingers, across).normalize().multiplyScalar(sideSign);

  // convert both into the hand's local frame
  const qInv = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
  out.fingersLocal = fingers.clone().applyQuaternion(qInv).normalize();
  out.palmLocal = palm.clone().applyQuaternion(qInv).normalize();
  out.ok = true;
  return out;
}

export default solveTwoBoneIK;
