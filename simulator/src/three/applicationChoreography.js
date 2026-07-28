// Phase-2 APPLICATION CHOREOGRAPHY — the authored sequence for "human applies cream to the
// opposite forearm".
//
// This module is PURE: plain data and arithmetic, no Three.js, no DOM, no clock. Everything is a
// function of the master timeline's normalized progress, so the scene, the tests and any future
// replay tool all read the same numbers. It is the single source of truth for WHAT happens when;
// humanApplicationScene.js only turns these numbers into transforms.
//
// TIME RULE (unchanged from Phase 0): there is exactly ONE narrative clock — the master timeline.
// Nothing here reads wall-clock time, and no value accumulates between calls.
//
// RELATIONSHIP TO PHASE 0: src/three/humanAnimationController.js remains the validated minimal
// FK controller (still used by human-preview.html and its tests). This module is the richer
// Phase-2 successor for the application shot; it does not modify or replace that file.

/** Sequence stages over normalized progress. Contiguous and exhaustive: t0 of each = t1 of previous. */
export const STAGES = Object.freeze([
  { id: 'neutral',  t0: 0.00, t1: 0.10, note: 'relaxed stance, arms down' },
  { id: 'prepare',  t0: 0.10, t1: 0.26, note: 'treated arm comes up and across the torso' },
  { id: 'approach', t0: 0.26, t1: 0.38, note: 'applying hand travels down to the forearm' },
  { id: 'contact',  t0: 0.38, t1: 0.44, note: 'palm meets skin; cream deposited' },
  { id: 'stroke_1', t0: 0.44, t1: 0.60, note: 'stroke toward the wrist and back' },
  { id: 'stroke_2', t0: 0.60, t1: 0.74, note: 'stroke toward the elbow and back' },
  { id: 'release',  t0: 0.74, t1: 0.84, note: 'hand lifts away' },
  { id: 'hold',     t0: 0.84, t1: 1.00, note: 'settled forearm hero shot — hand-off to the skin phase' },
]);

/** The window during which the palm is required to be ON the skin. */
export const CONTACT_WINDOW = Object.freeze({ t0: 0.38, t1: 0.74 });

/** Tunables, all in metres / normalized forearm units. Named so tests can assert against them. */
export const PARAMS = Object.freeze({
  depositAxial: 0.50,        // where on the forearm the first deposit lands (0 = elbow, 1 = wrist)
  axialMin: 0.12,            // never stroke off the ends of the forearm
  axialMax: 0.88,
  strokeToWrist: 0.26,       // stroke-1 excursion toward the wrist
  strokeToElbow: 0.26,       // stroke-2 excursion toward the elbow
  approachHeight: 0.14,      // how far above the skin the hand starts its descent (m)
  releaseHeight: 0.16,       // how far it lifts afterwards (m)
  // Hand geometry, measured from the rig. The wrist JOINT is inside the hand, so when the palm
  // lies flat the joint centre still sits ~25 mm off the skin; the palm's contact patch is also
  // ~45 mm distal of the joint. Both offsets are needed or the hand hovers (see PALM_* below).
  palmDepth: 0.025,          // wrist joint -> palm surface, along the palm normal (m)
  palmForward: 0.045,        // wrist joint -> palm contact patch, along the fingers (m)
  // The skin mesh does not deform under the palm, so this is a small deliberate overlap that
  // reads as soft-tissue compression. Kept low: too much and the hand visibly sinks into the arm.
  pressDepth: 0.005,         // slight compression into the skin during strokes (m)
  coverageAtContact: 0.07,   // creamed half-width right after the deposit
  coverageAfterStroke1: 0.30,
  coverageFinal: 0.42,
  opacityPeak: 0.88,
  opacityRubbedIn: 0.78,     // cream thins as it is worked into the skin, but stays clearly visible
  contactGapTolerance: 0.02, // max acceptable palm-to-skin gap during the contact window (m)
});

/** Camera keyframes. `anchor` names are resolved to world positions by the scene. */
export const CAMERA_KEYS = Object.freeze([
  { t: 0.00, anchor: 'upper_body',  dist: 2.30, az: 0.30, elev: 0.10 },
  { t: 0.12, anchor: 'upper_body',  dist: 1.70, az: 0.24, elev: 0.06 },
  { t: 0.28, anchor: 'application', dist: 1.05, az: 0.30, elev: 0.16 },
  { t: 0.44, anchor: 'application', dist: 0.62, az: 0.34, elev: 0.22 },
  { t: 0.74, anchor: 'application', dist: 0.46, az: 0.30, elev: 0.26 },
  { t: 0.88, anchor: 'forearm',     dist: 0.30, az: 0.22, elev: 0.30 },
  { t: 1.00, anchor: 'forearm',     dist: 0.28, az: 0.20, elev: 0.30 },
]);

/** Named shots, for reporting and for asserting the shot progression. */
export const SHOTS = Object.freeze([
  { id: 'establish',   t0: 0.00, t1: 0.12, framing: 'medium-wide human' },
  { id: 'preparation', t0: 0.12, t1: 0.28, framing: 'medium, treated arm rising' },
  { id: 'approach',    t0: 0.28, t1: 0.44, framing: 'hand descending to the forearm' },
  { id: 'application', t0: 0.44, t1: 0.74, framing: 'application close shot' },
  { id: 'hero_push',   t0: 0.74, t1: 0.88, framing: 'push in to the coated forearm' },
  { id: 'hero_hold',   t0: 0.88, t1: 1.00, framing: 'static forearm hero — skin-zoom hand-off' },
]);

// ---------------------------------------------------------------- small pure helpers
export const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
/** Smoothstep — C1-continuous, so camera and limbs never visibly "kick" at a keyframe. */
export const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
/** Smootherstep — C2-continuous; used where a limb starts and stops (no visible acceleration jump). */
export const easeSoft = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;

/** Which stage a progress value falls in. */
export function stageAt(progress) {
  const p = clamp01(progress);
  let s = STAGES[0];
  for (const st of STAGES) if (p >= st.t0) s = st;
  return s;
}

/** Local 0..1 progress inside a named stage (0 before it, 1 after it). */
export function stageProgress(id, progress) {
  const s = STAGES.find((x) => x.id === id);
  if (!s) return 0;
  const p = clamp01(progress);
  if (p <= s.t0) return 0;
  if (p >= s.t1) return 1;
  return (p - s.t0) / (s.t1 - s.t0);
}

/** Which named shot is on screen. */
export function shotAt(progress) {
  const p = clamp01(progress);
  let s = SHOTS[0];
  for (const sh of SHOTS) if (p >= sh.t0) s = sh;
  return s;
}

/**
 * Camera framing at a progress value. Returns the two anchors being blended plus the mix, so the
 * scene can lerp between real world positions (e.g. "upper_body" -> "application").
 */
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
    fromAnchor: a.anchor,
    toAnchor: b.anchor,
    mix: k,
    dist: lerp(a.dist, b.dist, k),
    az: lerp(a.az, b.az, k),
    elev: lerp(a.elev, b.elev, k),
  });
}

/**
 * How far along the forearm the palm is targeting, 0 = elbow .. 1 = wrist.
 * Strokes are half-sine excursions so the hand decelerates at each end (a real rub reverses
 * smoothly; a triangle wave reads as a robot).
 */
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
 * that has been spread never un-spreads, which is both physically right and a testable invariant.
 */
export function creamCoverage(progress) {
  const p = clamp01(progress);
  if (p < CONTACT_WINDOW.t0) return 0;
  const c = easeSoft(stageProgress('contact', p)) * PARAMS.coverageAtContact;
  const s1 = ease(stageProgress('stroke_1', p)) * (PARAMS.coverageAfterStroke1 - PARAMS.coverageAtContact);
  const s2 = ease(stageProgress('stroke_2', p)) * (PARAMS.coverageFinal - PARAMS.coverageAfterStroke1);
  return c + s1 + s2;
}

/**
 * Full choreography state at a progress value. Pure — identical input always yields identical
 * output, with no dependence on call order.
 */
export function choreographyAt(progress) {
  const p = clamp01(progress);
  const stage = stageAt(p);

  // --- treated (presented) arm: rises during `prepare`, then HOLDS for the rest of the shot so
  // the hero framing never loses the application site.
  const presentBlend = easeSoft(stageProgress('prepare', p));

  // --- applying arm: travels in during `approach`, holds through the strokes, withdraws on `release`
  const approachBlend = easeSoft(stageProgress('approach', p));
  const releaseBlend = easeSoft(stageProgress('release', p));
  const applyBlend = approachBlend * (1 - releaseBlend);

  const inContactWindow = p >= CONTACT_WINDOW.t0 && p <= CONTACT_WINDOW.t1;

  // Height of the wrist above the skin. The hand travels in mostly HORIZONTALLY and only drops in
  // the last part of the approach, so touchdown coincides with the deposit. Tying the descent to
  // the position blend instead makes the palm land early and then sit there while nothing happens.
  const descend = ease(Math.max(0, (stageProgress('approach', p) - 0.45) / 0.55));
  let lift;
  if (p < CONTACT_WINDOW.t0) lift = PARAMS.approachHeight * (1 - descend);
  else if (inContactWindow) lift = 0;
  else lift = PARAMS.releaseHeight * releaseBlend;

  // gentle press during the strokes reads as real contact rather than a hovering hand
  const stroking = stageProgress('stroke_1', p) > 0 && stageProgress('stroke_2', p) < 1;
  const pressure = inContactWindow ? (stroking ? 1 : easeSoft(stageProgress('contact', p))) : 0;

  const coverage = creamCoverage(p);
  const creamPresent = p >= CONTACT_WINDOW.t0 && coverage > 0;
  // opacity peaks just after the deposit, then thins as it is worked in — but never disappears
  const rubIn = ease(stageProgress('stroke_2', p));
  const opacity = creamPresent
    ? lerp(PARAMS.opacityPeak, PARAMS.opacityRubbedIn, rubIn) * easeSoft(Math.min(1, stageProgress('contact', p) * 1.6))
    : 0;
  // wetness: highest at deposit, settles to a soft sheen
  const gloss = creamPresent ? lerp(1, 0.45, ease(stageProgress('stroke_1', p) * 0.6 + rubIn * 0.4)) : 0;

  return Object.freeze({
    progress: p,
    stage: stage.id,
    stageProgress: stageProgress(stage.id, p),
    present: Object.freeze({ blend: presentBlend }),
    apply: Object.freeze({
      blend: applyBlend,
      axial: strokeAxial(p),
      lift,
      press: pressure * PARAMS.pressDepth,
      expectContact: inContactWindow,
      // confidence is the AUTHORED expectation; the scene measures the real gap and reports
      // contactValid separately, so a broken rig cannot be hidden by the choreography claiming success
      contactConfidence: inContactWindow ? Math.min(1, approachBlend) * (1 - releaseBlend) : 0,
    }),
    cream: Object.freeze({
      present: creamPresent,
      depositAxial: PARAMS.depositAxial,
      coverage,
      opacity,
      gloss,
    }),
    camera: cameraAt(p),
  });
}

export default choreographyAt;
