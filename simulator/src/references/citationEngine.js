// Citation engine (Phase 1). Indexes the loaded reference/license registries so
// any future visual object can resolve a reference id to a citation, atlas
// entry, microscopy method, license class, and scientific note. No display here.

/**
 * @typedef {object} Citation
 * @property {string} id
 * @property {string} [citation]
 * @property {string} [doi]
 * @property {string} [licenseClass]
 * @property {string} [use]
 * @property {string} [notes]
 */

export class CitationEngine {
  /** @param {{ logger?: object }} [opts] */
  constructor(opts = {}) {
    this.logger = opts.logger || null;
    /** @type {Map<string, Citation>} */
    this.index = new Map();
  }

  /**
   * Build the index from loaded data.
   * @param {any} evidencePackage  parsed profile-b-evidence-package.json
   * @param {any} licenseRegistry  parsed profile-b-license-registry.json
   */
  build(evidencePackage, licenseRegistry) {
    // Evidence-package sources -> citations.
    const sources = (evidencePackage && evidencePackage.sources) || {};
    for (const [key, src] of Object.entries(sources)) {
      this.index.set(key, {
        id: key,
        citation: src.citation || undefined,
        doi: src.doi || undefined,
        use: src.evidence_level || undefined,
        notes: src.study_objective || undefined,
      });
    }
    // License registry sources -> license/use metadata (merge or add).
    const licSources = (licenseRegistry && licenseRegistry.sources) || [];
    for (const s of licSources) {
      const existing = this.index.get(s.id) || { id: s.id };
      this.index.set(s.id, {
        ...existing,
        licenseClass: s.license_class || existing.licenseClass,
        use: s.use || existing.use,
        notes: s.license_detail || existing.notes,
      });
    }
    this._log('info', 'evidence', `citation index built (${this.index.size} entries)`);
    return this.index.size;
  }

  /** @param {string} id @returns {Citation|undefined} */
  resolve(id) { return this.index.get(id); }

  /** @param {string[]} ids @returns {Citation[]} */
  resolveMany(ids) { return (ids || []).map((id) => this.resolve(id)).filter(Boolean); }

  size() { return this.index.size; }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default CitationEngine;
