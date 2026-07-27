// Phase-0 3D VISUALIZATION ADAPTER (read-only). The ONLY bridge between existing simulation
// outputs and the future Three.js scenes.
//
// HARD RULES (enforced by tests):
//   • calculates NO biology, mutates NO frame/replay/registry/evidence/prediction data
//   • never converts UNAVAILABLE / not-modelled to zero
//   • every emitted field carries a provenance tag so VISUAL_ONLY values can never be
//     mistaken for biological measurements:
//        SIMULATION_DERIVED      - read straight from a simulation output
//        EVIDENCE_BACKED_MAPPING - simulation value mapped to a visual range (no new biology)
//        VISUAL_ONLY             - presentation parameter with no biological meaning
//        UNAVAILABLE / NOT_MODELLED - explicitly absent (value stays null)

export const PROVENANCE = Object.freeze({
  SIMULATION_DERIVED: 'SIMULATION_DERIVED',
  EVIDENCE_BACKED_MAPPING: 'EVIDENCE_BACKED_MAPPING',
  VISUAL_ONLY: 'VISUAL_ONLY',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_MODELLED: 'NOT_MODELLED',
});

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** A tagged visual parameter. `value` is null whenever the source is absent — NEVER 0. */
export function vparam(value, provenance, source = null) {
  const known = provenance === PROVENANCE.SIMULATION_DERIVED
    || provenance === PROVENANCE.EVIDENCE_BACKED_MAPPING
    || provenance === PROVENANCE.VISUAL_ONLY;
  return Object.freeze({ value: known && isNum(value) ? value : (known && value != null ? value : null), provenance, source });
}

/** Simulation number -> visual range, keeping provenance. Absent input stays UNAVAILABLE (null). */
export function mapRange(value, outMin, outMax, provenance = PROVENANCE.EVIDENCE_BACKED_MAPPING, source = null) {
  if (!isNum(value)) return vparam(null, PROVENANCE.UNAVAILABLE, source);
  return vparam(outMin + clamp01(value) * (outMax - outMin), provenance, source);
}

/**
 * Build the immutable VisualState the SceneDirector consumes.
 * Reads ONLY already-computed outputs; performs no biology.
 * @param {{ transportStats?:object, releaseStats?:object, immuneFrame?:object,
 *           resistanceReadiness?:object, progress?:number }} src
 */
export function buildVisualState(src = {}) {
  const t = src.transportStats || null;
  const r = src.releaseStats || null;
  const f = src.immuneFrame || null;

  const num = (v) => (isNum(v) ? v : null);
  const fromMetric = (m) => (m && typeof m === 'object' ? (m.availability === 'UNAVAILABLE' ? null : num(m.value)) : num(m));

  return Object.freeze({
    // narrative progress (drives which scene/shot is active) — supplied by the master timeline
    progress: vparam(isNum(src.progress) ? clamp01(src.progress) : null, isNum(src.progress) ? PROVENANCE.SIMULATION_DERIVED : PROVENANCE.UNAVAILABLE, 'masterTimeline'),

    // --- skin transport (Phase 3 engine) ---
    releasedFraction: r && isNum(r.releasedFraction) ? vparam(r.releasedFraction, PROVENANCE.SIMULATION_DERIVED, 'releaseEngine.stats') : vparam(null, PROVENANCE.UNAVAILABLE, 'releaseEngine.stats'),
    penetrationDepth: t && isNum(t.meanDepth) ? vparam(t.meanDepth, PROVENANCE.SIMULATION_DERIVED, 'transportEngine.stats') : vparam(null, PROVENANCE.UNAVAILABLE, 'transportEngine.stats'),
    layerOccupancy: t && t.byLayer ? vparam(t.byLayer, PROVENANCE.SIMULATION_DERIVED, 'transportEngine.stats.byLayer') : vparam(null, PROVENANCE.UNAVAILABLE, 'transportEngine.stats.byLayer'),

    // --- systemic stage: NOT MODELLED for the topical route (never faked, never zeroed) ---
    capillaryEntryFraction: vparam(null, PROVENANCE.NOT_MODELLED, 'topical route has no systemic stage (transportEngine)'),
    bloodstreamFlowSpeed: vparam(null, PROVENANCE.NOT_MODELLED, 'no systemic PK in evidence'),

    // --- tissue / immune (Phase 7C canonical frame) ---
    tissueAccessibility: f ? vparam(fromMetric(f.inputSummary && f.inputSummary.availability ? null : null), PROVENANCE.UNAVAILABLE, 'immuneFrame') : vparam(null, PROVENANCE.UNAVAILABLE, 'immuneFrame'),
    immuneControlState: f && f.immuneEffect ? vparam(f.immuneEffect.controlState || null, PROVENANCE.SIMULATION_DERIVED, 'immuneFrame.immuneEffect') : vparam(null, PROVENANCE.UNAVAILABLE, 'immuneFrame.immuneEffect'),
    frameAvailability: f ? vparam(f.availability || null, PROVENANCE.SIMULATION_DERIVED, 'immuneFrame.availability') : vparam(null, PROVENANCE.UNAVAILABLE, 'immuneFrame'),

    // --- presentation-only (explicitly NOT biological measurements) ---
    visibleParticleCount: vparam(240, PROVENANCE.VISUAL_ONLY, 'render budget'),
    redBloodCellDensity: vparam(0.6, PROVENANCE.VISUAL_ONLY, 'illustrative'),
    glowIntensity: vparam(0.8, PROVENANCE.VISUAL_ONLY, 'illustrative'),
    cameraSpeed: vparam(1.0, PROVENANCE.VISUAL_ONLY, 'cinematography'),
  });
}

/** True when a visual parameter may be presented as a scientific value. */
export function isBiological(p) { return !!p && (p.provenance === PROVENANCE.SIMULATION_DERIVED || p.provenance === PROVENANCE.EVIDENCE_BACKED_MAPPING); }

export default buildVisualState;
