// Structured logger for the Profile-B simulator foundation (Phase 1).
// Category + level tagged messages. No biology, no rendering.
// Runs in browser and Node without external dependencies.

/** @typedef {'debug'|'info'|'warn'|'error'} LogLevel */
/** @typedef {'load'|'validate'|'scene'|'state'|'camera'|'preset'|'evidence'|'ui'|'science'|'app'} LogCategory */

const LEVEL_ORDER = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
  /** @param {{ level?: LogLevel, sink?: (entry: object) => void }} [opts] */
  constructor(opts = {}) {
    this.level = opts.level || 'info';
    this.sink = opts.sink || defaultSink;
    /** @type {object[]} */
    this.buffer = [];
    this.maxBuffer = 500;
  }

  /** @param {LogLevel} level */
  setLevel(level) { this.level = level; }

  /** @param {LogLevel} level @param {LogCategory} category @param {string} message @param {object} [data] */
  log(level, category, message, data) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.level]) return;
    const entry = { t: nowMs(), level, category, message, data: data || null };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    this.sink(entry);
  }

  debug(c, m, d) { this.log('debug', c, m, d); }
  info(c, m, d) { this.log('info', c, m, d); }
  warn(c, m, d) { this.log('warn', c, m, d); }
  error(c, m, d) { this.log('error', c, m, d); }

  // Convenience for scientific-validation messages (kept a first-class category).
  science(m, d) { this.log('info', 'science', m, d); }

  recent(n = 50) { return this.buffer.slice(-n); }
}

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now)
    ? Math.round(performance.now())
    : Date.now();
}

/** @param {object} entry */
function defaultSink(entry) {
  const line = `[${entry.level.toUpperCase()}][${entry.category}] ${entry.message}`;
  // eslint-disable-next-line no-console
  const fn = entry.level === 'error' ? console.error
    : entry.level === 'warn' ? console.warn
      : console.log;
  if (entry.data) fn(line, entry.data); else fn(line);
}

export const logger = new Logger();
export default logger;
