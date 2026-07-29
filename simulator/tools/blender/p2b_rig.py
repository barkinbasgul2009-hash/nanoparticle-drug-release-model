"""Phase 2B — authoring control rig, pose-to-pose animation and the bake to deform bones.

The authoring rig is deliberately conventional so a future animator can open the .blend and work:
two-bone IK on each arm driven by a hand control empty, a pole empty per arm, world-space Copy
Rotation for the wrist, FK keys on the spine chain, and per-joint finger keys. None of that survives
into the runtime asset — ss19 requires the evaluated result to be baked onto the original deform
bones and the controls excluded from export.

Two ideas do the heavy lifting here:

* HAND POSES ARE DERIVED FROM THE PRODUCT, not typed in. Given a desired tube placement and a fixed
  grip offset, the wrist transform is `tube_world @ grip^-1`. The grip can therefore never drift,
  and the pick-up/put-down frames are exact rather than approximately coincident.

* CONTACT TARGETS ARE MEASURED FROM THE POSED SKELETON. The treated arm is keyed first; the applying
  hand's targets are then read off the actually-evaluated forearm at each frame. Nothing depends on
  hand-copied coordinates that would silently rot if the presentation pose changed.
"""

from __future__ import annotations

import math

import bpy
from mathutils import Matrix, Quaternion, Vector

# --------------------------------------------------------------------------------------------
# timeline — the single source of truth for event timing (ss10)
# --------------------------------------------------------------------------------------------

FPS = 30
FRAME_START = 1
FRAME_END = 421          # 420 frames = 14.000 s, matching the procedural fallback's duration

EVENTS: dict[str, int] = {
    "neutral": 1,
    "productEstablishStart": 31,
    "gripPreparation": 61,
    "productGripEstablished": 91,
    "dispensePreparation": 121,
    "dispenseStart": 151,
    "creamContact": 181,
    "dispenseEnd": 211,
    "productRetreatStart": 221,
    "productRetreatEnd": 256,
    "handApproach": 266,
    "skinContact": 286,
    "spreadStart": 296,
    "strokeOne": 316,
    "strokeTwo": 346,
    "releaseStart": 376,
    "releaseEnd": 391,
    "heroStart": 396,
    "heroHold": 406,
    "sequenceEnd": 421,
}

APPLYING = "r"           # the hand that holds the product and applies the cream
TREATED = "l"            # the forearm that receives it

FINGERS = ("index", "middle", "ring", "pinky")

# Finger lengths differ, so a single shared curl reads as a circular cage. These per-finger factors
# and lead times are what break that up (ss12).
FINGER_TUNING = {
    "index":  {"reach": 1.00, "lead": 0.00, "spread": +0.055},
    "middle": {"reach": 1.06, "lead": 0.05, "spread": +0.012},
    "ring":   {"reach": 0.97, "lead": 0.11, "spread": -0.030},
    "pinky":  {"reach": 0.84, "lead": 0.18, "spread": -0.075},
}
JOINT_SHARE = {"01": 0.45, "02": 0.35, "03": 0.20}


# --------------------------------------------------------------------------------------------
# maths helpers
# --------------------------------------------------------------------------------------------

def basis_matrix(finger_dir: Vector, palm_normal: Vector) -> Matrix:
    """Build the hand's orthonormal basis from two intent vectors.

    Columns are the hand bone's local X, Y, Z in world space; Y is the finger direction and Z the
    palmar normal, which is the convention measured off this rig's rest pose.
    """
    y = Vector(finger_dir).normalized()
    z = Vector(palm_normal).normalized()
    z = (z - y * y.dot(z)).normalized()
    x = y.cross(z)
    m = Matrix.Identity(3)
    m.col[0], m.col[1], m.col[2] = x, y, z
    return m


def rest_basis(armature: bpy.types.Object, bone: str) -> Matrix:
    return armature.data.bones[bone].matrix_local.to_3x3()


def rest_head(armature: bpy.types.Object, bone: str) -> Vector:
    return Vector(armature.data.bones[bone].head_local)


def minimum_jerk(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * t * (10.0 + t * (-15.0 + 6.0 * t))


# --------------------------------------------------------------------------------------------
# control rig
# --------------------------------------------------------------------------------------------

def _empty(name: str, collection: bpy.types.Collection, size=0.03, display="PLAIN_AXES"):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    collection.objects.link(obj)
    obj["p2b_role"] = "control"
    obj["p2b_export"] = False
    return obj


def build_control_rig(armature: bpy.types.Object, control_col: bpy.types.Collection) -> dict:
    """IK targets, pole targets and wrist orientation controls for both arms."""
    controls = {}
    for side in ("l", "r"):
        wrist = rest_head(armature, f"hand_{side}")
        elbow = rest_head(armature, f"lowerarm_{side}")
        shoulder = rest_head(armature, f"upperarm_{side}")

        hand_ctrl = _empty(f"CTRL_hand_{side}", control_col, size=0.05, display="CUBE")
        hand_ctrl.matrix_world = Matrix.Translation(wrist) @ rest_basis(armature, f"hand_{side}").to_4x4()

        # the pole sits out along the plane the elbow already occupies, so turning IK on does not
        # snap the arm to a new solution on frame one
        upper = (elbow - shoulder).normalized()
        lower = (wrist - elbow).normalized()
        bend = (lower - upper)
        if bend.length < 1e-4:
            bend = Vector((0.0, -1.0, 0.0))
        pole_dir = -bend.normalized()
        pole = _empty(f"CTRL_pole_{side}", control_col, size=0.04, display="SPHERE")
        pole.location = elbow + pole_dir * 0.45

        pb = armature.pose.bones[f"lowerarm_{side}"]
        ik = pb.constraints.new("IK")
        ik.name = "P2B_IK"
        ik.target = hand_ctrl
        ik.pole_target = pole
        ik.chain_count = 2
        ik.use_tail = True
        ik.influence = 1.0

        hb = armature.pose.bones[f"hand_{side}"]
        cr = hb.constraints.new("COPY_ROTATION")
        cr.name = "P2B_WRIST"
        cr.target = hand_ctrl
        cr.target_space = "WORLD"
        cr.owner_space = "WORLD"

        controls[side] = {"hand": hand_ctrl, "pole": pole, "ik": ik, "copy_rot": cr}

    # Solve once so the pole angle that reproduces the rest pose can be measured rather than guessed.
    for side in ("l", "r"):
        _calibrate_pole_angle(armature, side, controls[side])
    return controls


def _calibrate_pole_angle(armature: bpy.types.Object, side: str, ctrl: dict) -> float:
    """Pick the pole angle whose IK solution reproduces the rest elbow position most closely."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    target_elbow = rest_head(armature, f"lowerarm_{side}")
    best, best_err = 0.0, float("inf")
    for step in range(72):
        angle = -math.pi + step * (2 * math.pi / 72)
        ctrl["ik"].pole_angle = angle
        depsgraph.update()
        bpy.context.view_layer.update()
        got = armature.matrix_world @ armature.pose.bones[f"lowerarm_{side}"].head
        err = (got - target_elbow).length
        if err < best_err:
            best, best_err = angle, err
    ctrl["ik"].pole_angle = best
    ctrl["pole_error"] = best_err
    return best


# --------------------------------------------------------------------------------------------
# finger articulation
# --------------------------------------------------------------------------------------------

def finger_axes(armature: bpy.types.Object, side: str) -> dict:
    """Per-bone local flexion axes, derived from the rest geometry rather than assumed.

    Rotating a bone by theta about world axis `a` moves its tip by theta * (a x bone_vector). For
    flexion the tip must travel along the palmar normal `n`, so `a = u x n` where `u` is the bone
    direction; expressed in the bone's own rest space that axis is a fixed anatomical constant.
    """
    hand_basis = rest_basis(armature, f"hand_{side}")
    palm_normal = Vector(hand_basis.col[2]).normalized()
    ulnar = -Vector(hand_basis.col[0]).normalized()      # index -> little finger, across the palm
    axes = {}
    for name in FINGERS + ("thumb",):
        for seg in ("01", "02", "03"):
            bone_name = f"{name}_{seg}_{side}"
            bone = armature.data.bones[bone_name]
            u = (Vector(bone.tail_local) - Vector(bone.head_local)).normalized()
            rest = bone.matrix_local.to_3x3().inverted()
            flex_world = u.cross(palm_normal)
            if flex_world.length < 1e-6:
                flex_world = Vector(hand_basis.col[0])
            axes[bone_name] = {
                "flex": (rest @ flex_world.normalized()).normalized(),
                "abduct": (rest @ palm_normal).normalized(),
                "oppose": (rest @ u.cross(ulnar).normalized()).normalized(),
            }
    axes["_palm_normal"] = palm_normal
    axes["_ulnar"] = ulnar
    return axes


def set_finger_totals(armature: bpy.types.Object, side: str, axes: dict,
                      totals: dict, spread_scale: float = 1.0,
                      thumb_oppose: float = 0.0, thumb_flex: float = 0.0) -> None:
    """Pose one hand from EXPLICIT per-finger total flexion angles (radians).

    Total flexion is split across MCP/PIP/DIP by JOINT_SHARE, which is why PIP always exceeds DIP
    and no two fingers describe the same arc.
    """
    for name in FINGERS:
        total = max(0.0, totals.get(name, 0.0))
        for seg, share in JOINT_SHARE.items():
            pb = armature.pose.bones[f"{name}_{seg}_{side}"]
            pb.rotation_mode = "QUATERNION"
            q = Quaternion(axes[f"{name}_{seg}_{side}"]["flex"], total * share)
            if seg == "01":
                q = q @ Quaternion(axes[f"{name}_01_{side}"]["abduct"],
                                   FINGER_TUNING[name]["spread"] * spread_scale)
            pb.rotation_quaternion = q

    # the thumb opposes across the palm — a distinct motion, not another curl (ss12)
    for seg, flex_share in (("01", 0.22), ("02", 0.44), ("03", 0.34)):
        pb = armature.pose.bones[f"thumb_{seg}_{side}"]
        pb.rotation_mode = "QUATERNION"
        ax = axes[f"thumb_{seg}_{side}"]
        q = Quaternion(ax["flex"], thumb_flex * flex_share)
        if seg == "01":
            q = Quaternion(ax["oppose"], thumb_oppose) @ q
        pb.rotation_quaternion = q


def set_finger_pose(armature: bpy.types.Object, side: str, axes: dict, close: float,
                    squeeze: float = 0.0, grip: dict | None = None,
                    thumb_oppose: float | None = None) -> None:
    """Pose one hand. `close` 0 = relaxed open, 1 = the SOLVED grip; `squeeze` deepens it further.

    `grip` is the solution measured by the build against the real tube surface. Without it the
    fingers fall back to an object-radius estimate, which is only used when no object is held.
    """
    close = min(1.0, max(0.0, close))
    squeeze = min(1.0, max(0.0, squeeze))
    totals = {}
    for name in FINGERS:
        tune = FINGER_TUNING[name]
        # staggered closure: each finger starts a little after the one before it
        local = minimum_jerk(min(1.0, max(0.0, (close - tune["lead"]) / max(1e-6, 1.0 - tune["lead"]))))
        if grip and name in grip["fingers"]:
            target = grip["fingers"][name]
        else:
            chain_len = sum(armature.data.bones[f"{name}_{s}_{side}"].length for s in ("01", "02", "03"))
            target = min(3.05, chain_len / 0.0215) * tune["reach"]
        totals[name] = target * local + 0.42 * squeeze * local
    oppose_max = grip["thumb"]["oppose"] if grip else 0.92
    flex_max = grip["thumb"]["flex"] if grip else 1.10
    shaped = minimum_jerk(close)
    set_finger_totals(
        armature, side, axes, totals,
        spread_scale=1.0 - 0.65 * shaped,
        thumb_oppose=(thumb_oppose if thumb_oppose is not None else oppose_max * shaped),
        thumb_flex=flex_max * shaped + 0.18 * squeeze,
    )


def relaxed_hand(armature: bpy.types.Object, side: str, axes: dict, amount: float = 1.0) -> None:
    """The treated hand must not be left in bind pose (ss12). A real hand rests with a soft cascade."""
    cascade = {"index": 0.26, "middle": 0.31, "ring": 0.36, "pinky": 0.42}
    for name in FINGERS:
        total = cascade[name] * amount
        for seg, share in JOINT_SHARE.items():
            pb = armature.pose.bones[f"{name}_{seg}_{side}"]
            pb.rotation_mode = "QUATERNION"
            q = Quaternion(axes[f"{name}_{seg}_{side}"]["flex"], total * share * 3.0)
            if seg == "01":
                q = q @ Quaternion(axes[f"{name}_01_{side}"]["abduct"],
                                   FINGER_TUNING[name]["spread"] * 0.8 * amount)
            pb.rotation_quaternion = q
    for seg, flex in (("01", 0.16), ("02", 0.22), ("03", 0.18)):
        pb = armature.pose.bones[f"thumb_{seg}_{side}"]
        pb.rotation_mode = "QUATERNION"
        ax = axes[f"thumb_{seg}_{side}"]
        q = Quaternion(ax["flex"], flex * amount)
        if seg == "01":
            q = Quaternion(ax["oppose"], 0.30 * amount) @ q
        pb.rotation_quaternion = q


# --------------------------------------------------------------------------------------------
# torso / spine FK
# --------------------------------------------------------------------------------------------

SPINE_CHAIN = ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head")


def set_torso(armature: bpy.types.Object, lean: float = 0.0, twist: float = 0.0,
              look_down: float = 0.0, breathe: float = 0.0) -> None:
    """Distribute a small amount of lean/twist across the chain instead of hinging one joint."""
    share = {"pelvis": 0.12, "spine_01": 0.22, "spine_02": 0.30, "spine_03": 0.24,
             "neck_01": 0.08, "head": 0.04}
    for bone, w in share.items():
        pb = armature.pose.bones[bone]
        pb.rotation_mode = "QUATERNION"
        # bone local Y runs up the spine, so twist is about local Y and lean about local X
        q = Quaternion(Vector((1.0, 0.0, 0.0)), lean * w + breathe * w * 0.35)
        q = q @ Quaternion(Vector((0.0, 1.0, 0.0)), twist * w)
        pb.rotation_quaternion = q
    for bone, amount in (("neck_01", 0.62), ("head", 0.38)):
        pb = armature.pose.bones[bone]
        pb.rotation_quaternion = pb.rotation_quaternion @ Quaternion(Vector((1.0, 0.0, 0.0)),
                                                                     look_down * amount)


def set_clavicles(armature: bpy.types.Object, lift_l=0.0, lift_r=0.0, forward_l=0.0, forward_r=0.0):
    """Shoulders must contribute, or a raised arm reads as a doll's socket joint (ss11)."""
    for side, lift, fwd in (("l", lift_l, forward_l), ("r", lift_r, forward_r)):
        pb = armature.pose.bones[f"clavicle_{side}"]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (Quaternion(Vector((1.0, 0.0, 0.0)), lift)
                                  @ Quaternion(Vector((0.0, 0.0, 1.0)), fwd))


# --------------------------------------------------------------------------------------------
# keying
# --------------------------------------------------------------------------------------------

def key_control(obj: bpy.types.Object, frame: int, matrix: Matrix) -> None:
    obj.matrix_world = matrix
    obj.keyframe_insert("location", frame=frame)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = matrix.to_quaternion()
    obj.keyframe_insert("rotation_quaternion", frame=frame)


def key_pose_bones(armature: bpy.types.Object, names, frame: int) -> None:
    for n in names:
        pb = armature.pose.bones[n]
        pb.keyframe_insert("rotation_quaternion", frame=frame)


def finger_bone_names(side: str) -> list[str]:
    return [f"{n}_{s}_{side}" for n in FINGERS + ("thumb",) for s in ("01", "02", "03")]


def smooth_all_fcurves(action: bpy.types.Action, handle="AUTO_CLAMPED") -> None:
    """Bezier with auto-clamped handles everywhere: no linear ramps, no overshoot past a key."""
    for fcu in action.fcurves:
        for kp in fcu.keyframe_points:
            kp.interpolation = "BEZIER"
            kp.handle_left_type = handle
            kp.handle_right_type = handle
        fcu.update()


def bake_pose(armature: bpy.types.Object, frame_start: int, frame_end: int, step: int = 1) -> None:
    """Evaluate IK + constraints onto the original deform bones and drop the authoring rig (ss19)."""
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.nla.bake(
        frame_start=frame_start, frame_end=frame_end, step=step,
        only_selected=False, visual_keying=True, clear_constraints=True,
        clear_parents=False, use_current_action=False, bake_types={"POSE"},
    )
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_object(obj: bpy.types.Object, frame_start: int, frame_end: int, step: int = 1) -> None:
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.nla.bake(
        frame_start=frame_start, frame_end=frame_end, step=step,
        only_selected=True, visual_keying=True, clear_constraints=True,
        clear_parents=False, use_current_action=False, bake_types={"OBJECT"},
    )
    obj.select_set(False)
