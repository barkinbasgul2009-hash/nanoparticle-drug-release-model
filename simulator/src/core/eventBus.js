// Minimal pub/sub event bus. Decouples modules (scene <-> state <-> ui) without
// direct references. No biology, no rendering.

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this.handlers = new Map();
  }

  /** @param {string} type @param {Function} handler @returns {() => void} unsubscribe */
  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  /** @param {string} type @param {Function} handler */
  off(type, handler) {
    const set = this.handlers.get(type);
    if (set) set.delete(handler);
  }

  /** @param {string} type @param {*} [payload] */
  emit(type, payload) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const h of [...set]) {
      try { h(payload); } catch (err) { /* swallow to protect other handlers */ reportHandlerError(type, err); }
    }
  }

  clear() { this.handlers.clear(); }
}

let _errorReporter = null;
/** @param {(type: string, err: unknown) => void} fn */
export function setEventErrorReporter(fn) { _errorReporter = fn; }
function reportHandlerError(type, err) { if (_errorReporter) _errorReporter(type, err); }

export const bus = new EventBus();
export default bus;
