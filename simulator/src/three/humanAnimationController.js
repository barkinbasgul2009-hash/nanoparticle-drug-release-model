// Minimal topical-application animation controller (Phase-0 patch: skeleton + contract only).
//
// TIME RULE: this controller has NO clock of its own. `apply(progress)` is a PURE function of the
// master timeline's normalized progress, so play / pause / seek / reset / replay are the same code
// path and always reproduce the same pose. An AnimationMixer, when clips exist, is driven with
// `mixer.setTime(progress * duration)` — never `mixer.update(delta)` as a narrative source.
//
// Scope: only what the topical application needs. NOT a general IK framework.

import { buildBoneMap, clampJoint, REQUIRED_ROLES } from './boneMap.js';

/** Application stages over normalized progress (matches the storyboard's S1->S2 beats). */
export const APPLICATION_STAGES = Object.freeze([
  { id: 'idle',            t0: 0.00, t1: 0.25 },
  { id: 'present_forearm', t0: 0.25, t1: 0.45 },
  { id: 'reach',           t0: 0.45, t1: 0.62 },
  { id: 'apply_cream',     t0: 0.62, t1: 0.85 },
  { id: 'return_neutral',  t0: 0.85, t1: 1.00 },
]);

/** Smoothstep easing (deterministic, no time dependence). */
export const ease = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Local progress within a stage, 0 outside it. */
export function stageProgress(stageId, progress) {
  const s = APPLICATION_STAGES.find((x) => x.id === stageId);
  if (!s) return 0;
  if (progress <= s.t0) return 0;
  if (progress >= s.t1) return 1;
  return (progress - s.t0) / (s.t1 - s.t0);
}

export function stageAt(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  let s = APPLICATION_STAGES[0];
  for (const st of APPLICATION_STAGES) if (p >= st.t0) s = st;
  return s;
}

/**
 * Deterministic target joint rotations (radians) for a given progress. Pure data — no Three.js
 * dependency — so it is unit-testable headless and reusable by Phase 2's scene code.
 * All values pass through anatomical clamps to prevent dislocation / hyperextension / inversion.
 * `side` = the arm that APPLIES the cream (the other arm is presented).
 */
export function poseFor(progress, { side = 'R' } = {}) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const present = ease(stageProgress('present_forearm', p));
  const reach = ease(stageProgress('reach', p));
  const applyP = stageProgress('apply_cream', p);
  const back = ease(stageProgress('return_neutral', p));
  const active = 1 - back;                                  // everything relaxes on the way back

  // rubbing is a bounded oscillation, deterministic in progress (never wall-clock)
  const rub = Math.sin(applyP * Math.PI * 6) * 0.10 * (applyP > 0 && applyP < 1 ? 1 : 0);

  const presentSide = side === 'R' ? 'L' : 'R';             // forearm being treated
  const pose = {};
  // treated arm: lifts and rotates to present the forearm
  pose[`shoulder${presentSide}`] = clampJoint('shoulder', 0.35 * present * active);
  pose[`upperArm${presentSide}`] = clampJoint('upperArm', 0.55 * present * active);
  pose[`forearm${presentSide}`] = clampJoint('forearm', 1.05 * present * active);   // elbow flexion only
  pose[`hand${presentSide}`] = clampJoint('wrist', 0.15 * present * active);
  // applying arm: reaches across, then rubs
  pose[`shoulder${side}`] = clampJoint('shoulder', (0.30 * reach + rub * 0.3) * active);
  pose[`upperArm${side}`] = clampJoint('upperArm', (0.70 * reach + rub) * active);
  pose[`forearm${side}`] = clampJoint('forearm', (1.35 * reach + rub * 0.6) * active);
  pose[`hand${side}`] = clampJoint('wrist', (0.20 * reach + rub * 0.5) * active);
  return Object.freeze({ stage: stageAt(p).id, side, rotations: Object.freeze(pose) });
}

export class HumanAnimationController {
  /**
   * @param {{ root?:object, boneNames?:string[], mixer?:object, clip?:object, side?:string,
   *           lookupBone?:(name:string)=>any }} opts
   */
  constructor(opts = {}) {
    this.root = opts.root || null;
    this.side = opts.side || 'R';
    this.mixer = opts.mixer || null;                 // optional THREE.AnimationMixer
    this.clip = opts.clip || null;                   // optional THREE.AnimationClip
    this.action = null;
    this.lookupBone = opts.lookupBone || null;
    this.boneMap = buildBoneMap(opts.boneNames || []);
    this.lastProgress = null;
    this.disposed = false;
  }

  /** True when the rig can drive the required motion. */
  get ready() { return this.boneMap.ok; }
  get missingRoles() { return this.boneMap.missingRequired; }

  /** Bind an optional clip; its time is SET from progress, never advanced by a delta. */
  bindClip(mixer, clip) {
    this.mixer = mixer; this.clip = clip;
    if (mixer && clip) { this.action = mixer.clipAction(clip); this.action.play(); this.action.paused = true; }
    return this;
  }

  /**
   * Apply the pose for a normalized master-timeline progress. Pure: same progress -> same pose.
   * @returns {{ stage:string, applied:string[], skipped:string[] }}
   */
  apply(progress) {
    if (this.disposed) return { stage: null, applied: [], skipped: [] };
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    this.lastProgress = p;
    const pose = poseFor(p, { side: this.side });
    const applied = []; const skipped = [];

    // clip time is DERIVED from progress (no independent clock)
    if (this.action && this.clip) { this.action.time = p * (this.clip.duration || 0); if (this.mixer && this.mixer.update) this.mixer.update(0); }

    for (const [role, rot] of Object.entries(pose.rotations)) {
      const name = this.boneMap.map[role];
      const bone = name && this.lookupBone ? this.lookupBone(name) : null;
      if (!bone || !bone.rotation) { skipped.push(role); continue; }
      // rotate about X (flexion) — the only axis this controller drives
      bone.rotation.x = rot;
      applied.push(role);
    }
    return { stage: pose.stage, applied, skipped };
  }

  /** Seek and reset are the same pure call — guarantees replay determinism. */
  seek(progress) { return this.apply(progress); }
  reset() { return this.apply(0); }

  dispose() {
    if (this.action && this.action.stop) this.action.stop();
    if (this.mixer && this.mixer.stopAllAction) this.mixer.stopAllAction();
    this.action = null; this.mixer = null; this.clip = null; this.disposed = true;
  }
}

export { REQUIRED_ROLES };
export default HumanAnimationController;
