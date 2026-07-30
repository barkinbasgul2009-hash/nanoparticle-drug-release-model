// Anatomy model (Phase 2). Wraps the loaded anatomy registry and exposes typed
// accessors: ordered layers, scale-level visibility, scenes, labels, palette.
// It performs NO rendering and defines NO biological values in code - everything
// comes from simulator/data/anatomy.registry.json.

export class AnatomyModel {
  /**
   * @param {any} registry parsed anatomy.registry.json
   * @param {{ species?: string }} [opts] initial species selection (a choice, NOT a fallback)
   */
  constructor(registry, opts = {}) {
    if (!registry || !Array.isArray(registry.layers)) {
      throw new Error('AnatomyModel requires a registry with layers[]');
    }
    this.registry = registry;
    /** @type {any[]} ordered top->bottom */
    this.layers = [...registry.layers].sort((a, b) => a.order - b.order);
    this.palette = registry.palette || {};
    this.scaleLevels = registry.scale_levels || {};
    this.scenes = registry.scenes || [];
    this.labelsCfg = registry.labels || {};
    this.notToScale = !!(registry.scientific_integrity && registry.scientific_integrity.not_to_scale);

    // Phase 2.6: species-driven. Independent per-species profiles; no hidden fallback.
    this.speciesProfiles = registry.species_profiles || {};
    this.speciesScope = registry.species_scope || {};
    const supported = Array.isArray(this.speciesScope.supported) && this.speciesScope.supported.length
      ? this.speciesScope.supported
      : Object.keys(this.speciesProfiles).filter((k) => k !== 'note');
    /** @type {string[]} supported species ids */
    this._supported = supported;
    const initial = opts.species || this.speciesScope.initial || supported[0];
    if (!initial || !this._supported.includes(initial)) {
      throw new Error(`AnatomyModel: unsupported initial species '${initial}' (supported: ${this._supported.join(', ')})`);
    }
    /** @type {string} the active species; weights() always follows this. */
    this.activeSpecies = initial;
  }

  /** Ordered layer ids top -> bottom. */
  order() { return this.layers.map((l) => l.id); }

  /** Tissue layers only (excludes 'air'). */
  tissueLayers() { return this.layers.filter((l) => l.tissue); }

  /** @param {string} id */
  layer(id) { return this.layers.find((l) => l.id === id); }

  /** Colour for a layer via its palette token. */
  colorOf(id) {
    const l = this.layer(id);
    return (l && this.palette[l.color_token]) || 'transparent';
  }

  /** Scale-level config (visible/emphasized/depth_window/clip/framing). */
  levelConfig(levelId) { return this.scaleLevels[levelId] || null; }

  /** Layers visible at a scale level (falls back to all tissue layers). */
  visibleAt(levelId) {
    const cfg = this.levelConfig(levelId);
    if (cfg && Array.isArray(cfg.visible)) return cfg.visible;
    return this.tissueLayers().map((l) => l.id);
  }

  /** Supported species ids (Phase 2.6). */
  species() { return [...this._supported]; }

  /** Alias kept for callers: the list of available anatomy profiles. */
  profiles() { return this.species(); }

  /** The boot/initial species selection (a choice, NOT an anatomical fallback). */
  initialSpecies() { return this.speciesScope.initial || this._supported[0]; }

  /** @deprecated Phase 2.5 name; returns the initial species id. */
  defaultProfile() { return this.initialSpecies(); }

  /** The full independent profile object for a species (throws if unsupported). */
  profileFor(speciesId) {
    if (!this._supported.includes(speciesId)) {
      throw new Error(`AnatomyModel: unsupported species '${speciesId}' (supported: ${this._supported.join(', ')})`);
    }
    const p = this.speciesProfiles[speciesId];
    if (!p) throw new Error(`AnatomyModel: species '${speciesId}' has no profile in the registry`);
    return p;
  }

  /**
   * Select the active species. The engine is species-driven: weights() and every
   * layout derived from it will follow this selection. There is NO silent fallback
   * to human - an unsupported species throws.
   * @param {string} speciesId
   */
  setSpecies(speciesId) {
    this.profileFor(speciesId); // validates (throws if unsupported)
    this.activeSpecies = speciesId;
    return this.activeSpecies;
  }

  /** True if a species profile declares a subcutis layer present. */
  subcutisPresent(speciesId = this.activeSpecies) {
    return !!this.profileFor(speciesId).subcutis_present;
  }

  /**
   * Draw weights for a species, keyed by layer id (schematic - NOT measured).
   * Tissue weights come from that species' INDEPENDENT profile; 'air' uses the
   * structural layer default. No fallback to human: an unsupported species, or a
   * profile missing a tissue weight, throws.
   * @param {string} speciesId
   */
  weightsForSpecies(speciesId) {
    const profile = this.profileFor(speciesId);
    const dw = profile.draw_weights || {};
    const out = {};
    for (const l of this.layers) {
      if (l.id === 'air') { out[l.id] = typeof l.draw_weight === 'number' ? l.draw_weight : 0.6; continue; }
      if (typeof dw[l.id] !== 'number') {
        throw new Error(`species profile '${speciesId}' is missing a draw weight for layer '${l.id}'`);
      }
      out[l.id] = dw[l.id];
    }
    return out;
  }

  /** Draw weights for the ACTIVE species (schematic, per-species - NOT measured). */
  weights() { return this.weightsForSpecies(this.activeSpecies); }

  /** True if a tissue layer carries located literature evidence for a species. */
  hasThicknessEvidence(layerId, species = 'human') {
    const l = this.layer(layerId);
    const ev = l && l.thickness_evidence && l.thickness_evidence[species];
    return !!(ev && (typeof ev.representative_um === 'number'));
  }

  /** Verify ordering is monotonic and the five required tissue layers exist. */
  validateOrdering() {
    const required = ['skin_surface', 'stratum_corneum', 'viable_epidermis', 'dermis', 'subcutis'];
    const ids = this.order();
    const orders = this.layers.map((l) => l.order);
    const monotonic = orders.every((o, i) => i === 0 || o > orders[i - 1]);
    const hasAll = required.every((r) => ids.includes(r));
    // required order among the tissue layers (air may precede)
    const idx = (id) => ids.indexOf(id);
    const correctSequence =
      idx('skin_surface') < idx('stratum_corneum')
      && idx('stratum_corneum') < idx('viable_epidermis')
      && idx('viable_epidermis') < idx('dermis')
      && idx('dermis') < idx('subcutis');
    return { ok: monotonic && hasAll && correctSequence, monotonic, hasAll, correctSequence };
  }
}

export default AnatomyModel;
