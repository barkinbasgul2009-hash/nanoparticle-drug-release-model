// Validated bone-name map. Scene code NEVER hardcodes raw bone names — it asks for a ROLE
// ('forearmL', 'handR', …) and this module resolves it against the loaded skeleton. Prevents
// animating guessed/unsupported bones.

/**
 * Role -> ordered name patterns. Covers three rig naming conventions:
 *   - Mixamo            (mixamorig:LeftForeArm)
 *   - generic Blender   (Left forearm / forearm.L)
 *   - Unreal / MakeHuman-MPFB  (lowerarm_l, clavicle_r, spine_01)  <- simulator/assets/human/human.glb
 *
 * NOTE ON RESOLUTION ORDER: buildBoneMap scans the SKELETON in bone order and accepts the first
 * bone matching any pattern for the role — so pattern order inside an array is not a priority.
 * Where a role could match several bones (e.g. `chest` vs spine_02/spine_03) the skeleton's own
 * hierarchical order decides, which is what we want (nearest-to-root wins).
 */
export const BONE_PATTERNS = Object.freeze({
  root:       [/^hips$/i, /mixamorig:?Hips/i, /^root$/i, /^pelvis$/i],
  spine:      [/^spine$/i, /mixamorig:?Spine$/i, /^spine_0?1$/i],
  chest:      [/chest/i, /mixamorig:?Spine[12]$/i, /^spine_0?[23]$/i],
  neck:       [/^neck$/i, /mixamorig:?Neck/i, /^neck_0?\d$/i],
  head:       [/^head$/i, /mixamorig:?Head$/i],
  shoulderL:  [/left.*shoulder/i, /mixamorig:?LeftShoulder/i, /^shoulder[._]l$/i, /^clavicle[._]l$/i],
  shoulderR:  [/right.*shoulder/i, /mixamorig:?RightShoulder/i, /^shoulder[._]r$/i, /^clavicle[._]r$/i],
  upperArmL:  [/mixamorig:?LeftArm$/i, /left.*(upperarm|arm)$/i, /^upper[_.]?arm[._]l$/i],
  upperArmR:  [/mixamorig:?RightArm$/i, /right.*(upperarm|arm)$/i, /^upper[_.]?arm[._]r$/i],
  forearmL:   [/mixamorig:?LeftForeArm$/i, /left.*(forearm|lowerarm)/i, /^(fore|lower)[_.]?arm[._]l$/i],
  forearmR:   [/mixamorig:?RightForeArm$/i, /right.*(forearm|lowerarm)/i, /^(fore|lower)[_.]?arm[._]r$/i],
  handL:      [/mixamorig:?LeftHand$/i, /left.*hand$/i, /^hand[._]l$/i],
  handR:      [/mixamorig:?RightHand$/i, /right.*hand$/i, /^hand[._]r$/i],
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
