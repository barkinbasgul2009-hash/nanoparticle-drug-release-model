// JSON loader with automatic validation. Works in browser (fetch) and Node
// (injected fs fetcher), so architecture tests can exercise it without a server.
//
// Loads blueprint / registry / evidence / reference / director-pass / config
// JSON. Validation runs automatically after parse.

import { validateAgainstSchema } from './schema.js';

/** @typedef {(url: string) => Promise<string>} TextFetcher */

/** Default browser fetcher. */
async function browserFetcher(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed ${res.status} for ${url}`);
  return res.text();
}

export class JsonLoader {
  /**
   * @param {{ basePath?: string, fetcher?: TextFetcher, logger?: object }} [opts]
   */
  constructor(opts = {}) {
    this.basePath = opts.basePath || '';
    this.fetcher = opts.fetcher || browserFetcher;
    this.logger = opts.logger || null;
    /** @type {Map<string, any>} */
    this.cache = new Map();
  }

  /**
   * @param {string} fileName
   * @param {string} [schemaName] validate against this schema after parse
   * @returns {Promise<any>}
   */
  async load(fileName, schemaName = 'generic') {
    const url = this.basePath + fileName;
    if (this.cache.has(url)) return this.cache.get(url);
    this._log('debug', 'load', `loading ${url}`);
    let text;
    try {
      text = await this.fetcher(url);
    } catch (err) {
      this._log('error', 'load', `failed to load ${url}`, { err: String(err) });
      throw err;
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      this._log('error', 'validate', `invalid JSON in ${url}`, { err: String(err) });
      throw new Error(`invalid JSON in ${fileName}: ${err.message}`);
    }
    const result = validateAgainstSchema(schemaName, data);
    if (!result.ok) {
      this._log('error', 'validate', `schema validation failed for ${fileName}`, { errors: result.errors });
      throw new Error(`schema validation failed for ${fileName}: ${result.errors.join('; ')}`);
    }
    this._log('info', 'load', `loaded + validated ${fileName}`);
    this.cache.set(url, data);
    return data;
  }

  /**
   * Load several named sources.
   * @param {Array<{ fileName: string, schemaName?: string, key: string }>} specs
   * @returns {Promise<Record<string, any>>}
   */
  async loadMany(specs) {
    const out = {};
    for (const s of specs) {
      out[s.key] = await this.load(s.fileName, s.schemaName || 'generic');
    }
    return out;
  }

  clearCache() { this.cache.clear(); }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default JsonLoader;
