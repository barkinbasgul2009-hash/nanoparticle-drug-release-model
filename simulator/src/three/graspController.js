// Phase-2 OBJECT-AWARE GRASP CONTROLLER.
//
// Replaces the previous behaviour, where every finger joint was driven by ONE scalar in the SAME
// proportion. That produced the "circular cage" silhouette: five identical arcs of identical
// curvature, which no human hand makes, because fingers differ in length and sit at different
// distances from the object.
//
// WHAT THIS DOES INSTEAD
// ----------------------
// The wrap angle of each finger is derived from GEOMETRY: a finger of length L closing around a
// cylinder of radius r sweeps roughly L / (r + softTissue) radians in total, distributed across
// MCP / PIP / DIP in the ~45 / 35 / 20 proportion of a real power grip. Measured on this rig the
// fingers are index 53.4, middle 66.7, ring 59.5, little 40.2 mm — so the little finger closes far
// less than the middle finger, and the silhouette stops being a ring.
//
// AXES WERE MEASURED, NOT ASSUMED (probe against the real skeleton):
//   flexion            local X, NEGATIVE  (index MCP -0.5 rad -> +19.6 mm toward the palm)
//   abduction/spread   local Z            (+0.5 rad -> +24.4 mm across the palm, ~0 flexion)
//   thumb CMC opposition local Z, POSITIVE (+0.5 rad -> +27.2 mm palmward, +21.4 mm distally)
//   thumb MCP flexion    local Z, POSITIVE
//
// Everything is a pure function of (gripAmount, squeeze) — no state is carried between calls, so
// seek and replay reproduce the grip exactly.

/** Grip phases, in order. `gripStateAt` maps a 0..1 grip amount onto them. */
export const GRIP_STATES = Object.freeze([
  'OPEN', 'PRE_SHAPE', 'APPROACH', 'FIRST_CONTACT', 'POWER_GRIP', 'SQUEEZE', 'HOLD', 'RELEASE', 'RELAXED',
]);

/** Where each phase sits on the 0..1 grip ramp. */
export const GRIP_PHASES = Object.freeze([
  { id: 'OPEN',          t0: 0.00, t1: 0.08 },
  { id: 'PRE_SHAPE',     t0: 0.08, t1: 0.30 },   // fingers shape to the object before touching it
  { id: 'APPROACH',      t0: 0.30, t1: 0.55 },
  { id: 'FIRST_CONTACT', t0: 0.55, t1: 0.72 },   // pads land, proximal first
  { id: 'POWER_GRIP',    t0: 0.72, t1: 1.00 },
]);

/**
 * Per-finger anatomy. `lengthMm` is measured from the rig; `reach` is how far the base sits from
 * the object (the little finger sits further round the barrel, so it wraps less than its length
 * alone suggests). `spread` is resting abduction — a real hand is not a flat comb.
 * `lead` staggers closure so the fingers do not all land on the same frame.
 */
export const FINGER_ANATOMY = Object.freeze({
  index:  { lengthMm: 53.4, reach: 1.00, spread: -0.10, lead: 0.00 },
  middle: { lengthMm: 66.7, reach: 1.00, spread: -0.02, lead: 0.04 },
  ring:   { lengthMm: 59.5, reach: 0.94, spread: 0.05, lead: 0.08 },
  pinky:  { lengthMm: 40.2, reach: 0.86, spread: 0.13, lead: 0.12 },
});

/** Power-grip distribution of total wrap across the three joints. */
export const JOINT_SHARE = Object.freeze({ mcp: 0.45, pip: 0.35, dip: 0.20 });

/** Anatomical flexion ceilings (radians) so no joint folds past a real hand's range. */
export const JOINT_LIMITS = Object.freeze({
  mcp: 1.55, pip: 1.75, dip: 1.40,
  thumbCmcOppose: 1.05, thumbCmcAbduct: 0.55, thumbMcp: 0.85, thumbIp: 0.75,
});

/** Soft-tissue allowance added to the object radius — finger pads compress, they do not point. */
export const PAD_THICKNESS_M = 0.009;

const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
/** Minimum-jerk: zero velocity AND zero acceleration at both ends. */
export const minJerk = (x) => { const t = clamp01(x); return t * t * t * (10 - 15 * t + 6 * t * t); };

/** Which grip phase a 0..1 grip amount is in. */
export function gripStateAt(gripAmount, { releasing = false, squeeze = 0 } = {}) {
  const g = clamp01(gripAmount);
  if (releasing) return g > 0.05 ? 'RELEASE' : 'RELAXED';
  if (squeeze > 0.02 && g > 0.9) return 'SQUEEZE';
  let s = GRIP_PHASES[0];
  for (const ph of GRIP_PHASES) if (g >= ph.t0) s = ph;
  if (s.id === 'POWER_GRIP' && squeeze <= 0.02 && g >= 0.999) return 'HOLD';
  return s.id;
}

/**
 * Total wrap angle for one finger around a cylinder.
 * @param {string} name finger key in FINGER_ANATOMY
 * @param {number} objectRadiusM cylinder radius at that finger, metres
 */
export function wrapAngleFor(name, objectRadiusM) {
  const a = FINGER_ANATOMY[name];
  if (!a) return 0;
  const L = (a.lengthMm / 1000) * a.reach;
  const effR = Math.max(0.006, objectRadiusM + PAD_THICKNESS_M);
  // arc length / radius, capped so a short finger on a fat tube cannot ask for a full curl
  return clamp(L / effR, 0.0, 3.4);
}

/**
 * Per-finger joint targets for a cylindrical power grip.
 *
 * @param {number} gripAmount 0 = open, 1 = fully closed on the object
 * @param {number} squeeze    0..1 extra pressure on top of the grip
 * @param {number} objectRadiusM
 * @returns {{state:string, fingers:Record<string,{mcp:number,pip:number,dip:number,abduct:number}>,
 *            thumb:{oppose:number,abduct:number,mcp:number,ip:number}}}
 */
export function graspPose(gripAmount, squeeze = 0, objectRadiusM = 0.015, opts = {}) {
  const g = clamp01(gripAmount);
  const sq = clamp01(squeeze);
  const releasing = !!opts.releasing;

  const fingers = {};
  for (const [name, a] of Object.entries(FINGER_ANATOMY)) {
    // staggered closure: each finger starts a little after the previous one, then all arrive
    const local = minJerk(clamp01((g - a.lead) / Math.max(0.05, 1 - a.lead)));
    // squeeze adds a little more flexion, most of it at the middle joint where a squeeze bites
    const total = wrapAngleFor(name, objectRadiusM) * local * (1 + 0.10 * sq);
    fingers[name] = {
      mcp: clamp(total * JOINT_SHARE.mcp, 0, JOINT_LIMITS.mcp),
      pip: clamp(total * JOINT_SHARE.pip * (1 + 0.18 * sq), 0, JOINT_LIMITS.pip),
      dip: clamp(total * JOINT_SHARE.dip, 0, JOINT_LIMITS.dip),
      // spread narrows as the hand closes — fingers converge on the object
      abduct: a.spread * (1 - 0.75 * local),
    };
  }

  // THUMB: opposition is a distinct motion, not a curl. The pad must come ACROSS the palm to face
  // the index/middle side, which is what actually stabilises a tube.
  const tg = minJerk(clamp01((g - 0.06) / 0.94));
  const thumb = {
    oppose: clamp(JOINT_LIMITS.thumbCmcOppose * tg * (1 + 0.08 * sq), 0, JOINT_LIMITS.thumbCmcOppose),
    abduct: clamp(JOINT_LIMITS.thumbCmcAbduct * (0.35 + 0.65 * tg), 0, JOINT_LIMITS.thumbCmcAbduct),
    mcp: clamp(JOINT_LIMITS.thumbMcp * tg * (1 + 0.15 * sq), 0, JOINT_LIMITS.thumbMcp),
    ip: clamp(JOINT_LIMITS.thumbIp * tg * 0.8, 0, JOINT_LIMITS.thumbIp),
  };

  return { state: gripStateAt(g, { releasing, squeeze: sq }), fingers, thumb };
}

/**
 * Relaxed open hand — a hand at rest is NOT the bind pose. The GLB's treated hand ships with
 * straight, splayed fingers, which reads as a mannequin; this gives it a gentle natural curl with
 * a slight cascade from index to little finger.
 */
export function relaxedPose(amount = 1) {
  const a = clamp01(amount);
  const fingers = {};
  const curl = { index: 0.26, middle: 0.30, ring: 0.32, pinky: 0.34 };
  const spread = { index: -0.06, middle: -0.01, ring: 0.04, pinky: 0.10 };
  for (const name of Object.keys(FINGER_ANATOMY)) {
    fingers[name] = {
      mcp: curl[name] * a,
      pip: curl[name] * 1.35 * a,
      dip: curl[name] * 0.65 * a,
      abduct: spread[name] * a,
    };
  }
  return {
    state: 'RELAXED',
    fingers,
    thumb: { oppose: 0.18 * a, abduct: 0.22 * a, mcp: 0.16 * a, ip: 0.12 * a },
  };
}

/**
 * Write a pose onto real bones.
 *
 * Axis conventions were measured on this rig (see the header). Rotations are ADDED to the captured
 * rest rotation by the caller's restore step, so this must be called on a freshly restored pose.
 *
 * @param {{index:object, middle:object, ring:object, pinky:object, thumb:object}} chains
 *        each: { prox, mid, dist } bones
 * @param {object} pose from graspPose() / relaxedPose()
 * @returns {{applied:number, skipped:string[]}}
 */
export function applyGraspPose(chains, pose) {
  let applied = 0; const skipped = [];
  for (const [name, joints] of Object.entries(pose.fingers)) {
    const c = chains[name];
    if (!c) { skipped.push(name); continue; }
    if (c.prox) { c.prox.rotation.x -= joints.mcp; c.prox.rotation.z += joints.abduct; applied++; }
    if (c.mid) { c.mid.rotation.x -= joints.pip; applied++; }
    if (c.dist) { c.dist.rotation.x -= joints.dip; applied++; }
  }
  const t = chains.thumb;
  if (t) {
    // CMC carries opposition (+Z) and palmar abduction (-X moves it away from the index)
    if (t.prox) { t.prox.rotation.z += pose.thumb.oppose; t.prox.rotation.x -= pose.thumb.abduct * 0.5; applied++; }
    if (t.mid) { t.mid.rotation.z += pose.thumb.mcp; applied++; }
    if (t.dist) { t.dist.rotation.z += pose.thumb.ip; applied++; }
  } else skipped.push('thumb');
  return { applied, skipped };
}

export default graspPose;
