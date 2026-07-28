// Phase-2 APPLICATION CHOREOGRAPHY — the authored sequence for
// "human takes the NANODERM tube, dispenses cream onto the opposite forearm, and rubs it in".
//
// This module is PURE: plain data and arithmetic, no Three.js, no DOM, no clock. Everything is a
// function of the master timeline's normalized progress, so the scene, the tests and any future
// replay tool all read the same numbers. It is the single source of truth for WHAT happens when;
// applicationRig.js / humanApplicationScene.js only turn these numbers into transforms.
//
// TIME RULE (unchanged from Phase 0): there is exactly ONE narrative clock — the master timeline.
// Nothing here reads wall-clock time, and no value accumulates between calls.
//
// POLISH PASS. The sequence gained a product act (raise / prep / dispense / stow) in front of the
// original contact-and-stroke act. Two measured defects drove the rest of the changes:
//   * the applying wrist passed 36.9 mm INSIDE the torso capsule during the old release move,
//     because its IK target was lerped along a straight chord from beside the hip to in front of
//     the chest. Hand travel is now expressed as an arc with an explicit outward bulge, and the rig
//     additionally clamps every target out of the torso.
//   * the cream was invisible: off-white over pale skin with no thickness and no specular contrast.
//     Cream state now carries thickness and a separate sheen term, and the layer shades accordingly.

/** Sequence stages over normalized progress. Contiguous and exhaustive. */
export const STAGES = Object.freeze([
  { id: 'neutral',       t0: 0.00, t1: 0.06, note: 'relaxed stance, arms down' },
  { id: 'present',       t0: 0.06, t1: 0.16, note: 'treated arm comes up and across the torso' },
  { id: 'product_raise', t0: 0.16, t1: 0.28, note: 'tube is raised into view, label to camera' },
  { id: 'dispense_prep', t0: 0.28, t1: 0.36, note: 'tube tilts nozzle-down over the application site' },
  { id: 'dispense',      t0: 0.36, t1: 0.50, note: 'cream extrudes from the nozzle and lands on the skin' },
  { id: 'stow',          t0: 0.50, t1: 0.58, note: 'tube lowered away; the hand returns empty' },
  { id: 'contact',       t0: 0.58, t1: 0.64, note: 'palm meets skin over the deposit' },
  { id: 'stroke_1',      t0: 0.64, t1: 0.75, note: 'stroke toward the wrist and back' },
  { id: 'stroke_2',      t0: 0.75, t1: 0.85, note: 'stroke toward the elbow and back' },
  { id: 'release',       t0: 0.85, t1: 0.91, note: 'hand lifts away' },
  { id: 'hold',          t0: 0.91, t1: 1.00, note: 'settled forearm hero shot — hand-off to the skin phase' },
]);

/**
 * The window during which the palm is required to be ON the skin.
 * It opens at the END of the `contact` stage, not its start: 0.58-0.64 is the touchdown reach, and
 * requiring contact from 0.58 asserted a contact the hand had not yet made (measured 197 mm short).
 */
export const CONTACT_WINDOW = Object.freeze({ t0: 0.64, t1: 0.85 });
/** The window during which cream is leaving the nozzle. */
export const DISPENSE_WINDOW = Object.freeze({ t0: 0.36, t1: 0.50 });

/** Tunables, in metres / normalized forearm units. Named so tests can assert against them. */
export const PARAMS = Object.freeze({
  depositAxial: 0.50,
  axialMin: 0.12,
  axialMax: 0.88,
  strokeToWrist: 0.26,
  strokeToElbow: 0.22,       // trimmed: a deeper reach swung the applying ELBOW into the ribs

  approachHeight: 0.14,
  releaseHeight: 0.16,
  // Hand geometry. The wrist JOINT is inside the hand, so when the palm lies flat the joint centre
  // still sits ~25 mm off the skin and the contact patch is ~45 mm distal of it.
  palmDepth: 0.025,
  palmForward: 0.045,
  pressDepth: 0.005,
  contactGapTolerance: 0.02,

  // --- product / dispensing ---
  nozzleHeight: 0.075,       // nozzle orifice height above the skin while dispensing (m)
  productShowHeight: 0.27,   // how high the tube is held during the product beat (m above the site)
  strandMaxLength: 0.075,    // longest visible cream strand (m)
  beadMaxRadius: 0.014,      // deposited bead radius before it is spread (m)

  // --- cream on skin ---
  coverageAtDeposit: 0.05,
  coverageAfterStroke1: 0.30,
  coverageFinal: 0.44,
  opacityPeak: 0.97,
  opacityRubbedIn: 0.90,     // stays high: the user could not see the previous 0.70
  thicknessPeak: 1.0,        // fresh bead sits proud of the skin
  thicknessRubbedIn: 0.42,   // worked in, but still a visible film
});

/** Torso-avoidance spec. The rig enforces it; declared here so tests can assert the contract. */
export const TORSO = Object.freeze({
  radius: 0.155,             // trunk half-width of this figure (measured from the rig)
  margin: 0.045,             // required clearance for the wrist (m)
  arcBulge: 0.26,            // how far the travel arc bows away from the body (m)
});

/** Camera keyframes. `anchor` names are resolved to world positions by the scene. */
export const CAMERA_KEYS = Object.freeze([
  { t: 0.00, anchor: 'upper_body', dist: 2.05, az: 0.30, elev: 0.10 },
  { t: 0.10, anchor: 'upper_body', dist: 1.35, az: 0.26, elev: 0.06 },
  { t: 0.22, anchor: 'product',    dist: 0.34, az: 0.16, elev: 0.05 },   // NANODERM readable
  { t: 0.30, anchor: 'dispense',   dist: 0.52, az: 0.28, elev: 0.20 },
  { t: 0.40, anchor: 'dispense',   dist: 0.44, az: 0.26, elev: 0.22 },
  { t: 0.52, anchor: 'application',dist: 0.36, az: 0.30, elev: 0.24 },
  { t: 0.64, anchor: 'application',dist: 0.30, az: 0.32, elev: 0.26 },
  { t: 0.85, anchor: 'application',dist: 0.27, az: 0.28, elev: 0.28 },
  { t: 0.93, anchor: 'forearm',    dist: 0.23, az: 0.22, elev: 0.30 },
  { t: 1.00, anchor: 'forearm',    dist: 0.21, az: 0.20, elev: 0.30 },
]);

/** Named shots, for reporting and for asserting the shot progression. */
export const SHOTS = Object.freeze([
  { id: 'product_establish', t0: 0.00, t1: 0.28, framing: 'figure, then the NANODERM tube raised to camera' },
  { id: 'dispense_prep',     t0: 0.28, t1: 0.36, framing: 'tube, nozzle and forearm in one frame' },
  { id: 'dispense',          t0: 0.36, t1: 0.50, framing: 'cream leaving the nozzle onto the skin' },
  { id: 'initial_contact',   t0: 0.50, t1: 0.64, framing: 'palm meeting the forearm over the deposit' },
  { id: 'application',       t0: 0.64, t1: 0.85, framing: 'the cream being spread along the forearm' },
  { id: 'forearm_hero',      t0: 0.85, t1: 1.00, framing: 'coated forearm hero — skin-zoom hand-off' },
]);

// ---------------------------------------------------------------- pure helpers
export const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Smoothstep — C1-continuous, so camera and limbs never visibly "kick" at a keyframe. */
export const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
/** Smootherstep — C2-continuous; used where a limb starts and stops. */
export const easeSoft = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;

export function stageAt(progress) {
  const p = clamp01(progress);
  let s = STAGES[0];
  for (const st of STAGES) if (p >= st.t0) s = st;
  return s;
}

export function stageProgress(id, progress) {
  const s = STAGES.find((x) => x.id === id);
  if (!s) return 0;
  const p = clamp01(progress);
  if (p <= s.t0) return 0;
  if (p >= s.t1) return 1;
  return (p - s.t0) / (s.t1 - s.t0);
}

export function shotAt(progress) {
  const p = clamp01(progress);
  let s = SHOTS[0];
  for (const sh of SHOTS) if (p >= sh.t0) s = sh;
  return s;
}

export function cameraAt(progress) {
  const p = clamp01(progress);
  let a = CAMERA_KEYS[0], b = CAMERA_KEYS[0];
  for (let i = 0; i < CAMERA_KEYS.length; i++) {
    if (CAMERA_KEYS[i].t <= p) { a = CAMERA_KEYS[i]; b = CAMERA_KEYS[Math.min(i + 1, CAMERA_KEYS.length - 1)]; }
  }
  const span = b.t - a.t;
  const k = span > 1e-9 ? ease((p - a.t) / span) : 0;
  return Object.freeze({
    shotId: shotAt(p).id,
    fromAnchor: a.anchor, toAnchor: b.anchor, mix: k,
    dist: lerp(a.dist, b.dist, k),
    az: lerp(a.az, b.az, k),
    elev: lerp(a.elev, b.elev, k),
  });
}

/** Where along the forearm the palm targets, 0 = elbow .. 1 = wrist. */
export function strokeAxial(progress) {
  const p = clamp01(progress);
  const a0 = PARAMS.depositAxial;
  const s1 = stageProgress('stroke_1', p);
  const s2 = stageProgress('stroke_2', p);
  let a = a0;
  if (s1 > 0) a += PARAMS.strokeToWrist * Math.sin(Math.PI * s1);
  if (s2 > 0) a -= PARAMS.strokeToElbow * Math.sin(Math.PI * s2);
  return Math.max(PARAMS.axialMin, Math.min(PARAMS.axialMax, a));
}

/**
 * Creamed half-width around the deposit point. MONOTONIC NON-DECREASING by construction — cream
 * that has been spread never un-spreads. Starts at the DEPOSIT (not at contact): the bead is on the
 * skin before the hand arrives, which is what makes the dispensing read as causal.
 */
export function creamCoverage(progress) {
  const p = clamp01(progress);
  if (p < DISPENSE_WINDOW.t0) return 0;
  const dep = easeSoft(stageProgress('dispense', p)) * PARAMS.coverageAtDeposit;
  const s1 = ease(stageProgress('stroke_1', p)) * (PARAMS.coverageAfterStroke1 - PARAMS.coverageAtDeposit);
  const s2 = ease(stageProgress('stroke_2', p)) * (PARAMS.coverageFinal - PARAMS.coverageAfterStroke1);
  return dep + s1 + s2;
}

/** How much cream has left the tube, 0..1. Drives the strand and the bead. */
export function extrusion(progress) { return easeSoft(stageProgress('dispense', clamp01(progress))); }

/** Full choreography state at a progress value. Pure. */
export function choreographyAt(progress) {
  const p = clamp01(progress);
  const stage = stageAt(p);

  // --- treated (presented) arm: rises during `present`, then HOLDS for the rest of the shot ---
  const presentBlend = easeSoft(stageProgress('present', p));

  // --- product: raised, aimed, dispensing, then stowed ---
  const raise = easeSoft(stageProgress('product_raise', p));
  const aim = easeSoft(stageProgress('dispense_prep', p));
  const stow = easeSoft(stageProgress('stow', p));
  const ext = extrusion(p);
  // the tube is in hand from the raise until it is stowed
  const holdingTube = p >= STAGES[2].t0 && p < STAGES[5].t1;
  const tubeVisible = p >= STAGES[2].t0;         // it stays in the scene once introduced

  // --- applying arm: for the product act the hand is placed by the NOZZLE target; for the
  // application act by the PALM target. `mode` tells the rig which solve to run. ---
  let mode = 'idle';
  if (p >= STAGES[2].t0 && p < STAGES[5].t1) mode = 'product';
  else if (p >= STAGES[5].t1) mode = 'apply';

  const approachBlend = easeSoft(stageProgress('contact', p) * 1.0);
  const releaseBlend = easeSoft(stageProgress('release', p));
  const applyBlend = mode === 'apply' ? approachBlend * (1 - releaseBlend) : 0;

  const inContactWindow = p >= CONTACT_WINDOW.t0 && p <= CONTACT_WINDOW.t1;

  // wrist height above the skin during the application act
  let lift;
  if (p < CONTACT_WINDOW.t0) lift = PARAMS.approachHeight * (1 - approachBlend);
  else if (inContactWindow) lift = 0;
  else lift = PARAMS.releaseHeight * releaseBlend;

  const stroking = stageProgress('stroke_1', p) > 0 && stageProgress('stroke_2', p) < 1;
  const pressure = inContactWindow ? (stroking ? 1 : easeSoft(stageProgress('contact', p))) : 0;

  // --- cream on skin ---
  const coverage = creamCoverage(p);
  const landed = ext > 0.25;                      // the bead has reached the skin
  const creamPresent = coverage > 0 && landed;
  const rubIn = ease(stageProgress('stroke_2', p));
  const opacity = creamPresent
    ? lerp(PARAMS.opacityPeak, PARAMS.opacityRubbedIn, rubIn) * easeSoft(Math.min(1, ext * 1.6))
    : 0;
  // thickness drives both the shader's height cue and its specular tightening
  const thickness = creamPresent
    ? lerp(PARAMS.thicknessPeak, PARAMS.thicknessRubbedIn, ease(stageProgress('stroke_1', p) * 0.5 + rubIn * 0.5))
    : 0;
  const gloss = creamPresent ? lerp(1, 0.62, ease(stageProgress('stroke_1', p) * 0.5 + rubIn * 0.5)) : 0;

  return Object.freeze({
    progress: p,
    stage: stage.id,
    stageProgress: stageProgress(stage.id, p),
    mode,
    present: Object.freeze({ blend: presentBlend }),
    product: Object.freeze({
      visible: tubeVisible,
      inHand: holdingTube,
      raise,                       // 0 = at the side, 1 = held up to camera
      aim,                         // 0 = upright label-to-camera, 1 = nozzle down over the site
      stow,                        // 1 = lowered away
      capOn: p < STAGES[2].t0 + 0.02,
    }),
    dispense: Object.freeze({
      active: p >= DISPENSE_WINDOW.t0 && p <= DISPENSE_WINDOW.t1,
      extrusion: ext,
      strandLength: ext < 0.55 ? PARAMS.strandMaxLength * ease(ext / 0.55) : PARAMS.strandMaxLength * (1 - ease((ext - 0.55) / 0.45)),
      // The bead grows as it is extruded, then is FLATTENED by the arriving palm — without this
      // fade an un-rubbed blob is still sitting on the arm in the hero shot, after the cream has
      // supposedly been worked in.
      beadRadius: PARAMS.beadMaxRadius
        * easeSoft(Math.max(0, (ext - 0.25) / 0.75))
        * (1 - easeSoft(stageProgress('contact', p))),
      landed,
    }),
    apply: Object.freeze({
      blend: applyBlend,
      axial: strokeAxial(p),
      lift,
      press: pressure * PARAMS.pressDepth,
      expectContact: inContactWindow,
      contactConfidence: inContactWindow ? Math.min(1, approachBlend) * (1 - releaseBlend) : 0,
    }),
    cream: Object.freeze({
      present: creamPresent,
      depositAxial: PARAMS.depositAxial,
      coverage, opacity, thickness, gloss,
    }),
    camera: cameraAt(p),
  });
}

export default choreographyAt;
