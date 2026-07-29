#!/usr/bin/env python3
"""Phase 2B arm/wrist motion analysis, against the REAL exported geometry.

    python measure_motion.py -- --glb <baked.glb> --out <report.json> [--step 1]

Run under a Blender Python (the `bpy` module interpreter is what this container uses).

WHAT THIS MEASURES AND WHY
--------------------------
"Looks robotic" is a perceptual verdict, but the things that cause it are measurable, and each one
has a distinct numeric signature. This samples the exported clip frame by frame and computes the
quantities that separate human motion from machine motion:

* **Linear and angular speed of the wrist.** Human reaching is bell-shaped -- slow, fast, slow. A
  flat speed plateau with square ends is the single strongest robotic tell, and it shows up here as
  a long run of near-constant speed bounded by large accelerations.
* **Joint-angle deltas** at clavicle, shoulder, elbow and the forearm twist. If the whole action is
  solved by the wrist, every other channel sits near zero and the brief's "do not solve through wrist
  movement alone" is violated in a way a still frame cannot show.
* **Elbow plane.** The normal of the shoulder-elbow-wrist triangle. When an IK solver flips the pole,
  this normal reverses, and the arm snaps through itself between two frames.
* **Quaternion sign continuity.** `q` and `-q` are the same rotation but interpolate the long way
  round. A sign flip in a baked curve is a guaranteed visible spin.
* **Product transform relative to the hand.** While the tube is held this must be constant; any drift
  is the product sliding inside the grip.
* **Jerk.** Third derivative of position. Human movement minimises it; mechanical movement does not.

Everything is expressed per frame at the clip's authored rate, so a "spike" here is exactly what a
viewer sees as a snap.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector, Quaternion

ARMATURE = "Human_rig"
TUBE = "NANODERM_tube"

CHAINS = {
    "r": {"clavicle": "clavicle_r", "upper": "upperarm_r", "lower": "lowerarm_r", "hand": "hand_r"},
    "l": {"clavicle": "clavicle_l", "upper": "upperarm_l", "lower": "lowerarm_l", "hand": "hand_l"},
}


def _argv():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]


def _q_delta_deg(a: Quaternion, b: Quaternion) -> float:
    """Shortest-arc angle between two orientations, in [0, 180].

    Both halves of this matter. `q` and `-q` are the same orientation, so the sign is aligned first;
    and Blender's `Quaternion.angle` runs to 360, so a delta whose w is negative is the long way
    round and has to be flipped. Without both, a -0.5 degree step reads as a 359.5 degree one, which
    is how the first run of this tool reported a full revolution of the upper arm every frame.
    """
    if a.dot(b) < 0.0:
        b = Quaternion((-b.w, -b.x, -b.y, -b.z))
    d = a.inverted() @ b
    if d.w < 0.0:
        d = Quaternion((-d.w, -d.x, -d.y, -d.z))
    return math.degrees(2.0 * math.acos(max(-1.0, min(1.0, d.w))))


def _wrap180(deg: float) -> float:
    return (deg + 180.0) % 360.0 - 180.0


def _angle_between(a: Vector, b: Vector) -> float:
    if a.length < 1e-9 or b.length < 1e-9:
        return 0.0
    return math.degrees(a.normalized().angle(b.normalized(), 0.0))


def sample(glb: str, step: int = 1, frame_start: int = 1, frame_end: int = 421,
           fps: int = 30) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # See measure_collisions.py: the importer places keys at the scene's fps, which defaults to 24,
    # and a 14-second clip then lands on frames 0.8-336.8 instead of 1-421.
    bpy.context.scene.render.fps = fps
    bpy.ops.import_scene.gltf(filepath=glb)
    scene = bpy.context.scene
    scene.render.fps = fps
    action_end = max((a.frame_range[1] for a in bpy.data.actions), default=0.0)
    if action_end < frame_end - 1.5:
        raise SystemExit(f"BLOCKED: imported action ends at {action_end:.1f}, expected {frame_end}")

    arm = bpy.data.objects[ARMATURE]
    tube = bpy.data.objects.get(TUBE)

    rows = []
    for frame in range(frame_start, frame_end + 1, step):
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        ae = arm.evaluated_get(depsgraph)
        mw = ae.matrix_world
        row = {"frame": frame}

        for side, names in CHAINS.items():
            pb = {k: ae.pose.bones[v] for k, v in names.items()}
            shoulder = mw @ pb["upper"].head
            elbow = mw @ pb["lower"].head
            wrist = mw @ pb["hand"].head
            hand_tip = mw @ pb["hand"].tail

            upper_dir = elbow - shoulder
            lower_dir = wrist - elbow
            # Interior elbow angle: 180 deg is a straight arm.
            elbow_deg = 180.0 - _angle_between(upper_dir, lower_dir)
            # The elbow plane. Its normal reversing between frames IS a pole flip.
            plane = upper_dir.cross(lower_dir)
            plane_n = plane.normalized() if plane.length > 1e-9 else Vector((0.0, 0.0, 0.0))

            hand_m = mw @ pb["hand"].matrix
            hand_q = hand_m.to_quaternion()

            # FOREARM PRONATION, measured as a signed angle in the plane perpendicular to the
            # forearm, from the elbow plane's normal to the hand's own palmar axis.
            #
            # The obvious alternative -- a swing-twist decomposition of the hand relative to the
            # forearm -- is ill-conditioned exactly where it matters. When the swing approaches 180
            # degrees the twist branch flips, and the first version of this tool reported 125-degree
            # single-frame "snaps" at frames 270, 402 and 413 while wrist speed, elbow angle and
            # position were all provably smooth across those same frames. Re-authoring poses to chase
            # those numbers would have been fixing the measurement, not the motion.
            #
            # An atan2 of two vectors projected into the perpendicular plane has no such branch: it
            # is continuous everywhere the forearm has a direction at all, and it is anatomically the
            # right quantity -- rotation of the hand about the forearm, relative to the elbow.
            axis = lower_dir.normalized() if lower_dir.length > 1e-9 else Vector((0.0, 1.0, 0.0))
            palmar = Vector(hand_m.to_3x3().col[2])
            u = palmar - axis * palmar.dot(axis)
            ref = plane_n - axis * plane_n.dot(axis)
            if u.length > 1e-6 and ref.length > 1e-6:
                u, ref = u.normalized(), ref.normalized()
                twist_deg = math.degrees(math.atan2(ref.cross(u).dot(axis), ref.dot(u)))
            else:
                twist_deg = 0.0

            row[side] = {
                "wrist": [wrist.x, wrist.y, wrist.z],
                "elbow": [elbow.x, elbow.y, elbow.z],
                "shoulder": [shoulder.x, shoulder.y, shoulder.z],
                "handTip": [hand_tip.x, hand_tip.y, hand_tip.z],
                "handQ": [hand_q.w, hand_q.x, hand_q.y, hand_q.z],
                "elbowDeg": elbow_deg,
                "planeN": [plane_n.x, plane_n.y, plane_n.z],
                "twistDeg": twist_deg,
                "claviclePos": list(mw @ pb["clavicle"].tail),
                "clavicleQ": list((mw @ pb["clavicle"].matrix).to_quaternion()),
                "upperQ": list((mw @ pb["upper"].matrix).to_quaternion()),
            }

        if tube is not None:
            te = tube.evaluated_get(depsgraph)
            hand_m = mw @ ae.pose.bones["hand_r"].matrix
            rel_m = hand_m.inverted() @ te.matrix_world
            row["tubeInHand"] = [list(rel_m.translation),
                                 list(rel_m.to_quaternion())]
        rows.append(row)
    return {"glb": glb, "glbBytes": os.path.getsize(glb), "fps": fps, "step": step,
            "frames": rows}


# ----------------------------------------------------------------------------------------------
# derivatives and defect detection
# ----------------------------------------------------------------------------------------------

def _series(rows, fn):
    return [fn(r) for r in rows]


def _delta(values):
    return [0.0] + [values[i] - values[i - 1] for i in range(1, len(values))]


def _spikes(values, frames, factor=3.0, window=15, floor=1e-6):
    """Values far above their own local median — the signature of a snap."""
    out = []
    half = window // 2
    for i, v in enumerate(values):
        lo, hi = max(0, i - half), min(len(values), i + half + 1)
        local = sorted(abs(x) for x in values[lo:hi])
        med = local[len(local) // 2]
        if med < floor:
            continue
        ratio = abs(v) / med
        if ratio >= factor:
            out.append({"frame": frames[i], "value": round(v, 4), "ratio": round(ratio, 2)})
    return out


def _runs(spikes):
    """Group consecutive spike frames — an isolated spike is a snap, a run is fast motion."""
    if not spikes:
        return []
    groups, cur = [], [spikes[0]]
    for s in spikes[1:]:
        if s["frame"] - cur[-1]["frame"] <= 2:
            cur.append(s)
        else:
            groups.append(cur)
            cur = [s]
    groups.append(cur)
    return [{"start": g[0]["frame"], "end": g[-1]["frame"], "length": len(g),
             "peakRatio": max(x["ratio"] for x in g)} for g in groups]


def analyse(report: dict) -> dict:
    rows = report["frames"]
    frames = [r["frame"] for r in rows]
    out = {"perSide": {}, "product": {}, "summary": {}}

    for side in ("r", "l"):
        wrist = [Vector(r[side]["wrist"]) for r in rows]
        speed = [0.0] + [(wrist[i] - wrist[i - 1]).length * 1000.0 for i in range(1, len(wrist))]
        accel = _delta(speed)
        jerk = _delta(accel)

        hq = [Quaternion(r[side]["handQ"]) for r in rows]
        ang = [0.0]
        sign_flips = []
        for i in range(1, len(hq)):
            a, b = hq[i - 1], hq[i]
            if a.dot(b) < 0.0:
                sign_flips.append(frames[i])
            ang.append(_q_delta_deg(a, b))

        elbow = [r[side]["elbowDeg"] for r in rows]
        twist = [r[side]["twistDeg"] for r in rows]
        plane = [Vector(r[side]["planeN"]) for r in rows]
        plane_flips = [frames[i] for i in range(1, len(plane))
                       if plane[i].length > 0.5 and plane[i - 1].length > 0.5
                       and plane[i].dot(plane[i - 1]) < 0.0]
        clav = [Quaternion(r[side]["clavicleQ"]) for r in rows]
        clav_delta = [0.0] + [_q_delta_deg(clav[i - 1], clav[i]) for i in range(1, len(clav))]
        upper = [Quaternion(r[side]["upperQ"]) for r in rows]
        upper_delta = [0.0] + [_q_delta_deg(upper[i - 1], upper[i]) for i in range(1, len(upper))]

        moving = [s for s in speed if s > 0.5]
        out["perSide"][side] = {
            "wristSpeedMmPerFrame": {"max": round(max(speed), 3),
                                     "meanWhileMoving": round(sum(moving) / len(moving), 3) if moving else 0.0,
                                     "movingFrames": len(moving)},
            "wristAngularDegPerFrame": {"max": round(max(ang), 3)},
            "elbowRangeDeg": [round(min(elbow), 2), round(max(elbow), 2)],
            "elbowMaxDeltaDeg": round(max(abs(x) for x in _delta(elbow)), 3),
            "forearmTwistRangeDeg": [round(min(twist), 2), round(max(twist), 2)],
            "forearmTwistMaxDeltaDeg": round(max(abs(_wrap180(x)) for x in _delta(twist)), 3),
            "clavicleMaxDeltaDeg": round(max(clav_delta), 3),
            "clavicleTotalDeg": round(sum(clav_delta), 2),
            "upperArmMaxDeltaDeg": round(max(upper_delta), 3),
            "quaternionSignFlips": sign_flips,
            "elbowPlaneFlips": plane_flips,
            "speedSpikeRuns": _runs(_spikes(accel, frames, 4.0, 15, 0.05)),
            "angularSpikeRuns": _runs(_spikes(_delta(ang), frames, 4.0, 15, 0.02)),
            "twistSpikeRuns": _runs(_spikes([_wrap180(x) for x in _delta(twist)],
                                            frames, 4.0, 15, 0.02)),
            "maxJerk": round(max(abs(x) for x in jerk), 3),
        }

    if "tubeInHand" in rows[0]:
        pos = [Vector(r["tubeInHand"][0]) for r in rows]
        rot = [Quaternion(r["tubeInHand"][1]) for r in rows]
        # only while actually held
        held = [i for i, r in enumerate(rows) if 91 <= r["frame"] <= 256]
        if held:
            ref_p, ref_q = pos[held[0]], rot[held[0]]
            drift = [(pos[i] - ref_p).length * 1000.0 for i in held]
            spin = [_q_delta_deg(ref_q, rot[i]) for i in held]
            out["product"] = {"maxSlipMm": round(max(drift), 4),
                              "maxSpinDeg": round(max(spin), 4),
                              "heldFrames": [rows[held[0]]["frame"], rows[held[-1]]["frame"]]}

    r = out["perSide"]["r"]
    out["summary"] = {
        "wristSignFlips": len(r["quaternionSignFlips"]),
        "elbowPlaneFlips": len(r["elbowPlaneFlips"]),
        "isolatedSpeedSnaps": len([g for g in r["speedSpikeRuns"] if g["length"] == 1]),
        "speedSpikeRuns": len(r["speedSpikeRuns"]),
        "isolatedAngularSnaps": len([g for g in r["angularSpikeRuns"] if g["length"] == 1]),
        "isolatedTwistSnaps": len([g for g in r["twistSpikeRuns"] if g["length"] == 1]),
        "productMaxSlipMm": out["product"].get("maxSlipMm"),
        "clavicleTotalDeg": r["clavicleTotalDeg"],
        "elbowRangeDeg": r["elbowRangeDeg"],
    }
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--step", type=int, default=1)
    p.add_argument("--label", default="")
    a = p.parse_args(_argv())

    raw = sample(a.glb, a.step)
    result = analyse(raw)
    result["label"] = a.label
    result["glb"] = a.glb
    result["sampledFrames"] = len(raw["frames"])
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(result, f, indent=1)

    s = result["summary"]
    print(f"\nMOTION REPORT  {a.glb}  ({result['sampledFrames']} frames)")
    for side in ("r", "l"):
        d = result["perSide"][side]
        print(f"  [{side}] wrist max {d['wristSpeedMmPerFrame']['max']:.1f} mm/f "
              f"(mean while moving {d['wristSpeedMmPerFrame']['meanWhileMoving']:.1f}), "
              f"angular max {d['wristAngularDegPerFrame']['max']:.1f} deg/f")
        print(f"      elbow {d['elbowRangeDeg']} deg, max step {d['elbowMaxDeltaDeg']:.2f} | "
              f"twist {d['forearmTwistRangeDeg']} deg, max step {d['forearmTwistMaxDeltaDeg']:.2f}")
        print(f"      clavicle total {d['clavicleTotalDeg']:.1f} deg, upperarm max step "
              f"{d['upperArmMaxDeltaDeg']:.2f} deg | jerk max {d['maxJerk']:.2f}")
        print(f"      sign flips {len(d['quaternionSignFlips'])}, plane flips "
              f"{len(d['elbowPlaneFlips'])}, speed spike runs {len(d['speedSpikeRuns'])}, "
              f"angular {len(d['angularSpikeRuns'])}, twist {len(d['twistSpikeRuns'])}")
        for g in d["speedSpikeRuns"][:6]:
            print(f"        speed  f{g['start']}-{g['end']} len {g['length']} peak x{g['peakRatio']}")
        for g in d["twistSpikeRuns"][:6]:
            print(f"        twist  f{g['start']}-{g['end']} len {g['length']} peak x{g['peakRatio']}")
    if result["product"]:
        print(f"  product in hand: max slip {result['product']['maxSlipMm']:.3f} mm, "
              f"max spin {result['product']['maxSpinDeg']:.3f} deg")
    print(f"  wrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
