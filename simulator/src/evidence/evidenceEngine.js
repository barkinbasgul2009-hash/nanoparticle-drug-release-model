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
