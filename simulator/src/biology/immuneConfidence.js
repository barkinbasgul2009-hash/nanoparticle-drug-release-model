// Phase-7C shared confidence framework (Part 1 - Section 2). Confidence = trust in the computational
// ESTIMATE, not biological activity. Registry-driven category boundaries + propagation penalties.
// Confidence is never inflated: it starts at a modest base and only DECREASES with missing inputs,
// unavailable dependencies, incomplete registries, conflicting signals, and prediction uncertainty.
// Deterministic.

import { clamp, isFiniteNumber } from './immuneObjects.js';

export class ImmuneConfidence {
  /** @param {any} confidenceRegistry parsed immune-confidence.registry.json */
  constructor(confidenceRegistry) {
    if (!confidenceRegistry || !confidenceRegistry.categories) throw new Error('ImmuneConfidence requires the immune-confidence registry');
    this.reg = confidenceRegistry;
    this.p = confidenceRegistry.propagation || {};
    this.floor = isFiniteNumber(this.p.floor) ? this.p.floor : 0.02;
    this.ceiling = isFiniteNumber(this.p.ceiling) ? this.p.ceiling : 0.95;
    this.base = isFiniteNumber(this.p.base_confidence) ? this.p.base_confidence : 0.6;
  }

  /** Map a normalized score to a categorical confidence using registry boundaries. */
  categorize(score) {
    if (!isFiniteNumber(score)) return null;
    const cats = this.reg.categories;
    // ordered check; a score at a boundary falls into the higher category's [min,max]
    for (const name of ['VERY_HIGH', 'HIGH', 'MODERATE', 'LOW', 'VERY_LOW']) {
      const c = cats[name]; if (c && score >= c.min && score <= c.max) return name;
    }
    return score >= 0.8 ? 'VERY_HIGH' : score < 0.2 ? 'VERY_LOW' : 'MODERATE';
  }

  /**
   * Propagate confidence from support conditions. Each penalty is applied per COUNT (or boolean).
   * @param {{ missingInputs?:number, unavailableDependencies?:number, incompleteRegistry?:boolean|number,
   *   conflictingSignals?:number, predictionUncertainty?:boolean|number, baseOverride?:number }} f
   * @returns {{ score:number, category:string }}
   */
  propagate(f = {}) {
    const pen = this.p.penalties || {};
    let score = isFiniteNumber(f.baseOverride) ? f.baseOverride : this.base;
    score -= (pen.missing_input || 0) * (f.missingInputs || 0);
    score -= (pen.unavailable_dependency || 0) * (f.unavailableDependencies || 0);
    score -= (pen.incomplete_registry || 0) * (f.incompleteRegistry ? Number(f.incompleteRegistry) : 0);
    score -= (pen.conflicting_signal || 0) * (f.conflictingSignals || 0);
    score -= (pen.prediction_uncertainty || 0) * (f.predictionUncertainty ? Number(f.predictionUncertainty) : 0);
    score = clamp(score, this.floor, this.ceiling);
    return { score, category: this.categorize(score) };
  }

  /**
   * Combine per-input confidences into an aggregate confidence that also reflects how many inputs
   * were unavailable and whether signals conflicted. Never exceeds the ceiling.
   */
  combine(inputConfidences = [], { unavailableCount = 0, conflictCount = 0 } = {}) {
    const vals = inputConfidences.filter(isFiniteNumber);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : this.floor;
    const propagated = this.propagate({ baseOverride: mean, unavailableDependencies: unavailableCount, conflictingSignals: conflictCount });
    return propagated;
  }
}

export default ImmuneConfidence;
