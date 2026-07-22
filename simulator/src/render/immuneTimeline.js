// Phase-7C Part 2 immune timeline + replay engines (read-only, deterministic). The timeline provides
// chronological navigation over immutable published ImmuneFrames; the replay engine reconstructs
// historical states EXACTLY as produced (never recalculates biology, never interpolates biological
// values - replay speed affects visualization only). Both mutate nothing biological; a navigation
// cursor is visualization state only. Reuses Section-1 serialization for round-trip validation.

import { validateSerializable, stableStringify, contentId } from '../biology/immuneSerialization.js';

/** Deterministic frame ordering: frameIndex, then simulationTime, then frameId. */
function orderFrames(frames) {
  return (frames || []).slice().sort((a, b) => {
    const ai = a.frameIndex ?? 0, bi = b.frameIndex ?? 0; if (ai !== bi) return ai - bi;
    const at = a.simulationTime ?? 0, bt = b.simulationTime ?? 0; if (at !== bt) return at - bt;
    return String(a.frameId).localeCompare(String(b.frameId));
  });
}

export class ImmuneTimeline {
  constructor(frames) { this.frames = orderFrames(frames); this.cursor = 0; }

  length() { return this.frames.length; }
  positions() { return this.frames.map((f, i) => ({ position: i, frameId: f.frameId, frameIndex: f.frameIndex, simulationTime: f.simulationTime })); }
  current() { return this.frames[this.cursor] || null; }

  // ---- read-only navigation (cursor is visualization state only) ----
  first() { this.cursor = 0; return this.current(); }
  last() { this.cursor = Math.max(0, this.frames.length - 1); return this.current(); }
  next() { if (this.cursor < this.frames.length - 1) this.cursor += 1; return this.current(); }
  prev() { if (this.cursor > 0) this.cursor -= 1; return this.current(); }
  jumpToFrame(idOrIndex) { const i = typeof idOrIndex === 'number' ? idOrIndex : this.frames.findIndex((f) => f.frameId === idOrIndex); if (i >= 0 && i < this.frames.length) this.cursor = i; return this.current(); }
  jumpToTimestamp(t) { let i = 0; for (let k = 0; k < this.frames.length; k++) if ((this.frames[k].simulationTime ?? 0) <= t) i = k; this.cursor = i; return this.current(); }
  jumpToTransition(n = 0) { let count = 0; for (let k = 0; k < this.frames.length; k++) { const tr = this.frames[k].transitionRecords || []; if (count + tr.length > n) { this.cursor = k; return this.current(); } count += tr.length; } return null; }
  jumpToWarning(n = 0) { return this._jumpToNonEmpty('warnings', n); }
  jumpToEvidence(n = 0) { return this._jumpToNonEmpty('evidenceRecords', n); }
  jumpToPrediction(n = 0) { return this._jumpToNonEmpty('predictionRecords', n); }
  _jumpToNonEmpty(key, n) { let count = 0; for (let k = 0; k < this.frames.length; k++) { const arr = this.frames[k][key] || []; if (count + arr.length > n) { this.cursor = k; return this.current(); } count += arr.length; } return null; }

  /** Timeline never changes frame ordering; expose the ordered frames read-only. */
  ordered() { return this.frames.slice(); }
}

export class ImmuneReplay {
  /** @param {object[]} serializedOrFrames immutable published frames (or their serialized plain data) */
  constructor(serializedOrFrames) {
    this.frames = orderFrames((serializedOrFrames || []).map((f) => (typeof f === 'string' ? JSON.parse(f) : f)));
    this.cursor = 0; this.playing = false; this.speed = 1; this.mode = 'frame_by_frame';
  }

  /** Validate the sequence BEFORE replay: ordering, version + schema compatibility, serialization, completeness. */
  validate() {
    const issues = [];
    let prevIndex = -Infinity; let schema = null; let contract = null;
    for (const f of this.frames) {
      if (!f || typeof f !== 'object') { issues.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', message: 'non-object frame' }); continue; }
      if ((f.frameIndex ?? 0) < prevIndex) issues.push({ code: 'IMMUNE_INVALID_DELTA_TIME', message: `frame ordering violation at ${f.frameId}` });
      prevIndex = f.frameIndex ?? 0;
      if (schema == null) schema = f.schemaVersion; else if (f.schemaVersion !== schema) issues.push({ code: 'IMMUNE_FRAME_VERSION_MISMATCH', message: `schema mismatch at ${f.frameId}` });
      if (contract == null) contract = f.resistanceContractVersion; else if (f.resistanceContractVersion !== contract) issues.push({ code: 'IMMUNE_FRAME_VERSION_MISMATCH', message: `contract mismatch at ${f.frameId}` });
      if (!f.frameId || f.schemaVersion == null) issues.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', message: 'missing identity/version' });
      const ser = validateSerializable(f); if (!ser.ok) issues.push({ code: 'IMMUNE_SERIALIZATION_VALIDATION_FAILED', message: `frame ${f.frameId} not serializable` });
    }
    if (this.frames.length === 0) issues.push({ code: 'IMMUNE_INPUT_MISSING', message: 'empty timeline' });
    return { ok: issues.length === 0, issues };
  }

  // ---- replay controls (reconstruct stored frames; never recalculates biology) ----
  current() { return this.frames[this.cursor] || null; }
  stepForward() { if (this.cursor < this.frames.length - 1) this.cursor += 1; return this.current(); }
  stepBackward() { if (this.cursor > 0) this.cursor -= 1; return this.current(); }
  first() { this.cursor = 0; return this.current(); }
  last() { this.cursor = Math.max(0, this.frames.length - 1); return this.current(); }
  jumpToFrame(idOrIndex) { const i = typeof idOrIndex === 'number' ? idOrIndex : this.frames.findIndex((f) => f.frameId === idOrIndex); if (i >= 0) this.cursor = i; return this.current(); }
  jumpToTransition(n = 0) { let c = 0; for (let k = 0; k < this.frames.length; k++) { const tr = this.frames[k].transitionRecords || []; if (c + tr.length > n) { this.cursor = k; return this.current(); } c += tr.length; } return null; }
  pause() { this.playing = false; return this; }
  resume() { this.playing = true; return this; }
  setSpeed(s) { this.speed = s > 0 ? s : 1; return this; }   // visualization only; biological timing unchanged
  setMode(m) { this.mode = m; return this; }

  /** Round-trip check: serialize -> deserialize -> serialize is stable for every frame. */
  roundTripStable() { return this.frames.every((f) => stableStringify(f) === stableStringify(JSON.parse(stableStringify(f)))); }
  contentIds() { return this.frames.map((f) => contentId(f)); }
}

export default ImmuneTimeline;
