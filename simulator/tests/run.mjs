// Architecture test runner for the Profile-B simulator foundation.
// Zero dependencies; run with:  node simulator/tests/run.mjs
import { summary } from './harness.mjs';

import configLoading from './configLoading.test.mjs';
import jsonValidation from './jsonValidation.test.mjs';
import preset from './preset.test.mjs';
import sceneRegistration from './sceneRegistration.test.mjs';
import stateTransitions from './stateTransitions.test.mjs';
import cameraInit from './cameraInit.test.mjs';
import bootstrap from './bootstrap.test.mjs';
import anatomy from './anatomy.test.mjs';
import transport from './transport.test.mjs';

const suites = [
  configLoading, jsonValidation, preset, sceneRegistration,
  stateTransitions, cameraInit, bootstrap, anatomy, transport,
];

for (const suite of suites) {
  await suite();
}

summary('Simulator foundation tests');
