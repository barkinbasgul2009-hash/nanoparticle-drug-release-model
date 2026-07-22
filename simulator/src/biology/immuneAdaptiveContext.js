// Phase-7C Section 4 adaptive input contract. The immutable AdaptiveImmuneContext centralizes every
// input the CD8 / CD4 / Treg / checkpoint / suppression / escape modules consume, so no module queries
// unrelated simulation state. It is built READ-ONLY from the Section-1 ImmuneFrame (innate + visibility
// outputs), the Phase-7A/7B engines (vascular access), the Section-3 innate contribution when present,
// and/or explicit inputs. Every field is availability-gated: a missing input stays UNAVAILABLE, never
// zero. IMPORTANT: Section 3 innate biology is not implemented, so innate-cell fields resolve to
// UNAVAILABLE (the runtime stays operational and computes availability-gated outputs). Deterministic;
// deep-frozen; retains no mutable references to upstream engines.

import { AVAILABILITY, deepFreeze, isFiniteNumber, ImmuneRuntimeIssue, ISSUE_SEVERITY, TemporalImmuneContext } from './immuneObjects.js';
import { metric } from './immuneAdaptiveShared.js';

const INPUT_FIELDS = [
  'tumor_immune_visibility', 'antigen_availability', 'immune_accessibility', 'macrophage_contribution',
  'nk_contribution', 'dendritic_contribution', 'antigen_presentation_potential', 'innate_immune_readiness',
  'innate_tumor_pressure', 'adaptive_priming_potential', 'vascular_access', 'vascular_functionality',
];

function fieldFromMetric(m) { const v = m && typeof m === 'object' ? m.value : m; return metric(v, m && m.availability ? m.availability : (isFiniteNumber(v) ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE)); }

/**
 * Build an immutable AdaptiveImmuneContext.
 * @param {{ immuneFrame?:object, innateContribution?:object, vascularEngine?:object, microenvironmentEngine?:object,
 *   explicitInputs?:Record<string,any>, temporalContext?:object, frameIndex?:number, simulationTime?:number,
 *   previousAdaptiveState?:object, registries?:object }} def
 * @returns {{ context:object, issues:ImmuneRuntimeIssue[] }}
 */
export function buildAdaptiveContext(def = {}) {
  const issues = [];
  const inputs = {};
  const availability = {};
  const explicit = def.explicitInputs || {};
  const frame = def.immuneFrame || null;
  const innate = def.innateContribution || null;   // Section 3 output (absent in this build)

  // seed every field UNAVAILABLE (never zero)
  for (const f of INPUT_FIELDS) inputs[f] = metric(null, AVAILABILITY.UNAVAILABLE);

  // read-only from the Section-1 immune frame (visibility / antigen), where present
  if (frame) {
    if (frame.tumorVisibility) { inputs.tumor_immune_visibility = fieldFromMetric(frame.tumorVisibility.summary || frame.tumorVisibility.effectiveRecognition); inputs.antigen_availability = fieldFromMetric(frame.tumorVisibility.antigenAvailability); }
    if (frame.antigenPresentation) inputs.antigen_presentation_potential = fieldFromMetric(frame.antigenPresentation.effectivePresentation);
  }
  // read-only from the Section-3 innate contribution (absent -> stays UNAVAILABLE)
  if (innate) {
    if (innate.macrophage) inputs.macrophage_contribution = fieldFromMetric(innate.macrophage);
    if (innate.nk) inputs.nk_contribution = fieldFromMetric(innate.nk);
    if (innate.dendritic) inputs.dendritic_contribution = fieldFromMetric(innate.dendritic);
    if (innate.readiness) inputs.innate_immune_readiness = fieldFromMetric(innate.readiness);
    if (innate.tumorPressure) inputs.innate_tumor_pressure = fieldFromMetric(innate.tumorPressure);
    if (innate.adaptivePrimingPotential) inputs.adaptive_priming_potential = fieldFromMetric(innate.adaptivePrimingPotential);
  } else {
    issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_UPSTREAM_FRAME_UNAVAILABLE', severity: ISSUE_SEVERITY.INFO, module: 'immuneAdaptiveContext', message: 'Section 3 innate contribution absent; innate-derived adaptive inputs UNAVAILABLE (not zero).' }));
  }
  // read-only Phase-7A / 7B (these engines exist): vascular access + immune accessibility
  const vasc = def.vascularEngine;
  if (vasc && (typeof vasc.isIdle !== 'function' || !vasc.isIdle())) {
    if (typeof vasc.deliveryModifier === 'function') inputs.vascular_access = metric(vasc.deliveryModifier(), AVAILABILITY.AVAILABLE);
    if (typeof vasc.perfusionModifier === 'function') inputs.vascular_functionality = metric(vasc.perfusionModifier(), AVAILABILITY.AVAILABLE);
  }
  const micro = def.microenvironmentEngine;
  if (micro && (typeof micro.isIdle !== 'function' || !micro.isIdle()) && typeof micro.penetrationModifier === 'function') inputs.immune_accessibility = metric(micro.penetrationModifier(), AVAILABILITY.AVAILABLE);

  // explicit inputs override (used by tests + upstream wiring); validated
  for (const [k, v] of Object.entries(explicit)) {
    if (!INPUT_FIELDS.includes(k)) { issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_INPUT_PARTIAL', severity: ISSUE_SEVERITY.WARNING, module: 'immuneAdaptiveContext', message: `unknown adaptive input field ${k}`, affectedField: k })); continue; }
    const m = fieldFromMetric(v);
    if (m.value != null && (!isFiniteNumber(m.value) || m.value < 0 || m.value > 1)) { issues.push(new ImmuneRuntimeIssue({ code: 'IMMUNE_VALUE_OUT_OF_RANGE', severity: ISSUE_SEVERITY.WARNING, module: 'immuneAdaptiveContext', message: `adaptive input ${k}=${m.value} out of [0,1]`, affectedField: k })); continue; }
    inputs[k] = m;
  }

  for (const f of INPUT_FIELDS) availability[f] = inputs[f].availability;

  const temporal = def.temporalContext instanceof TemporalImmuneContext ? def.temporalContext : new TemporalImmuneContext({ currentTime: def.simulationTime ?? 0, frameIndex: def.frameIndex ?? 0 });
  const context = deepFreeze({
    schemaVersion: '7C.1.0', registryVersion: (def.registries && def.registries.adaptiveContext && def.registries.adaptiveContext.$schema_version) || '1.0',
    frameIndex: def.frameIndex ?? 0, simulationTime: def.simulationTime ?? 0,
    sourceImmuneFrameId: frame ? frame.frameId : null, sourceImmuneSchemaVersion: frame ? frame.schemaVersion : null,
    temporalContext: { frameIndex: temporal.frameIndex, currentTime: temporal.currentTime, deltaTime: temporal.deltaTime, initializationStatus: temporal.initializationStatus },
    inputs, availability,
    previousAdaptiveState: def.previousAdaptiveState || null,
    innateAvailable: !!innate,
  });
  return { context, issues };
}

export function adaptiveInputFields() { return INPUT_FIELDS.slice(); }
export default buildAdaptiveContext;
