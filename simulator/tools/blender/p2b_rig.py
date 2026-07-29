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
# How a finger's total flexion is divided between MCP / PIP / DIP.
#
# The first Phase 2B build used a single share for every finger with the MCP dominant
# (0.45 / 0.35 / 0.20). That is backwards for a power grip and is the second reason the fingers read
# as cylinders: with the strongest bend at the root, the outer two-thirds of the finger stay
# straight and the whole thing swings inward as one rigid tube. A hand closing on an object bends
# hardest at the PIP -- roughly MCP 80 deg, PIP 105 deg, DIP 60 deg -- so the PIP share must lead.
#
# The four fingers also differ from each other: the index rolls more at the PIP, the little finger
# carries more of its closure at the MCP. Identical shares across fingers are exactly the "circular
# cage" ss10 forbids.
JOINT_SHARE_BY_FINGER = {
    "index":  {"01": 0.30, "02": 0.44, "03": 0.26},
    "middle": {"01": 0.31, "02": 0.45, "03": 0.24},
    "ring":   {"01": 0.33, "02": 0.43, "03": 0.24},
    "pinky":  {"01": 0.36, "02": 0.41, "03": 0.23},
}
#: Fallback for callers that are not per-finger (the thumb has its own split).
JOINT_SHARE = {"01": 0.32, "02": 0.44, "03": 0.24}


def joint_share(finger: str) -> dict:
    return JOINT_SHARE_BY_FINGER.get(finger, JOINT_SHARE)


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

def hand_frame(armature: bpy.types.Object, side: str) -> dict:
    """The hand's ANATOMICAL frame, measured off the rest skeleton.

    This exists because the deform rig's `hand_*` bone basis is NOT anatomically aligned: on this
    skeleton its local +Z sits **39.5 degrees** away from the true palmar normal. Everything that
    was derived from that basis inherited the error -- the finger flexion hinges, so fingers twisted
    instead of curling and read as cylinders; and the product grip, so the tube hung off the palm
    inside a cage of fingers instead of resting in it. One wrong assumption, three visible defects.

    The frame is therefore built from landmarks that mean something anatomically:

    * `distal`  wrist -> knuckles, the hand bone's own direction (unambiguous, it is the bone).
    * `radial`  index side positive, from the knuckle line (index MCP -> little MCP).
    * `palmar`  their cross product; the SIGN is voted on by the four fingers, because a rest hand
                already carries a slight resting flexion, so every fingertip lies on the palmar side
                of the ray continuing its own proximal phalanx. All four agree here (-13.3 mm for
                the index down to -5.1 mm for the little finger), so the vote is not marginal.

    Returned vectors are unit, orthonormal and expressed in ARMATURE space; `to_frame` maps an
    armature-space point into hand-anatomical millimetres with the wrist at the origin.
    """
    bones = armature.data.bones
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
        off -= prox * off.dot(prox)          # the part of the resting flexion across the phalanx
        vote += off.dot(palmar)
    if vote < 0.0:
        palmar = -palmar

    radial = distal.cross(palmar).normalized()     # little-finger side -> index side
    distal = palmar.cross(radial).normalized()     # re-orthogonalise

    def to_frame(point) -> Vector:
        d = Vector(point) - wrist
        return Vector((d.dot(radial), d.dot(distal), d.dot(palmar)))

    return {
        "origin": wrist, "radial": radial, "distal": distal, "palmar": palmar,
        "ulnar": -radial, "knuckle": knuckle, "mcp": mcp, "to_frame": to_frame,
    }


def finger_axes(armature: bpy.types.Object, side: str, frame: dict | None = None) -> dict:
    """Per-bone local flexion axes, derived from the measured anatomical frame.

    Rotating a bone by theta about world axis `a` moves its tip by theta * (a x bone_vector). For
    flexion the tip must travel along the palmar normal `n`, so `a = u x n` where `u` is the bone
    direction; expressed in the bone's own rest space that axis is a fixed anatomical constant.

    The formula is unchanged from the first Phase 2B build. What changed is `n`: it is now the
    measured palmar normal from `hand_frame` rather than the hand bone's local +Z. Verified against
    the rest skeleton, that single substitution takes the fingertip-to-palm-centre distance under a
    160 degree fist from 57-62 mm (a hand that never closes) to 38-46 mm, and at 200 degrees to
    8-29 mm -- a real fist -- while keeping every fingertip within 1.2 mm of its own flexion plane.
    """
    frame = frame or hand_frame(armature, side)
    palm_normal = frame["palmar"]
    ulnar = frame["ulnar"]

    # THE THUMB DOES NOT FLEX LIKE A FINGER. A finger's flexion plane is perpendicular to the palm,
    # so `u x palm_normal` is its hinge. The thumb's flexion plane is its OWN plane -- it is an
    # opposable digit, rotated out of the palm at the carpometacarpal joint -- and on this rest
    # skeleton the finger formula lands 110.5 degrees away from it, which is why the thumb used to
    # arrive edge-on and interleave with the tube surface instead of pressing a pad onto it.
    #
    # The thumb's chain plane can be fitted here where a finger's cannot: its metacarpal and distal
    # phalanx differ by 34.2 degrees at rest, so the cross product is well conditioned, whereas a
    # near-straight finger's is numerically meaningless.
    tb = armature.data.bones
    thumb_meta = (Vector(tb[f"thumb_01_{side}"].tail_local)
                  - Vector(tb[f"thumb_01_{side}"].head_local)).normalized()
    thumb_tip = (Vector(tb[f"thumb_03_{side}"].tail_local)
                 - Vector(tb[f"thumb_03_{side}"].head_local)).normalized()
    thumb_hinge = thumb_meta.cross(thumb_tip)
    if thumb_hinge.length < 1e-4:
        thumb_hinge = frame["radial"]          # degenerate rest thumb; fall back to something sane
    thumb_hinge.normalize()
    # Sign: flexing must carry the thumb tip ACROSS the palm, toward the little finger. Rotating a
    # vector `u` about an axis `a` moves its tip along `a x u`, NOT `u x a` -- getting that backwards
    # turns the thumb's flexion into extension, which is what drove the pad radially away from the
    # barrel and made every non-zero flex value score worse than none.
    if thumb_hinge.cross(thumb_meta).dot(ulnar) < 0.0:
        thumb_hinge = -thumb_hinge

    axes = {}
    for name in FINGERS + ("thumb",):
        for seg in ("01", "02", "03"):
            bone_name = f"{name}_{seg}_{side}"
            bone = armature.data.bones[bone_name]
            u = (Vector(bone.tail_local) - Vector(bone.head_local)).normalized()
            rest = bone.matrix_local.to_3x3().inverted()
            flex_world = thumb_hinge if name == "thumb" else u.cross(palm_normal)
            if flex_world.length < 1e-6:
                flex_world = frame["radial"]
            axes[bone_name] = {
                "flex": (rest @ flex_world.normalized()).normalized(),
                "abduct": (rest @ palm_normal).normalized(),
                "oppose": (rest @ u.cross(ulnar).normalized()).normalized(),
                "twist": (rest @ u).normalized(),      # axial roll along the bone (thumb pronation)
            }
    axes["_palm_normal"] = palm_normal
    axes["_ulnar"] = ulnar
    axes["_frame"] = frame
    return axes


#: Thumb opposition is three joints doing three different things (ss11), not one curl scaled up.
#: CMC carries the abduction, the axial pronation that turns the pad to face the fingers, and a
#: little flexion; MCP and IP then flex to close the pad onto the object.
THUMB_FLEX_SHARE = {"01": 0.18, "02": 0.46, "03": 0.36}
THUMB_PRONATION = 0.62      # radians of axial roll at the CMC per unit opposition
THUMB_CMC_FLEX = 0.30       # radians of CMC flexion per unit opposition


def set_finger_totals(armature: bpy.types.Object, side: str, axes: dict,
                      totals: dict, spread_scale: float = 1.0,
                      thumb_oppose: float = 0.0, thumb_flex: float = 0.0,
                      thumb_tip: float = 0.0) -> None:
    """Pose one hand from EXPLICIT per-finger total flexion angles (radians).

    Total flexion is split across MCP/PIP/DIP by that finger's own share, so the PIP leads, the DIP
    trails, and no two fingers describe the same arc.
    """
    for name in FINGERS:
        total = max(0.0, totals.get(name, 0.0))
        for seg, share in joint_share(name).items():
            pb = armature.pose.bones[f"{name}_{seg}_{side}"]
            pb.rotation_mode = "QUATERNION"
            q = Quaternion(axes[f"{name}_{seg}_{side}"]["flex"], total * share)
            if seg == "01":
                q = q @ Quaternion(axes[f"{name}_01_{side}"]["abduct"],
                                   FINGER_TUNING[name]["spread"] * spread_scale)
            pb.rotation_quaternion = q

    # ---- thumb: abduct + pronate + flex at the CMC, then flex the MCP and IP (ss11) -------------
    for seg, flex_share in THUMB_FLEX_SHARE.items():
        pb = armature.pose.bones[f"thumb_{seg}_{side}"]
        pb.rotation_mode = "QUATERNION"
        ax = axes[f"thumb_{seg}_{side}"]
        q = Quaternion(ax["flex"], thumb_flex * flex_share)
        if seg == "03":
            # The IP joint needs its own freedom, not a fixed share of the total. Measured against
            # the barrel, a thumb driven only by a shared total contacts with its MIDDLE phalanx and
            # leaves the pad 25 mm out in the air, because the distal phalanx is 40 mm long against a
            # 23-30 mm cross-section. Curling the last joint is what puts the pad on the tube.
            q = Quaternion(ax["flex"], thumb_tip) @ q
        if seg == "01":
            # Order matters: swing the thumb across the palm, roll it so the pad faces the fingers,
            # then bend it. Without the roll the thumb arrives edge-on and has to be pushed through
            # the object to look like it is touching it.
            q = (Quaternion(ax["oppose"], thumb_oppose)
                 @ Quaternion(ax["twist"], THUMB_PRONATION * thumb_oppose)
                 @ Quaternion(ax["flex"], THUMB_CMC_FLEX * thumb_oppose)
                 @ q)
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
    tip_max = grip["thumb"].get("tip", 0.0) if grip else 0.0
    shaped = minimum_jerk(close)
    set_finger_totals(
        armature, side, axes, totals,
        spread_scale=1.0 - 0.65 * shaped,
        thumb_oppose=(thumb_oppose if thumb_oppose is not None else oppose_max * shaped),
        thumb_flex=flex_max * shaped + 0.18 * squeeze,
        thumb_tip=tip_max * shaped + 0.10 * squeeze,
    )


def relaxed_hand(armature: bpy.types.Object, side: str, axes: dict, amount: float = 1.0) -> None:
    """The treated hand must not be left in bind pose (ss12). A real hand rests with a soft cascade."""
    cascade = {"index": 0.26, "middle": 0.31, "ring": 0.36, "pinky": 0.42}
    for name in FINGERS:
        total = cascade[name] * amount
        for seg, share in joint_share(name).items():
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

def reset_quaternion_continuity() -> None:
    """No-op kept so callers stay stable.

    An earlier version of this module aligned each keyed quaternion with the previous one, on the
    theory that component-wise Bezier interpolation between opposite hemispheres was causing the
    124.8-degree single-frame forearm twist during the approach. Measurement said otherwise: forcing
    a global hemisphere chain ADDED twist spikes at frames 14, 55, 401-405, 413 and 416, because
    dragging keys away from their canonical representatives changes the auto-clamped handle shapes on
    all four component curves. The hypothesis was reasonable and the numbers rejected it, so the
    alignment is not applied.
    """


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
