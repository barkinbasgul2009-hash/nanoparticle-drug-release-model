// Phase-7C Section 4 shared adaptive helpers. Thin utilities layered on the Section-2 frameworks so
// the CD8 / CD4 / Treg / checkpoint / suppression / escape modules stay compact and identical in
// convention. No biological constants here (all come from registries). Deterministic; availability-
// aware (absence != zero); every derived value bounded [0,1].

import { AVAILABILITY, clamp, clamp01, isFiniteNumber } from './immuneObjects.js';

/** Build one aggregation contribution (with a stable id). */
export function contrib(id, value, availability, opts = {}) {
  return { id, value: isFiniteNumber(value) ? value : null, weight: isFiniteNumber(opts.weight) ? opts.weight : 1, availability: availability || (isFiniteNumber(value) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE), confidence: opts.confidence, signed: opts.signed, evidenceId: opts.evidenceId, predictionId: opts.predictionId };
}

/** A metric may be a number or {value,availability}; normalize to {value,availability}. */
export function asMetric(m) {
  if (m == null) return { value: null, availability: AVAILABILITY.UNAVAILABLE };
  if (typeof m === 'number') return { value: m, availability: isFiniteNumber(m) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE };
  return { value: m.value ?? null, availability: m.availability || (m.value == null ? AVAILABILITY.UNAVAILABLE : AVAILABILITY.AVAILABLE) };
}

/** Build a contribution array from an inputs map {name:{value,availability}} + weights map {name:weight}. */
export function weightsToContribs(inputs, weights, prefix = '') {
  const out = [];
  for (const [name, w] of Object.entries(weights || {})) {
    if (name.endsWith('_note') || name === 'note') continue;
    const m = asMetric(inputs[name]);
    out.push(contrib(`${prefix}${name}`, m.value, m.availability, { weight: w, confidence: m.confidence }));
  }
  return out;
}

/** Evaluate a stage via the shared aggregator (default availability-aware weighted average). */
export function evalStage(aggregator, target, contributions) { return aggregator.aggregate(target, contributions); }

/** Apply bounded multiplicative reductions (penalties) to a value: v * PROD(1 - r_i). */
export function applyReductions(value, reductions = []) {
  if (!isFiniteNumber(value)) return value;
  let f = 1; for (const r of reductions) if (isFiniteNumber(r)) f *= (1 - clamp01(r));
  return clamp01(value * f);
}

/** Categorical state from a {STATE: minValue} threshold map (highest min <= value wins). */
export function categorize(value, thresholds) {
  if (!isFiniteNumber(value) || !thresholds) return null;
  let best = null, bestMin = -Infinity;
  for (const [name, min] of Object.entries(thresholds)) { if (typeof min === 'number' && value >= min && min >= bestMin) { best = name; bestMin = min; } }
  return best;
}

/** Blocked potential = max(0, capability - effective); availability = weakest of the two. */
export function blockedPotential(capability, effective) {
  const c = asMetric(capability), e = asMetric(effective);
  const avail = (a, b) => (a === AVAILABILITY.UNAVAILABLE || b === AVAILABILITY.UNAVAILABLE) ? AVAILABILITY.UNAVAILABLE
    : (a === AVAILABILITY.PARTIALLY_AVAILABLE || b === AVAILABILITY.PARTIALLY_AVAILABLE) ? AVAILABILITY.PARTIALLY_AVAILABLE : AVAILABILITY.AVAILABLE;
  if (!isFiniteNumber(c.value) || !isFiniteNumber(e.value)) return { value: null, availability: AVAILABILITY.UNAVAILABLE };
  return { value: clamp(c.value - e.value, 0, 1), availability: avail(c.availability, e.availability) };
}

/** Convenience: a plain metric object. */
export function metric(value, availability, confidence) { return { value: isFiniteNumber(value) ? value : null, availability: availability || (isFiniteNumber(value) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE), confidence: confidence ?? null }; }

/** Pick the aggregation result's value + availability as a metric. */
export function resultMetric(res) { return { value: res.value, availability: res.availability, confidence: res.confidence }; }
