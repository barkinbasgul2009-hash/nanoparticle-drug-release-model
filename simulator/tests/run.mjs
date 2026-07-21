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
import release from './release.test.mjs';
import uptake from './uptake.test.mjs';
import endocytosis from './endocytosis.test.mjs';
import intracellular from './intracellular.test.mjs';
import targetEngagement from './targetEngagement.test.mjs';
import signalGraph from './signalGraph.test.mjs';
import signalPropagation from './signalPropagation.test.mjs';
import transcription from './transcription.test.mjs';
import translation from './translation.test.mjs';
import proteinFunction from './proteinFunction.test.mjs';
import apoptosis from './apoptosis.test.mjs';
import population from './population.test.mjs';
import tumor from './tumor.test.mjs';

const suites = [
  configLoading, jsonValidation, preset, sceneRegistration,
  stateTransitions, cameraInit, bootstrap, anatomy, transport, release, uptake, endocytosis, intracellular, targetEngagement, signalGraph, signalPropagation, transcription, translation, proteinFunction, apoptosis, population, tumor,
];

for (const suite of suites) {
  await suite();
}

summary('Simulator foundation tests');
