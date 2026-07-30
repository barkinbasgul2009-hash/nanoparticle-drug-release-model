// Phase-7C Part 2 immune renderer (read-only, deterministic, headless). Consumes ONLY immutable
// published ImmuneFrames and produces plain-data render frames + renderable components. It NEVER
// modifies biological state, never estimates/smooths/interpolates biological values, and never hides
// unavailability or uncertainty. Colour = biological interpretation (registry-driven); confidence uses
// a SEPARATE encoding channel. Every component carries icon + label + text for accessibility (never
// colour-only). Output is deep-frozen (no mutable references escape). Reuses Section-1 primitives.

import { AVAILABILITY, deepFreeze, isFiniteNumber } from '../biology/immuneObjects.js';

function metricOf(m) {
  if (m == null) return { value: null, availability: AVAILABILITY.UNAVAILABLE };
  if (typeof m === 'number') return { value: isFiniteNumber(m) ? m : null, availability: isFiniteNumber(m) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE };
  return { value: m.value ?? null, availability: m.availability || (m.value == null ? AVAILABILITY.UNAVAILABLE : AVAILABILITY.AVAILABLE) };
}
function confOf(owner) { return owner && owner.confidence ? { score: owner.confidence.score ?? null, category: owner.confidence.category ?? null } : { score: null, category: null }; }

// Component extraction specs (handle both Section-1 and Section-4 frame shapes; missing -> UNAVAILABLE).
const SPECS = [
  { id: 'tumor_visibility', get: (f) => metricOf((f.resistanceReadiness && f.resistanceReadiness.tumorVisibility) || (f.tumorVisibility && f.tumorVisibility.summary)) },
  { id: 'antigen_availability', get: (f) => metricOf(f.tumorVisibility && f.tumorVisibility.antigenAvailability) },
  { id: 'immune_accessibility', get: (f) => metricOf(f.inputSummary && f.inputSummary.availability ? { value: null, availability: f.inputSummary.availability.immune_accessibility } : null) },
  { id: 'macrophage', get: (f) => metricOf(f.innateImmunity && f.innateImmunity.macrophage && f.innateImmunity.macrophage.tumorOpposingTendency) },
  { id: 'nk', get: (f) => metricOf(f.innateImmunity && f.innateImmunity.nk && f.innateImmunity.nk.cytotoxicPotential) },
  { id: 'dendritic', get: (f) => metricOf(f.innateImmunity && f.innateImmunity.dendritic && f.innateImmunity.dendritic.presentationPotential) },
  { id: 'innate_readiness', get: (f) => metricOf(f.innateImmunity && f.innateImmunity.readiness) },
  { id: 'adaptive_readiness', get: (f) => metricOf(f.adaptiveImmunity && f.adaptiveImmunity.adaptive && f.adaptiveImmunity.adaptive.readiness), owner: (f) => f.adaptiveImmunity && f.adaptiveImmunity.adaptive },
  { id: 'cd8', get: (f) => metricOf(f.adaptiveImmunity && f.adaptiveImmunity.cd8 && f.adaptiveImmunity.cd8.cytotoxicPotential), owner: (f) => f.adaptiveImmunity && f.adaptiveImmunity.cd8 },
  { id: 'cd4', get: (f) => metricOf(f.adaptiveImmunity && f.adaptiveImmunity.cd4 && f.adaptiveImmunity.cd4.helperCompetence), owner: (f) => f.adaptiveImmunity && f.adaptiveImmunity.cd4 },
  { id: 'treg', get: (f) => metricOf(f.adaptiveImmunity && f.adaptiveImmunity.treg && f.adaptiveImmunity.treg.suppressiveCompetence), state: (f) => f.adaptiveImmunity && f.adaptiveImmunity.treg && f.adaptiveImmunity.treg.suppressiveCompetence && f.adaptiveImmunity.treg.suppressiveCompetence.state, owner: (f) => f.adaptiveImmunity && f.adaptiveImmunity.treg },
  { id: 'checkpoint', get: (f) => metricOf(f.checkpointState && (f.checkpointState.overallCheckpointBurden || { value: f.checkpointState.axis && f.checkpointState.axis.engagement, availability: f.checkpointState.availability })), owner: (f) => f.checkpointState },
  { id: 'suppression', get: (f) => metricOf(f.immuneSuppression && { value: f.immuneSuppression.pressure, availability: f.immuneSuppression.availability }), state: (f) => f.immuneSuppression && f.immuneSuppression.state, owner: (f) => f.immuneSuppression },
  { id: 'escape', get: (f) => metricOf(f.immuneEscape && f.immuneEscape.overallEscapePressure), state: (f) => f.immuneEscape && f.immuneEscape.magnitudeState, persistence: (f) => f.immuneEscape && f.immuneEscape.persistenceState, owner: (f) => f.immuneEscape },
  { id: 'net_immune_potential', get: (f) => metricOf(f.immuneEffect && f.immuneEffect.potential), owner: (f) => f.immuneEffect },
  { id: 'blocked_immune_potential', get: (f) => metricOf(f.immuneEffect && f.immuneEffect.blockedPotential) },
  { id: 'immune_control', get: (f) => ({ value: null, availability: f.immuneEffect ? f.immuneEffect.availability : AVAILABILITY.UNAVAILABLE }), state: (f) => f.immuneEffect && f.immuneEffect.controlState },
  { id: 'immune_failure', get: (f) => ({ value: null, availability: f.immuneEffect ? f.immuneEffect.availability : AVAILABILITY.UNAVAILABLE }), state: (f) => f.immuneEffect && f.immuneEffect.failureState },
];

export class ImmuneRenderer {
  /** @param {any} renderRegistry parsed immune-render.registry.json */
  constructor(renderRegistry) {
    if (!renderRegistry || !renderRegistry.palettes) throw new Error('ImmuneRenderer requires the immune-render registry');
    this.reg = renderRegistry;
  }

  _band(value) {
    if (!isFiniteNumber(value)) return null;
    const b = this.reg.value_bands || {}; let best = null, bestMin = -Infinity;
    for (const [name, min] of Object.entries(b)) if (typeof min === 'number' && value >= min && min >= bestMin) { best = name; bestMin = min; }
    return best;
  }

  /** Build one renderable component (read-only). */
  _component(frame, spec) {
    const m = spec.get(frame) || { value: null, availability: AVAILABILITY.UNAVAILABLE };
    const owner = spec.owner ? spec.owner(frame) : null;
    const explicitState = spec.state ? spec.state(frame) : null;
    const band = this._band(m.value);
    const paletteId = m.availability === AVAILABILITY.UNAVAILABLE ? 'unavailable' : (this.reg.category_palette[spec.id] || 'neutral');
    const palette = this.reg.palettes[paletteId] || this.reg.palettes.neutral;
    const conf = confOf(owner);
    const confEnc = conf.category && this.reg.confidence_encoding.bands[conf.category] != null ? this.reg.confidence_encoding.bands[conf.category] : null;
    // transition indicator derives ONLY from transition records (never inferred)
    const transitions = (frame.transitionRecords || []).filter((t) => t.machine === spec.id || (t.affectedField && t.affectedField === spec.id));
    const title = (this.reg.component_titles || {})[spec.id] || spec.id;
    const stateOrBand = explicitState || band;
    const text = m.availability === AVAILABILITY.UNAVAILABLE ? 'Unavailable' : (isFiniteNumber(m.value) ? m.value.toFixed(3) : (stateOrBand || 'n/a'));
    return {
      id: spec.id, title, value: m.value, state: stateOrBand, band, persistenceState: spec.persistence ? spec.persistence(frame) : undefined,
      availability: m.availability, confidence: conf, confidenceEncoding: confEnc,
      palette: palette.id, paletteToken: palette.token, paletteMeaning: palette.meaning, unavailablePattern: paletteId === 'unavailable' ? (palette.pattern || 'hatched') : null,
      icon: (this.reg.accessibility.icons || {})[paletteId] || 'dot', label: title, text, stateDescription: stateOrBand ? `${title}: ${stateOrBand}` : `${title}: ${text}`,
      warnings: (frame.warnings || []).filter((w) => w.affectedField === spec.id),
      transitionIndicator: transitions.length > 0, transitionCount: transitions.length,
      timestamp: frame.simulationTime, sourceReferences: (frame.sourceFrameReferences || []).map((r) => r.frameId).filter(Boolean),
    };
  }

  /** Produce one deterministic, deep-frozen render frame for a published ImmuneFrame. */
  renderFrame(frame) {
    if (!frame) throw new Error('ImmuneRenderer.renderFrame requires an immune frame');
    const components = SPECS.map((s) => this._component(frame, s));
    return deepFreeze({
      renderVersion: this.reg.render_version, frameId: frame.frameId, simulationTime: frame.simulationTime, frameIndex: frame.frameIndex,
      schemaVersion: frame.schemaVersion, engineVersion: frame.engineVersion, availability: frame.availability, status: frame.status,
      components,
      warningCount: (frame.warnings || []).length, errorCount: (frame.errors || []).length,
      transitionCount: (frame.transitionRecords || []).length, contributionCount: (frame.contributionLedger || []).length,
      rendererMetadata: { readOnly: true, biologyAuthority: 'runtime', deterministic: true },
    });
  }

  /** Render a whole sequence of frames (deterministic; one render frame per immune frame). */
  renderSequence(frames) { return (frames || []).map((f) => this.renderFrame(f)); }
}

/**
 * Read-only hierarchical frame inspector. Never edits; every accessor returns frozen data derived from
 * the immutable frame.
 */
export class ImmuneFrameInspector {
  constructor(frame) { if (!frame) throw new Error('ImmuneFrameInspector requires a frame'); this.frame = frame; }

  /**
   * Hierarchical tree of {path,type,keys/value} nodes (read-only). Depth-limited for lazy expansion:
   * nodes beyond `maxDepth` are summarized (type + keys, `truncated:true`) and expanded on demand via
   * `expand(path)`. This prevents eager full materialization of large frames.
   */
  tree(maxDepth = 2, node = this.frame, path = '', depth = 0) {
    if (node === null || typeof node !== 'object') return { path, type: 'leaf', value: node };
    if (Array.isArray(node)) {
      if (depth >= maxDepth) return { path, type: 'array', length: node.length, truncated: true };
      return { path, type: 'array', length: node.length, items: node.map((v, i) => this.tree(maxDepth, v, `${path}[${i}]`, depth + 1)) };
    }
    const keys = Object.keys(node).sort();
    if (depth >= maxDepth) return { path, type: 'object', keys, truncated: true };
    const children = {}; for (const k of keys) children[k] = this.tree(maxDepth, node[k], path ? `${path}.${k}` : k, depth + 1);
    return { path, type: 'object', keys, children };
  }

  /** Expand a subtree at a dotted path to a further depth (read-only, lazy). */
  expand(dotted, maxDepth = 2) { return this.tree(maxDepth, this.field(dotted), String(dotted)); }

  /** Read a field by dotted path (read-only; returns undefined if absent). */
  field(dotted) { let n = this.frame; for (const k of String(dotted).split('.')) { if (n == null) return undefined; n = n[k.replace(/\[(\d+)\]$/, '')]; if (/\[(\d+)\]$/.test(k)) n = n && n[Number(RegExp.$1)]; } return n; }

  /** Filter top-level frame keys by a predicate (read-only). */
  filter(pred) { const out = {}; for (const k of Object.keys(this.frame)) if (pred(k, this.frame[k])) out[k] = this.frame[k]; return out; }

  availabilityMap() { const out = {}; const walk = (n, p) => { if (n && typeof n === 'object') { if (typeof n.availability === 'string') out[p || 'root'] = n.availability; for (const k of Object.keys(n)) if (n[k] && typeof n[k] === 'object') walk(n[k], p ? `${p}.${k}` : k); } }; walk(this.frame, ''); return out; }

  /** The inspector is strictly read-only. */
  canEdit() { return false; }
}

export default ImmuneRenderer;
