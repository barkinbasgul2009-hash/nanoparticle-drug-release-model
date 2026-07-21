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

// Phase 6A PROTEIN-FUNCTION / EARLY-CELLULAR-RESPONSE evidence vocabulary. ADDITIVE - does
// not modify any earlier array. Reuses the refined tiers + HYPOTHESIS. Applied to protein
// functional states, cellular-state variables, and functional edges. Experimental always
// outranks prediction; a prediction never overwrites experimental data. Cell-fate remains
// NOT_EVALUATED (Phase 6A stops before cell fate).
export const FUNCTION_EVIDENCE_LEVELS = Object.freeze([
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

const _FUNCTION_EXPERIMENTAL = new Set([
  'EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_PATHWAY_SPECIFIC',
]);
const _FUNCTION_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'HYPOTHESIS',
]);

/** Valid protein-function evidence level? */
export function isFunctionEvidenceLevel(level) { return FUNCTION_EVIDENCE_LEVELS.includes(level); }
/** True if a function evidence level is experimental (outranks predictions). */
export function isFunctionExperimental(level) { return _FUNCTION_EXPERIMENTAL.has(level); }
/** True if a function evidence level is a labelled prediction (never presented as experimental). */
export function isFunctionPrediction(level) { return _FUNCTION_PREDICTION.has(level); }
/** Would this function level be eligible to run/animate? (not UNAVAILABLE / NOT_REPORTED) */
export function functionLevelActive(level) {
  return _FUNCTION_EXPERIMENTAL.has(level) || _FUNCTION_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
}

// Phase 6B APOPTOSIS evidence vocabulary. ADDITIVE - does not modify any earlier array.
// Extends the refined tiers with CONTEXT_TRANSFER_PREDICTION (a relationship transferred
// from one cell model to another, e.g. B16 -> B16BL6, always explicitly labelled and never
// experimental in the target). Experimental always outranks a prediction; a prediction
// never overwrites experimental data. Population / tumour outcome stays NOT_EVALUATED.
export const APOPTOSIS_EVIDENCE_LEVELS = Object.freeze([
  'EXPERIMENTAL_FORMULATION_SPECIFIC',
  'EXPERIMENTAL_DRUG_CELL_SPECIFIC',
  'EXPERIMENTAL_PATHWAY_SPECIFIC',
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'CONTEXT_TRANSFER_PREDICTION',
  'HYPOTHESIS',
  'NOT_REPORTED',
  'UNAVAILABLE',
  'CONTRADICTORY_EVIDENCE',
]);

const _APOPTOSIS_EXPERIMENTAL = new Set([
  'EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_PATHWAY_SPECIFIC',
]);
const _APOPTOSIS_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'CONTEXT_TRANSFER_PREDICTION', 'HYPOTHESIS',
]);

/** Valid apoptosis evidence level? */
export function isApoptosisEvidenceLevel(level) { return APOPTOSIS_EVIDENCE_LEVELS.includes(level); }
/** True if an apoptosis evidence level is experimental (outranks predictions). */
export function isApoptosisExperimental(level) { return _APOPTOSIS_EXPERIMENTAL.has(level); }
/** True if an apoptosis evidence level is a labelled prediction (never presented as experimental). */
export function isApoptosisPrediction(level) { return _APOPTOSIS_PREDICTION.has(level); }
/** True if an apoptosis evidence level is a cross-cell-model context transfer. */
export function isApoptosisTransfer(level) { return level === 'CONTEXT_TRANSFER_PREDICTION'; }
/** Would this apoptosis level be eligible to run/animate? (not UNAVAILABLE / NOT_REPORTED) */
export function apoptosisLevelActive(level) {
  return _APOPTOSIS_EXPERIMENTAL.has(level) || _APOPTOSIS_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
}

// ---------------------------------------------------------------------------
// Phase 6C - population-response evidence vocabulary (ADDITIVE; earlier arrays
// unchanged). Phase 6C reasons about a SCHEMATIC virtual cell population derived
// from the Phase-6B single-cell apoptosis trajectory. The frozen package has NO
// population-level dataset, so a population relationship is only ever a LABELLED
// prediction where single-cell evidence exists (and NOT_REPORTED otherwise) - it
// is NEVER presented as experimental, and it never claims real cell counts. The
// simulator STOPS at population composition; tumour / clinical outcome is NEVER
// evaluated.
export const POPULATION_EVIDENCE_LEVELS = Object.freeze([
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'CONTEXT_TRANSFER_PREDICTION',
  'HYPOTHESIS',
  'NOT_REPORTED',
  'UNAVAILABLE',
  'CONTRADICTORY_EVIDENCE',
]);

const _POPULATION_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'CONTEXT_TRANSFER_PREDICTION', 'HYPOTHESIS',
]);

/** Valid population evidence level? */
export function isPopulationEvidenceLevel(level) { return POPULATION_EVIDENCE_LEVELS.includes(level); }
/** True if a population evidence level is a labelled prediction (population is never experimental). */
export function isPopulationPrediction(level) { return _POPULATION_PREDICTION.has(level); }
/** True if a population evidence level is a cross-cell-model context transfer. */
export function isPopulationTransfer(level) { return level === 'CONTEXT_TRANSFER_PREDICTION'; }
/** Would this population level be eligible to run? (not UNAVAILABLE / NOT_REPORTED) */
export function populationLevelActive(level) {
  return _POPULATION_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
}

// ---------------------------------------------------------------------------
// Phase 6D - tumour growth / treatment-response evidence vocabulary (ADDITIVE;
// earlier arrays unchanged). Phase 6D represents a SCHEMATIC virtual tumour-cell
// burden (normalized 0-1) and a treatment-response trajectory. Unlike the
// population layer, a tumour-level EXPERIMENTAL tier exists here because the frozen
// package DOES contain in vivo antimelanoma pharmacodynamic evidence (Chen 2012,
// B16BL6, formulation ranking) - but it supports DIRECTION / RANKING only; every
// exact tumour volume / rate / % stays NOT_REPORTED. Predictions are always labelled
// and never overwrite experimental evidence. The simulator STOPS at the schematic
// treatment-response trajectory; no clinical / RECIST / survival / patient outcome
// is ever represented.
export const TUMOR_EVIDENCE_LEVELS = Object.freeze([
  'EXPERIMENTAL_FORMULATION_SPECIFIC',
  'EXPERIMENTAL_DRUG_CELL_SPECIFIC',
  'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC',
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'CONTEXT_TRANSFER_PREDICTION',
  'HYPOTHESIS',
  'NOT_REPORTED',
  'UNAVAILABLE',
  'CONTRADICTORY_EVIDENCE',
]);

const _TUMOR_EXPERIMENTAL = new Set([
  'EXPERIMENTAL_FORMULATION_SPECIFIC', 'EXPERIMENTAL_DRUG_CELL_SPECIFIC', 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC',
]);
const _TUMOR_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'CONTEXT_TRANSFER_PREDICTION', 'HYPOTHESIS',
]);

/** Valid tumour evidence level? */
export function isTumorEvidenceLevel(level) { return TUMOR_EVIDENCE_LEVELS.includes(level); }
/** True if a tumour evidence level is experimental (outranks predictions; never fabricated). */
export function isTumorExperimental(level) { return _TUMOR_EXPERIMENTAL.has(level); }
/** True if a tumour evidence level is a labelled prediction (never presented as experimental). */
export function isTumorPrediction(level) { return _TUMOR_PREDICTION.has(level); }
/** True if a tumour evidence level is a cross-cell-model context transfer. */
export function isTumorTransfer(level) { return level === 'CONTEXT_TRANSFER_PREDICTION'; }
/** Would this tumour level be eligible to run? (not UNAVAILABLE / NOT_REPORTED) */
export function tumorLevelActive(level) {
  return _TUMOR_EXPERIMENTAL.has(level) || _TUMOR_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
}

// ---------------------------------------------------------------------------
// Phase 7A - passive tumour-microenvironment (TME) evidence vocabulary (ADDITIVE;
// earlier arrays unchanged). Phase 7A represents the PASSIVE physical/biochemical
// environment (ECM / collagen / hyaluronic acid / interstitial space / oxygen /
// hypoxia / mechanical barrier) that MODIFIES drug penetration - it does not kill
// cells, signal, or remodel. The frozen package contains NO direct TME dataset for
// this formulation, so a microenvironment relationship is only ever a LABELLED
// prediction (general tumour-ECM / hypoxia biology applied to this context) or
// NOT_REPORTED - never experimental, never a fabricated concentration / density /
// pressure / diffusion coefficient. No experimental tier exists here.
export const MICROENVIRONMENT_EVIDENCE_LEVELS = Object.freeze([
  'HIGH_CONFIDENCE_PREDICTION',
  'LITERATURE_DERIVED_PREDICTION',
  'MECHANISTIC_PREDICTION',
  'CONTEXT_TRANSFER_PREDICTION',
  'HYPOTHESIS',
  'NOT_REPORTED',
  'UNAVAILABLE',
  'CONTRADICTORY_EVIDENCE',
]);

const _MICROENV_PREDICTION = new Set([
  'HIGH_CONFIDENCE_PREDICTION', 'LITERATURE_DERIVED_PREDICTION', 'MECHANISTIC_PREDICTION', 'CONTEXT_TRANSFER_PREDICTION', 'HYPOTHESIS',
]);

/** Valid microenvironment evidence level? */
export function isMicroenvironmentEvidenceLevel(level) { return MICROENVIRONMENT_EVIDENCE_LEVELS.includes(level); }
/** True if a microenvironment evidence level is a labelled prediction (never experimental). */
export function isMicroenvironmentPrediction(level) { return _MICROENV_PREDICTION.has(level); }
/** True if a microenvironment evidence level is a cross-species/context transfer. */
export function isMicroenvironmentTransfer(level) { return level === 'CONTEXT_TRANSFER_PREDICTION'; }
/** Would this microenvironment level be eligible to run? (not UNAVAILABLE / NOT_REPORTED) */
export function microenvironmentLevelActive(level) {
  return _MICROENV_PREDICTION.has(level) || level === 'CONTRADICTORY_EVIDENCE';
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
