// Validated bone-name map. Scene code NEVER hardcodes raw bone names — it asks for a ROLE
// ('forearmL', 'handR', …) and this module resolves it against the loaded skeleton. Prevents
// animating guessed/unsupported bones.

/** Role -> ordered name patterns (first match wins). Covers Mixamo + common Blender rigs. */
export const BONE_PATTERNS = Object.freeze({
  root:       [/^hips$/i, /mixamorig:?Hips/i, /^root$/i],
  spine:      [/^spine$/i, /mixamorig:?Spine$/i],
  chest:      [/chest/i, /mixamorig:?Spine[12]$/i],
  neck:       [/^neck$/i, /mixamorig:?Neck/i],
  head:       [/^head$/i, /mixamorig:?Head$/i],
  shoulderL:  [/left.*shoulder/i, /mixamorig:?LeftShoulder/i],
  shoulderR:  [/right.*shoulder/i, /mixamorig:?RightShoulder/i],
  upperArmL:  [/mixamorig:?LeftArm$/i, /left.*(upperarm|arm)$/i],
  upperArmR:  [/mixamorig:?RightArm$/i, /right.*(upperarm|arm)$/i],
  forearmL:   [/mixamorig:?LeftForeArm$/i, /left.*(forearm|lowerarm)/i],
  forearmR:   [/mixamorig:?RightForeArm$/i, /right.*(forearm|lowerarm)/i],
  handL:      [/mixamorig:?LeftHand$/i, /left.*hand$/i],
  handR:      [/mixamorig:?RightHand$/i, /right.*hand$/i],
});

/** Roles the topical-application animation cannot run without. */
export const REQUIRED_ROLES = Object.freeze(['root', 'spine', 'head', 'shoulderL', 'shoulderR', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR']);

/** Anatomical safety limits (radians) — enforced by the animation controller. */
export const JOINT_LIMITS = Object.freeze({
  shoulder: { min: -0.6, max: 1.2, note: 'prevents shoulder dislocation' },
  upperArm: { min: -1.4, max: 1.6, note: 'prevents over-rotation' },
  forearm:  { min: 0.0,  max: 2.4, note: 'elbow flexion only — never hyperextends past 0' },
  wrist:    { min: -1.0, max: 1.0, note: 'prevents wrist inversion' },
});

/**
 * Resolve roles against a real skeleton.
 * @param {string[]} boneNames names present on the loaded model
 * @returns {{ map:Record<string,string>, missing:string[], fingerBones:string[], ok:boolean }}
 */
export function buildBoneMap(boneNames = []) {
  const map = {}; const missing = [];
  for (const [role, pats] of Object.entries(BONE_PATTERNS)) {
    const hit = boneNames.find((b) => pats.some((p) => p.test(b)));
    if (hit) map[role] = hit; else missing.push(role);
  }
  const fingerBones = boneNames.filter((b) => /(thumb|index|middle|ring|pinky|finger)/i.test(b));
  const missingRequired = REQUIRED_ROLES.filter((r) => !map[r]);
  return Object.freeze({ map, missing, missingRequired, fingerBones, fingerBoneCount: fingerBones.length, ok: missingRequired.length === 0 });
}

/** Look up an actual THREE.Bone by role from a skeleton (returns null when absent). */
export function boneFor(rolesOrMap, role, skeletonLookup) {
  const map = rolesOrMap && rolesOrMap.map ? rolesOrMap.map : rolesOrMap;
  const name = map && map[role];
  if (!name || typeof skeletonLookup !== 'function') return null;
  return skeletonLookup(name) || null;
}

/** Clamp a joint rotation to its anatomical limit. */
export function clampJoint(kind, radians) {
  const l = JOINT_LIMITS[kind];
  if (!l || typeof radians !== 'number' || !Number.isFinite(radians)) return 0;
  return Math.max(l.min, Math.min(l.max, radians));
}

export default buildBoneMap;
