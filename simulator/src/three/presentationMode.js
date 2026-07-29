// Phase-2B PRESENTATION MODE — exactly two runtime modes, and they are mutually exclusive (ss24).
//
// The point of this module is that ownership is DATA, not scattered `if (baked)` branches. Each
// mode declares which system owns each channel; the scene reads the table and enables one side.
// A channel owned by both would be caught here rather than showing up as a fight between the mixer
// and the procedural rig on the same bone.
//
// The default is the PROCEDURAL FALLBACK. It was briefly `blender-baked` after the Phase 2B
// technical gates passed, and has been restored because the Phase 2B completion review found the
// baked hands, grip and contact are not yet visually accepted. Technical gates passing is not the
// same as visual acceptance, and the production default follows the stricter of the two.

export const PRESENTATION_MODES = Object.freeze({
  BAKED: 'blender-baked',
  PROCEDURAL: 'procedural-fallback',
});

export const ALL_MODES = Object.freeze([PRESENTATION_MODES.BAKED, PRESENTATION_MODES.PROCEDURAL]);

/**
 * The default the application boots with.
 *
 * RESTORED TO THE PROCEDURAL FALLBACK for the Phase 2B completion pass.
 *
 * The technical gates all pass — asset verification, manifest validation, bone-for-bone skeleton
 * comparison, 18/18 in-browser determinism checks, disposal, and a frame cost below the procedural
 * path. Those were enough to flip the default once, and that was wrong: the completion review
 * identified blocking VISUAL defects in the baked hands, product grip, application contact and skin
 * deformation. A default is a claim about what is good enough to show, so it follows the stricter
 * standard, not the one that happens to be measurable.
 *
 * `blender-baked` remains fully built, fully tested and one query parameter away
 * (`?presentationMode=blender-baked`). Nothing about the baked implementation has been weakened.
 * This flips back only when the visual acceptance in ss33 passes.
 */
export const DEFAULT_PRESENTATION_MODE = PRESENTATION_MODES.PROCEDURAL;

/** Channels that exactly one system must own at any moment. */
export const CHANNELS = Object.freeze([
  'humanBones', 'fingerPose', 'productTransform', 'tubeSqueeze',
  'skinIndent', 'creamGeometry', 'camera', 'surfaceShader', 'timeline',
]);

const BAKED_OWNERSHIP = Object.freeze({
  humanBones: 'baked',
  fingerPose: 'baked',
  productTransform: 'baked',
  tubeSqueeze: 'baked',
  skinIndent: 'baked',
  creamGeometry: 'baked',
  camera: 'threejs',
  surfaceShader: 'threejs',
  timeline: 'master-progress',
});

const PROCEDURAL_OWNERSHIP = Object.freeze({
  humanBones: 'procedural',
  fingerPose: 'procedural',
  productTransform: 'procedural',
  tubeSqueeze: 'procedural',
  skinIndent: 'procedural',
  creamGeometry: 'procedural',
  camera: 'threejs',
  surfaceShader: 'threejs',
  timeline: 'master-progress',
});

export function ownershipFor(mode) {
  if (mode === PRESENTATION_MODES.BAKED) return BAKED_OWNERSHIP;
  if (mode === PRESENTATION_MODES.PROCEDURAL) return PROCEDURAL_OWNERSHIP;
  throw new Error(`unknown presentation mode: ${mode}`);
}

/** True when the procedural rig/product/morph drivers must be switched off. */
export function proceduralControllersEnabled(mode) {
  const own = ownershipFor(mode);
  return own.humanBones === 'procedural';
}

/** True when an AnimationMixer should drive the scene. */
export function bakedClipEnabled(mode) {
  return ownershipFor(mode).humanBones === 'baked';
}

/**
 * Guard against the failure ss42 calls out: baked and procedural systems driving the same channel.
 * @returns {{ ok:boolean, conflicts:string[] }}
 */
export function assertExclusive(mode, active) {
  const own = ownershipFor(mode);
  const conflicts = [];
  for (const channel of CHANNELS) {
    const expected = own[channel];
    // camera, surfaceShader and timeline are owned by Three.js in BOTH modes, so they are not part
    // of the exclusivity question — only the channels a baked clip could fight the procedural rig
    // over are.
    if (expected !== 'baked' && expected !== 'procedural') continue;
    const baked = !!(active.baked && active.baked[channel]);
    const procedural = !!(active.procedural && active.procedural[channel]);
    if (baked && procedural) conflicts.push(`${channel}: driven by BOTH baked and procedural`);
    else if (expected === 'baked' && !baked) conflicts.push(`${channel}: baked mode owns it but nothing drives it`);
    else if (expected === 'procedural' && !procedural) conflicts.push(`${channel}: procedural mode owns it but nothing drives it`);
    else if (expected === 'baked' && procedural) conflicts.push(`${channel}: procedural driver still active in baked mode`);
    else if (expected === 'procedural' && baked) conflicts.push(`${channel}: baked driver still active in procedural mode`);
  }
  return { ok: conflicts.length === 0, conflicts };
}

/**
 * Resolve the requested mode against what is actually available.
 *
 * A request for baked mode when the baked asset failed to load does NOT silently pretend baked mode
 * is active (ss28): it returns the fallback plus the reason, which the caller surfaces in the
 * development diagnostics.
 *
 * @param {string|null|undefined} requested
 * @param {{ bakedAvailable?:boolean, failureReason?:string }} [state]
 * @returns {{ mode:string, requested:string, fellBack:boolean, reason:string|null }}
 */
export function resolvePresentationMode(requested, state = {}) {
  const want = ALL_MODES.includes(requested) ? requested : DEFAULT_PRESENTATION_MODE;
  const unknown = requested != null && !ALL_MODES.includes(requested);
  if (want === PRESENTATION_MODES.BAKED && state.bakedAvailable === false) {
    return {
      mode: PRESENTATION_MODES.PROCEDURAL,
      requested: want,
      fellBack: true,
      reason: state.failureReason || 'baked asset unavailable',
    };
  }
  return {
    mode: want,
    requested: requested == null ? want : requested,
    fellBack: false,
    reason: unknown ? `unknown presentation mode "${requested}", using ${want}` : null,
  };
}

/** Read the mode from a URL query string, if present. */
export function modeFromQuery(search) {
  try {
    const value = new URLSearchParams(search || '').get('presentationMode');
    return ALL_MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
}
