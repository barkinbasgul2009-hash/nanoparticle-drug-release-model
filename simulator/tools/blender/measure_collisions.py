#!/usr/bin/env python3
"""Phase 2B contact-and-collision measurement, against the REAL exported geometry.

    python measure_collisions.py -- --glb <baked.glb> --out <report.json> [--step 2]

Run under a Blender Python (the `bpy` module interpreter is what this container uses).

WHY THIS EXISTS
---------------
The Phase 2B build already measured contact, and it passed, and the render was still wrong. It
measured the wrong thing: a single palm-centre point against a forearm radius profile. That number
says nothing about the eight other surfaces a viewer actually looks at -- each fingertip, each finger
pad, the sides of the fingers, the palm heel, the wrist boundary -- and nothing at all about the
garment. Two blocking defects hid in that gap: the applying fingers passing through the treated
wrist, and the treated hand entering the shirt.

So this tool measures what is on screen:

* It imports the EXPORTED GLB, not the authoring scene, so what it measures is what ships.
* It evaluates the skinned, morphed mesh through the dependency graph at each sampled frame, so it
  sees the same deformation the runtime does.
* It builds a BVH of the *target* surface only -- the treated arm for hand contact, the garment for
  clothing clearance -- so a query point cannot match against its own skin.
* It reports SIGNED distance per named region: positive is clear air, negative is inside the target.

The sign comes from the surface normal at the nearest point. That is reliable here because both
targets are smooth, closed, locally convex-ish surfaces at the scale of the query; it would not be
reliable across a thin crease, which is why the regions are kept away from seams.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

FINGERS = ("index", "middle", "ring", "pinky")
APPLYING = "r"
TREATED = "l"

BODY_MESH = "Human_mesh"
GARMENT_MESH = "Human_male_casualsuit06"
ARMATURE = "Human_rig"


def _argv():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]


# ----------------------------------------------------------------------------------------------
# region definition — every surface a viewer can see, named separately (ssA)
# ----------------------------------------------------------------------------------------------

def dominant_groups(obj: bpy.types.Object, names: set[str], threshold=0.5) -> set[int]:
    """Vertex indices whose summed weight across `names` exceeds `threshold`."""
    idx = {obj.vertex_groups[n].index for n in names if n in obj.vertex_groups}
    if not idx:
        return set()
    out = set()
    for v in obj.data.vertices:
        if sum(g.weight for g in v.groups if g.group in idx) > threshold:
            out.add(v.index)
    return out


def hand_frame(arm: bpy.types.Object, side: str) -> dict:
    """The measured anatomical hand frame (see p2b_rig.hand_frame -- same construction)."""
    bones = arm.data.bones
    hand = bones[f"hand_{side}"]
    wrist = Vector(hand.head_local)
    mcp = {f: Vector(bones[f"{f}_01_{side}"].head_local) for f in FINGERS}
    distal = (Vector(hand.tail_local) - wrist).normalized()
    knuckle = (mcp["pinky"] - mcp["index"]).normalized()
    palmar = knuckle.cross(distal).normalized()
    vote = 0.0
    for f in FINGERS:
        head = mcp[f]
        prox = (Vector(bones[f"{f}_01_{side}"].tail_local) - head).normalized()
        off = Vector(bones[f"{f}_03_{side}"].tail_local) - head
        off -= prox * off.dot(prox)
        vote += off.dot(palmar)
    if vote < 0.0:
        palmar = -palmar
    radial = distal.cross(palmar).normalized()
    distal = palmar.cross(radial).normalized()
    return {"origin": wrist, "radial": radial, "distal": distal, "palmar": palmar}


def build_regions(body: bpy.types.Object, arm: bpy.types.Object) -> dict[str, list[int]]:
    """Split the applying hand into the surfaces ssA lists, plus the treated side's queries."""
    frame = hand_frame(arm, APPLYING)
    inv = arm.data.bones[f"hand_{APPLYING}"].matrix_local.inverted()

    def to_frame(co):
        d = Vector(co) - frame["origin"]
        return Vector((d.dot(frame["radial"]), d.dot(frame["distal"]), d.dot(frame["palmar"])))

    regions: dict[str, list[int]] = {}

    # --- per-finger: the distal phalanx, split into the PAD (palmar side) and the TIP (the end) ---
    for f in FINGERS:
        distal_verts = dominant_groups(body, {f"{f}_03_{APPLYING}"})
        bone = arm.data.bones[f"{f}_03_{APPLYING}"]
        head = Vector(bone.head_local)
        axis = (Vector(bone.tail_local) - head).normalized()
        length = (Vector(bone.tail_local) - head).length
        pad, tip = [], []
        for i in distal_verts:
            co = body.data.vertices[i].co
            t = (Vector(co) - head).dot(axis)
            # palmar side of the phalanx, measured in the hand's own frame
            radial_off = (Vector(co) - head) - axis * t
            palmar_side = radial_off.dot(frame["palmar"]) > 0.0
            if t > length * 0.80:
                tip.append(i)
            elif palmar_side and t > length * 0.25:
                pad.append(i)
        regions[f"{f}_tip"] = tip
        regions[f"{f}_pad"] = pad
        # the SIDES of the finger: middle + proximal phalanges, which is what brushes the forearm
        # when a hand is laid flat on a limb and is exactly what the palm-centre metric ignored
        regions[f"{f}_side"] = sorted(dominant_groups(body, {f"{f}_01_{APPLYING}",
                                                             f"{f}_02_{APPLYING}"}))

    # --- thumb ---
    regions["thumb"] = sorted(dominant_groups(body, {f"thumb_02_{APPLYING}",
                                                     f"thumb_03_{APPLYING}"}))

    # --- palm, split at the wrist-to-knuckle midpoint into heel and centre ---
    palm_all = dominant_groups(body, {f"hand_{APPLYING}"})
    heel, centre = [], []
    for i in palm_all:
        p = to_frame(body.data.vertices[i].co)
        if p.z <= 0.0:          # dorsal side never contacts; drop it
            continue
        (heel if p.y < 0.045 else centre).append(i)
    regions["palm_heel"] = heel
    regions["palm_centre"] = centre

    # --- applying wrist boundary ---
    wrist = []
    lower = dominant_groups(body, {f"lowerarm_{APPLYING}"})
    hand_head = Vector(arm.data.bones[f"hand_{APPLYING}"].head_local)
    for i in lower:
        if (Vector(body.data.vertices[i].co) - hand_head).length < 0.055:
            wrist.append(i)
    regions["applying_wrist"] = wrist

    # --- treated side, for the garment queries (ssB) ---
    regions["treated_hand"] = sorted(
        dominant_groups(body, {f"hand_{TREATED}"}
                        | {f"{n}_{s}_{TREATED}" for n in FINGERS + ("thumb",)
                           for s in ("01", "02", "03")}))
    treated_wrist = []
    t_hand_head = Vector(arm.data.bones[f"hand_{TREATED}"].head_local)
    for i in dominant_groups(body, {f"lowerarm_{TREATED}"}):
        if (Vector(body.data.vertices[i].co) - t_hand_head).length < 0.060:
            treated_wrist.append(i)
    regions["treated_wrist"] = treated_wrist
    regions["treated_forearm"] = sorted(dominant_groups(body, {f"lowerarm_{TREATED}"}))

    return regions


def bind_pose_covered(body: bpy.types.Object, garment: bpy.types.Object,
                      arm: bpy.types.Object) -> set[int]:
    """Body vertices already inside the garment with the armature in its REST position.

    These are the ones clothing is supposed to cover. Evaluated at rest rather than at frame 1,
    because frame 1 is an authored pose and could itself contain the defect being looked for.
    """
    previous = arm.data.pose_position
    arm.data.pose_position = "REST"
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    bverts, _ = evaluated_mesh(body, depsgraph)
    gverts, gpolys = evaluated_mesh(garment, depsgraph)
    bvh = BVHTree.FromPolygons(gverts, gpolys, all_triangles=False, epsilon=0.0)
    spine = arm.matrix_world @ Vector(arm.data.bones["spine_01"].head_local)
    spine_dir = (arm.matrix_world @ Vector(arm.data.bones["spine_03"].tail_local) - spine).normalized()
    covered = set()
    for i, p in enumerate(bverts):
        d = Vector(p) - spine
        radial = d - spine_dir * d.dot(spine_dir)
        if radial.length < 1e-6:
            covered.add(i)
            continue
        r = radial.normalized()
        shot = bvh.ray_cast(Vector(p) + r * 1e-5, r, 0.40)
        if shot is not None and shot[0] is not None:
            covered.add(i)
    arm.data.pose_position = previous
    bpy.context.view_layer.update()
    return covered


def treated_arm_vertices(body: bpy.types.Object) -> set[int]:
    """The surface the applying hand presses on: treated forearm plus its hand."""
    return dominant_groups(body, {f"lowerarm_{TREATED}", f"hand_{TREATED}"}, threshold=0.4)


# ----------------------------------------------------------------------------------------------
# measurement
# ----------------------------------------------------------------------------------------------

def evaluated_mesh(obj: bpy.types.Object, depsgraph):
    ob = obj.evaluated_get(depsgraph)
    me = ob.to_mesh(preserve_all_data_layers=False, depsgraph=depsgraph)
    mw = ob.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ob.to_mesh_clear()
    return verts, polys


def subset_bvh(verts, polys, keep: set[int]):
    """BVH over only the polygons whose vertices are all in `keep`.

    Restricting the target surface is what makes the sign meaningful: query a fingertip against the
    whole body and its nearest surface is its own skin, which reads as a 0 mm 'contact' everywhere.
    """
    sel = [p for p in polys if all(i in keep for i in p)]
    if not sel:
        return None
    remap: dict[int, int] = {}
    vs = []
    fs = []
    for p in sel:
        f = []
        for i in p:
            if i not in remap:
                remap[i] = len(vs)
                vs.append(verts[i])
            f.append(remap[i])
        fs.append(tuple(f))
    return BVHTree.FromPolygons(vs, fs, all_triangles=False, epsilon=0.0)


def signed_clearance(bvh: BVHTree, points, axis_head=None, axis_dir=None,
                     max_depth: float = 0.055) -> list[float]:
    """Signed distance to the target surface: positive outside, negative inside.

    The sign is NOT taken from the nearest surface normal. That test is only locally valid, and at
    range it lies: a hand 270 mm away across the body can land nearest a patch whose normal points
    away from it, and gets reported as 270 mm INSIDE the arm. The first run of this tool did exactly
    that.

    Instead, when a limb/torso axis is supplied, a point is inside if a ray fired from it directly
    AWAY from that axis still hits the target surface -- i.e. there is target material between the
    point and open air. That is exact for the tube-like shapes involved (a forearm, a sleeved torso)
    and does not care how far away the point is.

    Without an axis it falls back to the normal test, gated to 50 mm so a far-away point can never be
    reported as deeply embedded.
    """
    out = []
    for p in points:
        hit = bvh.find_nearest(p)
        if hit is None or hit[0] is None:
            continue
        location, normal, _index, dist = hit
        inside = False
        # A point inside a solid can be at most its local half-thickness from the surface. A forearm
        # is under 50 mm in radius, so anything further than `max_depth` from the surface is outside
        # by construction, whatever a ray happens to graze on its way past a curved limb.
        if dist > max_depth:
            out.append(dist)
            continue
        if axis_head is not None:
            d = Vector(p) - axis_head
            radial = d - axis_dir * d.dot(axis_dir)
            if radial.length < 1e-6:
                inside = True
            else:
                r = radial.normalized()
                shot = bvh.ray_cast(Vector(p) + r * 1e-5, r, 0.30)
                inside = shot is not None and shot[0] is not None
        elif dist < 0.050:
            inside = (Vector(p) - Vector(location)).dot(Vector(normal)) < 0.0
        out.append((-dist if inside else dist))
    return out


def measure(glb: str, step: int = 2, frame_start: int = 1, frame_end: int = 421,
            fps: int = 30) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # SET THE FRAME RATE BEFORE IMPORTING. glTF stores animation in seconds and the importer places
    # keys at whatever the scene's fps happens to be, which is 24 by default. Import at 24 and the
    # 14-second clip lands on frames 0.8-336.8, so sampling 1-421 silently holds the final frame for
    # the last 85 -- which is the entire hero section, the exact place one of the defects lives.
    bpy.context.scene.render.fps = fps
    bpy.ops.import_scene.gltf(filepath=glb)
    scene = bpy.context.scene
    scene.render.fps = fps
    action_end = max((a.frame_range[1] for a in bpy.data.actions), default=0.0)
    if action_end < frame_end - 1.5:
        raise SystemExit(
            f"BLOCKED: imported action ends at frame {action_end:.1f} but {frame_end} was requested; "
            f"the scene fps ({fps}) does not match the clip's authored rate")
    arm = bpy.data.objects[ARMATURE]
    body = bpy.data.objects[BODY_MESH]
    garment = bpy.data.objects.get(GARMENT_MESH)
    if garment is None:
        raise SystemExit(f"BLOCKED: garment mesh {GARMENT_MESH} not in {glb}")

    regions = build_regions(body, arm)
    treated_arm = treated_arm_vertices(body)

    # SKIN THAT IS UNDER CLOTHING BY DESIGN IS NOT A COLLISION. The upper arm lives inside the
    # sleeve, and the elbow end of the forearm sits under its hem; measuring those as "inside the
    # garment" reports a constant ~12 mm penetration for the entire sequence and buries the real
    # defect in noise. The exposed set is computed once from the BIND pose -- whatever is already
    # inside the garment when nothing is animated is covered on purpose, and only vertices that
    # start outside and later go in are defects.
    covered = bind_pose_covered(body, garment, arm)
    for name in ("treated_hand", "treated_wrist", "treated_forearm"):
        regions[name] = [i for i in regions[name] if i not in covered]

    counts = {k: len(v) for k, v in regions.items()}
    counts["_coveredAtBind"] = len(covered)

    contact_regions = [k for k in regions if k.endswith(("_tip", "_pad", "_side"))] + \
                      ["thumb", "palm_heel", "palm_centre", "applying_wrist"]
    garment_regions = ["treated_hand", "treated_wrist", "treated_forearm"]

    frames = []
    t0 = time.time()
    for frame in range(frame_start, frame_end + 1, step):
        scene.frame_set(frame)
        depsgraph = bpy.context.evaluated_depsgraph_get()
        bverts, bpolys = evaluated_mesh(body, depsgraph)
        gverts, gpolys = evaluated_mesh(garment, depsgraph)

        arm_bvh = subset_bvh(bverts, bpolys, treated_arm)
        garment_bvh = BVHTree.FromPolygons(gverts, gpolys, all_triangles=False, epsilon=0.0)

        # The axes the inside test fires away from, taken from the POSED skeleton at this frame so
        # they follow the limb rather than assuming a rest orientation.
        arm_eval = arm.evaluated_get(depsgraph)
        f_head = arm_eval.matrix_world @ arm_eval.pose.bones[f"lowerarm_{TREATED}"].head
        f_tail = arm_eval.matrix_world @ arm_eval.pose.bones[f"lowerarm_{TREATED}"].tail
        f_dir = (f_tail - f_head).normalized()
        s_head = arm_eval.matrix_world @ arm_eval.pose.bones["spine_01"].head
        s_tail = arm_eval.matrix_world @ arm_eval.pose.bones["spine_03"].tail
        s_dir = (s_tail - s_head).normalized()

        row = {"frame": frame, "contact": {}, "garment": {}}
        for name in contact_regions:
            pts = [bverts[i] for i in regions[name]]
            if not pts or arm_bvh is None:
                continue
            d = signed_clearance(arm_bvh, pts, f_head, f_dir, max_depth=0.055)
            if d:
                row["contact"][name] = {"minMm": round(min(d) * 1000, 3),
                                        "medianMm": round(sorted(d)[len(d) // 2] * 1000, 3)}
        for name in garment_regions:
            pts = [bverts[i] for i in regions[name]]
            if not pts:
                continue
            d = signed_clearance(garment_bvh, pts, s_head, s_dir, max_depth=0.120)
            if d:
                row["garment"][name] = {"minMm": round(min(d) * 1000, 3),
                                        "medianMm": round(sorted(d)[len(d) // 2] * 1000, 3)}
        frames.append(row)

    return {
        "glb": glb,
        "glbBytes": os.path.getsize(glb),
        "sampledFrames": len(frames),
        "step": step,
        "frameRange": [frame_start, frame_end],
        "regionVertexCounts": counts,
        "seconds": round(time.time() - t0, 1),
        "frames": frames,
    }


def summarise(report: dict) -> dict:
    """Worst case per region across the whole sequence, and where it happens."""
    worst = {}
    for row in report["frames"]:
        for kind in ("contact", "garment"):
            for name, v in row[kind].items():
                key = f"{kind}:{name}"
                if key not in worst or v["minMm"] < worst[key]["minMm"]:
                    worst[key] = {"minMm": v["minMm"], "frame": row["frame"]}
    contact = [v["minMm"] for k, v in worst.items() if k.startswith("contact:")]
    garment = [v["minMm"] for k, v in worst.items() if k.startswith("garment:")]
    return {
        "worstPerRegion": dict(sorted(worst.items(), key=lambda kv: kv[1]["minMm"])),
        "worstContactMm": min(contact) if contact else None,
        "worstGarmentMm": min(garment) if garment else None,
    }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--glb", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--step", type=int, default=2)
    p.add_argument("--label", default="")
    a = p.parse_args(_argv())

    report = measure(a.glb, a.step)
    report["summary"] = summarise(report)
    report["label"] = a.label
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(report, f, indent=1)

    s = report["summary"]
    print(f"\nCOLLISION REPORT  {a.glb}  ({report['sampledFrames']} frames, {report['seconds']}s)")
    print(f"  worst applying-hand -> treated arm : {s['worstContactMm']:+.2f} mm")
    print(f"  worst treated side  -> garment     : {s['worstGarmentMm']:+.2f} mm")
    print("  per region (negative = inside the target):")
    for k, v in s["worstPerRegion"].items():
        flag = "  <-- PENETRATION" if v["minMm"] < 0 else ""
        print(f"    {k:34s} {v['minMm']:+9.2f} mm @ f{v['frame']}{flag}")
    print(f"  wrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
