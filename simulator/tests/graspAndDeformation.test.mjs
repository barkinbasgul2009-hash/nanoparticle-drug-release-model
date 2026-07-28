// Phase-2 final-lock tests: object-aware grasp, tube deformation, dispensing causality and skin
// compression. These cover the failure modes the previous suites could NOT see — every earlier test
// passed while the hand still formed a uniform circular cage and the skin stayed rigid.

import { ok, eq, section } from './harness.mjs';
import {
  GRIP_STATES, GRIP_PHASES, FINGER_ANATOMY, JOINT_SHARE, JOINT_LIMITS,
  graspPose, relaxedPose, wrapAngleFor, gripStateAt, minJerk,
} from '../src/three/graspController.js';
import { choreographyAt, squeezeAt, extrusion, DISPENSE_WINDOW, CONTACT_WINDOW } from '../src/three/applicationChoreography.js';
import { SKIN_DEFORM_DEFAULTS } from '../src/three/skinDeformation.js';
import { TUBE } from '../src/three/creamProduct.js';

export default function run() {
  section('grasp — minimum-jerk profile');
  eq(minJerk(0), 0, 'starts at 0');
  eq(minJerk(1), 1, 'ends at 1');
  // zero velocity at both ends is the whole point: sample the slope near the endpoints
  const h = 1e-4;
  ok(minJerk(h) / h < 1e-3, 'zero velocity at the start (no snap out of rest)');
  ok((1 - minJerk(1 - h)) / h < 1e-3, 'zero velocity at the end (no snap into the target)');
  let prev = -1, mono = true;
  for (let i = 0; i <= 100; i++) { const v = minJerk(i / 100); if (v < prev - 1e-12) mono = false; prev = v; }
  ok(mono, 'monotonic — the limb never reverses mid-reach');

  section('grasp — fingers are NOT driven by one shared scalar');
  const pose = graspPose(1, 0, 0.015);
  const names = ['index', 'middle', 'ring', 'pinky'];
  for (const n of names) ok(pose.fingers[n], `finger present: ${n}`);
  // the defect was five identical arcs; wrap angle must differ with finger length
  const mcps = names.map((n) => pose.fingers[n].mcp);
  ok(new Set(mcps.map((v) => v.toFixed(4))).size === names.length,
    `every finger has a DIFFERENT MCP flexion (${mcps.map((v) => v.toFixed(2)).join(', ')})`);
  ok(pose.fingers.middle.mcp > pose.fingers.pinky.mcp,
    'the longest finger closes further than the shortest (middle > little)');
  ok(wrapAngleFor('middle', 0.015) > wrapAngleFor('pinky', 0.015), 'wrap angle follows finger length');
  // wrap must respond to the OBJECT, not be a constant
  ok(wrapAngleFor('middle', 0.010) > wrapAngleFor('middle', 0.030),
    'a thinner object is wrapped further than a fatter one');
  for (const n of names) {
    const f = pose.fingers[n];
    ok(f.mcp !== f.pip && f.pip !== f.dip, `${n}: MCP/PIP/DIP are independently controlled`);
    ok(f.mcp <= JOINT_LIMITS.mcp && f.pip <= JOINT_LIMITS.pip && f.dip <= JOINT_LIMITS.dip,
      `${n}: joints stay inside anatomical limits`);
    ok(f.pip > f.dip, `${n}: PIP flexes more than DIP, as a real finger does`);
  }
  eq(Number((JOINT_SHARE.mcp + JOINT_SHARE.pip + JOINT_SHARE.dip).toFixed(6)), 1, 'joint shares sum to the total wrap');
  // abduction must vary, or the fingers read as a flat comb
  const abds = names.map((n) => pose.fingers[n].abduct);
  ok(new Set(abds.map((v) => v.toFixed(4))).size > 1, 'fingers carry different abduction');

  section('grasp — thumb opposition is a distinct motion, not a curl');
  ok(pose.thumb.oppose > 0.5, `thumb opposes across the palm (${pose.thumb.oppose.toFixed(2)} rad)`);
  ok(pose.thumb.abduct > 0.1, 'thumb is palmarly abducted, not tucked');
  ok(pose.thumb.mcp > 0 && pose.thumb.ip > 0, 'thumb MCP and IP both flex');
  ok(pose.thumb.oppose > pose.thumb.ip, 'opposition dominates the thumb pose');
  const open = graspPose(0, 0, 0.015);
  ok(open.thumb.oppose < 0.02, 'the open hand has no opposition');

  section('grasp — staggered closure and squeeze');
  ok(FINGER_ANATOMY.index.lead < FINGER_ANATOMY.pinky.lead, 'fingers close in a staggered order');
  const mid = graspPose(0.5, 0, 0.015);
  ok(mid.fingers.index.mcp > mid.fingers.pinky.mcp, 'mid-closure: the leading finger is further along');
  const squeezed = graspPose(1, 1, 0.015);
  ok(squeezed.fingers.middle.pip > pose.fingers.middle.pip, 'squeeze deepens the grip');
  for (const s of GRIP_STATES) ok(typeof s === 'string', `grip state declared: ${s}`);
  eq(gripStateAt(0), 'OPEN', 'zero grip is OPEN');
  eq(gripStateAt(1, { squeeze: 0.5 }), 'SQUEEZE', 'pressure reports SQUEEZE');
  eq(gripStateAt(0.5, { releasing: true }), 'RELEASE', 'letting go reports RELEASE');
  for (let i = 1; i < GRIP_PHASES.length; i++) eq(GRIP_PHASES[i].t0, GRIP_PHASES[i - 1].t1, 'grip phases are contiguous');

  section('grasp — the treated hand is never left in bind pose');
  const relaxed = relaxedPose(1);
  for (const n of names) {
    ok(relaxed.fingers[n].mcp > 0.05, `${n}: relaxed hand has a real curl, not a straight finger`);
    ok(relaxed.fingers[n].mcp < 0.6, `${n}: relaxed hand is not clenched`);
  }
  ok(relaxed.fingers.pinky.mcp > relaxed.fingers.index.mcp,
    'the relaxed curl cascades from index to little finger');
  ok(relaxed.thumb.oppose > 0, 'the relaxed thumb is not flat against the palm');
  eq(relaxedPose(0).fingers.index.mcp, 0, 'relax amount 0 leaves the hand as-is');

  section('dispensing — squeeze CAUSES extrusion (pressure leads)');
  ok(squeezeAt(0.32) > 0.1, 'pressure is already building during the aim');
  eq(extrusion(0.32), 0, 'nothing has left the nozzle yet at that point');
  const pLead = DISPENSE_WINDOW.t0 + 0.03;
  ok(squeezeAt(pLead) > extrusion(pLead), `pressure leads extrusion at p=${pLead.toFixed(2)}`);
  ok(squeezeAt(0.42) > 0.9, 'pressure peaks during the pour');
  ok(squeezeAt(0.50) < 0.35, 'pressure is released as the pour ends');
  let sq = true;
  for (let i = 0; i <= 200; i++) { const v = squeezeAt(i / 200); if (!(v >= 0 && v <= 1)) sq = false; }
  ok(sq, 'squeeze stays in 0..1 across the whole timeline');

  section('tube — squeezable proportions, and the nozzle never collapses');
  ok(TUBE.bodyRadius * 2 < 0.035, 'barrel reads as a tube');
  ok(TUBE.crimpWidth > TUBE.bodyRadius * 1.8, 'the crimped tail is much wider than the barrel');
  ok(TUBE.neckRadius < TUBE.bodyRadius * 0.5, 'a narrow neck, so the nozzle stays distinct');
  // deformation is applied to the BARREL only — the choreography must never ask for a full collapse
  for (let i = 0; i <= 100; i++) {
    const s = choreographyAt(i / 100).dispense.squeeze;
    ok(s <= 1.0, `squeeze never exceeds 1 (p=${(i / 100).toFixed(2)})`);
  }

  section('skin compression — replaces the authored overlap');
  ok(SKIN_DEFORM_DEFAULTS.maxDepth > 0.004, 'the dent is deep enough to see');
  ok(SKIN_DEFORM_DEFAULTS.maxDepth < 0.012, 'the dent is restrained, not a crater');
  ok(SKIN_DEFORM_DEFAULTS.radius > 0.03 && SKIN_DEFORM_DEFAULTS.radius < 0.09,
    'the footprint is palm-sized and local to the forearm');
  ok(SKIN_DEFORM_DEFAULTS.ridgeHeight > 0, 'displaced tissue produces a compensating ridge');
  // indentation may only exist while the palm is on the skin
  for (let i = 0; i <= 200; i++) {
    const p = i / 200;
    const c = choreographyAt(p);
    if (!(p >= CONTACT_WINDOW.t0 && p <= CONTACT_WINDOW.t1)) {
      eq(c.apply.press, 0, `no press outside the contact window (p=${p.toFixed(3)})`);
    }
  }
  eq(choreographyAt(0).apply.press, 0, 'no indentation at rest');
  eq(choreographyAt(1).apply.press, 0, 'the dent has fully relaxed by the hero shot');
  ok(choreographyAt(0.70).apply.press > 0, 'the skin is pressed during the strokes');
}
