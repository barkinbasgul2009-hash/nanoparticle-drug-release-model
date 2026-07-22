// Phase-7C immune serialization + validation. The published ImmuneFrame is plain data (no functions,
// no cycles, no live registries, no mutable Maps/Sets), so it serializes deterministically. This
// module provides a stable stringifier (sorted keys), a deterministic content id (FNV-1a; no crypto
// dependency, no wall-clock), a JSON round-trip validator, and a plain-data snapshot helper.

import { ImmuneRuntimeIssue, ISSUE_SEVERITY } from './immuneObjects.js';

/** Deterministic JSON with recursively sorted object keys (arrays keep order). */
export function stableStringify(value) {
  const seen = new WeakSet();
  const norm = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) throw new Error('circular reference in immune frame');
    seen.add(v);
    if (Array.isArray(v)) return v.map(norm);
    const out = {};
    for (const k of Object.keys(v).sort()) { const val = v[k]; if (typeof val === 'function') throw new Error(`function found at key ${k}`); out[k] = norm(val); }
    seen.delete(v);
    return out;
  };
  return JSON.stringify(norm(value));
}

/** Deterministic 32-bit FNV-1a content id over the stable JSON (hex string). No wall-clock. */
export function contentId(value) {
  const s = stableStringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return 'imf_' + h.toString(16).padStart(8, '0');
}

/** Plain-data deep copy of a frame (safe to publish/embed; strips prototypes). */
export function toPlainData(frame) { return JSON.parse(JSON.stringify(frame)); }

/**
 * Validate that a frame serializes safely (no functions, no cycles, JSON round-trips exactly).
 * Returns { ok, issues, serialized }.
 */
export function validateSerializable(frame) {
  const issues = [];
  try {
    const s = stableStringify(frame);
    const round = stableStringify(JSON.parse(s));
    if (s !== round) issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', severity: ISSUE_SEVERITY.ERROR, module: 'immuneSerialization', message: 'frame did not round-trip deterministically' }));
    return { ok: issues.length === 0, issues, serialized: s };
  } catch (e) {
    issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', severity: ISSUE_SEVERITY.ERROR, module: 'immuneSerialization', message: String(e && e.message || e) }));
    return { ok: false, issues, serialized: null };
  }
}

export default validateSerializable;
