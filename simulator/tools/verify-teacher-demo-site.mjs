// Deployment-preparation verifier for the Phase-7C teacher-demo GitHub Pages artifact.
// Given a prepared _site directory, it statically proves the demo's COMPLETE transitive dependency
// graph is present inside the artifact and that nothing escapes _site:
//   1. _site/index.html exists and redirects to ./simulator/teacher-demo.html
//   2. _site/simulator/teacher-demo.html exists
//   3. every ES-module import reachable from teacher-demo.html resolves to a file inside _site
//   4. every registry in APP_CONFIG.immuneSources exists under _site/simulator/data
//   5. no resolved path escapes _site
// Exits non-zero with a clear message on the first missing/escaping dependency. No network, no build.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const siteArg = process.argv[2];
if (!siteArg) { console.error('usage: node verify-teacher-demo-site.mjs <_site dir>'); process.exit(2); }
const SITE = resolve(siteArg);
const fail = (m) => { console.error(`✗ VERIFY FAILED: ${m}`); process.exit(1); };
const inside = (p) => { const r = relative(SITE, p); return r && !r.startsWith('..') && !isAbsolute(r); };

// 1. root redirect
const indexPath = resolve(SITE, 'index.html');
if (!existsSync(indexPath)) fail('missing _site/index.html');
const indexHtml = readFileSync(indexPath, 'utf8');
if (!/simulator\/teacher-demo\.html/.test(indexHtml)) fail('_site/index.html does not point to ./simulator/teacher-demo.html');
if (!/http-equiv=["']refresh["']/i.test(indexHtml)) fail('_site/index.html has no <meta http-equiv="refresh"> redirect');

// 2. demo entry
const demo = resolve(SITE, 'simulator/teacher-demo.html');
if (!existsSync(demo)) fail('missing _site/simulator/teacher-demo.html');

// 3. transitive ES-module import graph from the demo
const importRe = /(?:import[\s\S]*?from|import|export[\s\S]*?from)\s*['"](\.[^'"]+)['"]/g;
const seen = new Set(); const queue = [];
const enqueueFrom = (file, text) => {
  for (const m of text.matchAll(importRe)) {
    const spec = m[1]; if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(file), spec);
    if (!inside(target)) fail(`import '${spec}' in ${relative(SITE, file)} escapes _site`);
    if (!seen.has(target)) { seen.add(target); queue.push(target); }
  }
};
enqueueFrom(demo, readFileSync(demo, 'utf8'));
let jsCount = 0;
while (queue.length) {
  const f = queue.shift();
  if (!existsSync(f)) fail(`missing module ${relative(SITE, f)} (imported in the demo graph)`);
  jsCount += 1;
  enqueueFrom(f, readFileSync(f, 'utf8'));
}

// 4. registries referenced by APP_CONFIG.immuneSources must exist under _site/simulator/data
const cfgPath = resolve(SITE, 'simulator/src/config/app.config.js');
if (!existsSync(cfgPath)) fail('missing simulator/src/config/app.config.js in artifact');
const { default: APP } = await import(pathToFileURL(cfgPath).href);
const sources = (APP && APP.immuneSources) || {};
const regNames = Object.values(sources);
if (regNames.length === 0) fail('APP_CONFIG.immuneSources is empty');
let regCount = 0;
for (const name of regNames) {
  const p = resolve(SITE, 'simulator/data', name);
  if (!inside(p)) fail(`registry ${name} escapes _site`);
  if (!existsSync(p)) fail(`missing registry _site/simulator/data/${name}`);
  regCount += 1;
}

console.log(`✓ VERIFY OK: index redirect present; demo entry present; ${jsCount} transitive ES modules resolved inside _site; ${regCount} immuneSources registries present.`);
