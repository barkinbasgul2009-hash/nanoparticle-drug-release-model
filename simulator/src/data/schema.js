// Lightweight, dependency-free structural validators for loaded JSON.
// These check SHAPE (keys/types), not scientific content. Scientific content is
// authored and frozen in the repo data/ files; the app never invents it.

/** @typedef {{ ok: boolean, errors: string[] }} ValidationResult */

/** @param {*} value @param {string} name @returns {ValidationResult} */
export function validateObject(value, name = 'root') {
  const errors = [];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${name}: expected an object`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Validate that an object has the required keys.
 * @param {*} obj @param {string[]} keys @param {string} name @returns {ValidationResult}
 */
export function requireKeys(obj, keys, name = 'root') {
  const errors = [];
  const base = validateObject(obj, name);
  if (!base.ok) return base;
  for (const k of keys) {
    if (!(k in obj)) errors.push(`${name}: missing required key "${k}"`);
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Named schemas describe only the keys the foundation reads. Unknown extra keys
 * are allowed (the data files are richer than the app needs in Phase 1).
 * @type {Record<string, string[]>}
 */
export const SCHEMAS = Object.freeze({
  presetLibrary: ['presets'],
  simulatorPresets: ['formulation_presets'],
  evidencePackage: ['sources'],
  biologicalScenes: ['presets'],
  referenceLibrary: ['structures'],
  licenseRegistry: ['sources'],
  cameraLanguage: ['transitions'],
  // Generic fallback: must at least be an object.
  generic: [],
});

/**
 * @param {string} schemaName @param {*} data @returns {ValidationResult}
 */
export function validateAgainstSchema(schemaName, data) {
  const keys = SCHEMAS[schemaName] || SCHEMAS.generic;
  if (keys.length === 0) return validateObject(data, schemaName);
  return requireKeys(data, keys, schemaName);
}
