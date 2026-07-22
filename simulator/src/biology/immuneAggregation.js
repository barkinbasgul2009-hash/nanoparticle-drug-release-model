// Phase-7C shared aggregation framework (Part 1 - Section 2). One registry-driven aggregation engine
// every immune module uses - no module implements its own combination logic. Preserves availability,
// confidence, evidence/prediction/contribution traceability, and warning propagation; distinguishes
// absence from zero from negative contribution; resolves competing effects EXPLICITLY (a later module
// never silently overwrites an earlier result). Deterministic (contributors combined in given order).

import { AVAILABILITY, clamp, safeDivide, isFiniteNumber, availabilityAwareAggregate } from './immuneObjects.js';

const USABLE = new Set([AVAILABILITY.AVAILABLE, AVAILABILITY.PARTIALLY_AVAILABLE]);
function usable(c) { return USABLE.has(c.availability) && isFiniteNumber(c.value); }

/** The structured, explainable result of an aggregation. */
export class AggregationResult {
  constructor(def = {}) {
    this.target = def.target;
    this.method = def.method;
    this.value = def.value ?? null;
    this.availability = def.availability || AVAILABILITY.UNAVAILABLE;
    this.confidence = def.confidence ?? null;
    this.contributors = def.contributors || [];   // applied {id,value,weight,...}
    this.ignored = def.ignored || [];             // {id, reason}
    this.conflicts = def.conflicts || [];
    this.warnings = def.warnings || [];
  }
}

export class ImmuneAggregator {
  /** @param {any} aggregationRegistry parsed immune-aggregation.registry.json */
  constructor(aggregationRegistry) {
    if (!aggregationRegistry || !aggregationRegistry.methods) throw new Error('ImmuneAggregator requires the immune-aggregation registry');
    this.reg = aggregationRegistry;
  }

  methodFor(target) { const t = (this.reg.targets || {})[target]; return t ? t.method : 'availability_aware_average'; }
  boundsFor(target) { const t = (this.reg.targets || {})[target] || {}; return { min: isFiniteNumber(t.min) ? t.min : 0, max: isFiniteNumber(t.max) ? t.max : 1 }; }

  /**
   * @param {string} target aggregation target name (declared in the registry)
   * @param {Array<{id:string,value:number|null,weight?:number,availability:string,confidence?:number,signed?:number,evidenceId?:string,predictionId?:string}>} contributions
   * @returns {AggregationResult}
   */
  aggregate(target, contributions = []) {
    const method = this.methodFor(target);
    const { min, max } = this.boundsFor(target);
    const applied = []; const ignored = [];
    for (const c of contributions) {
      if (usable(c)) applied.push({ ...c, weight: isFiniteNumber(c.weight) ? c.weight : 1 });
      else ignored.push({ id: c.id, reason: c.availability === AVAILABILITY.NOT_APPLICABLE ? 'not_applicable' : c.availability === AVAILABILITY.UNAVAILABLE ? 'unavailable' : 'non_finite' });
    }
    const availability = applied.length === 0 ? (contributions.length === 0 ? AVAILABILITY.NOT_APPLICABLE : AVAILABILITY.UNAVAILABLE)
      : applied.length === contributions.length ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE;

    let value = null; const warnings = [];
    if (applied.length) value = this._combine(method, applied, min, max);

    // explicit conflict detection: opposing signed contributions each above the threshold
    const conflicts = this._detectConflicts(applied);
    if (conflicts.length) warnings.push({ code: 'IMMUNE_CONTRIBUTION_CONFLICT', message: `${conflicts.length} competing contribution(s) resolved by ${method} (no silent overwrite)` });

    return new AggregationResult({ target, method, value: value == null ? null : clamp(value, min, max), availability, contributors: applied, ignored, conflicts, warnings });
  }

  _combine(method, applied, min, max) {
    const vals = applied.map((c) => c.value); const ws = applied.map((c) => c.weight);
    switch (method) {
      case 'weighted_sum': return applied.reduce((a, c) => a + c.weight * c.value, 0);
      case 'bounded_additive': return applied.reduce((a, c) => a + c.weight * c.value, 0);
      case 'min_selector': return Math.min(...vals);
      case 'max_selector': return Math.max(...vals);
      case 'dominant_contributor': { let best = applied[0]; for (const c of applied) if (Math.abs(c.weight * c.value) > Math.abs(best.weight * best.value)) best = c; return best.value; }
      case 'bounded_multiplicative': { let prod = 1; for (const c of applied) prod *= (1 - clamp(c.weight * clamp(c.value, 0, 1), 0, 1)); return 1 - prod; }
      case 'confidence_weighted_average': { let wsum = 0, acc = 0; for (const c of applied) { const w = c.weight * (isFiniteNumber(c.confidence) ? c.confidence : 1); wsum += w; acc += w * c.value; } return safeDivide(acc, wsum, 0); }
      case 'weighted_average':
      case 'availability_aware_average':
      default: return availabilityAwareAggregate(applied.map((c) => ({ value: c.value, weight: c.weight, availability: AVAILABILITY.AVAILABLE })), { min, max }).value;
    }
  }

  _detectConflicts(applied) {
    const th = (this.reg.conflict_resolution && this.reg.conflict_resolution.conflict_flag_threshold) ?? 0.5;
    const pos = applied.filter((c) => isFiniteNumber(c.signed) && c.signed >= th);
    const neg = applied.filter((c) => isFiniteNumber(c.signed) && c.signed <= -th);
    return pos.length && neg.length ? [{ positive: pos.map((c) => c.id), negative: neg.map((c) => c.id) }] : [];
  }
}

export default ImmuneAggregator;
