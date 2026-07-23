// Phase-7C immune serialization + validation. The published ImmuneFrame is plain data (no functions,
// no cycles, no live registries, no mutable Maps/Sets), so it serializes deterministically. This
// module provides a stable stringifier (sorted keys), a deterministic content id (FNV-1a; no crypto
// dependency, no wall-clock), a JSON round-trip validator, and a plain-data snapshot helper.

import { ImmuneRuntimeIssue, ISSUE_SEVERITY } from './immuneObjects.js';

/**
 * Deterministic JSON with recursively sorted object keys (arrays keep order). Tracks only the current
 * ANCESTOR PATH, so shared references (a DAG) are allowed and only TRUE cycles throw.
 */
export function stableStringify(value) {
  const path = new WeakSet();   // ancestors on the current descent path (not all visited nodes)
  const norm = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (path.has(v)) throw new Error('circular reference in immune frame');
    path.add(v);
    let out;
    if (Array.isArray(v)) out = v.map(norm);
    else { out = {}; for (const k of Object.keys(v).sort()) { const val = v[k]; if (typeof val === 'function') throw new Error(`function found at key ${k}`); out[k] = norm(val); } }
    path.delete(v);   // leaving this node's subtree; siblings may legitimately reference it again
    return out;
  };
  return JSON.stringify(norm(value));
}

/** Deterministic 32-bit FNV-1a hex digest of an already-canonical string. No wall-clock, no crypto dep. */
export function fnv1aHex(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** Deterministic FNV-1a content id over the stable JSON (hex string). No wall-clock. */
export function contentId(value) { return 'imf_' + fnv1aHex(stableStringify(value)); }

// ---------------------------------------------------------------------------
// Deterministic persistent-record identity (Part 2 remediation). One shared utility; NO parallel
// canonicalization. A persistent record id is a PURE function of its canonical identity-bearing payload
// plus the identity-algorithm version — never a module/process counter, wall-clock, or insertion order.
// ---------------------------------------------------------------------------
export const IDENTITY_ALGORITHM_VERSION = '1.0';

/** Reject values that would make a digest non-portable (NaN/Infinity/functions) inside an id payload. */
function assertIdentitySafe(payload) {
  const walk = (v, keyPath) => {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`non-finite number in identity payload at ${keyPath}`);
    if (typeof v === 'function') throw new Error(`function in identity payload at ${keyPath}`);
    if (v && typeof v === 'object') for (const k of Object.keys(v)) walk(v[k], `${keyPath}.${k}`);
  };
  walk(payload, '$');
}

/**
 * Deterministic id: `${prefix}[_${segment}]_${digest}`.
 * @param {string} prefix distinct record-type prefix (imx/imev/impr/imt/imc/…)
 * @param {object} identityPayload the identity-BEARING fields only (no prose / labels / timestamps).
 *   Set-like arrays must already be canonically sorted by the caller; semantic-order arrays are kept.
 * @param {string} [segment] optional human-readable semantic segment (e.g. `f12`); not a substitute for
 *   the digest, purely for debuggability.
 */
export function deterministicId(prefix, identityPayload, segment) {
  assertIdentitySafe(identityPayload);
  const canonical = { _idv: IDENTITY_ALGORITHM_VERSION, ...identityPayload };
  const digest = fnv1aHex(stableStringify(canonical));
  return segment ? `${prefix}_${segment}_${digest}` : `${prefix}_${digest}`;
}

/**
 * Collision-aware identity registration. Same id + identical canonical payload -> dedup (returns
 * 'duplicate'); same id + DIFFERENT payload -> integrity failure (returns 'collision'); new id ->
 * 'new'. Never silently overwrites. `seen` is a Map(id -> canonical string) owned by the caller.
 */
export function registerIdentity(seen, id, identityPayload) {
  const canonical = stableStringify({ _idv: IDENTITY_ALGORITHM_VERSION, ...identityPayload });
  if (!seen.has(id)) { seen.set(id, canonical); return 'new'; }
  return seen.get(id) === canonical ? 'duplicate' : 'collision';
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
