// Intracellular release model (Phase 4D). Wraps the registry's release-model catalog
// and evaluates the cumulative released fraction F(t) for a chosen model. PURE - no
// state, no rendering. A formulation supplies the model id + params ONLY when evidence
// exists; if none, the model id is null and NOTHING is released (NOT REPORTED stays
// NOT REPORTED). Rate constants are never invented here.

export class IntracellularReleaseModel {
  /** @param {any} registry parsed intracellular.registry.json */
  constructor(registry) {
    if (!registry || !registry.release_models) {
      throw new Error('IntracellularReleaseModel requires a registry with release_models');
    }
    this.registry = registry;
    this.models = registry.release_models;
  }

  /** Supported model ids (math available). */
  supportedModels() { return Object.keys(this.models).filter((k) => k !== 'note'); }

  /**
   * Cumulative released fraction for a model at elapsed intracellular time t (h).
   * @param {string|null} modelId  null -> 0 (NOT REPORTED: nothing releases)
   * @param {object} params        { k, n } as required by the model
   * @param {number} t
   */
  fractionReleased(modelId, params, t) {
    if (!modelId) return 0;                 // NOT REPORTED -> no release
    if (t <= 0) return 0;
    const p = params || {};
    switch (modelId) {
      case 'burst': return 1;
      case 'first_order': return p.k > 0 ? 1 - Math.exp(-p.k * t) : 0;
      case 'zero_order': return p.k > 0 ? Math.min(1, p.k * t) : 0;
      case 'higuchi': return p.k > 0 ? Math.min(1, p.k * Math.sqrt(t)) : 0;
      case 'korsmeyer_peppas': return (p.k > 0 && p.n > 0) ? Math.min(1, p.k * Math.pow(t, p.n)) : 0;
      default: throw new Error(`unknown intracellular release model: ${modelId}`);
    }
  }
}

export default IntracellularReleaseModel;
