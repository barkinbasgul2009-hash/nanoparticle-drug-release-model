// Anatomy model (Phase 2). Wraps the loaded anatomy registry and exposes typed
// accessors: ordered layers, scale-level visibility, scenes, labels, palette.
// It performs NO rendering and defines NO biological values in code - everything
// comes from simulator/data/anatomy.registry.json.

export class AnatomyModel {
  /** @param {any} registry parsed anatomy.registry.json */
  constructor(registry) {
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

  /** Draw weights keyed by layer id (schematic, ordinal - not measured). */
  weights() {
    const out = {};
    for (const l of this.layers) out[l.id] = typeof l.draw_weight === 'number' ? l.draw_weight : 1;
    return out;
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
