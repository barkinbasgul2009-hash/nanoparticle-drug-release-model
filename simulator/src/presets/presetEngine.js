// Preset engine (Phase 1). Loads B1/B2/B3 preset METADATA from the frozen data
// files and exposes it in a uniform shape. No visualization, no scientific
// computation - metadata only. Scientific values are read from the data files,
// never hardcoded here.

/**
 * @typedef {object} PresetMeta
 * @property {string} id                    // 'B1' | 'B2' | 'B3'
 * @property {string} sourceKey             // e.g. 'chen_2012'
 * @property {boolean} active
 * @property {string} model                 // evidence-level model description
 * @property {string} species
 * @property {string} route
 * @property {string} evidenceLevel
 * @property {string[]} references
 * @property {object} visualizationPermissions
 * @property {string[]} limitations
 */

export class PresetEngine {
  /** @param {{ logger?: object }} [opts] */
  constructor(opts = {}) {
    this.logger = opts.logger || null;
    /** @type {Map<string, PresetMeta>} */
    this.presets = new Map();
  }

  /**
   * Build preset metadata from loaded data. Pure transform; no side effects on
   * the source data.
   * @param {Array<{id:string, sourceKey:string, active:boolean}>} declared  from config
   * @param {any} evidencePackage  parsed profile-b-evidence-package.json
   * @param {any} [biologicalScenes]  parsed profile-b-biological-scenes.json (optional)
   * @returns {PresetMeta[]}
   */
  build(declared, evidencePackage, biologicalScenes) {
    const sources = (evidencePackage && evidencePackage.sources) || {};
    const scenePresets = (biologicalScenes && biologicalScenes.presets) || {};
    const out = [];
    for (const d of declared) {
      const src = sources[d.sourceKey] || {};
      // Find the matching scene-context block (keyed by e.g. 'B1_chen2012').
      const sceneKey = Object.keys(scenePresets).find((k) => k.startsWith(`${d.id}_`));
      const sceneBlock = sceneKey ? scenePresets[sceneKey] : {};
      /** @type {PresetMeta} */
      const meta = {
        id: d.id,
        sourceKey: d.sourceKey,
        active: !!d.active,
        model: sceneBlock.route || src.evidence_level || 'unspecified',
        species: firstDefined(sceneBlock.distinct_experimental_contexts, 'species') || 'see evidence package',
        route: sceneBlock.route || src.route || 'unspecified',
        evidenceLevel: src.evidence_level || 'unspecified',
        references: buildRefs(d.sourceKey, src),
        visualizationPermissions: {
          supportedEvents: sceneBlock.supported_events || [],
          contextualOnly: sceneBlock.contextual_only || [],
          unsupportedDoNotAnimate: sceneBlock.unsupported_do_not_animate || [],
        },
        limitations: toArray(src.limitations),
      };
      this.presets.set(meta.id, meta);
      out.push(meta);
      this._log('info', 'preset', `registered preset ${meta.id} (${meta.sourceKey})`);
    }
    return out;
  }

  /** @param {string} id @returns {PresetMeta|undefined} */
  get(id) { return this.presets.get(id); }
  list() { return [...this.presets.values()]; }
  activeList() { return this.list().filter((p) => p.active); }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function buildRefs(sourceKey, src) {
  const refs = [];
  if (src.doi) refs.push(`doi:${src.doi}`);
  if (src.citation) refs.push(sourceKey);
  return refs.length ? refs : [sourceKey];
}

function firstDefined(arr, key) {
  if (!Array.isArray(arr)) return null;
  for (const item of arr) { if (item && item[key]) return item[key]; }
  return null;
}

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.length) return [v];
  return [];
}

export default PresetEngine;
