// UI framework (Phase 1). A panel registry + mount orchestration. It knows the
// named panels (Main View, Navigation, Evidence, Citation, Legend, Information,
// Timeline, Debug) but fills them with NO biological content. Later phases swap
// panel bodies without changing this wiring.

import { BasePanel } from './panels/basePanel.js';

const PANEL_TITLES = {
  mainView: 'Main View',
  navigation: 'Navigation',
  evidence: 'Evidence',
  citation: 'Citation',
  legend: 'Legend',
  information: 'Information',
  timeline: 'Timeline',
  debug: 'Debug',
};

export class UiFramework {
  /** @param {{ panels: string[], logger?: object }} opts */
  constructor(opts) {
    if (!opts || !Array.isArray(opts.panels)) throw new Error('UiFramework requires panels[]');
    this.logger = opts.logger || null;
    /** @type {Map<string, BasePanel>} */
    this.panels = new Map();
    for (const id of opts.panels) {
      this.panels.set(id, new BasePanel({ id, title: PANEL_TITLES[id] || id, logger: this.logger }));
    }
  }

  /** @param {string} id @returns {BasePanel|undefined} */
  get(id) { return this.panels.get(id); }
  list() { return [...this.panels.keys()]; }

  /**
   * Mount all panels into their container elements. In Node this is a no-op mount
   * (lifecycle still flips). `containerResolver` maps a panel id to a DOM node.
   * @param {(id: string) => any} [containerResolver]
   */
  mountAll(containerResolver) {
    for (const [id, panel] of this.panels) {
      const container = containerResolver ? containerResolver(id) : null;
      panel.mount(container);
    }
    this._log('info', 'ui', `mounted ${this.panels.size} panels (empty shells)`);
  }

  disposeAll() {
    for (const p of this.panels.values()) p.dispose();
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default UiFramework;
