// Tiny zero-dependency test harness for the simulator foundation (Node).
// Provides assert helpers + a Node filesystem fetcher so the same bootstrap runs
// headless (no browser, no server).

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// simulator/tests -> repo root is two levels up.
export const REPO_ROOT = resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const failures = [];

export function ok(cond, msg) {
  if (cond) { passed += 1; } else { failed += 1; failures.push(msg || 'assertion failed'); }
}

export function eq(a, b, msg) {
  const good = JSON.stringify(a) === JSON.stringify(b);
  ok(good, `${msg || 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

export async function throwsAsync(fn, msg) {
  let threw = false;
  try { await fn(); } catch { threw = true; }
  ok(threw, msg || 'expected throw');
}

export function section(name) { /* eslint-disable-next-line no-console */ console.log(`\n# ${name}`); }

export function summary(label) {
  /* eslint-disable no-console */
  console.log(`\n${label}: ${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log('  - FAIL:', f); process.exitCode = 1; }
  /* eslint-enable no-console */
  return { passed, failed };
}

/**
 * A fetcher that reads files from disk (maps the app's '../data/' base back to
 * the repo's data/ directory). Lets jsonLoader run in Node unchanged.
 * @returns {(url: string) => Promise<string>}
 */
export function nodeFetcher() {
  return async (url) => {
    // url looks like '../data/<file>.json'; strip the leading '../'.
    const rel = url.replace(/^\.\.\//, '');
    const abs = resolve(REPO_ROOT, rel);
    return readFile(abs, 'utf8');
  };
}
