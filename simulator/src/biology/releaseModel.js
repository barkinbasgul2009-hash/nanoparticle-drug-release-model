// Release model (Phase 4). Wraps the release registry and exposes the evidence-
// selected kinetic model (first-order) plus its evidence, lifecycle states and
// trigger. PURE - no simulation state, no rendering. The MODEL is data from
// simulator/data/release.registry.json; no biology is hardcoded here.

export class ReleaseModel {
  /** @param {any} registry parsed release.registry.json */
  constructor(registry) {
    if (!registry || !registry.release_model) {
      throw new Error('ReleaseModel requires a registry with release_model');
    }
    this.registry = registry;
    this.model = registry.release_model;
    this.states = registry.states || [];
    this.trigger = registry.trigger || {};
    this.integrity = registry.integrity || {};
    this.notToScale = !!this.integrity.not_to_scale;
  }

  /** Kinetic model id (e.g. 'first_order'). */
  modelId() { return this.model.id; }

  /**
   * Fraction of payload RELEASED by elapsed release-time t (hours) at rate k.
   * First-order: F(t) = 1 - exp(-k t). Pure function of the evidence-selected model.
   * @param {number} t elapsed release time (h) @param {number} k rate (1/h)
   */
  fractionReleased(t, k) {
    if (this.model.id !== 'first_order') {
      throw new Error(`unsupported release model: ${this.model.id}`);
    }
    if (t <= 0 || k <= 0) return 0;
    return 1 - Math.exp(-k * t);
  }

  /** Fraction of payload REMAINING inside the carrier: 1 - fractionReleased. */
  fractionRemaining(t, k) { return 1 - this.fractionReleased(t, k); }

  /** Is the rate constant a measured value, or schematic (NOT REPORTED)? */
  rateIsReported() {
    const rc = this.registry.rate_constant;
    return !!(rc && typeof rc.value === 'number');
  }

  /** Evidence descriptor for the release model (for the EvidenceEngine / UI). */
  evidence() {
    return {
      confidence: this.model.confidence || 'QUALITATIVELY_SUPPORTED',
      referenceIds: this.model.references || [],
      model: this.model.id,
      limitations: [
        this.model.notes || '',
        this.rateIsReported() ? '' : 'rate constant k NOT REPORTED (schematic timing)',
      ].filter(Boolean),
    };
  }

  /** The DO-NOT-implement downstream list (auditable scope guard). */
  excludedDownstream() { return (this.integrity.excluded_downstream || []).slice(); }
}

export default ReleaseModel;
