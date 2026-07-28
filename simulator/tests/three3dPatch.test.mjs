// Phase-0 completion-patch tests: human asset facts, timeline-driven animation, and the predictive
// visualization model. Locks the rules the later phases must not break.

import { section, ok, eq, REPO_ROOT } from './harness.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectGlb, resolveBoneRoles } from '../tools/inspect-glb.mjs';
import { verifyHumanAsset, GATE } from '../tools/verify-human-asset.mjs';
import { buildBoneMap, clampJoint, REQUIRED_ROLES, JOINT_LIMITS } from '../src/three/boneMap.js';
import { HumanAnimationController, poseFor, stageAt, APPLICATION_STAGES } from '../src/three/humanAnimationController.js';
import { predictVisualState, systemicCurve, SOURCE_CLASS } from '../src/three/predictiveVisualizationModel.js';
import { PREDICTIVE_PARAMS, resolveParams, PREDICTIVE_MODEL_VERSION } from '../src/three/predictiveVisualConfig.js';
import { buildCombinedVisualState, PROVENANCE } from '../src/three/visualizationAdapter.js';
import { ASSETS, ASSET_STATUS } from '../src/three/assetManifest.js';

const P = (rel) => resolve(REPO_ROOT, 'simulator', rel);

export default async function run() {
  section('3D Phase-0 patch: assets, animation, prediction');

  // ================= human asset + licence =================
  const licPath = P('assets/ASSET_LICENCES.json');
  ok(existsSync(licPath), 'ASSETS: licence manifest exists');
  const lic = JSON.parse(readFileSync(licPath, 'utf8'));
  ok(lic.assets.some((a) => a.id === 'three_js_runtime' && a.licence === 'MIT'), 'ASSETS: vendored Three.js licence recorded (MIT)');
  ok(lic.rejected_candidates.length >= 3, 'ASSETS: rejected candidates recorded with reasons');
  ok(lic.outstanding_requirement.status.startsWith('RESOLVED'), 'ASSETS: the final presentation human is recorded as supplied');
  const finalHumanLic = lic.assets.find((a) => a.id === 'final_presentation_human');
  ok(finalHumanLic, 'ASSETS: the supplied human has a provenance entry');
  eq(finalHumanLic.path, 'simulator/assets/human/human.glb', 'ASSETS: provenance points at the real asset path');
  // the licence was NOT verifiable from this environment — that must never be silently asserted
  eq(finalHumanLic.licence_verified_for_public_redistribution, false, 'ASSETS: unverified licence is reported as unverified, not assumed');
  ok(/NOT INDEPENDENTLY VERIFIED/.test(finalHumanLic.licence), 'ASSETS: licence text states plainly that it is unverified');
  ok(/watermark/i.test(finalHumanLic.action_required_before_public_release), 'ASSETS: the baked MakeHuman watermark is flagged for the owner');
  ok(/asset NOT modified/.test(finalHumanLic.modification_rights), 'ASSETS: records that the GLB itself was never edited');
  const devRig = lic.assets.find((a) => a.id === 'dev_rig_michelle');
  ok(devRig && devRig.status === 'DEV_ONLY_NOT_FOR_PUBLICATION', 'ASSETS: dev rig is flagged NOT for publication');
  ok(devRig && /REJECTED as the final human/.test(devRig.quality_gate), 'ASSETS: dev rig is explicitly rejected as the final human');
  eq(ASSETS.human.status, ASSET_STATUS.PRESENT, 'ASSETS: manifest reports the supplied human as PRESENT');
  ok(ASSETS.human.accepted && /^PASS\b/.test(ASSETS.human.accepted.gate), 'ASSETS: acceptance record states the gate passed');
  ok(/limitation/i.test(ASSETS.human.accepted.visualReview), 'ASSETS: acceptance record states the visual limitations honestly');
  eq(ASSETS.humanAnimations.status, ASSET_STATUS.PROCEDURAL, 'ASSETS: no baked clips shipped — motion is procedural from the timeline');
  eq(ASSETS.humanAnimations.packagedClips, 0, 'ASSETS: the GLB carries zero animation clips');

  // the dev rig itself: local, self-contained, riggable
  const rigPath = P('assets/human/dev-rig/dev-rig-michelle.glb');
  if (existsSync(rigPath)) {
    const info = inspectGlb(rigPath);
    ok(info.selfContained, 'RIG: dev rig GLB is self-contained (no remote runtime dependency)');
    ok(info.skins >= 1 && info.bones > 20, `RIG: skeleton present (${info.bones} bones)`);
    ok(info.triangles > 5000, `RIG: real geometry (${info.triangles} triangles)`);
    const roles = resolveBoneRoles(info.boneNames);
    eq(roles.missing.length, 0, 'RIG: all 13 bone roles resolve');
    ok(roles.fingerBoneCount >= 10, `RIG: finger bones present (${roles.fingerBoneCount})`);
    ok(info.externalReferences.length === 0, 'RIG: no external texture/buffer references');
  }

  // ================= automated human-asset quality gate =================
  ok(GATE.minTriangles >= 10000 && GATE.minFingerBones >= 5, 'GATE: thresholds reject low-poly mannequins and rig-less models');
  // The final human has now been supplied (Blender/MakeHuman export). It must PASS the same gate
  // that previously rejected every stand-in — see simulator/tests/humanAsset.test.mjs for the full
  // asset assertions. The gate is never bypassed: a missing file still fails.
  const finalHuman = verifyHumanAsset(P('assets/human/human.glb'));
  ok(finalHuman.ok, 'GATE: the supplied final human.glb passes every automated check');
  ok(!verifyHumanAsset(P('assets/human/__no_such_model__.glb')).ok, 'GATE: an absent model still fails (no placeholder is silently accepted)');
  if (existsSync(rigPath)) {
    const g = verifyHumanAsset(rigPath);
    ok(g.checks.find((c) => c.id === 'self_contained').pass, 'GATE: dev rig passes self-containment');
    ok(g.checks.find((c) => c.id === 'has_skeleton').pass, 'GATE: dev rig passes the skeleton check');
    ok(g.checks.find((c) => c.id === 'required_bone_roles').pass, 'GATE: dev rig resolves every required bone role');
    ok(Array.isArray(g.manualReview) && g.manualReview.length >= 5, 'GATE: automated pass still demands documented human visual review (face/hands/forearm/licence)');
    ok(g.manualReview.some((m) => /FACE/.test(m)) && g.manualReview.some((m) => /FOREARM/.test(m)), 'GATE: visual review covers face and forearm explicitly');
  }
  // a model with real geometry but no textures must fail (the HVGirl class of asset)
  ok(GATE.minTriangles > 1872, 'GATE: 1,872-triangle models are below the minimum (HVGirl-class rejected)');

  // ================= bone map =================
  const bm = buildBoneMap(['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine1', 'mixamorig:Neck', 'mixamorig:Head',
    'mixamorig:LeftShoulder', 'mixamorig:RightShoulder', 'mixamorig:LeftArm', 'mixamorig:RightArm',
    'mixamorig:LeftForeArm', 'mixamorig:RightForeArm', 'mixamorig:LeftHand', 'mixamorig:RightHand', 'mixamorig:LeftHandIndex1']);
  ok(bm.ok, 'BONEMAP: Mixamo-style skeleton resolves every required role');
  eq(bm.map.forearmL, 'mixamorig:LeftForeArm', 'BONEMAP: forearm role maps to the real bone name');
  ok(bm.fingerBoneCount === 1, 'BONEMAP: finger bones detected');
  ok(!buildBoneMap(['Foo', 'Bar']).ok, 'BONEMAP: an unusable skeleton is rejected (no guessed bones)');
  eq(clampJoint('forearm', -2), JOINT_LIMITS.forearm.min, 'BONEMAP: elbow cannot hyperextend below its limit');
  eq(clampJoint('shoulder', 99), JOINT_LIMITS.shoulder.max, 'BONEMAP: shoulder clamped (no dislocation)');

  // ================= animation: timeline-driven, deterministic =================
  const bones = {}; const mk = (n) => (bones[n] = { name: n, rotation: { x: 0, y: 0, z: 0 } });
  for (const n of Object.values(bm.map)) mk(n);
  const ctrl = new HumanAnimationController({ boneNames: Object.keys(bones), lookupBone: (n) => bones[n], side: 'R' });
  ok(ctrl.ready, 'ANIM: controller is ready when the rig resolves');
  const r1 = ctrl.apply(0.7);
  ok(r1.applied.length > 0, 'ANIM: pose applied to real bones only');
  eq(r1.skipped.length, 0, 'ANIM: no bone skipped on a complete rig (never animates guessed names)');
  const poseA = Object.values(bones).map((b) => b.rotation.x).join(',');
  ctrl.apply(0.2); ctrl.apply(0.9);
  ctrl.apply(0.7);                                  // seek back
  const poseB = Object.values(bones).map((b) => b.rotation.x).join(',');
  eq(poseB, poseA, 'ANIM: seek reproduces the identical pose (deterministic replay, no hidden state)');
  // pause = simply not advancing progress -> pose frozen
  const before = bones[bm.map.handR].rotation.x; ctrl.apply(0.7);
  eq(bones[bm.map.handR].rotation.x, before, 'ANIM: re-applying the same progress freezes the pose (pause semantics)');
  ctrl.reset();
  ok(Math.abs(bones[bm.map.forearmR].rotation.x) < 1e-9, 'ANIM: reset restores the neutral pose');
  // no second clock: identical progress -> identical pure pose
  eq(JSON.stringify(poseFor(0.5)), JSON.stringify(poseFor(0.5)), 'ANIM: poseFor is a pure function of progress (no wall-clock)');
  ok(poseFor(0.7).rotations.forearmR >= JOINT_LIMITS.forearm.min, 'ANIM: generated pose respects joint limits');
  eq(stageAt(0.0).id, 'idle', 'ANIM: stage 0 is idle');
  eq(stageAt(0.7).id, 'apply_cream', 'ANIM: cream application stage reached');
  eq(APPLICATION_STAGES[APPLICATION_STAGES.length - 1].t1, 1, 'ANIM: stages cover the full progress range');
  ctrl.dispose(); ok(ctrl.disposed, 'ANIM: controller disposes cleanly');

  // ================= prediction: deterministic, bounded, labelled =================
  const inp = { releasedFraction: 0.6, absorbedFraction: 0.3, elapsedHours: 8, tissueAccessibility: 0.5 };
  const a = predictVisualState(inp), b = predictVisualState(inp);
  eq(JSON.stringify(a), JSON.stringify(b), 'PREDICT: identical inputs produce identical outputs (deterministic)');
  eq(a.modelVersion, PREDICTIVE_MODEL_VERSION, 'PREDICT: model version reported');

  const all = [...Object.values(a.systemic), ...Object.values(a.tissue)];
  ok(all.every((x) => x.value === null || (x.value >= 0 && x.value <= 1)), 'PREDICT: every output is bounded to [0,1]');
  ok(all.every((x) => x.sourceClass === SOURCE_CLASS.PREDICTED_VISUAL), 'PREDICT: every output is labelled PREDICTED_VISUAL (never SIMULATION_DERIVED)');
  ok(all.every((x) => x.modelVersion && Array.isArray(x.assumptions) && Array.isArray(x.inputSources)), 'PREDICT: provenance carries assumptions + inputSources + modelVersion');

  // conservation chain
  const T = a.tissue;
  ok(T.predictedTargetArrival.value <= a.systemic.relativePlasmaConcentration.value + 1e-9, 'PREDICT: target arrival cannot exceed available systemic amount');
  ok(T.predictedExtravasatedFraction.value <= T.predictedTargetArrival.value + 1e-9, 'PREDICT: extravasation cannot exceed target arrival');
  ok(T.predictedCellularUptake.value <= T.predictedInterstitialConcentration.value + 1e-9, 'PREDICT: uptake cannot exceed interstitial amount');
  ok(T.predictedPenetrationDepth.value <= T.predictedInterstitialConcentration.value + 1e-9, 'PREDICT: penetration cannot exceed what reached the interstitium');

  // monotonic sanity
  const hiEcm = predictVisualState({ ...inp, params: { ecmResistance: 0.9 } }).tissue.predictedPenetrationDepth.value;
  const loEcm = predictVisualState({ ...inp, params: { ecmResistance: 0.1 } }).tissue.predictedPenetrationDepth.value;
  ok(hiEcm <= loEcm, 'PREDICT: greater ECM resistance cannot increase penetration');
  const hiAcc = predictVisualState({ ...inp, tissueAccessibility: 0.9 }).tissue.predictedTargetArrival.value;
  const loAcc = predictVisualState({ ...inp, tissueAccessibility: 0.1 }).tissue.predictedTargetArrival.value;
  ok(loAcc <= hiAcc, 'PREDICT: lower accessibility cannot increase target arrival');

  // unavailable stays unavailable (never zero)
  const miss = predictVisualState({ elapsedHours: 5 });
  eq(miss.systemic.relativePlasmaConcentration.value, null, 'PREDICT: missing released/absorbed fraction -> value null (NOT zero)');
  ok(!!miss.systemic.relativePlasmaConcentration.unavailableReason, 'PREDICT: unavailable outputs carry an explicit reason');
  eq(miss.tissue.predictedTargetArrival.value, null, 'PREDICT: downstream tissue prediction is unavailable when systemic is unavailable');
  // a REAL zero dose is distinct from missing
  const zero = predictVisualState({ releasedFraction: 0, elapsedHours: 5 });
  eq(zero.systemic.relativePlasmaConcentration.value, 0, 'PREDICT: a real zero dose yields a real zero (distinct from unavailable)');
  ok(zero.systemic.relativePlasmaConcentration.available === true, 'PREDICT: zero dose is marked available (not unavailable)');

  // curve behaviour + edge cases
  eq(systemicCurve(0, 0.5, 0.2), 0, 'PREDICT: no systemic exposure before absorption begins');
  ok(systemicCurve(2, 0.5, 0.2) > 0, 'PREDICT: absorption curve rises after dosing');
  ok(systemicCurve(200, 0.5, 0.2) < 0.05, 'PREDICT: long-time decay approaches zero');
  const eq_ka_ke = systemicCurve(3, 0.3, 0.3);
  ok(Number.isFinite(eq_ka_ke) && eq_ka_ke > 0 && eq_ka_ke <= 1, 'PREDICT: ka == ke singularity handled analytically (finite, bounded)');
  ok(!Object.values(resolveParams({ absorptionRate: -5 })).some((v) => v < 0), 'PREDICT: invalid negative parameters fall back to defaults');
  eq(resolveParams({ ecmResistance: 99 }).ecmResistance, PREDICTIVE_PARAMS.ecmResistance.default, 'PREDICT: out-of-range parameter falls back to its default');
  // No clinical units are EMITTED: no output key names a unit, and every numeric output is a
  // normalized [0,1] fraction. (Assumption strings may mention mg/L only to disclaim it.)
  const outKeys = [...Object.keys(a.systemic), ...Object.keys(a.tissue)];
  ok(!outKeys.some((k) => /(MgPerL|NgPerMl|MolPerL|_mg|_ng|Micromolar|Nanomolar|PerLitre|PerMl)/i.test(k)), 'PREDICT: no output key carries a clinical unit');
  ok(all.every((x) => x.value === null || (x.value >= 0 && x.value <= 1)), 'PREDICT: all emitted values are normalized fractions, not clinical concentrations');
  ok(/not a concentration in mg\/L/.test(JSON.stringify(a.systemic)), 'PREDICT: the model explicitly disclaims clinical concentration units');

  // released API vs intact carrier is preserved
  ok(/RELEASED API/.test(a.particleIdentity.note) && /do not claim intact nanoparticle/i.test(a.particleIdentity.note), 'PREDICT: released-API vs intact-carrier distinction is preserved');

  // ================= combined adapter: simulation and prediction stay separate =================
  const c = buildCombinedVisualState({ progress: 0.5, releaseStats: { releasedFraction: 0.5 }, elapsedHours: 6, absorbedFraction: 0.25 });
  ok(c.simulation && c.prediction && c.provenance, 'ADAPTER: combined state exposes simulation, prediction and provenance separately');
  eq(c.simulation.releasedFraction.provenance, PROVENANCE.SIMULATION_DERIVED, 'ADAPTER: simulation side keeps SIMULATION_DERIVED provenance');
  eq(c.prediction.systemic.relativePlasmaConcentration.sourceClass, SOURCE_CLASS.PREDICTED_VISUAL, 'ADAPTER: prediction side is PREDICTED_VISUAL');
  eq(c.simulation.capillaryEntryFraction.provenance, PROVENANCE.NOT_MODELLED, 'ADAPTER: simulation still reports systemic entry as NOT_MODELLED');
  ok(Object.isFrozen(c) && Object.isFrozen(c.prediction), 'ADAPTER: combined state is immutable');
  // canonical frame is never mutated
  const frame = Object.freeze({ availability: 'AVAILABLE', immuneEffect: Object.freeze({ controlState: 'WEAK_CONTROL' }) });
  const snap = JSON.stringify(frame);
  buildCombinedVisualState({ progress: 0.4, immuneFrame: frame, releaseStats: { releasedFraction: 0.4 }, elapsedHours: 3 });
  eq(JSON.stringify(frame), snap, 'ADAPTER: the canonical frame is not mutated by the adapter or the predictor');
}
