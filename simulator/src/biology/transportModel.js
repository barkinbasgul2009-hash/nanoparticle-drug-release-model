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

  /** Per-species transport record. */
  speciesSupport(species) { return this.speciesTransport[species] || null; }

  /**
   * Evidence Level for a species: 'EXPERIMENTAL' | 'PREDICTIVE' | 'UNAVAILABLE'.
   * A species with no record is UNAVAILABLE (never silently promoted).
   * @param {string} species
   */
  evidenceLevelFor(species) {
    const s = this.speciesSupport(species);
    if (!s) return 'UNAVAILABLE';
    if (s.evidence_level) return s.evidence_level;
    return s.supported ? 'EXPERIMENTAL' : 'UNAVAILABLE';
  }

  isExperimental(species) { return this.evidenceLevelFor(species) === 'EXPERIMENTAL'; }
  isPredictive(species) { return this.evidenceLevelFor(species) === 'PREDICTIVE'; }
  isUnavailable(species) { return this.evidenceLevelFor(species) === 'UNAVAILABLE'; }

  /** May this species animate at all? (EXPERIMENTAL or PREDICTIVE, not UNAVAILABLE.) */
  canAnimateSpecies(species) { return this.evidenceLevelFor(species) !== 'UNAVAILABLE'; }

  /** The species-facing Evidence Level message (UX). */
  messageFor(species) {
    const s = this.speciesSupport(species);
    return (s && s.message) || `Evidence Level: ${this.evidenceLevelFor(species)}.`;
  }

  /**
   * Evidence descriptor for this species' transport, shaped for the EvidenceEngine.
   * Confidence carries the mode: QUALITATIVELY_SUPPORTED (experimental),
   * MECHANISTIC_TRANSFER (predictive), NOT_REPORTED (unavailable -> gate blocks).
   * EXPERIMENTAL keeps its references; PREDICTIVE carries NONE (no rat fallback, no
   * permeation citation claimed) - only principle_refs for transparency.
   * @param {string} species
   */
  evidenceForSpecies(species) {
    const s = this.speciesSupport(species);
    const level = this.evidenceLevelFor(species);
    if (!s) {
      return { confidence: 'NOT_REPORTED', referenceIds: [], species, evidenceLevel: level, predictive: false, message: this.messageFor(species), limitations: [`no transport record for species '${species}'`] };
    }
    const confidence = s.confidence
      || (level === 'EXPERIMENTAL' ? 'QUALITATIVELY_SUPPORTED' : level === 'PREDICTIVE' ? 'MECHANISTIC_TRANSFER' : 'NOT_REPORTED');
    return {
      confidence,
      referenceIds: level === 'EXPERIMENTAL' ? (s.referenceIds || []) : [],
      principleRefs: s.principle_refs || [],
      species,
      model: s.context,
      evidenceLevel: level,
      predictive: level === 'PREDICTIVE',
      message: this.messageFor(species),
      limitations: level === 'UNAVAILABLE' ? [s.reason || 'NOT REPORTED'] : (s.notes ? [s.notes] : []),
    };
  }

  /** Particle radius (px) for the schematic dot. */
  particleRadiusPx() {
    return (this.particleSpec.appearance && this.particleSpec.appearance.radius_px) || 3;
  }
}

export default TransportModel;
