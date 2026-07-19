// Evidence engine (Phase 1). A generic framework that attaches an evidence
// descriptor to any future visual object and answers "is this claim supported?"
// It carries the project's controlled confidence vocabulary and enforces the
// core rule: unsupported events must be blockable. No UI here.

/** Controlled vocabulary shared with the biological-visualization registries. */
export const CONFIDENCE = Object.freeze([
  'DIRECTLY_OBSERVED',
  'QUANTITATIVELY_SUPPORTED',
  'QUALITATIVELY_SUPPORTED',
  'ABSTRACT_SUPPORTED',
  'CONTEXTUAL_ANATOMY',
  'MECHANISTIC_TRANSFER',
  'INFERRED_RISK',
  'ILLUSTRATIVE_ONLY',
  'NOT_REPORTED',
  'UNSUPPORTED_DO_NOT_ANIMATE',
  'NOT_APPLICABLE',
]);

/** Confidence levels that must NEVER drive a rendered/animated event. */
export const BLOCKED_FOR_ANIMATION = Object.freeze([
  'NOT_REPORTED', 'UNSUPPORTED_DO_NOT_ANIMATE', 'NOT_APPLICABLE',
]);

/**
 * Evidence Level (Phase 3.1) - a species/feature-level classification layered on
 * top of the per-item confidence vocabulary. EXPERIMENTAL always outranks
 * PREDICTIVE; predictions are never presented as experimental observations.
 */
// Phase 4D adds NOT_REPORTED - a behaviour whose data is not reported (distinct from
// UNAVAILABLE, which means no profile at all). Neither animates.
export const EVIDENCE_LEVELS = Object.freeze(['EXPERIMENTAL', 'PREDICTIVE', 'UNAVAILABLE', 'NOT_REPORTED']);

/** Map an Evidence Level to whether it may animate. Only EXPERIMENTAL + PREDICTIVE do. */
export function levelAnimates(level) { return level === 'EXPERIMENTAL' || level === 'PREDICTIVE'; }

// Phase 5A prediction labels - a finer vocabulary for the pharmacology layer. A
// prediction is acceptable ONLY when explicitly labelled; it is never presented as an
// experimental fact. EXPERIMENTAL + the three PREDICTION labels animate; the rest do not.
export const PREDICTION_LABELS = Object.freeze([
  'EXPERIMENTAL',
  'HIGH_CONFIDENCE_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'LITERATURE_PREDICTION',
  'UNAVAILABLE',
  'NOT_REPORTED',
]);

/** True if a prediction label is a real prediction/experimental result (animates). */
export function labelAnimates(label) {
  return label === 'EXPERIMENTAL'
    || label === 'HIGH_CONFIDENCE_PREDICTION'
    || label === 'MECHANISTIC_PREDICTION'
    || label === 'LITERATURE_PREDICTION';
}

/** True if a prediction label denotes a prediction (not an experimental result). */
export function isPrediction(label) {
  return label === 'HIGH_CONFIDENCE_PREDICTION'
    || label === 'MECHANISTIC_PREDICTION'
    || label === 'LITERATURE_PREDICTION';
}

/**
 * @typedef {object} EvidenceDescriptor
 * @property {string} confidence      // one of CONFIDENCE
 * @property {string[]} referenceIds
 * @property {string} [species]
 * @property {string} [model]
 * @property {string[]} [limitations]
 * @property {string[]} [unsupportedClaims]
 */

export class EvidenceEngine {
  /** @param {{ logger?: object }} [opts] */
  constructor(opts = {}) { this.logger = opts.logger || null; }

  /** @param {string} confidence @returns {boolean} */
  isValidConfidence(confidence) { return CONFIDENCE.includes(confidence); }

  /**
   * Normalize + validate a descriptor. Throws on an unknown confidence value so
   * mistakes surface early rather than silently rendering unsupported claims.
   * @param {Partial<EvidenceDescriptor>} d
   * @returns {EvidenceDescriptor}
   */
  make(d) {
    const confidence = d.confidence || 'NOT_REPORTED';
    if (!this.isValidConfidence(confidence)) {
      throw new Error(`unknown confidence level: ${confidence}`);
    }
    return {
      confidence,
      referenceIds: d.referenceIds || [],
      species: d.species || undefined,
      model: d.model || undefined,
      limitations: d.limitations || [],
      unsupportedClaims: d.unsupportedClaims || [],
    };
  }

  /**
   * The core gate: may an object with this descriptor be animated/rendered as a
   * real event? Returns false for blocked confidence levels.
   * @param {EvidenceDescriptor} d
   * @returns {boolean}
   */
  canAnimate(d) {
    if (!d) return false;
    const blocked = BLOCKED_FOR_ANIMATION.includes(d.confidence);
    if (blocked) this._log('debug', 'evidence', `blocked for animation: ${d.confidence}`);
    return !blocked;
  }

  /** Present a badge-friendly summary. */
  badge(d) {
    return { confidence: d.confidence, refs: d.referenceIds.length, blocked: !this.canAnimate(d) };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default EvidenceEngine;
