// Base panel (Phase 1). A framework shell with a lifecycle and a mount point.
// Panels render NO biological content in Phase 1 - they show only their title and
// a placeholder so the layout exists. Later phases replace renderBody().

export class BasePanel {
  /** @param {{ id: string, title: string, logger?: object }} opts */
  constructor(opts) {
    if (!opts || !opts.id) throw new Error('panel requires id');
    this.id = opts.id;
    this.title = opts.title || opts.id;
    this.logger = opts.logger || null;
    this.el = null;
    this.mounted = false;
  }

  /**
   * Mount into a container. In a browser this creates a DOM node; in Node (tests)
   * it is a no-op that still flips `mounted` so lifecycle can be verified.
   * @param {any} [container]
   */
  mount(container) {
    if (typeof document !== 'undefined' && container) {
      const el = document.createElement('section');
      el.className = 'sim-panel';
      el.dataset.panel = this.id;
      const h = document.createElement('h2');
      h.className = 'sim-panel__title';
      h.textContent = this.title;
      const body = document.createElement('div');
      body.className = 'sim-panel__body';
      body.textContent = this.renderBody();
      el.appendChild(h);
      el.appendChild(body);
      container.appendChild(el);
      this.el = el;
    }
    this.mounted = true;
    return this;
  }

  /** Placeholder body text. Overridden in later phases (no biology in Phase 1). */
  renderBody() { return '(empty - Phase 1 foundation)'; }

  dispose() {
    if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
    this.el = null;
    this.mounted = false;
  }
}

export default BasePanel;
