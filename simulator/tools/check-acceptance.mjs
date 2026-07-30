#!/usr/bin/env node
// TASK-AWARE ACCEPTANCE GATE. Decides whether a change is allowed to merge and deploy, by working
// out which acceptance reports THIS change actually needs and then reading the declared decision in
// each of them.
//
//   node simulator/tools/check-acceptance.mjs --base origin/main   # classify the diff, gate on it
//   node simulator/tools/check-acceptance.mjs --changed a.yml b.js # classify an explicit file list
//   node simulator/tools/check-acceptance.mjs --all                # require every lock (fail-closed)
//   node simulator/tools/check-acceptance.mjs --root DIR           # resolve reports under DIR
//   node simulator/tools/check-acceptance.mjs --report             # print, always exit 0
//
// WHY IT IS PATH-AWARE
// --------------------
// Test counts cannot express "the hands look wrong", so every animation lock ends with a single
// declared decision line, written by whoever did the work after watching the actual videos. That
// line is the only thing that can authorise deploying an animation.
//
// But a blocked ANIMATION must not hold a CI/CD change hostage. Requiring every lock for every
// change conflates "this repository contains unfinished animation work" with "this change ships
// unfinished animation work". Those are different claims. So the required locks are derived from
// the paths a change actually touches: an infrastructure diff needs the infrastructure checks, an
// animation diff needs the animation locks, and a diff touching both needs both.
//
// This is scoping, not softening. Nothing here can turn a required lock off:
//   * A label cannot reach this file. Ownership is decided by paths, which are the diff itself.
//   * A path matching no domain is UNCLASSIFIED and fails. A new production directory therefore
//     blocks until someone classifies it, rather than sliding through ungated.
//   * A required report that is missing, unreadable or undeclared counts as BLOCKED, not as passing.
//     A gate that opens when it cannot find its input is not a gate.
//   * When the changed set cannot be determined at all, the result is every lock, not none.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * The acceptance locks that gate production. Add a row when a new lock is introduced, and reference
 * its id from whichever domains below it governs.
 *
 * `pass` is the exact phrase the task must return on success. `blocked` is listed separately rather
 * than inferred, so a report declaring neither is treated as indeterminate instead of as a pass.
 */
const LOCKS = {
  'contact-collision': {
    report: 'simulator/artifacts/phase2b/collision-report.md',
    pass: 'CONTACT AND COLLISION LOCK PASSED',
    blocked: 'CONTACT AND COLLISION LOCK REMAINS BLOCKED',
  },
  'arm-wrist-motion': {
    report: 'simulator/artifacts/phase2b/motion-report.md',
    pass: 'ARM AND WRIST MOTION LOCK PASSED',
    blocked: 'ARM AND WRIST MOTION LOCK REMAINS BLOCKED',
  },
  'phase2b-completion': {
    report: 'simulator/artifacts/phase2b/report.md',
    pass: 'PHASE 2B COMPLETION PASSED',
    blocked: 'PHASE 2B REMAINS BLOCKED',
  },
};

/** Every Phase-2B lock, for the domains that own the authored animation. */
const PHASE2B = ['contact-collision', 'arm-wrist-motion', 'phase2b-completion'];

/**
 * Path ownership. FIRST MATCH WINS, so specific patterns must precede general ones.
 *
 * `locks`  — the acceptance reports this domain requires.
 * `checks` — the technical suites it relies on. Those are unconditional jobs in the workflows; the
 *            list is here so the summary states what is being relied on instead of leaving it
 *            implicit, and so a reviewer can see at a glance that nothing was quietly dropped.
 */
const DOMAINS = [
  {
    id: 'ci-cd',
    locks: [],
    checks: ['all gates', 'hidden-char-check'],
    why: 'automation only — cannot change what the site renders',
    patterns: [
      /^\.github\//,
      /^simulator\/tools\/check-acceptance\.mjs$/,
      /^docs\/ci-cd-automated-deployment\.md$/,
    ],
  },
  {
    id: 'phase2b-animation',
    locks: PHASE2B,
    checks: ['all gates', 'simulator suite', 'generated-asset and manifest gates'],
    why: 'changes the authored figure, its rig, its clip, or how it is rendered',
    patterns: [
      /^simulator\/tools\/blender\//,
      /^simulator\/assets\//,
      /^simulator\/vendor\//,
      /^simulator\/src\/(three|render|camera|scene)\//,
      /^simulator\/artifacts\/phase2b\//,
      /^simulator\/[^/]*preview[^/]*\.html$/,
      /^simulator\/three-dev\.html$/,
      /^simulator\/tools\/(capture-|record-|inspect-glb|verify-baked-asset|verify-human-asset|phase2b-report)/,
    ],
  },
  {
    id: 'simulator-runtime',
    locks: [],
    checks: ['all gates', 'simulator suite', 'TypeScript contract'],
    why: 'scientific runtimes and simulator plumbing — headless and test-covered',
    patterns: [/^simulator\//],
  },
  {
    id: 'scientific',
    locks: [],
    checks: ['r-tests', 'js-tests', 'all gates'],
    why: 'the R model, the published web tool, and the golden reference between them',
    patterns: [
      /^R\//,
      /^tests\//,
      /^data\//,
      /^examples\//,
      /^notebooks\//,
      /^app\//,
      /^web\//,
      /^tools\//,
      /^package\.json$/,
    ],
  },
  {
    id: 'docs',
    locks: [],
    checks: ['hidden-char-check'],
    why: 'prose only',
    patterns: [/^docs\//, /^[^/]+\.md$/, /^\.gitignore$/],
  },
];

function classify(path) {
  for (const domain of DOMAINS) {
    if (domain.patterns.some((re) => re.test(path))) return domain;
  }
  return null;
}

// ---- arguments -----------------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flagAt = (name) => argv.indexOf(name);
const valueOf = (name, fallback) => (flagAt(name) === -1 ? fallback : argv[flagAt(name) + 1]);

const ROOT = resolve(valueOf('--root', process.cwd()));
const reportOnly = argv.includes('--report');
const requireAll = argv.includes('--all');
const base = valueOf('--base', null);

/** Files named after --changed, up to the next flag. */
function explicitChanged() {
  const at = flagAt('--changed');
  if (at === -1) return null;
  const out = [];
  for (let i = at + 1; i < argv.length && !argv[i].startsWith('--'); i += 1) out.push(argv[i]);
  return out;
}

/**
 * What this change touches, relative to `base`. Three dots: compare against the merge base, so a
 * branch is judged on what IT changed and not on whatever main did in the meantime.
 */
function changedSince(ref) {
  const out = execFileSync('git', ['diff', '--name-only', `${ref}...HEAD`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return out.split('\n').map((s) => s.trim()).filter(Boolean);
}

let changed = explicitChanged();
let mode = 'explicit file list';
if (requireAll) {
  changed = null;
  mode = 'ALL locks required (caller could not determine the changed set)';
} else if (changed === null) {
  if (!base) {
    console.error('check-acceptance: pass --base <ref>, --changed <files...>, or --all');
    process.exit(2);
  }
  try {
    changed = changedSince(base);
    mode = `diff against ${base}`;
  } catch (err) {
    // Fail closed. An unresolvable base is not permission to skip the locks.
    console.log(`Could not diff against ${base}: ${err && err.message}`);
    changed = null;
    mode = 'ALL locks required (base ref could not be resolved)';
  }
}

// ---- what does this change require? ---------------------------------------------------------------

const unclassified = [];
const domainsHit = new Map();

if (changed === null) {
  for (const domain of DOMAINS) domainsHit.set(domain.id, { domain, files: [] });
} else {
  for (const path of changed) {
    const domain = classify(path);
    if (!domain) {
      unclassified.push(path);
      continue;
    }
    if (!domainsHit.has(domain.id)) domainsHit.set(domain.id, { domain, files: [] });
    domainsHit.get(domain.id).files.push(path);
  }
}

// The union across every domain the change touches.
const requiredLocks = [...new Set([...domainsHit.values()].flatMap((h) => h.domain.locks))];
const requiredChecks = [...new Set([...domainsHit.values()].flatMap((h) => h.domain.checks))].sort();

// ---- read the declared decisions -------------------------------------------------------------------

function evaluate(id) {
  const lock = LOCKS[id];
  const file = resolve(ROOT, lock.report);
  if (!existsSync(file)) return { id, ...lock, state: 'MISSING', detail: `no report at ${lock.report}` };
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    return { id, ...lock, state: 'UNREADABLE', detail: String(err && err.message) };
  }
  // Blocked is checked first, so a report quoting both phrases while declaring the blocked one reads
  // as blocked.
  if (text.includes(lock.blocked)) return { id, ...lock, state: 'BLOCKED', detail: lock.blocked };
  if (text.includes(lock.pass)) return { id, ...lock, state: 'PASSED', detail: lock.pass };
  return { id, ...lock, state: 'UNDECLARED', detail: 'no recognised decision line in the report' };
}

const results = requiredLocks.map(evaluate);
const notPassed = results.filter((r) => r.state !== 'PASSED');

// ---- report ------------------------------------------------------------------------------------------

console.log('TASK-AWARE ACCEPTANCE GATE');
console.log(`  scope: ${mode}`);
console.log(`  files: ${changed === null ? '(unknown)' : changed.length}`);
console.log('');

console.log('Domains touched by this change:');
if (domainsHit.size === 0) console.log('  (none — no production path changed)');
for (const { domain, files } of domainsHit.values()) {
  const locks = domain.locks.length ? domain.locks.join(', ') : 'no acceptance lock';
  console.log(`  ${domain.id.padEnd(20)} ${String(files.length).padStart(4)} file(s)  requires: ${locks}`);
  console.log(`  ${''.padEnd(20)}      ${domain.why}`);
  for (const f of files.slice(0, 6)) console.log(`  ${''.padEnd(22)}- ${f}`);
  if (files.length > 6) console.log(`  ${''.padEnd(22)}... and ${files.length - 6} more`);
}
console.log('');
console.log(`Technical checks relied on: ${requiredChecks.join(', ') || '(none)'}`);
console.log('');

if (unclassified.length) {
  console.log('UNCLASSIFIED PATHS — failing closed:');
  for (const p of unclassified) console.log(`  [STOP] ${p}`);
  console.log('');
  console.log('These belong to no declared domain, so nothing knows what would verify them.');
  console.log('Add them to DOMAINS in this file, with the locks they must satisfy, and re-run.');
  console.log('');
}

console.log(`Acceptance locks required by this change: ${requiredLocks.length}`);
for (const r of results) {
  const mark = r.state === 'PASSED' ? 'PASS' : 'STOP';
  console.log(`  [${mark}] ${r.id.padEnd(20)} ${r.state.padEnd(11)} ${r.detail}`);
}

console.log('');
if (notPassed.length === 0 && unclassified.length === 0) {
  if (requiredLocks.length === 0) {
    console.log('No acceptance lock applies to this change. Its technical gates decide it.');
  } else {
    console.log('Every applicable acceptance lock is declared PASSED.');
  }
  console.log('Merge and production deployment are permitted by this gate.');
  process.exit(0);
}

if (notPassed.length) {
  console.log(`${notPassed.length} of ${requiredLocks.length} applicable lock(s) not passed.`);
}
console.log('Merge to main and production deployment are BLOCKED.');
console.log('Do not edit a report to change this, and do not relabel the PR — fix the work.');
process.exit(reportOnly ? 0 : 1);
