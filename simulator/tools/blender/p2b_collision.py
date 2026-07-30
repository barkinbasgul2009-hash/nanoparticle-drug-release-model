"""Phase 2B contact-and-collision resolution.

Runs after the animation is authored and before the bake, and does one thing: pushes each hand out
of whatever it is intersecting, by exactly as much as the measured intersection requires and no more.

WHY A SOLVER RATHER THAN RE-POSED KEYS
--------------------------------------
The intersections are not a handful of bad poses. Measured on the exported asset, thirteen of the
sixteen visible applying-hand regions penetrate the treated arm somewhere in the sequence, across a
window running from the product hand-off to the hero, and the treated hand is inside the garment for
most of the opening. Fixing that by eye, key by key, would be guesswork repeated forty times, and the
first Phase 2B build already showed what guessing costs here.

So the correction is measured per frame and applied per frame:

1. Evaluate the real deformed meshes at the frame -- the same skinned, morphed geometry the runtime
   draws, not a proxy.
2. Ask each named region how far it is from the surface it must not enter, signed.
3. Turn the worst violation into a push along the outward direction of the thing being escaped -- the
   forearm's own axis for hand contact, the spine's for the garment.
4. Smooth the resulting offset over time, so a correction that varies frame to frame cannot introduce
   the jitter the smoothing exists to prevent.
5. Add the smoothed offset to the hand control's own animated value and re-key it densely.

Step 5 is why this composes rather than fights: the authored motion is READ BACK at each frame and
the offset added on top, so easing, timing and arcs survive untouched. The solver only ever moves a
hand along the shortest line out of a surface.

TARGETS
-------
`REGION_TARGETS` encodes what "clear" means per surface. Fingertips, pads, finger sides, the thumb
and the wrist boundary must be strictly outside -- these are the silhouette edges a viewer reads. The
palm is allowed a small negative, because a palm pressing on skin should compress it and a palm held
at exactly zero reads as floating. That concealed overlap is bounded, measured and reported rather
than assumed.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import p2b_rig as R

FINGERS = R.FINGERS

#: Required signed clearance in metres. Negative means a concealed overlap is permitted there.
REGION_TARGETS = {
    "palm_centre": -0.0020,      # pressing into skin; hidden under the hand
    "palm_heel": -0.0015,
    "thumb": 0.0006,
    "applying_wrist": 0.0008,
}
DEFAULT_CONTACT_TARGET = 0.0006   # every fingertip, pad and side: strictly outside
GARMENT_TARGET = 0.0020           # skin must stay clear of cloth by a visible margin

#: Frames either side used to smooth the per-frame offsets.
SMOOTH_HALF_WIDTH = 6


#: Frames during which the applying hand is SUPPOSED to be touching the treated forearm. Outside it
#: the two arms merely pass each other and any contact at all is a defect; inside it, contact is the
#: point and the hand is pushed out only far enough to stop surfaces crossing.
CONTACT_WINDOW = (R.EVENTS["handApproach"], R.EVENTS["releaseEnd"])


def _phases():
    """Ordered solve.

    `garment`  -- treated arm out of the clothing.
    `separate` -- OUTSIDE the contact window, move the treated arm out of the applying arm's path.
                  These crossings are not contact gone wrong, they are two limbs occupying the same
                  space while the product is carried, and pushing the hand that holds the tube would
                  distort the product motion. Moving the arm being passed is the smaller change.
    `garment`  -- once more, because `separate` may have pushed the arm back towards the body.
    `contact`  -- INSIDE the window, push the applying hand out of the arm it is pressing on.

    ONLY THE GARMENT PHASE IS ENABLED. `separate` and `contact` are implemented and measured, and
    neither is shipped, because measurement says they make the asset worse rather than better:

      * `contact` does not converge. The offending region is the applying WRIST at frames 367-371,
        where the applying forearm crosses the treated forearm; translating the hand's IK target
        rotates the hand without carrying the forearm clear, so the requested push grows pass over
        pass (30 -> 34 mm) with no improvement.
      * `separate` moves the treated arm out of the passing applying arm, and in doing so it moves
        the arm the applying hand later has to press on, which took in-window contact from -21.2 mm
        to -29.5 mm. Fixing one crossing by causing a worse one is not a fix.

    Re-enabling either needs the applying arm's APPROACH re-authored so its forearm arrives from
    outside the treated arm rather than across it. That is a pose change this pass did not make.
    """
    return [("garment", i) for i in range(3)]


def _phases_full():
    """The full ordering, kept for the next pass to re-enable once the approach is re-authored."""
    return ([("garment", i) for i in range(2)]
            + [("separate", i) for i in range(2)]
            + [("garment", 2 + i) for i in range(1)]
            + [("contact", i) for i in range(3)])


# ----------------------------------------------------------------------------------------------
# geometry helpers (kept identical in behaviour to tools/blender/measure_collisions.py)
# ----------------------------------------------------------------------------------------------

def _dominant(obj, names, threshold=0.5):
    idx = {obj.vertex_groups[n].index for n in names if n in obj.vertex_groups}
    if not idx:
        return set()
    return {v.index for v in obj.data.vertices
            if sum(g.weight for g in v.groups if g.group in idx) > threshold}


def _evaluated(obj, depsgraph):
    ob = obj.evaluated_get(depsgraph)
    me = ob.to_mesh(preserve_all_data_layers=False, depsgraph=depsgraph)
    mw = ob.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ob.to_mesh_clear()
    return verts, polys


def _subset_bvh(verts, polys, keep):
    sel = [p for p in polys if all(i in keep for i in p)]
    if not sel:
        return None
    remap, vs, fs = {}, [], []
    for p in sel:
        f = []
        for i in p:
            if i not in remap:
                remap[i] = len(vs)
                vs.append(verts[i])
            f.append(remap[i])
        fs.append(tuple(f))
    return BVHTree.FromPolygons(vs, fs, all_triangles=False, epsilon=0.0)


def _worst_signed(bvh, points, axis_head, axis_dir, max_depth):
    """Smallest signed clearance over `points`, and the point that achieved it."""
    worst, where = math.inf, None
    for p in points:
        hit = bvh.find_nearest(p)
        if hit is None or hit[0] is None:
            continue
        _loc, _n, _i, dist = hit
        if dist > max_depth:
            value = dist
        else:
            d = Vector(p) - axis_head
            radial = d - axis_dir * d.dot(axis_dir)
            inside = True
            if radial.length >= 1e-6:
                r = radial.normalized()
                shot = bvh.ray_cast(Vector(p) + r * 1e-5, r, 0.30)
                inside = shot is not None and shot[0] is not None
            value = -dist if inside else dist
        if value < worst:
            worst, where = value, Vector(p)
    return worst, where


def build_query_regions(body, armature, applying=None, treated=None) -> dict:
    """The visible surfaces ssA requires to be validated separately."""
    applying = applying or R.APPLYING
    treated = treated or R.TREATED
    frame = R.hand_frame(armature, applying)
    origin, radial, distal, palmar = (frame["origin"], frame["radial"],
                                      frame["distal"], frame["palmar"])

    def to_frame(co):
        d = Vector(co) - origin
        return Vector((d.dot(radial), d.dot(distal), d.dot(palmar)))

    regions = {}
    for f in FINGERS:
        bone = armature.data.bones[f"{f}_03_{applying}"]
        head = Vector(bone.head_local)
        axis = (Vector(bone.tail_local) - head).normalized()
        length = (Vector(bone.tail_local) - head).length
        pad, tip = [], []
        for i in _dominant(body, {f"{f}_03_{applying}"}):
            co = Vector(body.data.vertices[i].co)
            t = (co - head).dot(axis)
            if t > length * 0.80:
                tip.append(i)
            elif t > length * 0.25 and ((co - head) - axis * t).dot(palmar) > 0.0:
                pad.append(i)
        regions[f"{f}_tip"] = tip
        regions[f"{f}_pad"] = pad
        regions[f"{f}_side"] = sorted(_dominant(body, {f"{f}_01_{applying}",
                                                       f"{f}_02_{applying}"}))
    regions["thumb"] = sorted(_dominant(body, {f"thumb_02_{applying}", f"thumb_03_{applying}"}))

    heel, centre = [], []
    for i in _dominant(body, {f"hand_{applying}"}):
        p = to_frame(body.data.vertices[i].co)
        if p.z <= 0.0:
            continue
        (heel if p.y < 0.045 else centre).append(i)
    regions["palm_heel"] = heel
    regions["palm_centre"] = centre

    hand_head = Vector(armature.data.bones[f"hand_{applying}"].head_local)
    regions["applying_wrist"] = [
        i for i in _dominant(body, {f"lowerarm_{applying}"})
        if (Vector(body.data.vertices[i].co) - hand_head).length < 0.055]

    treated_hand_head = Vector(armature.data.bones[f"hand_{treated}"].head_local)
    regions["treated_hand"] = sorted(
        _dominant(body, {f"hand_{treated}"}
                  | {f"{n}_{s}_{treated}" for n in FINGERS + ("thumb",)
                     for s in ("01", "02", "03")}))
    regions["treated_wrist"] = [
        i for i in _dominant(body, {f"lowerarm_{treated}"})
        if (Vector(body.data.vertices[i].co) - treated_hand_head).length < 0.060]
    regions["treated_forearm"] = sorted(_dominant(body, {f"lowerarm_{treated}"}))
    return regions


def garment_covered_at_bind(body, garment, armature) -> set:
    """Body vertices clothing is meant to cover — excluded from the garment test."""
    previous = armature.data.pose_position
    armature.data.pose_position = "REST"
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    depsgraph.update()
    bverts, _ = _evaluated(body, depsgraph)
    gverts, gpolys = _evaluated(garment, depsgraph)
    bvh = BVHTree.FromPolygons(gverts, gpolys, all_triangles=False, epsilon=0.0)
    spine = armature.matrix_world @ Vector(armature.data.bones["spine_01"].head_local)
    up = (armature.matrix_world @ Vector(armature.data.bones["spine_03"].tail_local) - spine).normalized()
    covered = set()
    for i, p in enumerate(bverts):
        d = Vector(p) - spine
        radial = d - up * d.dot(up)
        if radial.length < 1e-6:
            covered.add(i)
            continue
        r = radial.normalized()
        shot = bvh.ray_cast(Vector(p) + r * 1e-5, r, 0.40)
        if shot is not None and shot[0] is not None:
            covered.add(i)
    armature.data.pose_position = previous
    bpy.context.view_layer.update()
    return covered


# ----------------------------------------------------------------------------------------------
# the solver
# ----------------------------------------------------------------------------------------------

def _smooth(series: dict[int, Vector], half: int = SMOOTH_HALF_WIDTH) -> dict[int, Vector]:
    """Dilate to the window maximum, then average.

    A plain moving average was the first attempt and it does not converge: where only a few frames
    need a large push, averaging over thirteen spreads it thin and the violation survives, so the
    next pass asks for the same push again. Taking the window's LARGEST correction first guarantees
    every frame gets at least what it asked for; the average afterwards is what keeps the result
    smooth in time. The cost is that a neighbourhood is corrected slightly more than it strictly
    needs, which is the right way to be wrong -- it errs towards clearance, never towards contact.
    """
    frames = sorted(series)
    dilated = {}
    for i, f in enumerate(frames):
        lo, hi = max(0, i - half), min(len(frames), i + half + 1)
        best = max((series[frames[j]] for j in range(lo, hi)), key=lambda v: v.length)
        dilated[f] = best.copy()
    out = {}
    for i, f in enumerate(frames):
        lo, hi = max(0, i - half), min(len(frames), i + half + 1)
        acc = Vector((0.0, 0.0, 0.0))
        for j in range(lo, hi):
            acc += dilated[frames[j]]
        out[f] = acc / float(hi - lo)
    return out


def resolve(armature, body, garment, controls, log, step: int = 1) -> dict:
    """Push both hands out of everything they intersect. Returns a measurement record.

    The two solves run in SEQUENCE, garment first, and that ordering is not arbitrary. The applying
    hand's whole purpose is to touch the treated forearm, so its correct position is defined relative
    to an arm that is still moving while the garment solve runs. Solving both at once, as the first
    version did, has each pass invalidate the other's target: the garment clearance improved from
    -72 mm to -23 mm while the hand contact got worse, from -24 mm to -29 mm. Settling the treated
    arm first gives the hand a fixed thing to be correct about.
    """
    scene = bpy.context.scene
    regions = build_query_regions(body, armature)
    covered = garment_covered_at_bind(body, garment, armature)
    for name in ("treated_hand", "treated_wrist", "treated_forearm"):
        regions[name] = [i for i in regions[name] if i not in covered]

    treated_arm = _dominant(body, {f"lowerarm_{R.TREATED}", f"hand_{R.TREATED}"}, threshold=0.4)
    contact_names = [k for k in regions if k.endswith(("_tip", "_pad", "_side"))] + \
                    ["thumb", "palm_heel", "palm_centre", "applying_wrist"]
    garment_names = ["treated_hand", "treated_wrist", "treated_forearm"]

    frames = list(range(R.FRAME_START, R.FRAME_END + 1, step))
    applied_r = {f: Vector((0.0, 0.0, 0.0)) for f in frames}
    applied_l = {f: Vector((0.0, 0.0, 0.0)) for f in frames}
    history = []

    for phase, iteration in _phases():
        need_r, need_l = {}, {}
        worst_contact, worst_garment = math.inf, math.inf
        worst_contact_at, worst_garment_at = (0, "", False), (0, "")
        for frame in frames:
            scene.frame_set(frame)
            depsgraph = bpy.context.evaluated_depsgraph_get()
            bverts, bpolys = _evaluated(body, depsgraph)
            gverts, gpolys = _evaluated(garment, depsgraph)
            arm_bvh = _subset_bvh(bverts, bpolys, treated_arm)
            garment_bvh = BVHTree.FromPolygons(gverts, gpolys, all_triangles=False, epsilon=0.0)

            ae = armature.evaluated_get(depsgraph)
            f_head = ae.matrix_world @ ae.pose.bones[f"lowerarm_{R.TREATED}"].head
            f_dir = ((ae.matrix_world @ ae.pose.bones[f"lowerarm_{R.TREATED}"].tail) - f_head).normalized()
            s_head = ae.matrix_world @ ae.pose.bones["spine_01"].head
            s_dir = ((ae.matrix_world @ ae.pose.bones["spine_03"].tail) - s_head).normalized()

            # ---- applying hand out of the treated arm -------------------------------------
            push_r, worst_here, worst_pt, worst_name = 0.0, math.inf, None, ""
            if arm_bvh is not None:
                for name in contact_names:
                    pts = [bverts[i] for i in regions[name]]
                    if not pts:
                        continue
                    value, where = _worst_signed(arm_bvh, pts, f_head, f_dir, 0.055)
                    target = REGION_TARGETS.get(name, DEFAULT_CONTACT_TARGET)
                    deficit = target - value
                    if deficit > push_r:
                        push_r, worst_pt = deficit, where
                    if value < worst_here:
                        worst_here, worst_name = value, name
            in_window = CONTACT_WINDOW[0] <= frame <= CONTACT_WINDOW[1]
            direction = Vector((0.0, 0.0, 1.0))
            if worst_pt is not None:
                d = worst_pt - f_head
                radial = d - f_dir * d.dot(f_dir)
                if radial.length > 1e-6:
                    direction = radial.normalized()
            need_r[frame] = Vector((0.0, 0.0, 0.0))
            separate_l = Vector((0.0, 0.0, 0.0))
            if push_r > 0.0:
                if phase == "contact" and in_window:
                    need_r[frame] = direction * push_r
                elif phase == "separate" and not in_window:
                    # move the ARM out of the way, not the hand carrying the product
                    separate_l = -direction * push_r
            if worst_here < worst_contact:
                worst_contact, worst_contact_at = worst_here, (frame, worst_name, in_window)

            # ---- treated hand out of the garment ------------------------------------------
            push_l, worst_g, worst_gp, worst_g_name = 0.0, math.inf, None, ""
            for name in garment_names:
                pts = [bverts[i] for i in regions[name]]
                if not pts:
                    continue
                value, where = _worst_signed(garment_bvh, pts, s_head, s_dir, 0.120)
                deficit = GARMENT_TARGET - value
                if deficit > push_l:
                    push_l, worst_gp = deficit, where
                if value < worst_g:
                    worst_g, worst_g_name = value, name
            need_l[frame] = separate_l
            if phase == "garment" and push_l > 0.0 and worst_gp is not None:
                d = worst_gp - s_head
                radial = d - s_dir * d.dot(s_dir)
                gdir = radial.normalized() if radial.length > 1e-6 else Vector((1.0, 0.0, 0.0))
                need_l[frame] = gdir * push_l
            if worst_g < worst_garment:
                worst_garment, worst_garment_at = worst_g, (frame, worst_g_name)

        history.append({"phase": phase, "iteration": iteration,
                        "worstContactMm": round(worst_contact * 1000, 3),
                        "worstGarmentMm": round(worst_garment * 1000, 3),
                        "maxPushRmm": round(max(v.length for v in need_r.values()) * 1000, 3),
                        "maxPushLmm": round(max(v.length for v in need_l.values()) * 1000, 3),
                        "worstContactAt": {"frame": worst_contact_at[0], "region": worst_contact_at[1],
                                           "inWindow": worst_contact_at[2]},
                        "worstGarmentAt": {"frame": worst_garment_at[0], "region": worst_garment_at[1]}})
        log(f"  collision {phase} pass {iteration}: worst contact {worst_contact*1000:+.2f} mm, "
            f"worst garment {worst_garment*1000:+.2f} mm, "
            f"push r/l {history[-1]['maxPushRmm']:.2f}/{history[-1]['maxPushLmm']:.2f} mm"
            f"  | worst contact {worst_contact_at[1]}@f{worst_contact_at[0]}"
            f"{'(in-window)' if worst_contact_at[2] else '(outside)'}"
            f", worst garment {worst_garment_at[1]}@f{worst_garment_at[0]}")

        if max(v.length for v in need_r.values()) < 1e-5 and \
           max(v.length for v in need_l.values()) < 1e-5:
            continue

        need_r = _smooth(need_r)
        need_l = _smooth(need_l)
        for f in frames:
            applied_r[f] = applied_r[f] + need_r[f]
            applied_l[f] = applied_l[f] + need_l[f]
        _rekey(armature, controls[R.APPLYING]["hand"], frames, need_r)
        _rekey(armature, controls[R.TREATED]["hand"], frames, need_l)

    return {
        "iterations": history,
        "maxAppliedOffsetRmm": round(max(v.length for v in applied_r.values()) * 1000, 3),
        "maxAppliedOffsetLmm": round(max(v.length for v in applied_l.values()) * 1000, 3),
        "regionVertexCounts": {k: len(v) for k, v in regions.items()},
        "targetsMm": {**{k: round(v * 1000, 2) for k, v in REGION_TARGETS.items()},
                      "_default": round(DEFAULT_CONTACT_TARGET * 1000, 2),
                      "_garment": round(GARMENT_TARGET * 1000, 2)},
    }


def _rekey(armature, control, frames, offsets: dict[int, Vector]) -> None:
    """Add `offsets` to the control's own animated position, densely, preserving its rotation.

    The authored value is read back at each frame and the offset added to it, so the arcs, easing and
    timing the animation already has are carried through untouched -- the solver only ever slides a
    hand along the shortest way out of a surface.
    """
    scene = bpy.context.scene
    poses = {}
    for f in frames:
        scene.frame_set(f)
        bpy.context.view_layer.update()
        poses[f] = control.matrix_world.copy()
    for f in frames:
        m = poses[f].copy()
        m.translation = m.translation + offsets[f]
        R.key_control(control, f, m)
