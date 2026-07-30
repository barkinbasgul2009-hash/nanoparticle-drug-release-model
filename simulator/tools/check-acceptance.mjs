#!/usr/bin/env node
// Visual-acceptance gate. Decides whether the animation work in this branch is allowed to merge
// and deploy, by reading the DECLARED DECISION in each task's own report.
//
//   node simulator/tools/check-acceptance.mjs            # gate: exit 1 if any lock is blocked
//   node simulator/tools/check-acceptance.mjs --report   # print the table, always exit 0
//   node simulator/tools/check-acceptance.mjs --root DIR # resolve reports under DIR (repo root)
//
// WHY THIS EXISTS
// ---------------
// Test counts cannot express "the hands look wrong". Every animation lock in this project ends with
// a single declared decision line, written by whoever did the work after looking at the actual
// videos, and that line is the only thing that can authorise deploying an animation. This script
// reads those lines and nothing else: it does not re-derive a verdict, it does not average test
// results into one, and it cannot be satisfied by making tests pass.
//
// The failure direction is deliberate. A report that is missing, unreadable, or contains no
// recognisable decision counts as BLOCKED, not as passing. A gate that opens when it cannot find its
// input is not a gate.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Repository root the report paths are resolved against. Defaults to the process working directory,
 * which is what CI uses. `--root` exists so the gate itself can be exercised against a throwaway
 * copy of the reports — proving it fails when they are blocked AND passes when they are not —
 * without anyone editing a real report to test it.
 */
const rootFlag = process.argv.indexOf('--root');
const ROOT = rootFlag === -1 ? process.cwd() : resolve(process.argv[rootFlag + 1] ?? '.');

/**
 * The locks that gate production. Add a row when a new animation lock is introduced.
 *
 * `pass` must be the exact phrase the task is required to return on success. `blocked` is listed
 * separately rather than inferred, so a report that says neither is treated as indeterminate.
 */
const LOCKS = [
  {
    id: 'contact-collision',
    report: 'simulator/artifacts/phase2b/collision-report.md',
    pass: 'CONTACT AND COLLISION LOCK PASSED',
    blocked: 'CONTACT AND COLLISION LOCK REMAINS BLOCKED',
  },
  {
    id: 'arm-wrist-motion',
    report: 'simulator/artifacts/phase2b/motion-report.md',
    pass: 'ARM AND WRIST MOTION LOCK PASSED',
    blocked: 'ARM AND WRIST MOTION LOCK REMAINS BLOCKED',
  },
  {
    id: 'phase2b-completion',
    report: 'simulator/artifacts/phase2b/report.md',
    pass: 'PHASE 2B COMPLETION PASSED',
    blocked: 'PHASE 2B REMAINS BLOCKED',
  },
];

/** Read one lock's declared decision. Anything other than a clean pass is not a pass. */
function evaluate(lock) {
  const file = resolve(ROOT, lock.report);
  if (!existsSync(file)) {
    return { ...lock, state: 'MISSING', detail: `no report at ${lock.report}` };
  }
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    return { ...lock, state: 'UNREADABLE', detail: String(err && err.message) };
  }
  // Order matters: "... REMAINS BLOCKED" contains neither the pass phrase nor a prefix of it, but
  // checking blocked first also guards against a report that quotes both phrases while declaring
  // the blocked one.
  if (text.includes(lock.blocked)) {
    return { ...lock, state: 'BLOCKED', detail: lock.blocked };
  }
  if (text.includes(lock.pass)) {
    return { ...lock, state: 'PASSED', detail: lock.pass };
  }
  return { ...lock, state: 'UNDECLARED', detail: 'no recognised decision line in the report' };
}

const results = LOCKS.map(evaluate);
const reportOnly = process.argv.includes('--report');
const failing = results.filter((r) => r.state !== 'PASSED');

console.log('VISUAL ACCEPTANCE GATE');
for (const r of results) {
  const mark = r.state === 'PASSED' ? 'PASS' : 'STOP';
  console.log(`  [${mark}] ${r.id.padEnd(20)} ${r.state.padEnd(11)} ${r.detail}`);
}

if (failing.length === 0) {
  console.log('\nAll declared visual gates PASSED — merge and production deployment are permitted.');
  process.exit(0);
}

console.log(`\n${failing.length} of ${results.length} visual gate(s) not passed.`);
console.log('Merge to main and production deployment are BLOCKED until each declares its pass');
console.log('phrase in its own report. Do not edit a report to change this — fix the animation.');
process.exit(reportOnly ? 0 : 1);
