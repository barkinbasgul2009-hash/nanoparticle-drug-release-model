// Transport model (Phase 3). Wraps the transport registry and exposes typed,
// evidence-carrying accessors for barriers, mechanisms, per-species support, and
// the particle spec. NO simulation, NO rendering. All values are data from
// simulator/data/transport.registry.json - nothing biological is hardcoded here.

export class TransportModel {
  /** @param {any} registry parsed transport.registry.json */
  constructor(registry) {
    if (!registry || !registry.barriers || !registry.species_transport) {
      throw new Error('TransportModel requires a registry with barriers + species_transport');
    }
    this.registry = registry;
    this.barriers = registry.barriers || {};
    this.mechanisms = registry.mechanisms || {};
    this.speciesTransport = registry.species_transport || {};
    this.particleSpec = registry.particle || {};
    this.integrity = registry.integrity || {};
    this.notToScale = !!this.integrity.not_to_scale;
  }

  /**
   * Relative mobility modifier (0..1) for a layer. SCHEMATIC ORDINAL: only the
   * ordering is evidence-based (SC << viable epidermis < dermis). Layers without
   * a declared barrier (e.g. air, formulation, subcutis) default to free (1).
   * @param {string} layerId
   */
  mobilityFor(layerId) {
    const b = this.barriers[layerId];
    return b && typeof b.relative_mobility === 'number' ? b.relative_mobility : 1;
  }

  /** Barrier descriptor for a layer (rationale + confidence + references), or null. */
  barrier(layerId) { return this.barriers[layerId] || null; }

  /** Mechanism descriptor by id, or null. */
  mechanism(id) { return this.mechanisms[id] || null; }

  /** Mechanism ids that are PASSIVE and permitted (excludes active_transport). */
  activeMechanismIds() {
    return Object.keys(this.mechanisms).filter((id) => (this.mechanisms[id].kind || '') !== 'EXCLUDED');
  }

  /** Per-species transport support record. */
  speciesSupport(species) { return this.speciesTransport[species] || null; }

  /** Is topical transport SUPPORTED by evidence for this species? (No fallback.) */
  isSupportedForSpecies(species) {
    const s = this.speciesSupport(species);
    return !!(s && s.supported === true);
  }

  /**
   * Evidence descriptor for this species' transport, shaped for the EvidenceEngine.
   * Unsupported species carry NOT_REPORTED so the canAnimate() gate blocks them.
   * @param {string} species
   */
  evidenceForSpecies(species) {
    const s = this.speciesSupport(species);
    if (!s) {
      return { confidence: 'NOT_REPORTED', referenceIds: [], species, limitations: [`no transport record for species '${species}'`] };
    }
    return {
      confidence: s.confidence || (s.supported ? 'QUALITATIVELY_SUPPORTED' : 'NOT_REPORTED'),
      referenceIds: s.referenceIds || [],
      species,
      model: s.context,
      limitations: s.supported ? (s.notes ? [s.notes] : []) : [s.reason || 'NOT REPORTED'],
    };
  }

  /** Particle radius (px) for the schematic dot. */
  particleRadiusPx() {
    return (this.particleSpec.appearance && this.particleSpec.appearance.radius_px) || 3;
  }
}

export default TransportModel;
