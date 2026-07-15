// Extracts the *actual shipped* JavaScript model core from web/index.html and
// returns its `release` and `solveTissue` functions. By loading the real file
// (rather than a copy) the tests exercise exactly the code the public website
// runs, and index.html stays fully self-contained/inline (nothing is changed
// there). The model-core block is delimited by the comment markers
// "// Model core" ... "// Plotting" in index.html.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = path.join(HERE, '..', '..', 'web', 'index.html');

export async function loadModel() {
  const src = fs.readFileSync(HTML, 'utf8');
  const start = src.indexOf('// Model core');
  const end = src.indexOf('// Plotting');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error(
      'Could not locate the model-core block in web/index.html ' +
      '(expected "// Model core" ... "// Plotting" markers). ' +
      'If the file was refactored, update tests/js/extract-model.mjs.');
  }
  const js = src.slice(start, end);
  const mod = await import(
    'data:text/javascript,' + encodeURIComponent(js + '\nexport { release, solveTissue };')
  );
  if (typeof mod.release !== 'function' || typeof mod.solveTissue !== 'function') {
    throw new Error('extracted model core does not export release()/solveTissue()');
  }
  return mod;
}
