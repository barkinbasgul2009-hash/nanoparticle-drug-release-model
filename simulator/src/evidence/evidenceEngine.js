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

// Phase 5B.1 signal-transduction evidence classification - a refined vocabulary for
// per-node / per-edge evidence in the signaling graph. Stored INDEPENDENTLY per node,
// edge, timing, direction, phosphorylation and feedback. A prediction is never
// relabelled as experimental.
export const SIGNAL_EVIDENCE_LEVELS = Object.freeze([
  'EXPERIMENTAL_FORMULATION_SPECIFIC',   // exact formulation, same species/cell/context
  'EXPERIMENTAL_DRUG_CELL_SPECIFIC',     // same drug, same species/cell, maybe other formulation
  'EXPERIMENTAL_PATHWAY_SPECIFIC',       // relationship established generally, not this context
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'NOT_REPORTED',
  'UNAVAILABLE',
  'CONTRADICTORY_EVIDENCE',
]);

const _SIGNAL_EXPERIMENTAL = new Set([
  'EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_PATHWAY_SPECIFIC',
]);
const _SIGNAL_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION',
]);

export function isSignalEvidenceLevel(level) { return SIGNAL_EVIDENCE_LEVELS.includes(level); }
export function isSignalExperimental(level) { return _SIGNAL_EXPERIMENTAL.has(level); }
export function isSignalPrediction(level) { return _SIGNAL_PREDICTION.has(level); }
/** Whether a signal evidence level would be eligible to animate in a future engine. */
export function signalLevelAnimates(level) {
  return _SIGNAL_EXPERIMENTAL.has(level) || _SIGNAL_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
}

// Phase 5B.2 RUNTIME prediction vocabulary for the signal PROPAGATION engine. This is a
// display/reasoning ladder for a node/edge at runtime; it is ADDITIVE and does NOT modify
// the frozen 5B.1 SIGNAL_EVIDENCE_LEVELS (experimental evidence labels stay unchanged).
// Prediction never overwrites experimental: EXPERIMENTAL always outranks any prediction,
// and HYPOTHESIS is the weakest (a labelled, biologically-reasonable guess).
export const SIGNAL_PREDICTION_LEVELS = Object.freeze([
  'EXPERIMENTAL',
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'HYPOTHESIS',
]);

const _RUNTIME_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'HYPOTHESIS',
]);

/** True if a runtime prediction level is a real prediction (not experimental). */
export function isRuntimePrediction(level) { return _RUNTIME_PREDICTION.has(level); }
/** True if a runtime level is experimental (outranks every prediction). */
export function isRuntimeExperimental(level) { return level === 'EXPERIMENTAL'; }
/** Valid runtime prediction level? */
export function isRuntimePredictionLevel(level) { return SIGNAL_PREDICTION_LEVELS.includes(level); }

// Phase 5C GENE-REGULATION / TRANSCRIPTION evidence vocabulary. ADDITIVE - does not
// modify any earlier array. Applied to transcription factors, promoters, genes and mRNA.
// EXPERIMENTAL always outranks every prediction; a prediction never overwrites evidence.
// NOT_REPORTED is the honest empty state (e.g. Profile-B rat/mouse transcription).
export const GENE_EVIDENCE_LEVELS = Object.freeze([
  'EXPERIMENTAL',
  'HIGH_CONFIDENCE',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'HYPOTHESIS',
  'NOT_REPORTED',
]);

const _GENE_PREDICTION = new Set([
  'HIGH_CONFIDENCE', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'HYPOTHESIS',
]);

/** Valid gene/transcription evidence level? */
export function isGeneEvidenceLevel(level) { return GENE_EVIDENCE_LEVELS.includes(level); }
/** True if a gene evidence level is experimental (outranks predictions). */
export function isGeneExperimental(level) { return level === 'EXPERIMENTAL'; }
/** True if a gene evidence level is a labelled prediction (never presented as experimental). */
export function isGenePrediction(level) { return _GENE_PREDICTION.has(level); }

// Phase 5D TRANSLATION / PROTEIN-SYNTHESIS evidence vocabulary. ADDITIVE - does not modify
// any earlier array. Reuses the refined signal-evidence tiers plus HYPOTHESIS. Applied to
// translation contexts, machinery, proteins and turnover. Experimental always outranks a
// prediction; a prediction never overwrites experimental data.
export const TRANSLATION_EVIDENCE_LEVELS = Object.freeze([
  'EXPERIMENTAL_FORMULATION_SPECIFIC',
  'EXPERIMENTAL_DRUG_CELL_SPECIFIC',
  'EXPERIMENTAL_PATHWAY_SPECIFIC',
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'HYPOTHESIS',
  'NOT_REPORTED',
  'UNAVAILABLE',
  'CONTRADICTORY_EVIDENCE',
]);

const _TRANSLATION_EXPERIMENTAL = new Set([
  'EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_PATHWAY_SPECIFIC',
]);
const _TRANSLATION_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'HYPOTHESIS',
]);

/** Valid translation evidence level? */
export function isTranslationEvidenceLevel(level) { return TRANSLATION_EVIDENCE_LEVELS.includes(level); }
/** True if a translation evidence level is experimental (outranks predictions). */
export function isTranslationExperimental(level) { return _TRANSLATION_EXPERIMENTAL.has(level); }
/** True if a translation evidence level is a labelled prediction (never presented as experimental). */
export function isTranslationPrediction(level) { return _TRANSLATION_PREDICTION.has(level); }
/** Would this translation level be eligible to run/animate? (not UNAVAILABLE / NOT_REPORTED) */
export function translationLevelActive(level) {
  return _TRANSLATION_EXPERIMENTAL.has(level) || _TRANSLATION_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
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
