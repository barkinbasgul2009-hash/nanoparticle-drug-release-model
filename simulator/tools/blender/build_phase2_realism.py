#!/usr/bin/env python3
"""Phase 2B — Blender-authored realism build.

Builds the topical-application animation from the immutable human asset and emits everything the web
runtime needs::

    simulator/assets/blender/phase2_application_source.blend      editable authoring source
    simulator/assets/human/human_application_baked.glb            runtime asset
    simulator/assets/human/human_application_manifest.json        authoritative manifest
    simulator/artifacts/phase2b/build-report.json                 machine-readable build report
    simulator/artifacts/phase2b/blender-preview-normal.mp4        optional preview render

The script is deterministic and idempotent: it always starts from an empty scene, imports the
original GLB, and rebuilds every authored object from code. Running it twice on the same repository
state produces the same mesh topology, the same shape-key deltas and the same baked curves.

Usage (either interpreter works; the .bat entry point uses the first form)::

    blender --background --python-exit-code 1 --python build_phase2_realism.py -- --repo <root>
    python build_phase2_realism.py -- --repo <root>            # bpy-module interpreter

It refuses to write simulator/assets/human/human.glb under any circumstances (ss3).
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import sys
import time

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import p2b_geometry as G           # noqa: E402
import p2b_rig as R                # noqa: E402

MIN_BLENDER = (4, 5, 0)
MAX_BLENDER = (5, 0, 0)
CLIP_NAME = "phase2_application"
BONE_MAP_VERSION = "phase0-ue-makehuman-1"

ORIGINAL_REL = "simulator/assets/human/human.glb"
BLEND_REL = "simulator/assets/blender/phase2_application_source.blend"
BAKED_REL = "simulator/assets/human/human_application_baked.glb"
MANIFEST_REL = "simulator/assets/human/human_application_manifest.json"
REPORT_REL = "simulator/artifacts/phase2b/build-report.json"
PREVIEW_REL = "simulator/artifacts/phase2b/blender-preview-normal.mp4"

COLLECTIONS = ("SOURCE_HUMAN", "RUNTIME_EXPORT", "CONTROL_RIG", "PRODUCT", "CREAM",
               "HELPERS", "LIGHTS", "PREVIEW_ONLY")

# Where the product rests when it is not in the hand. Measured to sit inside the applying arm's
# reach (shoulder to wrist is 518 mm; this pose needs 477 mm).
TRAY_TOP = Vector((-0.320, -0.260, 0.955))

log_lines: list[str] = []


def log(msg: str) -> None:
    line = f"[phase2b] {msg}"
    log_lines.append(line)
    print(line, flush=True)


# ==============================================================================================
# preflight
# ==============================================================================================

def check_blender_version() -> str:
    v = bpy.app.version
    if not (MIN_BLENDER <= v < MAX_BLENDER):
        raise SystemExit(
            f"BLOCKED: Blender {v[0]}.{v[1]}.{v[2]} is outside the range required by the "
            f"architecture lock ({MIN_BLENDER[0]}.{MIN_BLENDER[1]} <= version < "
            f"{MAX_BLENDER[0]}.{MAX_BLENDER[1]}). Refusing to substitute another version.")
    return bpy.app.version_string


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def guard_original(repo: str, path: str) -> None:
    original = os.path.normpath(os.path.join(repo, ORIGINAL_REL))
    if os.path.normpath(path) == original:
        raise SystemExit("BLOCKED: refusing to write the immutable original human.glb")


# ==============================================================================================
# scene assembly
# ==============================================================================================

def clean_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images,
                 bpy.data.armatures, bpy.data.actions, bpy.data.curves, bpy.data.cameras,
                 bpy.data.lights, bpy.data.collections):
        for item in list(coll):
            coll.remove(item, do_unlink=True)
    bpy.context.scene.name = CLIP_NAME
    bpy.context.scene.render.fps = R.FPS
    bpy.context.scene.render.fps_base = 1.0
    bpy.context.scene.frame_start = R.FRAME_START
    bpy.context.scene.frame_end = R.FRAME_END
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def make_collections() -> dict:
    out = {}
    for name in COLLECTIONS:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
        c["p2b_export"] = name in ("SOURCE_HUMAN", "RUNTIME_EXPORT", "PRODUCT", "CREAM")
        out[name] = c
    return out


def import_human(repo: str, collections: dict) -> tuple[bpy.types.Object, list[bpy.types.Object]]:
    src = os.path.join(repo, ORIGINAL_REL)
    if not os.path.isfile(src):
        raise SystemExit(f"BLOCKED: original human asset missing at {src}")
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=src)
    appeared = [o for o in bpy.data.objects if o not in before]
    # Blender's glTF importer leaves a stray "Icosphere" behind that is in neither the file's node
    # list nor its mesh list. Accepting everything that appeared would adopt it as part of the human
    # and ship a 2 m sphere in the runtime asset, so keep only the armature and what it parents.
    armature_objs = [o for o in appeared if o.type == "ARMATURE"]
    keep = set(armature_objs)
    for o in appeared:
        node = o
        while node is not None:
            if node in armature_objs:
                keep.add(o)
                break
            node = node.parent
    strays = [o for o in appeared if o not in keep]
    for o in strays:
        bpy.data.objects.remove(o, do_unlink=True)
    if strays:
        log(f"discarded {len(strays)} importer artefact(s): {', '.join(sorted(o.name for o in strays)) if False else len(strays)} object(s)")
    imported = [o for o in appeared if o in keep]
    for o in imported:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        collections["SOURCE_HUMAN"].objects.link(o)
        o["p2b_role"] = "source_human"
        o["p2b_export"] = True
        o["p2b_provenance"] = "SOURCE_ASSET"
    armatures = [o for o in imported if o.type == "ARMATURE"]
    if len(armatures) != 1:
        raise SystemExit(f"BLOCKED: expected exactly one armature in human.glb, found {len(armatures)}")
    _sanitise_object_names(imported)
    log(f"imported {len(imported)} objects, armature '{armatures[0].name}' "
        f"with {len(armatures[0].data.bones)} bones")
    return armatures[0], [o for o in imported if o.type == "MESH"]


def _sanitise_object_names(objects: list[bpy.types.Object]) -> None:
    """Give every imported node a name three.js will not rewrite.

    three's GLTFLoader runs node names through PropertyBinding.sanitizeNodeName, which replaces
    ``. : / [ ]`` and whitespace with underscores. The MakeHuman export arrives as
    ``Human.rig_export_copy_export_copy``, so the manifest would promise a name the runtime never
    sees. Renaming at build time keeps manifest, GLB and runtime in exact agreement. Bone names,
    material names and skin weights are untouched — only object (node) names change.
    """
    used: set[str] = set()
    for o in objects:
        base = o.name
        for token in ("_export_copy", ".00", "_copy"):
            base = base.replace(token, "")
        base = base.replace(".", "_").replace(" ", "_").replace(":", "_")
        base = base.rstrip("_") or "Human_node"
        if o.type == "ARMATURE":
            base = "Human_rig"
        name = base
        n = 1
        while name in used:
            n += 1
            name = f"{base}_{n}"
        used.add(name)
        if name != o.name:
            o.name = name
        if o.data is not None:
            o.data.name = f"{name}_mesh" if o.type == "MESH" else f"{name}_data"


def find_body_mesh(meshes: list[bpy.types.Object]) -> bpy.types.Object:
    for o in meshes:
        for m in o.data.materials:
            if m and "body" in m.name.lower():
                return o
    raise SystemExit("BLOCKED: could not identify the skin/body mesh in the imported human")


def build_runtime_anchors(tube: bpy.types.Object, armature: bpy.types.Object,
                          collections: dict, deposit_local: Vector) -> dict:
    """Two exported marker nodes the runtime camera reads.

    ss20 excludes AUTHORING controls (IK targets, poles, guides) from the export, and those are all
    purged. These two are different: they are runtime data. Without them Three.js would have to
    re-derive the nozzle tip and the deposit point from bone maths duplicated out of this script,
    which is exactly the copied-constant problem ss10 warns about. They carry no geometry.
    """
    nozzle = bpy.data.objects.new("ANCHOR_nozzle", None)
    nozzle.empty_display_type = "PLAIN_AXES"
    nozzle.empty_display_size = 0.01
    collections["PRODUCT"].objects.link(nozzle)
    nozzle.parent = tube
    nozzle.matrix_parent_inverse = Matrix.Identity(4)
    nozzle.location = G.TUBE_NOZZLE_LOCAL
    nozzle["p2b_export"] = True
    nozzle["p2b_role"] = "runtime_anchor"

    deposit = bpy.data.objects.new("ANCHOR_deposit", None)
    deposit.empty_display_type = "PLAIN_AXES"
    deposit.empty_display_size = 0.01
    collections["CREAM"].objects.link(deposit)
    deposit.parent = armature
    deposit.parent_type = "BONE"
    deposit.parent_bone = f"lowerarm_{R.TREATED}"
    bone = armature.data.bones[f"lowerarm_{R.TREATED}"]
    # BONE parenting puts the origin at the bone TAIL, so shift back along the bone by its length
    deposit.matrix_parent_inverse = Matrix.Identity(4)
    deposit.location = Vector((deposit_local.x, deposit_local.y - bone.length, deposit_local.z))
    deposit["p2b_export"] = True
    deposit["p2b_role"] = "runtime_anchor"
    return {"nozzle": nozzle, "deposit": deposit}


def build_preview_rig(collections: dict) -> dict:
    """Preview-only camera and lights. ss20 forbids exporting either."""
    cam_data = bpy.data.cameras.new("PREVIEW_camera")
    cam_data.lens = 52.0
    cam = bpy.data.objects.new("PREVIEW_camera", cam_data)
    collections["PREVIEW_ONLY"].objects.link(cam)
    cam["p2b_export"] = False
    bpy.context.scene.camera = cam

    lights = []
    spec = [
        ("LIGHT_key", "AREA", 190.0, Vector((-0.75, -1.35, 1.85)), 1.1),
        ("LIGHT_fill", "AREA", 55.0, Vector((1.25, -1.15, 1.35)), 1.4),
        ("LIGHT_rake", "AREA", 130.0, Vector((-1.35, -0.35, 1.25)), 0.7),
        ("LIGHT_rim", "AREA", 90.0, Vector((0.55, 1.25, 1.85)), 0.9),
    ]
    for name, kind, power, loc, size in spec:
        ld = bpy.data.lights.new(name, type=kind)
        ld.energy = power
        ld.size = size
        obj = bpy.data.objects.new(name, ld)
        obj.location = loc
        collections["LIGHTS"].objects.link(obj)
        obj["p2b_export"] = False
        _aim(obj, Vector((0.05, -0.20, 1.20)))
        lights.append(obj)

    world = bpy.data.worlds.new("PREVIEW_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.085, 0.100, 0.115, 1.0)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.65
    bpy.context.scene.world = world
    return {"camera": cam, "lights": lights}


def _aim(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("-Z", "Y")


# ==============================================================================================
# measurement helpers
# ==============================================================================================

def palm_surface(body: bpy.types.Object, armature: bpy.types.Object, side: str,
                 frame: dict, band=(0.035, 0.100), across=(-0.055, 0.028)) -> dict:
    """Measure the PALMAR SKIN in the anatomical hand frame (ss9).

    Every distance the grip depends on -- how high the barrel must sit, how far the fingers have to
    travel, where the palm actually touches -- is read off the real vertices here rather than typed
    in. `band` is the wrist->knuckle span and `across` the index->little span, both in metres.
    """
    gi = body.vertex_groups[f"hand_{side}"].index
    to_frame = frame["to_frame"]
    pts = []
    for v in body.data.vertices:
        if not any(g.group == gi and g.weight > 0.5 for g in v.groups):
            continue
        p = to_frame(v.co)
        if band[0] <= p.y <= band[1] and across[0] <= p.x <= across[1] and p.z > 0.0:
            pts.append(p)
    if not pts:
        raise SystemExit("BLOCKED: could not measure the palm surface")
    heights = sorted(p.z for p in pts)
    return {
        "points": pts,
        "medianZ": heights[len(heights) // 2],
        "p75Z": heights[int(len(heights) * 0.75)],
        "maxZ": heights[-1],
        "count": len(pts),
    }


def palm_contact_local(body: bpy.types.Object, armature: bpy.types.Object, side: str,
                       frame: dict) -> Vector:
    """The point on the palm surface that should touch the skin, in hand-bone local space."""
    surf = palm_surface(body, armature, side, frame, band=(0.030, 0.095), across=(-0.032, 0.032))
    pts = sorted(surf["points"], key=lambda p: -p.z)
    top = pts[: max(3, len(pts) // 6)]
    mean = Vector((sum(p.x for p in top) / len(top),
                   sum(p.y for p in top) / len(top),
                   sum(p.z for p in top) / len(top)))
    return frame_to_hand_local(armature, side, frame, mean)


def frame_to_hand_local(armature: bpy.types.Object, side: str, frame: dict, p) -> Vector:
    """Anatomical-frame metres -> hand-bone local metres."""
    hand = armature.data.bones[f"hand_{side}"]
    world = (frame["origin"] + frame["radial"] * p[0]
             + frame["distal"] * p[1] + frame["palmar"] * p[2])
    return hand.matrix_local.inverted() @ world


def grip_seat(frame: dict, surf: dict) -> Vector:
    """Where the barrel's axis must sit, in ANATOMICAL frame metres, from the measured palm.

    The first Phase 2B build hard-coded this in the hand bone's own basis, which is 39.5 degrees off
    the palm. The consequence was geometric and is exactly what the completion review saw: the barrel
    hung 14-23 mm clear of the palm skin and tilted out of the palm plane, so the fingers could only
    reach *out* to it. A hand closed around something it is not touching is a cage.

    Seated properly the axis sits one half-thickness above the skin, less a couple of millimetres of
    soft-tissue compression, and the barrel is genuinely resting in the hand. `y` slides the barrel
    along the palm so the finger row wraps the body rather than the shoulder.
    """
    return Vector((
        0.000,                                              # barrel end reaches the thumb's own side
        0.078,                                              # just distal of the MCP row
        surf["p75Z"] + G.TUBE["radius_z"] - 0.0025,         # skin + half-thickness - compression
    ))


def grip_matrix(armature: bpy.types.Object, side: str, frame: dict, seat: Vector,
                tilt: float = 0.0) -> Matrix:
    """Tube pose expressed in hand-bone local space, built from the ANATOMICAL frame.

    A flat oval tube is held with its FLAT face against the palm: the thin axis (which is also the
    label normal) runs along the palmar normal, the wide axis lies in the palm plane along the hand's
    length, and the barrel crosses the palm so the fingers close around its cross-section. The tail
    sits in the fist and the labelled upper barrel, shoulder and nozzle project past the index side,
    which is how a tube is actually held to dispense and what keeps the brand readable (ss12).

    Two things about this were wrong in the first Phase 2B build and are fixed here.

    The basis is now built from the MEASURED anatomical frame instead of the hand bone's own axes,
    which are 39.5 degrees off the palm; that tilt is what left the barrel hanging clear of the palm
    skin with the fingers reaching out to it.

    The barrel is also long enough for the thumb to have something to press on. Held across a palm,
    the thumb reaches the tube from ITS OWN end -- it does not swing across the palm to meet the
    fingers. Measured on the rest skeleton, every thumb pose whose pad reaches a barrel short enough
    to end mid-palm puts the thumb's IP joint 6-11 mm INSIDE the barrel, because the crossing arc
    passes through the volume the tube occupies. Sizing the body to the digits' actual 108 mm contact
    span (`p2b_geometry.TUBE`) removes the crossing entirely.

    `tilt` swings the barrel within the palm plane, from straight across the palm towards the
    thumb-index web. Nobody holds a tube exactly across their palm; the barrel lies diagonally, and
    on this rig the angle is not cosmetic. The thumb's flexion plane runs nearly parallel to a barrel
    laid straight across, so curling the thumb sweeps its pad ALONGSIDE the tube instead of onto it,
    and the pad stalls ~23 mm out however the joint angles are tuned. Rotating the barrel into the
    thumb's plane is what lets the pad actually land, so the angle is searched with the seating
    rather than assumed.
    """
    hand_inv3 = armature.data.bones[f"hand_{side}"].matrix_local.to_3x3().inverted()
    c, s = math.cos(tilt), math.sin(tilt)
    axis = frame["radial"] * c + frame["distal"] * s          # tail -> nozzle, in the palm plane
    wide = -(frame["distal"] * c - frame["radial"] * s)       # wide oval axis, also in the palm
    m = Matrix.Identity(3)
    m.col[0] = hand_inv3 @ wide                  # tube +X (wide oval axis) lies along the palm
    m.col[1] = hand_inv3 @ axis                  # tube +Y (tail -> nozzle) exits towards the web
    m.col[2] = hand_inv3 @ frame["palmar"]       # tube +Z (label face)     faces the palm
    return Matrix.Translation(frame_to_hand_local(armature, side, frame, seat)) @ m.to_4x4()


def finger_flesh(body: bpy.types.Object, armature: bpy.types.Object, side: str) -> dict:
    """Soft-tissue radius around each phalanx, in metres, measured from the skinned vertices.

    Without this the grip solve is wrong in a way that is invisible to it. `rn` is measured at the
    BONE, so driving a fingertip to rn = 1.0 puts the bone exactly on the barrel surface and
    therefore buries 5-8 mm of finger pad inside it. The completion review saw the result as pads
    sunk into the tube and the tube showing through the fingers.

    Two numbers per bone: `pad` over the distal half (what actually touches) and `mid` over the whole
    bone (what has to clear the surface when the phalanx lies along it).
    """
    out = {}
    for name in R.FINGERS + ("thumb",):
        for seg in ("01", "02", "03"):
            bone_name = f"{name}_{seg}_{side}"
            gi = body.vertex_groups[bone_name].index
            bone = armature.data.bones[bone_name]
            head = Vector(bone.head_local)
            axis = (Vector(bone.tail_local) - head).normalized()
            length = (Vector(bone.tail_local) - head).length
            radii, pad = [], []
            for v in body.data.vertices:
                if not any(g.group == gi and g.weight > 0.5 for g in v.groups):
                    continue
                d = Vector(v.co) - head
                t = d.dot(axis)
                r = (d - axis * t).length
                radii.append(r)
                if 0.45 * length <= t <= 0.95 * length:
                    pad.append(r)
            if not radii:
                continue
            out[bone_name] = {
                "mid": sum(radii) / len(radii),
                "pad": (sum(pad) / len(pad)) if pad else (sum(radii) / len(radii)),
            }
    return out


#: How much the pad is allowed to compress into the barrel before it counts as penetration (metres).
#: Fingers holding a squeezable tube really do flatten; 2 mm reads as grip, 8 mm reads as a bug.
PAD_COMPRESSION = 0.0020
PENETRATION_TOLERANCE = 0.0030


def solve_grip_at(armature: bpy.types.Object, side: str, axes: dict, tube: bpy.types.Object,
                  flesh: dict, target_rn: float = 1.04) -> dict:
    """Measure, per finger, the flexion that puts the pad ON the tube surface.

    ss12 forbids both a circular finger cage and gross tube penetration. Rather than tuning magic
    angles until renders look acceptable, this bisects each finger's total flexion against the real
    exported geometry: `rn` is the fingertip's distance from the tube axis expressed in units of the
    local cross-section radius, so rn = 1 is exactly on the surface. Each finger converges to its own
    angle because each has its own length and its own position along the barrel.
    """
    depsgraph = bpy.context.evaluated_depsgraph_get()

    def sample(bone_names) -> list[tuple[float, float]]:
        """rn (distance from the tube axis in cross-section radii) at each named bone tail."""
        depsgraph.update()
        bpy.context.view_layer.update()
        ao = armature.evaluated_get(depsgraph)
        inv = tube.evaluated_get(depsgraph).matrix_world.inverted()
        out = []
        for bone_name in bone_names:
            local = inv @ (ao.matrix_world @ ao.pose.bones[bone_name].tail)
            rx, rz = G.tube_radius_at(local.y)
            rn = math.hypot(local.x / rx, local.z / rz)
            # Clearance in METRES from the barrel surface along the same radial direction. rn alone
            # cannot be compared against a flesh thickness -- it is a ratio, and the barrel's radius
            # changes along its length -- so every acceptance test below is written in millimetres.
            radial = math.hypot(local.x, local.z)
            surface = radial / rn if rn > 1e-9 else min(rx, rz)
            out.append((rn, local.y, radial - surface))
        return out

    def rn_of(bone_name: str) -> tuple[float, float, float]:
        return sample([bone_name])[0]

    solution = {"fingers": {}, "thumb": {}, "contact": {}}
    totals = {n: 0.0 for n in R.FINGERS}

    # A SCAN, not a bisection. rn is not monotonic in flexion: a finger that cannot reach the barrel
    # passes its closest approach and then curls away again, and a bisection would happily clench it
    # to the joint limit. Scanning finds the true closest approach and reveals when a finger simply
    # does not reach, which is information the build report should carry rather than hide.
    SAMPLES = 40
    penetration = 0.0
    unreachable = []
    for name in R.FINGERS:
        joints = [f"{name}_01_{side}", f"{name}_02_{side}", f"{name}_03_{side}"]
        # What "touching" means for THIS finger, in metres, from its own measured soft tissue.
        want_tip = flesh[f"{name}_03_{side}"]["pad"] - PAD_COMPRESSION
        want_dip = flesh[f"{name}_02_{side}"]["mid"] - PAD_COMPRESSION
        want_pip = flesh[f"{name}_01_{side}"]["mid"] - PAD_COMPRESSION
        best, best_err, best_gap, best_pen = 0.0, float("inf"), float("inf"), 0.0
        for i in range(SAMPLES + 1):
            angle = 3.10 * i / SAMPLES
            totals[name] = angle
            R.set_finger_totals(armature, side, axes, totals, spread_scale=0.35)
            s = sample(joints)
            pip, dip, tip = (v[2] for v in s)
            # Contact at the pad, the MIDDLE PHALANX lying along the barrel, and no phalanx driven
            # through it. The middle term is the one that matters for ss10: scoring the fingertip
            # alone is satisfied by a straight finger poking the surface, which is precisely the cage
            # the completion review rejected. Requiring the DIP to stay near the barrel too forces
            # the finger to fold over it instead of bridging it.
            pen = (max(0.0, want_tip - PENETRATION_TOLERANCE - tip)
                   + max(0.0, want_dip - PENETRATION_TOLERANCE - dip)
                   + max(0.0, want_pip - PENETRATION_TOLERANCE - pip))
            err = (abs(tip - want_tip)
                   + 0.75 * max(0.0, dip - want_dip - 0.006)
                   + 0.30 * max(0.0, pip - want_pip - 0.016)
                   + 6.0 * pen
                   + angle * 1e-5)
            if err < best_err:
                best, best_err, best_gap, best_pen = angle, err, tip, pen
        if abs(best_gap - want_tip) > 0.008:
            unreachable.append(name)
        penetration += best_pen
        totals[name] = best
        solution["fingers"][name] = best
    # A finger too short to reach the barrel must still look like part of the same hand: give it the
    # curl of its reachable neighbours, slightly relaxed, which is what a little finger does when it
    # falls off the end of a narrow tube.
    reachable = [v for k, v in solution["fingers"].items() if k not in unreachable]
    if reachable and unreachable:
        cascade = 0.86 * (sum(reachable) / len(reachable))
        for name in unreachable:
            solution["fingers"][name] = cascade
            totals[name] = cascade
    solution["penetration"] = penetration
    solution["unreachable"] = unreachable

    # thumb: opposition brings the pad to the far side of the barrel from the finger pads
    R.set_finger_totals(armature, side, axes, totals, spread_scale=0.35)
    best_oppose, best_flex, best_err = 0.0, 0.0, float("inf")
    want_thumb = flesh[f"thumb_03_{side}"]["pad"] - PAD_COMPRESSION
    want_thumb_ip = flesh[f"thumb_02_{side}"]["mid"] - PAD_COMPRESSION
    # The thumb belongs on the RADIAL half of the barrel, not merely somewhere on it. Allowing the
    # whole body lets the solver park the thumb at the ulnar tail, alongside the little finger, which
    # scores well and looks absurd -- a thumb on the far side of a tube held across the palm has, by
    # definition, crossed the palm and gone through the tube to get there.
    lo_y, hi_y = -0.010, G.TUBE["body_top"]
    envelope = []
    # A wider sweep than the first build's, because opposition is now three coupled motions at the
    # CMC (swing, pronation, flexion) rather than one, so the same pad position is reached at a
    # different pair of values. A sweep that is too narrow silently returns its own boundary, which
    # is what left the thumb 3.7 radii off the barrel with zero flexion.
    for oppose in [i * 0.05 for i in range(0, 30)]:
        for flex in [i * 0.10 for i in range(0, 27)]:
            R.set_finger_totals(armature, side, axes, totals, spread_scale=0.35,
                                thumb_oppose=oppose, thumb_flex=flex)
            _rn, y, gap = rn_of(f"thumb_03_{side}")
            _rn2, _y2, gap2 = rn_of(f"thumb_02_{side}")
            # the thumb must be on the BARREL, not floating past either end
            axial_penalty = max(0.0, lo_y - y) + max(0.0, y - hi_y)
            err = (abs(gap - want_thumb)
                   + 0.45 * max(0.0, gap2 - want_thumb_ip - 0.008)
                   + 8.0 * max(0.0, want_thumb - PENETRATION_TOLERANCE - gap)
                   + 8.0 * max(0.0, want_thumb_ip - PENETRATION_TOLERANCE - gap2)
                   + axial_penalty * 12.0)
            envelope.append((err, gap, gap2, oppose, flex, y))
            if err < best_err:
                best_oppose, best_flex, best_err = oppose, flex, err
    # Third pass: curl the IP alone until the PAD reaches the barrel. The two-parameter sweep above
    # places the thumb's approach; this places its contact.
    best_tip, tip_err = 0.0, float("inf")
    for i in range(29):
        tip = i * 0.05
        R.set_finger_totals(armature, side, axes, totals, spread_scale=0.35,
                            thumb_oppose=best_oppose, thumb_flex=best_flex, thumb_tip=tip)
        _rn, y, gap = rn_of(f"thumb_03_{side}")
        err = (abs(gap - want_thumb)
               + 8.0 * max(0.0, want_thumb - PENETRATION_TOLERANCE - gap)
               + 12.0 * (max(0.0, lo_y - y) + max(0.0, y - hi_y)))
        if err < tip_err:
            best_tip, tip_err = tip, err
    solution["thumb"] = {"oppose": best_oppose, "flex": best_flex, "tip": best_tip}
    solution["thumbError"] = tip_err
    # What the thumb could actually reach, regardless of the axial window. If the closest approach
    # over the whole sweep is still far from the barrel, the problem is the tube's placement or its
    # dimensions -- not the thumb's angles -- and the report has to say which (ss9).
    envelope.sort(key=lambda e: e[0])
    solution["thumbEnvelope"] = [
        {"errMm": round(e * 1000, 1), "padGapMm": round(g * 1000, 1),
         "ipGapMm": round(g2 * 1000, 1), "opposeDeg": round(math.degrees(o), 1),
         "flexDeg": round(math.degrees(f), 1), "axialMm": round(y * 1000, 1)}
        for e, g, g2, o, f, y in envelope[:6]]

    # record the achieved contact so the build report carries evidence, not a claim
    R.set_finger_totals(armature, side, axes, totals, spread_scale=0.35,
                        thumb_oppose=best_oppose, thumb_flex=best_flex, thumb_tip=best_tip)
    wrap = 0.0
    for name in R.FINGERS + ("thumb",):
        rn, y, gap = rn_of(f"{name}_03_{side}")
        want = flesh[f"{name}_03_{side}"]["pad"] - PAD_COMPRESSION
        entry = {"rn": round(rn, 4), "axialMm": round(y * 1000, 1),
                 "padGapMm": round(gap * 1000, 2), "wantGapMm": round(want * 1000, 2)}
        if name != "thumb":
            # The whole finger, not just the pad: how far the PIP and DIP joints sit from the barrel
            # surface, measured against how far their OWN soft tissue says they should. A cage scores
            # badly here even when every fingertip scores perfectly, so this is the number that has
            # to be reported alongside the contact (ss10).
            _p, _py, pip_gap = rn_of(f"{name}_01_{side}")
            _d, _dy, dip_gap = rn_of(f"{name}_02_{side}")
            want_dip = flesh[f"{name}_02_{side}"]["mid"] - PAD_COMPRESSION
            want_pip = flesh[f"{name}_01_{side}"]["mid"] - PAD_COMPRESSION
            entry["pipGapMm"] = round(pip_gap * 1000, 2)
            entry["dipGapMm"] = round(dip_gap * 1000, 2)
            entry["dipWantMm"] = round(want_dip * 1000, 2)
            wrap += max(0.0, dip_gap - want_dip - 0.006) + 0.4 * max(0.0, pip_gap - want_pip - 0.016)
        solution["contact"][name] = entry
    solution["wrapError"] = wrap
    return solution


def search_grip(armature: bpy.types.Object, side: str, axes: dict, tube: bpy.types.Object,
                tray_tube: Matrix, hand_ctrl, frame: dict, seat: Vector,
                flesh: dict, surf: dict) -> tuple[dict, Matrix, list]:
    """Search the tube's seating in the palm, then solve the fingers against it.

    Where the barrel sits decides whether the fingers can reach it at all and whether the proximal
    phalanges pass through it, and those two pull in opposite directions: seat it too far forward and
    the short fingers miss, too far back and the knuckles are inside the barrel. Rather than picking
    a number and hoping, this evaluates a small grid against the real geometry and keeps the seating
    with the best measured contact.

    The grid is now centred on the MEASURED palm seat and searched in the anatomical frame, so a
    displacement of "4 mm palmward" moves the barrel 4 mm away from the palm skin rather than 4 mm
    along an axis that happens to be 39.5 degrees off it.
    """
    trials = []
    best = None
    for tilt in (0.0, math.radians(18.0), math.radians(34.0), math.radians(50.0)):
      for dx in (-0.028, -0.014, 0.0):
        for dy in (-0.014, 0.0, 0.014, 0.028):
            for dz in (-0.004, 0.0, 0.004, 0.008):
                offset = seat + Vector((dx, dy, dz))
                grip = grip_matrix(armature, side, frame, offset, tilt)
                hand_ctrl.matrix_world = tray_tube @ grip.inverted()
                bpy.context.view_layer.update()
                sol = solve_grip_at(armature, side, axes, tube, flesh)
                gaps = [v["padGapMm"] - v["wantGapMm"] for k, v in sol["contact"].items()
                        if k != "thumb"]
                contact_err = sum(abs(g) for g in gaps) / len(gaps) / 1000.0
                # THE THUMB IS PART OF THE GRIP, not an afterthought scored separately. The first
                # version of this search averaged the four fingers only, so it happily chose a
                # seating the fingers loved and the thumb could not reach at all -- and then the
                # thumb solve, given an impossible target, returned its least-bad miss. A seating
                # that strands a digit is not a good seating.
                tv = sol["contact"]["thumb"]
                thumb_err = abs(tv["padGapMm"] - tv["wantGapMm"]) / 1000.0
                # The barrel must REST in the palm. Without this the search happily lifts the tube
                # out of the hand, because fingers wrap a floating cylinder more easily than one
                # pressed into the palm -- and a tube held by fingertips alone is the cage again.
                palm_gap = (offset.z - G.TUBE["radius_z"]) - surf["p75Z"]
                palm_penalty = abs(palm_gap) if palm_gap > 0 else 2.0 * abs(palm_gap)
                score = (contact_err + 0.8 * thumb_err
                         + 3.0 * sol["penetration"] + 0.02 * len(sol["unreachable"])
                         + 1.2 * sol["wrapError"] + 0.9 * palm_penalty)
                trials.append({"offset": [round(c, 4) for c in offset],
                               "tiltDeg": round(math.degrees(tilt), 1), "score": round(score, 5),
                               "contactErrMm": round(contact_err * 1000, 2),
                               "thumbErrMm": round(thumb_err * 1000, 2),
                               "wrapErrorMm": round(sol["wrapError"] * 1000, 2),
                               "palmGapMm": round(palm_gap * 1000, 2),
                               "penetrationMm": round(sol["penetration"] * 1000, 2),
                               "unreachable": sol["unreachable"]})
                if best is None or score < best[0]:
                    best = (score, offset, grip, sol, tilt)
    _score, offset, grip, sol, tilt = best
    hand_ctrl.matrix_world = tray_tube @ grip.inverted()
    bpy.context.view_layer.update()
    sol = solve_grip_at(armature, side, axes, tube, flesh)
    sol["offset"] = [round(c, 4) for c in offset]
    sol["tiltDeg"] = round(math.degrees(tilt), 1)
    sol["palmGapMm"] = round(((offset.z - G.TUBE["radius_z"]) - surf["p75Z"]) * 1000, 2)
    sol["seatMeasuredMm"] = [round(c * 1000, 2) for c in seat]
    sol["trials"] = sorted(trials, key=lambda t: t["score"])[:6]
    return sol, grip, trials


def _lerp_pose(a: Matrix, b: Matrix, t: float) -> Matrix:
    """Blend two hand poses: linear on position, slerp on rotation, plus a small outward bow so the
    arm swings away rather than sliding along a straight chord."""
    pos = a.translation.lerp(b.translation, t)
    bow = (b.translation - a.translation).length * 0.18
    pos += Vector((0.0, -1.0, 0.0)) * bow * math.sin(math.pi * t)
    rot = a.to_quaternion().slerp(b.to_quaternion(), t)
    return Matrix.Translation(pos) @ rot.to_matrix().to_4x4()


def aim_tube(origin: Vector, target: Vector, label_toward: Vector = Vector((0.0, -1.0, 0.0))) -> Matrix:
    """Orient the tube so the nozzle points at `target` and the label faces `label_toward`.

    Building the basis from intent beats composing Euler rotations: the nozzle is guaranteed to be
    aimed at the deposit point from wherever the tube happens to be, and the brand keeps facing the
    camera instead of rolling away as the arm moves.
    """
    y = (target - origin).normalized()
    z = Vector(label_toward)
    z = (z - y * y.dot(z))
    if z.length < 1e-4:
        z = Vector((0.0, 0.0, 1.0)) - y * y.dot(Vector((0.0, 0.0, 1.0)))
    z.normalize()
    x = y.cross(z)
    m = Matrix.Identity(3)
    m.col[0], m.col[1], m.col[2] = x, y, z
    return Matrix.Translation(origin) @ m.to_4x4()


def evaluated_bone_matrix(armature: bpy.types.Object, bone: str) -> Matrix:
    dg = bpy.context.evaluated_depsgraph_get()
    ao = armature.evaluated_get(dg)
    return ao.matrix_world @ ao.pose.bones[bone].matrix


def forearm_axes_at(armature: bpy.types.Object, outward_local: Vector) -> dict:
    m = evaluated_bone_matrix(armature, f"lowerarm_{R.TREATED}")
    head = m.translation.copy()
    rot = m.to_3x3()
    axis = Vector(rot.col[1]).normalized()
    outward = (rot @ outward_local).normalized()
    up = axis.cross(outward).normalized()
    return {"head": head, "axis": axis, "outward": outward, "up": up}


# ==============================================================================================
# animation authoring
# ==============================================================================================

def author_animation(armature: bpy.types.Object, body: bpy.types.Object, tube: bpy.types.Object,
                     controls: dict, film_info: dict) -> dict:
    """Pose-to-pose keys for both arms, the torso and every finger, plus the tube's parenting."""
    scene = bpy.context.scene
    E = R.EVENTS
    frame_r = R.hand_frame(armature, R.APPLYING)
    frame_l = R.hand_frame(armature, R.TREATED)
    axes_r = R.finger_axes(armature, R.APPLYING, frame_r)
    axes_l = R.finger_axes(armature, R.TREATED, frame_l)
    palm_local = palm_contact_local(body, armature, R.APPLYING, frame_r)
    log(f"palm contact point (hand-local): {[round(c, 4) for c in palm_local]}")

    surf_r = palm_surface(body, armature, R.APPLYING, frame_r)
    flesh_r = finger_flesh(body, armature, R.APPLYING)
    seat = grip_seat(frame_r, surf_r)
    log("finger soft tissue (pad radius, mm): " + ", ".join(
        f"{n}={flesh_r[f'{n}_03_{R.APPLYING}']['pad']*1000:.1f}"
        for n in R.FINGERS + ("thumb",)))
    log(f"palm surface ({surf_r['count']} verts): median {surf_r['medianZ']*1000:.1f} mm  "
        f"p75 {surf_r['p75Z']*1000:.1f} mm  max {surf_r['maxZ']*1000:.1f} mm  "
        f"-> barrel axis seated at {seat.z*1000:.1f} mm")

    rest_inv = armature.data.bones[f"lowerarm_{R.TREATED}"].matrix_local.to_3x3().inverted()
    outward_local = (rest_inv @ film_info["side"]).normalized()

    grip = grip_matrix(armature, R.APPLYING, frame_r, seat)
    grip_inv = grip.inverted()
    _ = grip_inv

    # ---- tube tray pose: standing on its crimp, label toward the viewer (-Y world) --------------
    # +90 deg about X maps tube +Y (tail -> nozzle) to world +Z, so it stands on its crimp, and tube
    # +Z (the label face) to world -Y, which is the direction the figure and the camera face.
    tray_tube = (Matrix.Translation(TRAY_TOP + Vector((0.0, 0.0, -G.TUBE["crimp_bottom"])))
                 @ Matrix.Rotation(math.pi / 2, 4, "X")
                 @ Matrix.Rotation(math.radians(14.0), 4, "Y"))

    def hand_from_tube(tube_matrix: Matrix) -> Matrix:
        return tube_matrix @ grip_inv

    # Park the tube on the tray and put the hand on it, then MEASURE the grip against the real
    # geometry before any keyframe is written.
    tube.matrix_world = tray_tube
    grip_solution, grip, _trials = search_grip(armature, R.APPLYING, axes_r, tube, tray_tube,
                                               controls[R.APPLYING]["hand"], frame_r, seat,
                                               flesh_r, surf_r)
    grip_inv = grip.inverted()
    log(f"grip seating: offset={grip_solution['offset']} tilt={grip_solution['tiltDeg']}deg  "
        f"palmGap={grip_solution['palmGapMm']:+.1f}mm  "
        f"penetration={grip_solution['penetration']*1000:.2f}mm  "
        f"wrapError={grip_solution['wrapError']*1000:.2f}mm  "
        f"unreachable={grip_solution['unreachable']}")
    log("pad contact (achieved vs wanted, mm from the barrel surface): " + ", ".join(
        f"{k}={v['padGapMm']:+.1f}/{v['wantGapMm']:.1f}@{v['axialMm']:+.0f}mm"
        for k, v in grip_solution["contact"].items()))
    log("finger wrap (pip/dip gap vs dip want, mm): " + ", ".join(
        f"{k}={v['pipGapMm']:+.1f}/{v['dipGapMm']:+.1f}/{v['dipWantMm']:.1f}"
        for k, v in grip_solution["contact"].items() if "pipGapMm" in v))
    log(f"  finger totals (deg): " + ", ".join(
        f"{k}={math.degrees(v):.0f}" for k, v in grip_solution["fingers"].items())
        + f"  thumb oppose={math.degrees(grip_solution['thumb']['oppose']):.0f}"
        + f" flex={math.degrees(grip_solution['thumb']['flex']):.0f}")

    # ---------------------------------------------------------------------------------------
    # treated (left) arm: presentation pose, authored first so the applying hand can measure it
    # ---------------------------------------------------------------------------------------
    shoulder_l = R.rest_head(armature, f"upperarm_{R.TREATED}")
    rest_wrist_l = R.rest_head(armature, f"hand_{R.TREATED}")
    rest_basis_l = R.rest_basis(armature, f"hand_{R.TREATED}")
    rest_wrist_r = R.rest_head(armature, f"hand_{R.APPLYING}")
    rest_basis_r = R.rest_basis(armature, f"hand_{R.APPLYING}")

    upper_len = armature.data.bones[f"upperarm_{R.TREATED}"].length
    fore_len = armature.data.bones[f"lowerarm_{R.TREATED}"].length
    elbow_present = shoulder_l + Vector((0.150, -0.450, -0.880)).normalized() * upper_len
    wrist_present = elbow_present + Vector((-0.620, -0.720, 0.310)).normalized() * fore_len
    basis_present = R.basis_matrix(finger_dir=(wrist_present - elbow_present),
                                   palm_normal=Vector((0.35, 0.30, -0.89)))

    # A genuinely relaxed neutral. The rig ships in an A-pose with the arms out at ~45 deg; leaving
    # the IK targets at the rest wrists reproduces exactly that, which ss11 rejects. These bring the
    # hands down beside the hips with a small deliberate left/right asymmetry.
    neutral_l = (Matrix.Translation(Vector((0.207, -0.088, 0.941)))
                 @ R.basis_matrix(finger_dir=Vector((0.05, -0.19, -0.98)),
                                  palm_normal=Vector((-0.95, -0.28, 0.0))).to_4x4())
    neutral_r = (Matrix.Translation(Vector((-0.198, -0.074, 0.928)))
                 @ R.basis_matrix(finger_dir=Vector((-0.04, -0.23, -0.97)),
                                  palm_normal=Vector((0.94, -0.30, 0.02))).to_4x4())
    present_l = Matrix.Translation(wrist_present) @ basis_present.to_4x4()

    left_keys = [
        (E["neutral"], neutral_l, 0.30),
        (E["productEstablishStart"], neutral_l.copy(), 0.32),
        (E["gripPreparation"] + 8, present_l, 0.42),
        (E["dispensePreparation"], present_l.copy(), 0.44),
        (E["skinContact"], present_l.copy(), 0.46),
        (E["strokeTwo"], present_l.copy(), 0.45),
        (E["heroStart"], present_l.copy(), 0.40),
        (E["sequenceEnd"], present_l.copy(), 0.38),
    ]
    for frame, matrix, relax in left_keys:
        R.key_control(controls[R.TREATED]["hand"], frame, matrix)
        R.relaxed_hand(armature, R.TREATED, axes_l, relax)
        R.key_pose_bones(armature, R.finger_bone_names(R.TREATED), frame)

    # torso + clavicles: the presentation is a whole-body action, not an arm action
    torso_keys = [
        (E["neutral"], 0.010, -0.020, 0.02, 0.0, 0.0, 0.0),
        (E["gripPreparation"], 0.075, -0.055, 0.16, 0.10, -0.06, 0.05),
        (E["dispensePreparation"], 0.055, -0.075, 0.20, 0.14, 0.10, 0.08),
        (E["creamContact"], 0.062, -0.080, 0.23, 0.15, 0.13, 0.10),
        (E["productRetreatEnd"], 0.050, -0.060, 0.18, 0.13, 0.02, 0.05),
        (E["skinContact"], 0.058, -0.078, 0.22, 0.15, 0.16, 0.11),
        (E["strokeTwo"], 0.052, -0.070, 0.20, 0.14, 0.14, 0.10),
        (E["heroStart"], 0.040, -0.052, 0.15, 0.12, 0.04, 0.06),
        (E["sequenceEnd"], 0.034, -0.045, 0.12, 0.11, 0.02, 0.05),
    ]
    for frame, lean, twist, look, lift_l, lift_r, fwd in torso_keys:
        R.set_torso(armature, lean=lean, twist=twist, look_down=look,
                    breathe=0.006 * math.sin(frame * 0.11))
        R.set_clavicles(armature, lift_l=lift_l, lift_r=lift_r, forward_l=fwd, forward_r=fwd * 0.8)
        R.key_pose_bones(armature, list(R.SPINE_CHAIN) + ["clavicle_l", "clavicle_r"], frame)

    R.smooth_all_fcurves(armature.animation_data.action)

    # ---------------------------------------------------------------------------------------
    # applying (right) arm — targets measured off the evaluated treated forearm
    # ---------------------------------------------------------------------------------------
    scene.frame_set(E["skinContact"])
    fa = forearm_axes_at(armature, outward_local)
    radius = film_info["radius_mean"]
    a_lo, a_hi = film_info["axial_min"], film_info["axial_max"]
    deposit_axial = a_lo + 0.30 * (a_hi - a_lo)

    profile = film_info["radius_profile"]

    def surface_point(axial: float, lift: float = 0.0) -> Vector:
        """A point on the ACTUAL forearm surface at `axial`, `lift` metres proud of it."""
        return (fa["head"] + fa["axis"] * axial
                + fa["outward"] * (G.radius_at(profile, axial) + lift))

    deposit_point = surface_point(deposit_axial)
    log(f"deposit point (world): {[round(c, 4) for c in deposit_point]}  "
        f"forearm radius {G.radius_at(profile, deposit_axial):.4f} (mean {radius:.4f}, "
        f"profile {profile[0][1]:.4f}..{profile[-1][1]:.4f})")

    # -- product poses -----------------------------------------------------------------------
    # Nozzle aimed at the deposit point from ~95 mm out along the arm's outward normal, offset up
    # the forearm so the hand does not sit on top of the landing site.
    dispense_origin = deposit_point + fa["outward"] * 0.095 + fa["axis"] * 0.055 + Vector((0.0, -0.020, 0.020))
    dispense_tube = aim_tube(dispense_origin, deposit_point)
    # Presentation beat: held up, label to camera, nozzle still pointing broadly down-arm.
    raise_origin = deposit_point + fa["outward"] * 0.20 + fa["axis"] * 0.10 + Vector((-0.03, -0.06, 0.085))
    raise_tube = aim_tube(raise_origin, deposit_point + fa["axis"] * 0.02)

    def hand_key(frame: int, matrix: Matrix, close: float, squeeze: float = 0.0,
                 thumb: float | None = None):
        R.key_control(controls[R.APPLYING]["hand"], frame, matrix)
        R.set_finger_pose(armature, R.APPLYING, axes_r, close, squeeze,
                          grip=grip_solution, thumb_oppose=thumb)
        R.key_pose_bones(armature, R.finger_bone_names(R.APPLYING), frame)

    def relaxed_key(frame: int, matrix: Matrix, relax: float):
        R.key_control(controls[R.APPLYING]["hand"], frame, matrix)
        R.relaxed_hand(armature, R.APPLYING, axes_r, relax)
        R.key_pose_bones(armature, R.finger_bone_names(R.APPLYING), frame)

    tray_hand = hand_from_tube(tray_tube)
    approach_hand = Matrix.Translation(tray_hand.translation + Vector((0.02, -0.075, 0.085))) \
        @ tray_hand.to_3x3().to_4x4()

    relaxed_key(E["neutral"], neutral_r, 0.34)
    relaxed_key(E["productEstablishStart"], approach_hand, 0.20)
    hand_key(E["gripPreparation"], tray_hand, 0.22, thumb=0.35)          # pre-shaped, not yet closed
    hand_key(E["productGripEstablished"], tray_hand, 1.0)                # settled grip on the tray

    # lift, aim, dispense, relax, return
    hand_key(E["dispensePreparation"], hand_from_tube(raise_tube), 1.0)
    hand_key(E["dispenseStart"], hand_from_tube(dispense_tube), 1.0, squeeze=0.15)
    hand_key(E["creamContact"], hand_from_tube(dispense_tube), 1.0, squeeze=0.95)
    hand_key(E["dispenseEnd"], hand_from_tube(dispense_tube), 1.0, squeeze=0.25)
    hand_key(E["productRetreatStart"], hand_from_tube(raise_tube), 1.0, squeeze=0.05)
    hand_key(E["productRetreatEnd"], tray_hand, 1.0)
    hand_key(E["productRetreatEnd"] + 6, tray_hand, 0.24, thumb=0.30)    # let go, fingers open

    # -- application: palm poses derived from the posed forearm --------------------------------
    def palm_pose(axial: float, press: float, lift: float, roll: float = 0.0) -> Matrix:
        contact = surface_point(axial, lift - press)
        basis = R.basis_matrix(finger_dir=fa["up"] * math.cos(roll) - fa["axis"] * math.sin(roll),
                               palm_normal=-fa["outward"])
        wrist = contact - basis @ palm_local
        return Matrix.Translation(wrist) @ basis.to_4x4()

    stroke_lo = a_lo + 0.16 * (a_hi - a_lo)
    stroke_hi = a_lo + 0.82 * (a_hi - a_lo)
    application = [
        (E["handApproach"], palm_pose(deposit_axial, 0.0, 0.085, 0.10), 0.28),
        # `press` is now barely more than skin contact. The compression read comes from the
        # SKIN_INDENT morphs, which recede 7 mm under the palm; driving the palm itself several
        # millimetres into the arm only guaranteed a hard intersection wherever the hand sat between
        # the three discrete dent centres.
        (E["skinContact"], palm_pose(deposit_axial, 0.0010, 0.0, 0.04), 0.20),
        (E["spreadStart"], palm_pose(deposit_axial + 0.010, 0.0014, 0.0, 0.02), 0.18),
        (E["strokeOne"], palm_pose(stroke_hi, 0.0015, 0.0, -0.06), 0.16),
        (E["strokeOne"] + 18, palm_pose(stroke_lo, 0.0014, 0.0, 0.06), 0.17),
        (E["strokeTwo"], palm_pose(stroke_hi - 0.012, 0.0015, 0.0, -0.05), 0.16),
        (E["releaseStart"], palm_pose(deposit_axial + 0.020, 0.0006, 0.0, 0.03), 0.19),
        (E["releaseEnd"], palm_pose(deposit_axial + 0.010, 0.0, 0.075, 0.12), 0.30),
        # The arm returns to rest over 30 frames, not 5. An earlier version dropped it from the
        # forearm to the hip between releaseEnd and heroStart, which the frame-difference analysis
        # picked up as a sustained 7x spike — a sudden speed change of exactly the kind ss11 rejects.
        (E["heroStart"] + 8, _lerp_pose(palm_pose(deposit_axial + 0.010, 0.0, 0.075, 0.12),
                                        Matrix.Translation(rest_wrist_r + Vector((0.02, -0.06, -0.01)))
                                        @ rest_basis_r.to_4x4(), 0.45), 0.32),
        (E["sequenceEnd"], Matrix.Translation(rest_wrist_r + Vector((0.02, -0.06, -0.01))) @ rest_basis_r.to_4x4(), 0.33),
    ]
    for frame, matrix, relax in application:
        relaxed_key(frame, matrix, relax)

    R.smooth_all_fcurves(armature.animation_data.action)

    # MEASURE the contact rather than assume it. For every application key, evaluate the posed hand
    # and the posed forearm and report how far the palm sits from the skin surface: positive is a
    # hover, negative is penetration. A mean forearm radius used to put the palm ~10 mm inside the
    # arm near the elbow and ~10 mm off it near the wrist, which read on screen as the hand passing
    # through the forearm; this is the check that catches that class of error.
    contact_report = []
    hand_bone = f"hand_{R.APPLYING}"
    for frame, _matrix, _relax in application:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        hm = evaluated_bone_matrix(armature, hand_bone)
        palm_world = hm @ palm_local
        fa_now = forearm_axes_at(armature, outward_local)
        d = palm_world - fa_now["head"]
        t = d.dot(fa_now["axis"])
        radial = (d - fa_now["axis"] * t).length
        gap_mm = (radial - G.radius_at(profile, t)) * 1000.0
        contact_report.append({"frame": frame, "axialMm": round(t * 1000, 1),
                               "gapMm": round(gap_mm, 2)})
    worst = min(c["gapMm"] for c in contact_report)
    best = max(c["gapMm"] for c in contact_report)
    log("palm-to-skin gap across the application keys: "
        + ", ".join(f"f{c['frame']}={c['gapMm']:+.1f}mm" for c in contact_report))
    log(f"  worst {worst:+.1f} mm, largest hover {best:+.1f} mm")

    # ---------------------------------------------------------------------------------------
    # tube parenting: authored as a real Child Of constraint, baked out later (ss19)
    # ---------------------------------------------------------------------------------------
    tube.rotation_mode = "QUATERNION"
    for frame in (R.FRAME_START, R.FRAME_END):
        tube.keyframe_insert("location", frame=frame)
        tube.keyframe_insert("rotation_quaternion", frame=frame)

    child = tube.constraints.new("CHILD_OF")
    child.name = "P2B_HELD_BY_HAND"
    child.target = armature
    child.subtarget = f"hand_{R.APPLYING}"
    scene.frame_set(E["productGripEstablished"])
    bpy.context.view_layer.update()
    child.inverse_matrix = (evaluated_bone_matrix(armature, f"hand_{R.APPLYING}")).inverted() @ tray_tube \
        @ tray_tube.inverted()
    child.set_inverse_pending = False
    # Child Of composes parent @ inverse @ own; the inverse must cancel the parent at the grip frame
    child.inverse_matrix = evaluated_bone_matrix(armature, f"hand_{R.APPLYING}").inverted()

    grip_on, grip_off = E["productGripEstablished"], E["productRetreatEnd"]
    for frame, value in ((R.FRAME_START, 0.0), (grip_on - 1, 0.0), (grip_on, 1.0),
                         (grip_off, 1.0), (grip_off + 1, 0.0), (R.FRAME_END, 0.0)):
        child.influence = value
        child.keyframe_insert("influence", frame=frame)
    for fcu in tube.animation_data.action.fcurves:
        if "influence" in fcu.data_path:
            for kp in fcu.keyframe_points:
                kp.interpolation = "CONSTANT"

    bone_l = armature.data.bones[f"lowerarm_{R.TREATED}"]
    deposit_bone_local = bone_l.matrix_local.inverted() @ (
        Vector(bone_l.head_local) + Vector(bone_l.tail_local - bone_l.head_local).normalized() * deposit_axial
        + (rest_inv.inverted() @ outward_local) * radius)
    return {
        "deposit_bone_local": deposit_bone_local,
        "contact_report": contact_report,
        "contact_worst_mm": worst, "contact_hover_mm": best,
        "grip": grip, "tray_tube": tray_tube, "palm_local": palm_local,
        "outward_local": outward_local, "deposit_axial": deposit_axial,
        "forearm_radius": radius, "axial_range": (a_lo, a_hi),
        "grip_on": grip_on, "grip_off": grip_off, "grip_solution": grip_solution,
        "pole_error": {s: controls[s].get("pole_error") for s in ("l", "r")},
    }


# ==============================================================================================
# morph-target animation
# ==============================================================================================

def key_shape(obj: bpy.types.Object, name: str, frames: list[tuple[int, float]]) -> None:
    kb = obj.data.shape_keys.key_blocks[name]
    for frame, value in frames:
        kb.value = value
        kb.keyframe_insert("value", frame=frame)


def animate_morphs(tube: bpy.types.Object, strand: bpy.types.Object, film: bpy.types.Object,
                   body: bpy.types.Object) -> None:
    """Every morph is keyed against the same event frames the manifest publishes (ss10, ss14-17)."""
    E = R.EVENTS
    F0, F1 = R.FRAME_START, R.FRAME_END

    # -- tube: grip compression on pickup, squeeze during the pour, depletion is monotonic --------
    key_shape(tube, "TUBE_GRIP_COMPRESSION", [
        (F0, 0.0), (E["productGripEstablished"] - 6, 0.0), (E["productGripEstablished"], 0.85),
        (E["dispenseEnd"], 0.85), (E["productRetreatEnd"], 0.55), (E["productRetreatEnd"] + 6, 0.0), (F1, 0.0)])
    key_shape(tube, "TUBE_SQUEEZE", [
        (F0, 0.0), (E["dispenseStart"] - 10, 0.06), (E["dispenseStart"], 0.34),
        (E["creamContact"], 0.96), (E["dispenseEnd"] - 8, 0.88), (E["dispenseEnd"], 0.18),
        (E["productRetreatStart"], 0.0), (F1, 0.0)])
    key_shape(tube, "TUBE_CREASE", [
        (F0, 0.0), (E["dispenseStart"], 0.10), (E["creamContact"], 0.62),
        (E["dispenseEnd"], 0.30), (E["productRetreatEnd"], 0.16), (F1, 0.16)])
    key_shape(tube, "TUBE_DEPLETION", [
        (F0, 0.0), (E["dispenseStart"], 0.0), (E["dispenseEnd"], 0.34), (F1, 0.34)])
    key_shape(tube, "TUBE_RECOVERY", [
        (F0, 0.0), (E["dispenseEnd"], 0.0), (E["dispenseEnd"] + 10, 0.45),
        (E["productRetreatStart"], 0.15), (F1, 0.10)])

    # -- strand: bead -> short -> extended -> thinning -> break ----------------------------------
    key_shape(strand, "STRAND_NOZZLE_BEAD", [
        (F0, 0.0), (E["dispenseStart"] - 4, 0.0), (E["dispenseStart"] + 6, 1.0),
        (E["dispenseStart"] + 22, 0.35), (E["dispenseEnd"], 0.0), (F1, 0.0)])
    key_shape(strand, "STRAND_SHORT", [
        (F0, 0.0), (E["dispenseStart"] + 6, 0.0), (E["dispenseStart"] + 20, 1.0),
        (E["creamContact"] - 6, 0.30), (E["creamContact"], 0.0), (F1, 0.0)])
    key_shape(strand, "STRAND_EXTENDED", [
        (F0, 0.0), (E["dispenseStart"] + 18, 0.0), (E["creamContact"], 1.0),
        (E["dispenseEnd"] - 14, 1.0), (E["dispenseEnd"] - 6, 0.25), (E["dispenseEnd"], 0.0), (F1, 0.0)])
    key_shape(strand, "STRAND_THINNING", [
        (F0, 0.0), (E["dispenseEnd"] - 16, 0.0), (E["dispenseEnd"] - 5, 1.0),
        (E["dispenseEnd"] + 1, 0.4), (E["dispenseEnd"] + 4, 0.0), (F1, 0.0)])
    key_shape(strand, "STRAND_BROKEN", [
        (F0, 0.0), (E["dispenseEnd"] - 2, 0.0), (E["dispenseEnd"] + 3, 1.0),
        (E["productRetreatStart"] + 8, 0.25), (E["productRetreatEnd"], 0.0), (F1, 0.0)])

    # -- cream on the skin: bead grows monotonically, then spreads and thins ----------------------
    key_shape(film, "CREAM_CONTACT_BEAD", [
        (F0, 0.0), (E["creamContact"] - 2, 0.0), (E["dispenseEnd"], 1.0),
        (E["skinContact"], 1.0), (E["spreadStart"] + 6, 0.30), (E["strokeOne"], 0.0), (F1, 0.0)])
    key_shape(film, "CREAM_COMPRESSED_BEAD", [
        (F0, 0.0), (E["skinContact"] - 4, 0.0), (E["skinContact"] + 8, 1.0),
        (E["strokeOne"], 0.55), (E["strokeOne"] + 20, 0.0), (F1, 0.0)])
    key_shape(film, "CREAM_SPREAD_PRIMARY", [
        (F0, 0.0), (E["spreadStart"], 0.0), (E["strokeOne"] + 16, 1.0),
        (E["strokeTwo"], 0.55), (E["releaseStart"], 0.20), (F1, 0.15)])
    key_shape(film, "CREAM_SPREAD_SECONDARY", [
        (F0, 0.0), (E["strokeOne"] + 6, 0.0), (E["strokeTwo"], 1.0),
        (E["releaseStart"], 0.70), (F1, 0.55)])
    key_shape(film, "CREAM_FINAL_FILM", [
        (F0, 0.0), (E["strokeTwo"], 0.15), (E["releaseStart"], 0.85),
        (E["heroStart"], 1.0), (F1, 1.0)])

    # -- skin indentation: only while the palm is on the arm, and it resets exactly ---------------
    # The stations' windows are GENERATED from the stroke's own start and end rather than written
    # out, so the count is a single constant (`G.SKIN_INDENT_STATIONS`) and the crossfade stays even
    # however many there are. Each station peaks as the palm passes it and hands over to the next
    # before it has fallen far, which is what makes the depression travel instead of stepping: with
    # the first build's three stations the handovers were ~55 mm apart against a 46 mm dent radius,
    # so the surface partly relaxed between them.
    n = G.SKIN_INDENT_STATIONS
    stroke0, stroke1 = E["skinContact"], E["releaseStart"]
    span = (stroke1 - stroke0) / max(1, n - 1)
    for i in range(n):
        peak = stroke0 + span * i
        key_shape_frames = [
            (F0, 0.0),
            (max(F0, round(peak - span * 1.35)), 0.0),
            (round(peak), 1.0),
            (min(F1, round(peak + span * 1.35)), 0.0),
            (F1, 0.0),
        ]
        # keep the frames strictly increasing after rounding at the ends of the stroke
        key_shape_frames = [kv for j, kv in enumerate(key_shape_frames)
                            if j == 0 or kv[0] > key_shape_frames[j - 1][0]]
        for target in (body, film):
            key_shape(target, f"SKIN_INDENT_CONTACT_{chr(ord('A') + i)}", key_shape_frames)
    for target in (body, film):
        key_shape(target, "SKIN_INDENT_RELEASE",
                  [(F0, 0.0), (E["releaseStart"], 0.0), (E["releaseStart"] + 8, 1.0),
                   (E["releaseEnd"] + 10, 0.0), (F1, 0.0)])

    # -- hand correctives: driven by what the hand is DOING, which is what makes them corrective ---
    #
    # The applying (right) hand closes on the tube, holds it through the pour, opens to set it down,
    # then closes again -- softer, open-palmed -- to spread the cream. Its knuckles, roots, web,
    # arch and joint creases follow that, so they are strongest at the grip and the press and relax
    # in between. The treated (left) hand only ever hangs relaxed, so its correctives sit at a low
    # constant: enough to keep four separate fingers in the silhouette, not enough to read as effort.
    A = R.APPLYING.upper()
    grip_curve = [
        (F0, 0.0), (E["gripPreparation"], 0.06), (E["productGripEstablished"], 1.0),
        (E["creamContact"], 1.0), (E["dispenseEnd"], 0.92), (E["productRetreatEnd"], 0.20),
        (E["handApproach"], 0.16), (E["skinContact"], 0.55), (E["strokeTwo"], 0.62),
        (E["releaseStart"], 0.50), (E["releaseEnd"], 0.14), (F1, 0.10),
    ]
    scale = {"KNUCKLES": 1.00, "FINGER_ROOTS": 0.90, "ARCH": 1.00, "JOINT_CREASE": 0.95}
    for suffix, k in scale.items():
        key_shape(body, f"HAND_{A}_{suffix}" if suffix != "ARCH" else f"PALM_{A}_ARCH",
                  [(f, round(v * k, 4)) for f, v in grip_curve])
    # the web bunches with THUMB opposition, which outlasts the fingers' closure by a beat
    key_shape(body, f"THUMB_{A}_WEB", [
        (F0, 0.0), (E["gripPreparation"], 0.10), (E["productGripEstablished"], 1.0),
        (E["dispenseEnd"], 0.95), (E["productRetreatEnd"], 0.28), (E["skinContact"], 0.34),
        (E["releaseEnd"], 0.12), (F1, 0.10)])

    T = R.TREATED.upper()
    for name, level in ((f"HAND_{T}_KNUCKLES", 0.30), (f"HAND_{T}_FINGER_ROOTS", 0.55),
                        (f"THUMB_{T}_WEB", 0.18), (f"PALM_{T}_ARCH", 0.26),
                        (f"HAND_{T}_JOINT_CREASE", 0.34)):
        key_shape(body, name, [(F0, level), (F1, level)])


def animate_strand_transform(strand: bpy.types.Object, tube: bpy.types.Object,
                             armature: bpy.types.Object, geo: dict) -> dict:
    """Place the strand at the nozzle and aim it at the deposit point, per frame.

    The strand is not parented: it has to span two independently moving points, so the only exact
    solution is to evaluate both and key the result. This happens AFTER the pose and tube bakes, so
    the values come from the same transforms the runtime will see.
    """
    scene = bpy.context.scene
    E = R.EVENTS
    stats = {"min_len": 1e9, "max_len": 0.0}
    for frame in range(R.FRAME_START, R.FRAME_END + 1):
        scene.frame_set(frame)
        # The strand ALWAYS rides the nozzle. An earlier version parked it far below the set while
        # idle, which stretched the asset's bounding box to 5.8 m and made every frustum test wrong;
        # with all its morphs at zero the mesh collapses to a sub-millimetre stub at the nozzle and
        # the runtime hides it outright, so there is nothing to park.
        dg = bpy.context.evaluated_depsgraph_get()
        tube_m = tube.evaluated_get(dg).matrix_world
        nozzle = tube_m @ G.TUBE_NOZZLE_LOCAL
        fa = forearm_axes_at(armature, geo["outward_local"])
        deposit = fa["head"] + fa["axis"] * geo["deposit_axial"] + fa["outward"] * geo["forearm_radius"]
        delta = deposit - nozzle
        length = max(1e-4, delta.length)
        stats["min_len"] = min(stats["min_len"], length)
        stats["max_len"] = max(stats["max_len"], length)
        strand.location = nozzle
        strand.rotation_mode = "QUATERNION"
        strand.rotation_quaternion = delta.normalized().to_track_quat("-Y", "Z")
        strand.scale = Vector((1.0, length, 1.0))
        strand.keyframe_insert("location", frame=frame)
        strand.keyframe_insert("rotation_quaternion", frame=frame)
        strand.keyframe_insert("scale", frame=frame)
    return stats


# ==============================================================================================
# validation, export, manifest
# ==============================================================================================

def validate_action(armature: bpy.types.Object) -> dict:
    action = armature.animation_data.action
    if action is None:
        raise SystemExit("BLOCKED: no baked action on the armature")
    bones = set()
    finite = True
    keys = 0
    for fcu in action.fcurves:
        keys += len(fcu.keyframe_points)
        if fcu.data_path.startswith('pose.bones["'):
            bones.add(fcu.data_path.split('"')[1])
        for kp in fcu.keyframe_points:
            if not (math.isfinite(kp.co[0]) and math.isfinite(kp.co[1])):
                finite = False
    rng = action.frame_range
    if not finite:
        raise SystemExit("BLOCKED: baked action contains non-finite keyframes")
    required = {"pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r",
                "upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r"}
    missing = sorted(required - bones)
    if missing:
        raise SystemExit(f"BLOCKED: baked action is missing tracks for {missing}")
    if rng[0] > R.FRAME_START or rng[1] < R.FRAME_END:
        raise SystemExit(f"BLOCKED: baked range {rng[:]} does not cover {R.FRAME_START}..{R.FRAME_END}")
    return {"bones": len(bones), "fcurves": len(action.fcurves), "keyframes": keys,
            "frameRange": [rng[0], rng[1]]}


def purge_non_export() -> list[str]:
    """Physically remove every object that is not a declared runtime export.

    Two reasons this is a deletion rather than a deselection. The bpy startup scene contributes a
    stray Icosphere that survives read_factory_settings, and the glTF exporter's SCENE animation
    mode does not honour `use_selection` for node inclusion — together they put a 2 m sphere and the
    authoring rig into the runtime asset. ss20/ss21 require neither to leak. The editable .blend is
    saved BEFORE this runs, so nothing an animator needs is lost.
    """
    removed = []
    for scene in list(bpy.data.scenes):
        if scene is not bpy.context.scene:
            bpy.data.scenes.remove(scene, do_unlink=True)
    # bpy.data.objects, not scene.objects: the startup Icosphere is linked to no scene at all yet
    # still reaches the exporter, so scene-only iteration cannot see it.
    for o in list(bpy.data.objects):
        if not o.get("p2b_export", False):
            removed.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
    return removed


def export_glb(repo: str, exportables: list[bpy.types.Object]) -> str:
    out = os.path.join(repo, BAKED_REL)
    guard_original(repo, out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    for o in exportables:
        o.hide_set(False)
        o.hide_viewport = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = exportables[0]
    bpy.ops.export_scene.gltf(
        filepath=out, export_format="GLB", use_selection=True,
        export_animation_mode="SCENE",
        # SCENE mode still emits one glTF animation PER OBJECT unless the split is turned off; a
        # single self-contained clip is what ss9 asks for and what keeps one narrative clock trivial.
        export_anim_scene_split_object=False,
        export_bake_animation=True,
        export_morph=True, export_morph_normal=False, export_skins=True,
        export_apply=False, export_yup=True, export_texcoords=True,
        export_normals=True, export_materials="EXPORT", export_cameras=False,
        export_lights=False, export_extras=True, export_frame_range=True,
        export_optimize_animation_size=False, export_anim_single_armature=True,
    )
    return out


def build_manifest(repo: str, original_checksum: str, glb_path: str, blender_version: str,
                   objects: dict, morphs: dict, action_stats: dict, armature) -> dict:
    total_frames = R.FRAME_END - R.FRAME_START
    events = {}
    for marker in sorted(bpy.context.scene.timeline_markers, key=lambda m: m.frame):
        if not marker.name.startswith("EVT_"):
            continue
        events[marker.name[4:]] = round((marker.frame - R.FRAME_START) / total_frames, 6)
    if not events:
        raise SystemExit("BLOCKED: no EVT_ timeline markers found; manifest event timings must be generated")

    tri = 0
    meshes = 0
    materials = set()
    for o in bpy.context.scene.objects:
        if o.type != "MESH" or not o.get("p2b_export", False):
            continue
        meshes += 1
        o.data.calc_loop_triangles()
        tri += len(o.data.loop_triangles)
        for m in o.data.materials:
            if m:
                materials.add(m.name)

    morph_count = sum(len(v["targets"]) for v in morphs.values())
    return {
        "$schema": "./human_application_manifest.schema.json",
        "schemaVersion": 1,
        "assetVersion": f"2b.1.0+{original_checksum[:12]}",
        "asset": os.path.basename(glb_path),
        "generatedAtUtc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "clip": {
            "name": CLIP_NAME,
            "fps": R.FPS,
            "durationSeconds": round(total_frames / R.FPS, 6),
            "frameStart": R.FRAME_START,
            "frameEnd": R.FRAME_END,
        },
        "source": {
            "originalAsset": os.path.basename(ORIGINAL_REL),
            "originalAssetChecksum": original_checksum,
            "blenderSource": "../blender/phase2_application_source.blend",
            "blenderVersion": blender_version,
            "buildScript": "simulator/tools/blender/build_phase2_realism.py",
        },
        "skeleton": {
            "boneMapVersion": BONE_MAP_VERSION,
            "boneCount": len(armature.data.bones),
            "rootBone": next(b.name for b in armature.data.bones if b.parent is None),
            "compatibilityStatus": "verified",
        },
        "objects": objects,
        "morphTargets": morphs,
        "events": events,
        "ownership": {
            "bones": "blender-baked",
            "morphTargets": "blender-baked",
            "camera": "threejs",
            "timeline": "master-progress",
            "surfaceShader": "threejs-glsl",
        },
        "provenance": {
            "humanMotion": "VISUAL_ONLY",
            "productMotion": "VISUAL_ONLY",
            "tubeSqueeze": "VISUAL_ONLY",
            "creamExtrusion": "VISUAL_ONLY",
            "skinIndentation": "VISUAL_ONLY",
            "camera": "VISUAL_ONLY",
        },
        "compatibility": {
            "threeRevision": "r160",
            "gltf": "2.0",
            "presentationModes": ["blender-baked", "procedural-fallback"],
        },
        "statistics": {
            "fileSizeBytes": os.path.getsize(glb_path),
            "meshCount": meshes,
            "triangleCount": tri,
            "materialCount": len(materials),
            "textureCount": len(bpy.data.images),
            "animationTrackCount": action_stats["fcurves"],
            "animationKeyframeCount": action_stats["keyframes"],
            "morphTargetCount": morph_count,
        },
    }


def render_preview(repo: str, every: int = 4, width=960, height=540, samples=24,
                   engine: str = "CYCLES") -> dict | None:
    """Blender-authored preview of the whole sequence, rendered offline (ss23).

    CYCLES ON THE CPU IS THE WORKING ROUTE IN THIS CONTAINER, and the first Phase 2B report was
    wrong to say Cycles was unavailable. `_cycles` is compiled into the `bpy` wheel; the engine
    simply does not register until the add-on is explicitly enabled, which nothing in a background
    `bpy` session does for you. With `addon_utils.enable("cycles")` the engine appears and renders
    the real scene -- lights, camera, baked animation and all -- at roughly 27 s per frame at
    960x540, 24 adaptive samples with OpenImageDenoise.

    EEVEE Next remains unusable here: it needs a GPU/EGL context, and the Mesa software fallbacks
    either produce torn geometry (llvmpipe, 90 s/frame) or abort outright (softpipe). Passing
    `engine="BLENDER_EEVEE_NEXT"` keeps that path available on a machine with a GPU.

    The view transform is AgX rather than the Standard used when ENCODING browser captures. Those
    frames are already display-referred and must not be re-mapped; a Cycles render is scene-referred
    and has to be tone-mapped or the set blows out to white.
    """
    scene = bpy.context.scene
    out = os.path.join(repo, PREVIEW_REL)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if engine == "CYCLES":
        import addon_utils
        addon_utils.enable("cycles", default_set=True)
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.05
        scene.cycles.max_bounces = 4
        scene.view_settings.view_transform = "AgX"
        scene.view_settings.look = "AgX - Base Contrast"
    else:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
        scene.eevee.taa_render_samples = samples
        scene.eevee.use_raytracing = False
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.film_transparent = False
    scene.render.fps = max(1, R.FPS // every)
    scene.frame_step = every
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = out
    t0 = time.time()
    bpy.ops.render.render(animation=True)
    scene.frame_step = 1
    if not os.path.exists(out):
        return None
    return {"path": PREVIEW_REL, "bytes": os.path.getsize(out), "seconds": round(time.time() - t0, 1),
            "fps": scene.render.fps, "frameStep": every, "width": width, "height": height}


# ==============================================================================================
# camera helper for the preview
# ==============================================================================================

def animate_preview_camera(cam: bpy.types.Object, armature: bpy.types.Object, geo: dict) -> None:
    """Composition guide only. ss9/ss26 keep Three.js as the runtime camera owner."""
    E = R.EVENTS
    scene = bpy.context.scene
    shots = [
        (R.FRAME_START, 1.55, math.radians(16.0), 1.35, Vector((0.0, 0.0, 1.30))),
        (E["productEstablishStart"], 1.05, math.radians(24.0), 1.10, Vector((-0.20, -0.05, 1.05))),
        (E["productGripEstablished"], 0.52, math.radians(12.0), 1.12, Vector((-0.16, -0.06, 1.10))),
        (E["dispenseStart"], 0.40, math.radians(10.0), 1.20, None),
        (E["creamContact"], 0.30, math.radians(6.0), 1.22, None),
        (E["dispenseEnd"], 0.34, math.radians(8.0), 1.22, None),
        (E["productRetreatEnd"], 0.62, math.radians(14.0), 1.15, None),
        (E["skinContact"], 0.34, math.radians(9.0), 1.20, None),
        (E["strokeTwo"], 0.38, math.radians(12.0), 1.20, None),
        (E["heroStart"], 0.27, math.radians(7.0), 1.20, None),
        (R.FRAME_END, 0.26, math.radians(6.0), 1.20, None),
    ]
    # The distances above frame the Three.js shot list, which is a 720p viewport with the browser's
    # own field of view. The Blender preview camera renders the SAME scene through a different lens,
    # and at these distances the offline render sits so close that whole shots resolve to a patch of
    # forearm. The preview is a composition guide for a human to watch, so it is pulled back.
    PREVIEW_PULLBACK = 2.1
    for frame, dist, elev, _z, override in shots:
        dist *= PREVIEW_PULLBACK
        scene.frame_set(frame)
        fa = forearm_axes_at(armature, geo["outward_local"])
        target = override if override is not None else (
            fa["head"] + fa["axis"] * geo["deposit_axial"] + fa["outward"] * geo["forearm_radius"] * 0.5)
        direction = Vector((math.sin(math.radians(-18.0)) * math.cos(elev),
                            -math.cos(math.radians(-18.0)) * math.cos(elev),
                            math.sin(elev)))
        cam.location = target + direction * dist
        _aim(cam, target)
        cam.keyframe_insert("location", frame=frame)
        cam.keyframe_insert("rotation_quaternion", frame=frame)
    if cam.animation_data and cam.animation_data.action:
        R.smooth_all_fcurves(cam.animation_data.action)


# ==============================================================================================
# main
# ==============================================================================================

def main() -> int:
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser(description="Phase 2B Blender build")
    ap.add_argument("--repo", required=True, help="repository root")
    ap.add_argument("--preview", action="store_true", help="also render the Blender preview video")
    ap.add_argument("--preview-step", type=int, default=2)
    ap.add_argument("--preview-samples", type=int, default=12)
    a = ap.parse_args(argv)
    repo = os.path.abspath(a.repo)

    t_start = time.time()
    version = check_blender_version()
    log(f"Blender {version} ({bpy.app.build_branch})")

    original = os.path.join(repo, ORIGINAL_REL)
    original_checksum = sha256(original)
    log(f"original human.glb sha256 {original_checksum}")

    clean_scene()
    collections = make_collections()
    armature, meshes = import_human(repo, collections)
    body = find_body_mesh(meshes)
    log(f"body/skin mesh: {body.name} ({len(body.data.vertices)} verts)")

    preview = build_preview_rig(collections)

    # ---- authored geometry -------------------------------------------------------------------
    tube = G.build_tube(collections["PRODUCT"])
    tube_morphs = G.add_tube_shape_keys(tube)
    cap = G.build_cap(collections["PRODUCT"])
    tray_objs = G.build_tray(collections["PRODUCT"])
    tray_objs[0].location = TRAY_TOP + Vector((0.0, 0.0, -0.004))
    tray_objs[1].location = Vector((TRAY_TOP.x, TRAY_TOP.y, (TRAY_TOP.z - 0.008) / 2.0))
    tray_objs[1].scale = Vector((1.0, 1.0, (TRAY_TOP.z - 0.008)))
    cap.matrix_world = (Matrix.Translation(TRAY_TOP + Vector((0.052, 0.014, G.TUBE["cap_radius"])))
                        @ Matrix.Rotation(math.pi / 2, 4, "Z") @ Matrix.Rotation(math.pi / 2, 4, "X"))

    strand = G.build_strand(collections["CREAM"])
    strand_morphs = G.add_strand_shape_keys(strand)

    film, film_info = G.build_cream_film(body, armature, f"lowerarm_{R.TREATED}", collections["CREAM"])
    log(f"cream film: {film_info['vertices']} verts / {film_info['triangles']} tris, "
        f"axial {film_info['axial_min']:.3f}..{film_info['axial_max']:.3f} m, "
        f"radius {film_info['radius_mean']:.4f} m")
    film_morphs = G.add_cream_film_shape_keys(film, film_info)

    # skin indentation: identical maths on the body and on the film so they never separate
    # depth exceeds the deepest authored press (4.0 mm) so the skin genuinely swallows the palm
    body_indent = G.add_skin_indent_shape_keys(body, film_info, radius=0.046, depth=0.0070)
    film_indent = G.add_skin_indent_shape_keys(film, film_info, radius=0.046, depth=0.0070)

    # pose-dependent hand correctives (ss8) — the volume changes skinning cannot make
    frame_apply = R.hand_frame(armature, R.APPLYING)
    frame_treat = R.hand_frame(armature, R.TREATED)
    corrective = G.add_hand_corrective_shape_keys(
        body, armature, R.APPLYING, frame_apply, finger_flesh(body, armature, R.APPLYING))
    corrective += G.add_hand_corrective_shape_keys(
        body, armature, R.TREATED, frame_treat, finger_flesh(body, armature, R.TREATED))
    log(f"morphs: tube {len(tube_morphs)}, strand {len(strand_morphs)}, film {len(film_morphs)}, "
        f"skin {len(body_indent)}, hand correctives {len(corrective)}")

    # ---- markers -----------------------------------------------------------------------------
    for name, frame in R.EVENTS.items():
        bpy.context.scene.timeline_markers.new(f"EVT_{name}", frame=frame)

    # ---- rig + animation ---------------------------------------------------------------------
    controls = R.build_control_rig(armature, collections["CONTROL_RIG"])
    log(f"pole calibration error: L {controls['l']['pole_error'] * 1000:.2f} mm, "
        f"R {controls['r']['pole_error'] * 1000:.2f} mm")
    geo = author_animation(armature, body, tube, controls, film_info)
    anchors = build_runtime_anchors(tube, armature, collections, geo["deposit_bone_local"])
    animate_morphs(tube, strand, film, body)
    animate_preview_camera(preview["camera"], armature, geo)

    # ---- bake --------------------------------------------------------------------------------
    R.bake_pose(armature, R.FRAME_START, R.FRAME_END)
    action_stats = validate_action(armature)
    log(f"baked pose: {action_stats['bones']} bones, {action_stats['fcurves']} fcurves, "
        f"{action_stats['keyframes']} keys, range {action_stats['frameRange']}")
    R.bake_object(tube, R.FRAME_START, R.FRAME_END)
    strand_stats = animate_strand_transform(strand, tube, armature, geo)
    log(f"strand span {strand_stats['min_len'] * 1000:.1f}..{strand_stats['max_len'] * 1000:.1f} mm")

    # control helpers are authoring-only
    for name in ("CONTROL_RIG", "HELPERS", "LIGHTS", "PREVIEW_ONLY"):
        for o in collections[name].objects:
            o["p2b_export"] = False

    # ---- save the editable source BEFORE exporting ---------------------------------------------
    blend_out = os.path.join(repo, BLEND_REL)
    guard_original(repo, blend_out)
    os.makedirs(os.path.dirname(blend_out), exist_ok=True)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=blend_out, compress=True)
    log(f"saved authoring source: {BLEND_REL} ({os.path.getsize(blend_out)} bytes)")

    # ---- export --------------------------------------------------------------------------------
    removed = purge_non_export()
    log(f"purged {len(removed)} non-export objects: {', '.join(sorted(removed))}")
    exportables = [o for o in bpy.context.scene.objects if o.get("p2b_export", False)]
    leaked = [o.name for o in bpy.data.objects if not o.get("p2b_export", False)]
    if leaked:
        raise SystemExit(f"BLOCKED: non-export objects still in the scene at export time: {leaked}")
    glb = export_glb(repo, exportables)
    log(f"exported {BAKED_REL} ({os.path.getsize(glb)} bytes) from {len(exportables)} objects")

    manifest = build_manifest(
        repo, original_checksum, glb, version,
        objects={
            "humanRoot": armature.name,
            "bodyMesh": body.name,
            "tube": tube.name,
            "cap": cap.name,
            "tray": tray_objs[0].name,
            "creamStrand": strand.name,
            "nozzleAnchor": anchors["nozzle"].name,
            "depositAnchor": anchors["deposit"].name,
            "creamDeposit": film.name,
            "creamSpread": film.name,
        },
        morphs={
            "tubeSqueeze": {"mesh": tube.name, "targets": [n for n in tube_morphs if "SQUEEZE" in n or "GRIP" in n or "CREASE" in n or "RECOVERY" in n]},
            "tubeDepletion": {"mesh": tube.name, "targets": [n for n in tube_morphs if "DEPLETION" in n]},
            "skinIndent": {"mesh": body.name, "targets": body_indent},
            "creamNozzle": {"mesh": strand.name, "targets": [n for n in strand_morphs if "NOZZLE" in n]},
            "creamStrand": {"mesh": strand.name, "targets": [n for n in strand_morphs if "NOZZLE" not in n]},
            "creamDeposit": {"mesh": film.name, "targets": [n for n in film_morphs if "BEAD" in n]},
            "creamSpread": {"mesh": film.name, "targets": [n for n in film_morphs if "SPREAD" in n or "FILM" in n]},
            "creamSkinIndent": {"mesh": film.name, "targets": film_indent},
        },
        action_stats=action_stats, armature=armature,
    )
    manifest_path = os.path.join(repo, MANIFEST_REL)
    guard_original(repo, manifest_path)
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")
    log(f"wrote {MANIFEST_REL}")

    preview_info = None
    if a.preview:
        preview_info = render_preview(repo, every=a.preview_step, samples=a.preview_samples)
        log(f"preview render: {preview_info}")

    if sha256(original) != original_checksum:
        raise SystemExit("BLOCKED: the original human.glb changed during the build")

    report = {
        "status": "ok",
        "blenderVersion": version,
        "buildSeconds": round(time.time() - t_start, 1),
        "originalChecksum": original_checksum,
        "originalChecksumUnchanged": True,
        "outputs": {"blend": BLEND_REL, "glb": BAKED_REL, "manifest": MANIFEST_REL,
                    "preview": preview_info},
        "exportedObjects": sorted(o.name for o in exportables),
        "excludedObjects": sorted(removed),
        "action": action_stats,
        "strand": {k: round(v, 5) for k, v in strand_stats.items()},
        "poleCalibrationErrorMm": {k: round((v or 0) * 1000, 3) for k, v in geo["pole_error"].items()},
        "gripSolution": geo["grip_solution"],
        "palmContact": {"perKey": geo["contact_report"],
                        "worstGapMm": geo["contact_worst_mm"],
                        "largestHoverMm": geo["contact_hover_mm"]},
        "creamFilm": {"vertices": film_info["vertices"], "triangles": film_info["triangles"]},
        "manifest": manifest,
        "log": log_lines,
    }
    report_path = os.path.join(repo, REPORT_REL)
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")
    log(f"wrote {REPORT_REL}  (total {report['buildSeconds']}s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
