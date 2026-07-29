"""Phase 2B — authored geometry: NANODERM tube, cap, rest tray, cream strand, cream film.

Everything here is built from explicit vertex maths rather than operator/UI context, so the build is
deterministic and reproducible: the same repository state always produces the same mesh, in the same
vertex order, with the same shape-key deltas. That vertex-order stability is what makes the exported
morph targets comparable between builds.

Coordinate conventions (Blender, Z-up, the imported human faces -Y):

  tube local   +Y  crimped tail -> nozzle;  +Z is the LABEL FACE;  X is the wide oval axis
  strand local +Y  nozzle (y=0) -> tip (y=-1), i.e. a unit strand scaled per frame
  cream film        a patch cut from the treated forearm, keeping its armature weights

Units are metres throughout. A real 30 g pharmacy tube is ~150 mm tall over a ~30 x 23 mm oval
body, and those are the numbers used below.
"""

from __future__ import annotations

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------------------------
# product dimensions — kept in one place so the manifest, the rig and the tests agree
# --------------------------------------------------------------------------------------------

TUBE = {
    "radius_x": 0.0152,        # 30.4 mm across the wide axis of the oval
    "radius_z": 0.0115,        # 23 mm across the label face -> reads as a squeezable tube
    # The barrel is 102 mm, DERIVED FROM THE RIG rather than chosen (ss9).
    #
    # The digits of this hand, solved against the barrel, contact it over 108 mm: the little finger's
    # pad lands 58 mm to the ulnar side of the palm centre and the thumb's 50 mm to the radial side.
    # The first Phase 2B build used an 88 mm barrel, which is shorter than that span, and the
    # consequence was not cosmetic -- the thumb had nothing to press on at its own end and solved to
    # a pose 30 mm off the tube, while the little finger fell off the tail. 102 mm of body plus the
    # shoulder, neck and nozzle gives a 152 mm tube, which is the ordinary size of a 30 g laminate
    # cream tube, so measuring the hand moved this TOWARDS the real product, not away from it.
    #
    # It also has to be longer than the hand is wide (the finger span measures 72 mm here) or the
    # fist covers the whole label and the brand is never readable, which ss12 treats as a failure.
    "body_bottom": -0.0620,
    "body_top": 0.0400,
    "shoulder_top": 0.0570,
    "neck_bottom": 0.0610,
    "neck_top": 0.0750,
    "neck_radius": 0.0062,
    "nozzle_top": 0.0778,
    "bore_radius": 0.0026,
    "bore_depth": 0.0055,
    "crimp_top": -0.0660,
    "crimp_bottom": -0.0742,
    "crimp_half_width": 0.0163,
    "cap_radius": 0.0092,
    "cap_length": 0.0232,
    "segments": 32,
}
"""Nozzle tip sits at local y = 0.0778; overall tube height is 152 mm, a plausible 30 g tube."""

TUBE_NOZZLE_LOCAL = Vector((0.0, TUBE["nozzle_top"] + 0.0015, 0.0))

COLOURS = {
    "tube_body": (0.925, 0.945, 0.955, 1.0),
    "accent": (0.043, 0.318, 0.290, 1.0),      # clinical teal
    "ink": (0.055, 0.090, 0.118, 1.0),
    "bore": (0.045, 0.055, 0.062, 1.0),
    "cream": (0.960, 0.925, 0.855, 1.0),       # warm ivory, per ss15/ss17
    "tray": (0.400, 0.435, 0.470, 1.0),
}

# Artwork is laid out from the SHOULDER DOWN, because the fist covers the lower barrel while the
# tube is held. The brand and active ingredient stay above the index finger and remain readable
# during the product-establish shot.
LABEL_LINES = [
    # (text, y-centre on the tube axis, cap height, colour key, letter spacing)
    ("NANODERM", 0.0268, 0.0092, "ink", 0.10),
    ("CELASTROL (TRIPTERINE) NLC", 0.0152, 0.0031, "accent", 0.02),
    ("Topical Cream 0.05% w/w", 0.0072, 0.0028, "ink", 0.02),
    ("For External Use Only", -0.0110, 0.0025, "ink", 0.02),
    ("30 g", -0.0240, 0.0044, "ink", 0.06),
]
LABEL_RX_BADGE = ("Rx", 0.0352, 0.0052)
LABEL_BAND = (0.0330, 0.0384)


# --------------------------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------------------------

def make_material(name: str, colour, roughness=0.42, metallic=0.0, clearcoat=0.0) -> bpy.types.Material:
    """A plain Principled BSDF, which is what the glTF exporter understands losslessly."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = colour
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if clearcoat and "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
        bsdf.inputs["Coat Roughness"].default_value = 0.12
    return mat


def mesh_object(name: str, bm: bmesh.types.BMesh, collection: bpy.types.Collection) -> bpy.types.Object:
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.update()
    obj = bpy.data.objects.new(name, me)
    collection.objects.link(obj)
    return obj


def add_shape_key(obj: bpy.types.Object, name: str, fn) -> bpy.types.ShapeKey:
    """Add a shape key whose vertex positions are `fn(index, basis_position)`.

    `fn` returns either a Vector (absolute position) or None to leave the vertex at rest.
    """
    if obj.data.shape_keys is None:
        obj.shape_key_add(name="Basis", from_mix=False)
    key = obj.shape_key_add(name=name, from_mix=False)
    key.slider_min = 0.0
    key.slider_max = 1.0
    basis = obj.data.shape_keys.key_blocks["Basis"]
    for i, kp in enumerate(key.data):
        moved = fn(i, basis.data[i].co)
        if moved is not None:
            kp.co = moved
    return key


def smooth_falloff(t: float) -> float:
    """C1 falloff on [0,1] -> [1,0]; used for every localized deformation in this file."""
    t = min(1.0, max(0.0, t))
    return 1.0 - (t * t * (3.0 - 2.0 * t))


# --------------------------------------------------------------------------------------------
# NANODERM tube
# --------------------------------------------------------------------------------------------

def _oval(angle: float, rx: float, rz: float) -> tuple[float, float]:
    return rx * math.cos(angle), rz * math.sin(angle)


def tube_radius_at(y: float) -> tuple[float, float]:
    """Local cross-section semi-axes at height `y`, used by the grip solver to measure contact."""
    t = TUBE
    rings = _tube_profile()
    if y <= rings[0][0]:
        return rings[0][1], rings[0][2]
    for (y0, rx0, rz0), (y1, rx1, rz1) in zip(rings, rings[1:]):
        if y0 <= y <= y1:
            f = 0.0 if y1 == y0 else (y - y0) / (y1 - y0)
            return rx0 + (rx1 - rx0) * f, rz0 + (rz1 - rz0) * f
    return t["neck_radius"], t["neck_radius"]


def _tube_profile() -> list[tuple[float, float, float]]:
    """(y, radius_x, radius_z) rings from the crimped tail up to the nozzle rim."""
    t = TUBE
    rx, rz = t["radius_x"], t["radius_z"]
    rings: list[tuple[float, float, float]] = [
        (t["crimp_bottom"], t["crimp_half_width"], 0.0011),
        (t["crimp_bottom"] + 0.0030, t["crimp_half_width"], 0.0026),
        (t["crimp_top"], t["crimp_half_width"] * 0.96, 0.0052),
        (t["crimp_top"] + 0.0045, rx * 0.94, rz * 0.62),
    ]
    # barrel: enough rings that a squeeze reads as a smooth flattening, not a two-ring pinch
    barrel_rings = 14
    for i in range(barrel_rings + 1):
        f = i / barrel_rings
        y = t["body_bottom"] + f * (t["body_top"] - t["body_bottom"])
        # gentle waist so the tube is not a perfect extrusion
        swell = 1.0 + 0.035 * math.sin(math.pi * f)
        rings.append((y, rx * swell, rz * swell))
    rings += [
        (t["body_top"] + 0.0050, rx * 0.93, rz * 0.95),
        (t["shoulder_top"], rx * 0.52, rz * 0.62),
        (t["neck_bottom"], t["neck_radius"] * 1.12, t["neck_radius"] * 1.12),
        (t["neck_bottom"] + 0.0040, t["neck_radius"], t["neck_radius"]),
        (t["neck_top"], t["neck_radius"], t["neck_radius"]),
        (t["nozzle_top"], t["neck_radius"] * 0.94, t["neck_radius"] * 0.94),
    ]
    return rings


def build_tube_mesh() -> tuple[bmesh.types.BMesh, dict]:
    """Loft the tube profile, close the tail, and sink a real bore into the nozzle."""
    t = TUBE
    seg = t["segments"]
    bm = bmesh.new()
    rings = _tube_profile()

    ring_verts: list[list[bmesh.types.BMVert]] = []
    for (y, rx, rz) in rings:
        vs = []
        for s in range(seg):
            a = 2.0 * math.pi * s / seg
            x, z = _oval(a, rx, rz)
            vs.append(bm.verts.new((x, y, z)))
        ring_verts.append(vs)

    body_faces = []
    for i in range(len(ring_verts) - 1):
        lo, hi = ring_verts[i], ring_verts[i + 1]
        for s in range(seg):
            n = (s + 1) % seg
            body_faces.append(bm.faces.new((lo[s], lo[n], hi[n], hi[s])))

    # tail cap
    tail_c = bm.verts.new((0.0, rings[0][0], 0.0))
    for s in range(seg):
        n = (s + 1) % seg
        body_faces.append(bm.faces.new((ring_verts[0][n], ring_verts[0][s], tail_c)))

    # nozzle: rim -> bore wall -> bore floor, so the opening is a visible hole (ss13)
    rim = ring_verts[-1]
    bore_top = []
    for s in range(seg):
        a = 2.0 * math.pi * s / seg
        bore_top.append(bm.verts.new((t["bore_radius"] * math.cos(a), t["nozzle_top"],
                                      t["bore_radius"] * math.sin(a))))
    rim_faces = []
    for s in range(seg):
        n = (s + 1) % seg
        rim_faces.append(bm.faces.new((rim[s], rim[n], bore_top[n], bore_top[s])))

    bore_bottom = []
    for s in range(seg):
        a = 2.0 * math.pi * s / seg
        bore_bottom.append(bm.verts.new((t["bore_radius"] * 0.85 * math.cos(a),
                                         t["nozzle_top"] - t["bore_depth"],
                                         t["bore_radius"] * 0.85 * math.sin(a))))
    bore_faces = []
    for s in range(seg):
        n = (s + 1) % seg
        bore_faces.append(bm.faces.new((bore_top[s], bore_top[n], bore_bottom[n], bore_bottom[s])))
    floor_c = bm.verts.new((0.0, t["nozzle_top"] - t["bore_depth"], 0.0))
    for s in range(seg):
        n = (s + 1) % seg
        bore_faces.append(bm.faces.new((bore_bottom[n], bore_bottom[s], floor_c)))

    bm.normal_update()
    slots = {
        "body": [f.index for f in body_faces],
        "rim": [f.index for f in rim_faces],
        "bore": [f.index for f in bore_faces],
    }
    bm.faces.index_update()
    return bm, slots


def _wrap_onto_tube(x: float, y: float, extra: float = 0.0006) -> Vector:
    """Map flat label-artwork coordinates onto the tube's +Z face.

    `x` is the horizontal position in metres measured across the label, `y` the position along the
    tube axis. The wrap uses the oval's own radii, so text stays glued to the surface instead of
    floating off the curve as a cylindrical approximation would.
    """
    rx, rz = TUBE["radius_x"], TUBE["radius_z"]
    # arc-length parameterisation around the oval, front face centred at angle pi/2
    a = math.pi / 2 - x / rx * 0.92
    return Vector(((rx + extra) * math.cos(a), y, (rz + extra) * math.sin(a)))


def _text_mesh(text: str, size: float, spacing: float) -> bpy.types.Object:
    """Blender-native typography converted to geometry (ss13: no external font dependency)."""
    curve = bpy.data.curves.new(type="FONT", name=f"txt_{text[:12]}")
    curve.body = text
    curve.size = size
    curve.space_character = 1.0 + spacing
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.resolution_u = 3
    obj = bpy.data.objects.new(f"txt_{text[:12]}", curve)
    bpy.context.scene.collection.objects.link(obj)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.curves.remove(curve)
    holder = bpy.data.objects.new(f"lbl_{text[:12]}", me)
    return holder


def build_label_bmesh(max_width: float) -> tuple[bmesh.types.BMesh, list[str]]:
    """Flatten every label line into one bmesh already wrapped onto the tube surface."""
    bm = bmesh.new()
    layer_names: list[str] = []
    colour_of_face: list[str] = []

    def emit(text, y_centre, cap_height, colour_key, spacing, x_centre=0.0):
        holder = _text_mesh(text, cap_height * 1.42, spacing)
        me = holder.data
        if not me.vertices:
            bpy.data.meshes.remove(me)
            return
        xs = [v.co.x for v in me.vertices]
        width = max(xs) - min(xs)
        scale = 1.0 if width <= max_width else max_width / width
        vmap = {}
        for i, v in enumerate(me.vertices):
            p = _wrap_onto_tube(x_centre + v.co.x * scale, y_centre + v.co.y * scale)
            vmap[i] = bm.verts.new(p)
        for poly in me.polygons:
            try:
                f = bm.faces.new([vmap[i] for i in poly.vertices])
                colour_of_face.append(colour_key)
            except ValueError:
                pass  # duplicate face from overlapping glyph outlines
        bpy.data.meshes.remove(me)

    for (text, y, cap, colour, spacing) in LABEL_LINES:
        emit(text, y, cap, colour, spacing)
    emit(LABEL_RX_BADGE[0], LABEL_RX_BADGE[1], LABEL_RX_BADGE[2], "accent", 0.0,
         x_centre=-max_width * 0.42)

    # teal shoulder band: a wrapped strip near the top of the barrel
    band_lo, band_hi = LABEL_BAND
    seg = 48
    ring_lo, ring_hi = [], []
    for s in range(seg + 1):
        x = (-0.5 + s / seg) * (max_width * 1.62)
        ring_lo.append(bm.verts.new(_wrap_onto_tube(x, band_lo)))
        ring_hi.append(bm.verts.new(_wrap_onto_tube(x, band_hi)))
    for s in range(seg):
        try:
            bm.faces.new((ring_lo[s], ring_lo[s + 1], ring_hi[s + 1], ring_hi[s]))
            colour_of_face.append("accent")
        except ValueError:
            pass

    bm.normal_update()
    layer_names = colour_of_face
    return bm, layer_names


def build_tube(collection: bpy.types.Collection) -> bpy.types.Object:
    """The full NANODERM tube: lofted body plus label geometry joined into one exportable mesh."""
    bm, slots = build_tube_mesh()
    obj = mesh_object("NANODERM_tube", bm, collection)

    mat_body = make_material("NANODERM_tube_body", COLOURS["tube_body"], roughness=0.34, clearcoat=0.3)
    mat_ink = make_material("NANODERM_label_ink", COLOURS["ink"], roughness=0.48)
    mat_accent = make_material("NANODERM_accent", COLOURS["accent"], roughness=0.40)
    mat_bore = make_material("NANODERM_nozzle_bore", COLOURS["bore"], roughness=0.85)
    for m in (mat_body, mat_ink, mat_accent, mat_bore):
        obj.data.materials.append(m)
    IDX = {"body": 0, "ink": 1, "accent": 2, "bore": 3}

    for f in obj.data.polygons:
        f.material_index = IDX["body"]
    for i in slots["bore"]:
        obj.data.polygons[i].material_index = IDX["bore"]
    for i in slots["rim"]:
        obj.data.polygons[i].material_index = IDX["bore"]

    # ---- label, joined in so the squeeze morphs carry it ----
    label_bm, face_colours = build_label_bmesh(max_width=TUBE["radius_x"] * 1.52)
    tmp = mesh_object("NANODERM_label_tmp", label_bm, collection)
    for m in (mat_body, mat_ink, mat_accent, mat_bore):
        tmp.data.materials.append(m)
    for f, key in zip(tmp.data.polygons, face_colours):
        f.material_index = IDX["ink"] if key == "ink" else IDX["accent"]

    bpy.ops.object.select_all(action="DESELECT")
    tmp.select_set(True)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()

    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj.data.update()
    obj["p2b_role"] = "product"
    obj["p2b_export"] = True
    obj["p2b_provenance"] = "VISUAL_ONLY"
    return obj


def add_tube_shape_keys(obj: bpy.types.Object) -> list[str]:
    """Squeeze / depletion morphs. Only the barrel moves; nozzle, neck and crimp stay rigid (ss14)."""
    t = TUBE
    lo, hi = t["body_bottom"], t["body_top"]
    # the fist sits over the LOWER barrel (see grip_matrix), so that is where the tube compresses
    grip_centre = lo + 0.40 * (hi - lo)
    grip_half = 0.62 * (hi - lo)

    def barrel_weight(y: float) -> float:
        if y < lo - 0.004 or y > hi + 0.004:
            return 0.0
        return smooth_falloff(abs(y - grip_centre) / grip_half)

    def compress(amount_x: float, amount_z: float, extra=None):
        def fn(_i, co):
            w = barrel_weight(co.y)
            if w <= 0.0:
                return None
            p = Vector(co)
            p.x *= 1.0 - amount_x * w
            p.z *= 1.0 + amount_z * w
            if extra is not None:
                p = extra(p, w)
            return p
        return fn

    names = []
    # finger pads resting on the tube: a small, even indentation
    names.append(add_shape_key(obj, "TUBE_GRIP_COMPRESSION", compress(0.10, 0.055)).name)
    # a real squeeze: strong flattening between pads and thumb, lateral bulge to keep volume plausible
    names.append(add_shape_key(obj, "TUBE_SQUEEZE", compress(0.38, 0.24)).name)

    # depletion: the tail collapses first, as an emptying tube does
    def deplete(_i, co):
        if co.y > hi:
            return None
        tail = smooth_falloff(max(0.0, (co.y - (lo - 0.010)) / ((hi - lo) * 0.85)))
        if tail <= 0.0:
            return None
        p = Vector(co)
        p.x *= 1.0 - 0.30 * tail
        p.z *= 1.0 - 0.42 * tail
        return p
    names.append(add_shape_key(obj, "TUBE_DEPLETION", deplete).name)

    # a crease where a squeezed tube folds, just above the crimp
    def crease(_i, co):
        d = abs(co.y - (lo + 0.010))
        w = smooth_falloff(d / 0.008)
        if w <= 0.0:
            return None
        p = Vector(co)
        p.z *= 1.0 - 0.30 * w
        p.x *= 1.0 - 0.06 * w
        return p
    names.append(add_shape_key(obj, "TUBE_CREASE", crease).name)

    # elastic rebound after the pressure comes off
    names.append(add_shape_key(obj, "TUBE_RECOVERY", compress(-0.045, -0.030)).name)
    return names


def build_cap(collection: bpy.types.Collection) -> bpy.types.Object:
    """Removable cap, ribbed so it does not read as a plain cylinder."""
    t = TUBE
    seg = 28
    bm = bmesh.new()
    rings = [
        (0.0, t["cap_radius"] * 0.97),
        (0.0016, t["cap_radius"]),
        (t["cap_length"] - 0.0035, t["cap_radius"]),
        (t["cap_length"] - 0.0012, t["cap_radius"] * 0.93),
        (t["cap_length"], t["cap_radius"] * 0.80),
    ]
    ring_verts = []
    for (y, r) in rings:
        vs = []
        for s in range(seg):
            a = 2.0 * math.pi * s / seg
            rib = 1.0 + (0.010 if (0.0016 < y < t["cap_length"] - 0.0035) else 0.0) * math.cos(a * seg / 2)
            vs.append(bm.verts.new((r * rib * math.cos(a), y, r * rib * math.sin(a))))
        ring_verts.append(vs)
    for i in range(len(ring_verts) - 1):
        for s in range(seg):
            n = (s + 1) % seg
            bm.faces.new((ring_verts[i][s], ring_verts[i][n], ring_verts[i + 1][n], ring_verts[i + 1][s]))
    for idx, flip in ((0, True), (len(ring_verts) - 1, False)):
        c = bm.verts.new((0.0, rings[idx][0], 0.0))
        for s in range(seg):
            n = (s + 1) % seg
            tri = (ring_verts[idx][s], ring_verts[idx][n], c)
            bm.faces.new(tri if flip else tuple(reversed(tri)))
    bm.normal_update()
    obj = mesh_object("NANODERM_cap", bm, collection)
    obj.data.materials.append(make_material("NANODERM_cap_mat", COLOURS["accent"], roughness=0.38))
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj["p2b_role"] = "product"
    obj["p2b_export"] = True
    return obj


def build_tray(collection: bpy.types.Collection) -> list[bpy.types.Object]:
    """A small neutral rest surface. It exists so the tube and cap have somewhere to be (ss13/ss15)."""
    w, d, lip = 0.150, 0.105, 0.006
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(w, d, 0.008), verts=bm.verts)
    tray = mesh_object("PRODUCT_tray", bm, collection)
    bm2 = bmesh.new()
    bmesh.ops.create_cube(bm2, size=1.0)
    bmesh.ops.scale(bm2, vec=(0.055, 0.055, 0.92), verts=bm2.verts)
    stand = mesh_object("PRODUCT_tray_stand", bm2, collection)
    mat = make_material("PRODUCT_tray_mat", COLOURS["tray"], roughness=0.62)
    for o in (tray, stand):
        o.data.materials.append(mat)
        o["p2b_role"] = "set"
        o["p2b_export"] = True
    _ = lip
    return [tray, stand]


# --------------------------------------------------------------------------------------------
# cream strand
# --------------------------------------------------------------------------------------------

STRAND_RINGS = 20
STRAND_SEG = 14

def build_strand(collection: bpy.types.Collection) -> bpy.types.Object:
    """A unit-length strand along -Y. Object scale.y is the nozzle-to-skin distance each frame."""
    bm = bmesh.new()
    ring_verts = []
    for i in range(STRAND_RINGS + 1):
        f = i / STRAND_RINGS
        vs = []
        for s in range(STRAND_SEG):
            a = 2.0 * math.pi * s / STRAND_SEG
            # basis: collapsed at the nozzle so the strand is invisible before it is extruded
            vs.append(bm.verts.new((0.0002 * math.cos(a), -0.0006 * f, 0.0002 * math.sin(a))))
        ring_verts.append(vs)
    for i in range(STRAND_RINGS):
        for s in range(STRAND_SEG):
            n = (s + 1) % STRAND_SEG
            bm.faces.new((ring_verts[i][s], ring_verts[i][n], ring_verts[i + 1][n], ring_verts[i + 1][s]))
    # tip cap
    tip = bm.verts.new((0.0, -0.0006, 0.0))
    for s in range(STRAND_SEG):
        n = (s + 1) % STRAND_SEG
        bm.faces.new((ring_verts[-1][n], ring_verts[-1][s], tip))
    bm.normal_update()
    obj = mesh_object("CREAM_strand", bm, collection)
    obj.data.materials.append(make_material("CREAM_substance", COLOURS["cream"], roughness=0.18, clearcoat=0.85))
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj["p2b_role"] = "cream"
    obj["p2b_export"] = True
    obj["p2b_provenance"] = "VISUAL_ONLY"
    return obj


def add_strand_shape_keys(obj: bpy.types.Object) -> list[str]:
    """The ten dispensing stages of ss15, expressed as five morphs the timeline blends between."""
    n_ring = STRAND_RINGS
    total = (n_ring + 1) * STRAND_SEG

    def shape(reach: float, radius_fn):
        """reach = fraction of the unit length the cream has travelled."""
        def fn(i, co):
            if i >= total:                      # the tip cap vertex
                return Vector((0.0, -reach, 0.0))
            ring = i // STRAND_SEG
            s = i % STRAND_SEG
            f = ring / n_ring
            a = 2.0 * math.pi * s / STRAND_SEG
            r = radius_fn(f)
            return Vector((r * math.cos(a), -reach * f, r * math.sin(a)))
        return fn

    names = []
    # 1-2: a bead forming at the nozzle before anything falls
    names.append(add_shape_key(obj, "STRAND_NOZZLE_BEAD",
                               shape(0.055, lambda f: 0.0034 * (0.35 + 0.65 * math.sin(math.pi * min(1.0, f * 1.05))))).name)
    # 3: short strand
    names.append(add_shape_key(obj, "STRAND_SHORT",
                               shape(0.42, lambda f: 0.0040 * (1.0 - 0.20 * f) + 0.0016 * math.sin(math.pi * f))).name)
    # 4-5: extended strand reaching the skin, fatter at the falling tip (surface tension read)
    names.append(add_shape_key(obj, "STRAND_EXTENDED",
                               shape(1.0, lambda f: 0.0042 + 0.0026 * f ** 2)).name)
    # 7: thinning just before it lets go
    names.append(add_shape_key(obj, "STRAND_THINNING",
                               shape(1.0, lambda f: 0.0038 * (1.0 - 0.72 * math.sin(math.pi * f)) + 0.0022 * f ** 3)).name)
    # 8-9: separated — a small residual tail at the nozzle, nothing below
    names.append(add_shape_key(obj, "STRAND_BROKEN",
                               shape(0.16, lambda f: 0.0030 * max(0.0, 1.0 - f * 1.35))).name)
    return names


# --------------------------------------------------------------------------------------------
# cream film on the treated forearm
# --------------------------------------------------------------------------------------------

def forearm_frame(armature: bpy.types.Object, bone_name: str) -> tuple[Vector, Vector]:
    b = armature.data.bones[bone_name]
    head = Vector(b.head_local)
    axis = (Vector(b.tail_local) - head).normalized()
    return head, axis


def build_cream_film(body: bpy.types.Object, armature: bpy.types.Object, bone_name: str,
                     collection: bpy.types.Collection, axial_range=(0.030, 0.250),
                     angle_span=math.radians(160.0), subdivisions=2) -> tuple[bpy.types.Object, dict]:
    """Cut the treated forearm's outer surface out of the body mesh and lift it into a cream film.

    Keeping the original vertices means the film inherits the body's armature weights, so it follows
    the arm exactly instead of being a separately animated sleeve that can drift or lag (ss16).
    """
    head, axis = forearm_frame(armature, bone_name)
    gi = body.vertex_groups[bone_name].index
    # a stable reference for the "outward" side of the arm: away from the body midline and forward
    ref = Vector((0.55, -0.72, 0.42)).normalized()
    side = (ref - axis * ref.dot(axis)).normalized()
    up = axis.cross(side).normalized()

    keep_idx = []
    stats = {"axial": [], "radius": []}
    for v in body.data.vertices:
        w = next((g.weight for g in v.groups if g.group == gi), 0.0)
        if w < 0.18:
            continue
        d = Vector(v.co) - head
        t = d.dot(axis)
        if not (axial_range[0] <= t <= axial_range[1]):
            continue
        radial = d - axis * t
        r = radial.length
        if r < 1e-5:
            continue
        ang = math.atan2(radial.dot(up), radial.dot(side))
        if abs(ang) > angle_span * 0.5:
            continue
        keep_idx.append(v.index)
        stats["axial"].append(t)
        stats["radius"].append(r)

    if len(keep_idx) < 40:
        raise RuntimeError(f"cream film: only {len(keep_idx)} forearm vertices matched — patch too small")

    keep = set(keep_idx)
    bm = bmesh.new()
    bm.from_mesh(body.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context="VERTS")
    bm.verts.ensure_lookup_table()
    if not bm.faces:
        bm.free()
        raise RuntimeError("cream film: patch has no faces")
    # Subdivide so the cream morphs have somewhere to go: the body's forearm loops are far too
    # coarse to carry a bead, ridges and stroke lines. bmesh interpolates the deform layer, so the
    # new vertices inherit correct armature weights.
    for _ in range(max(0, subdivisions)):
        bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=1, use_grid_fill=True)
        bm.verts.ensure_lookup_table()
    deform_layer = bm.verts.layers.deform.active
    weights: list[dict[int, float]] = []
    for v in bm.verts:
        weights.append({gi_: w for gi_, w in (v[deform_layer].items() if deform_layer else [])})
    me = bpy.data.meshes.new("CREAM_film")
    bm.to_mesh(me)
    bm.free()

    obj = bpy.data.objects.new("CREAM_film", me)
    collection.objects.link(obj)
    obj.matrix_world = body.matrix_world.copy()

    # carry the weights across so the armature deforms the film identically to the skin
    name_by_index = {g.index: g.name for g in body.vertex_groups}
    for g in body.vertex_groups:
        obj.vertex_groups.new(name=g.name)
    for new_i, wmap in enumerate(weights):
        for group_index, w in wmap.items():
            if w <= 0.0:
                continue
            obj.vertex_groups[name_by_index[group_index]].add([new_i], w, "REPLACE")
    ordered = keep_idx

    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = armature
    obj.parent = armature

    obj.data.materials.append(make_material("CREAM_film_mat", COLOURS["cream"], roughness=0.16, clearcoat=0.9))
    obj.data.polygons.foreach_set("use_smooth", [True] * len(obj.data.polygons))
    obj["p2b_role"] = "cream"
    obj["p2b_export"] = True
    obj["p2b_provenance"] = "VISUAL_ONLY"

    # A RADIUS PROFILE, not a single mean. The forearm tapers by roughly a third from elbow to
    # wrist, so a mean radius puts the applying palm ~10 mm inside the skin at one end of the stroke
    # and ~10 mm off it at the other. Everything that has to sit ON the arm — the deposit point, the
    # palm contact targets — reads its radius from this.
    BINS = 12
    a_lo, a_hi = min(stats["axial"]), max(stats["axial"])
    buckets: list[list[float]] = [[] for _ in range(BINS)]
    for t, r in zip(stats["axial"], stats["radius"]):
        idx = min(BINS - 1, int((t - a_lo) / max(1e-6, a_hi - a_lo) * BINS))
        buckets[idx].append(r)
    profile = []
    for i, bucket in enumerate(buckets):
        t = a_lo + (i + 0.5) * (a_hi - a_lo) / BINS
        if bucket:
            bucket.sort()
            profile.append((t, bucket[int(len(bucket) * 0.75)]))   # upper quartile = the surface
    if not profile:
        raise RuntimeError("cream film: could not build a forearm radius profile")

    info = {
        "vertices": len(me.vertices),
        "triangles": sum(len(p.vertices) - 2 for p in me.polygons),
        "axial_min": a_lo, "axial_max": a_hi,
        "radius_mean": sum(stats["radius"]) / len(stats["radius"]),
        "radius_profile": profile,
        "source_indices": ordered,
        "head": head, "axis": axis, "side": side, "up": up,
    }
    return obj, info


def radius_at(profile: list[tuple[float, float]], axial: float) -> float:
    """Interpolate the measured forearm radius at an axial position along the bone."""
    if axial <= profile[0][0]:
        return profile[0][1]
    for (t0, r0), (t1, r1) in zip(profile, profile[1:]):
        if t0 <= axial <= t1:
            f = 0.0 if t1 == t0 else (axial - t0) / (t1 - t0)
            return r0 + (r1 - r0) * f
    return profile[-1][1]


def _vertex_normals(obj: bpy.types.Object) -> list[Vector]:
    obj.data.update()
    return [Vector(v.normal) for v in obj.data.vertices]


def add_cream_film_shape_keys(obj: bpy.types.Object, info: dict) -> list[str]:
    """Thick bead -> compressed bead -> two spread stages -> thin final film (ss17).

    Every key is a PURE BUMP that falls to zero at its own edges, and the basis sits a fifth of a
    millimetre proud of the skin. That matters because shape keys ADD: an earlier version gave each
    key a constant base thickness, so two keys crossfading at 1.0 stacked into a 17 mm shell with a
    hard ragged rim standing off the arm. With pure bumps a crossfade only sums where the two
    profiles actually overlap, and the film reads as cream on skin at every point in the timeline.
    """
    head, axis, side, up = info["head"], info["axis"], info["side"], info["up"]
    normals = _vertex_normals(obj)

    axials = [(Vector(v.co) - head).dot(axis) for v in obj.data.vertices]
    a_lo, a_hi = min(axials), max(axials)
    deposit_a = a_lo + 0.30 * (a_hi - a_lo)

    # Basis TUCKED UNDER the skin. This is what gives the film a soft organic border: every key is
    # `(SINK + peak) * shape`, so the film only emerges where its own profile is strong enough to
    # lift it clear of the skin, and the boundary is wherever that crossing happens. With the basis
    # proud of the skin instead, the whole cut patch stayed visible as a hard-edged shell over the
    # entire forearm no matter what the weights were.
    SINK = 0.0016
    for i, v in enumerate(obj.data.vertices):
        v.co = Vector(v.co) - normals[i] * SINK
    obj.data.update()

    def lift(thickness_fn):
        def fn(i, co):
            t = (Vector(co) - head).dot(axis)
            radial = (Vector(co) - head) - axis * t
            ang = math.atan2(radial.dot(up), radial.dot(side))
            h = thickness_fn(t, ang)
            if h <= 0.0:
                return None
            n = normals[i]
            if n.length_squared < 1e-9:
                n = radial.normalized() if radial.length_squared > 1e-12 else Vector((0, 0, 1))
            return Vector(co) + n * h
        return fn

    def bead(centre, sigma_a, sigma_ang, peak):
        span = SINK + peak
        def f(t, ang):
            da = (t - centre) / sigma_a
            dang = ang / sigma_ang
            g = math.exp(-0.5 * (da * da + dang * dang))
            return span * g if g > 0.02 else 0.0
        return f

    def band(lo, hi, peak, ridge=0.0, across_deg=48.0, feather=0.026):
        span = SINK + peak
        def f(t, ang):
            if t < lo or t > hi:
                return 0.0
            # taper to nothing at both ends and at the sides: no rim, no hard edge
            along = smooth_falloff(max(0.0, (lo + feather - t) / feather)) \
                * smooth_falloff(max(0.0, (t - (hi - feather)) / feather))
            across = smooth_falloff(abs(ang) / math.radians(across_deg))
            if along <= 0.0 or across <= 0.0:
                return 0.0
            shape = along * across
            h = span * shape
            if ridge:
                # directional stroke lines: thickness varies along the wipe, never below zero
                h += ridge * (0.5 + 0.5 * math.sin(t * 195.0)) * shape
            return h
        return f

    names = []
    names.append(add_shape_key(obj, "CREAM_CONTACT_BEAD",
                               lift(bead(deposit_a, 0.017, math.radians(27.0), 0.0042))).name)
    names.append(add_shape_key(obj, "CREAM_COMPRESSED_BEAD",
                               lift(bead(deposit_a, 0.030, math.radians(44.0), 0.0026))).name)
    names.append(add_shape_key(obj, "CREAM_SPREAD_PRIMARY",
                               lift(band(a_lo + 0.022, deposit_a + 0.056, 0.0022, 0.00030, 44.0))).name)
    names.append(add_shape_key(obj, "CREAM_SPREAD_SECONDARY",
                               lift(band(a_lo + 0.016, a_hi - 0.034, 0.0018, 0.00034, 48.0))).name)
    names.append(add_shape_key(obj, "CREAM_FINAL_FILM",
                               lift(band(a_lo + 0.014, a_hi - 0.030, 0.0013, 0.00038, 50.0))).name)
    return names


# --------------------------------------------------------------------------------------------
# localized skin indentation
# --------------------------------------------------------------------------------------------

def indent_positions(info: dict, count: int = 3) -> list[Vector]:
    """Contact points spaced along the stroke path, in the body mesh's own space.

    The radius comes from the measured profile, not the mean: the forearm tapers from ~50 mm at the
    elbow to ~27 mm at the wrist, so a single mean radius puts the dent centres well inside the arm
    at one end and outside it at the other — and a dent centred inside the arm does nothing visible
    where the palm actually is.
    """
    head, axis, side = info["head"], info["axis"], info["side"]
    a_lo, a_hi = info["axial_min"], info["axial_max"]
    profile = info["radius_profile"]
    out = []
    for i in range(count):
        f = 0.22 + 0.56 * (i / max(1, count - 1))
        t = a_lo + f * (a_hi - a_lo)
        out.append(head + axis * t + side * radius_at(profile, t))
    return out


def add_skin_indent_shape_keys(target: bpy.types.Object, info: dict, radius=0.052,
                               depth=0.0068, ridge=0.26, prefix="SKIN_INDENT",
                               restrict: set | None = None) -> list[str]:
    """Palm-sized dents plus a compensating ridge of displaced tissue (ss16).

    Applied to both the body mesh and the cream film with identical maths, so the film sits in the
    dent instead of floating over it.
    """
    normals = _vertex_normals(target)
    centres = indent_positions(info, 3)
    axis = info["axis"]
    side = info["side"]
    names = []

    def dent(centre):
        def fn(i, co):
            if restrict is not None and i not in restrict:
                return None
            n = normals[i]
            if n.length_squared < 1e-9:
                return None
            # ONLY the surface facing the palm. A plain Euclidean radius reaches around a 40 mm
            # forearm and dents its far side too, which showed up as a hard notch in the silhouette
            # rather than as compression under the hand.
            facing = n.normalized().dot(side)
            if facing <= 0.15:
                return None
            d = Vector(co) - centre
            dist = d.length
            if dist > radius * 1.6:
                return None
            shade = smooth_falloff(max(0.0, (0.45 - facing) / 0.45))   # fade out around the curve
            core = smooth_falloff(dist / radius) * shade
            rim = math.exp(-((dist - radius * 0.95) / (radius * 0.40)) ** 2) * shade
            # push in under the palm, lift a restrained ridge just outside it
            return Vector(co) + n * (-depth * core + depth * ridge * rim)
        return fn

    for i, c in enumerate(centres):
        names.append(add_shape_key(target, f"{prefix}_CONTACT_{'ABC'[i]}", dent(c)).name)

    # release: a much shallower residual impression that relaxes to nothing
    def relax(i, co):
        if restrict is not None and i not in restrict:
            return None
        n = normals[i]
        if n.length_squared < 1e-9:
            return None
        facing = n.normalized().dot(side)
        if facing <= 0.15:
            return None
        best = min((Vector(co) - c).length for c in centres)
        if best > radius * 1.3:
            return None
        shade = smooth_falloff(max(0.0, (0.45 - facing) / 0.45))
        return Vector(co) + n * (-depth * 0.22 * smooth_falloff(best / (radius * 1.2)) * shade)
    names.append(add_shape_key(target, f"{prefix}_RELEASE", relax).name)
    _ = axis
    return names


# --------------------------------------------------------------------------------------------
# pose-dependent hand correctives (ss8)
# --------------------------------------------------------------------------------------------

def add_hand_corrective_shape_keys(body: bpy.types.Object, armature: bpy.types.Object,
                                   side: str, frame: dict, flesh: dict) -> list[str]:
    """The hand deformations linear-blend skinning cannot produce, authored as shape keys.

    Skinning moves skin with bones. It has no notion of a knuckle riding up under the skin as a
    finger closes, of the clefts between finger roots deepening, of the thumb web bunching, or of the
    palm cupping around what it holds. Their absence is exactly the "mitten / inflated silhouette,
    finger roots and joints poorly defined" the completion review reported: the pose can be perfectly
    correct and the hand still read as one soft volume, because every feature that tells the eye
    "these are five separate fingers on an arched palm" is a volume change, not a rotation.

    Every centre and radius below is read off the rest skeleton and the measured soft tissue, so the
    correctives land on this hand rather than on a generic one. All five are pure bumps that fall to
    zero at their own edges, which is what lets them be blended and summed without stacking.

    Driven from the grip closure by `animate_morphs`, so they appear as the hand closes and relax as
    it opens -- pose-dependent, which is the whole point of a corrective.
    """
    bones = armature.data.bones
    normals = _vertex_normals(body)
    palmar, radial, distal = frame["palmar"], frame["radial"], frame["distal"]
    fingers = ("index", "middle", "ring", "pinky")
    mcp = {f: Vector(bones[f"{f}_01_{side}"].head_local) for f in fingers}

    # Only vertices this hand actually owns; without this the maths reaches into the other hand's
    # geometry wherever the two happen to pass close in rest space.
    own = set()
    groups = {f"hand_{side}"} | {f"{n}_{s}_{side}" for n in fingers + ("thumb",)
                                 for s in ("01", "02", "03")}
    indices = {body.vertex_groups[g].index for g in groups if g in body.vertex_groups}
    for v in body.data.vertices:
        if sum(g.weight for g in v.groups if g.group in indices) > 0.5:
            own.add(v.index)

    def bump(centres, direction, amount, radius, facing_min=0.15, sign=1.0):
        """Displace `own` vertices near any centre, along `direction`, if they face that way."""
        def fn(i, co):
            if i not in own:
                return None
            n = normals[i]
            if n.length_squared < 1e-9:
                return None
            d = direction(co) if callable(direction) else direction
            facing = n.normalized().dot(d)
            if facing <= facing_min:
                return None
            best = None
            for c in centres:
                dist = (Vector(co) - c).length
                if best is None or dist < best:
                    best = dist
            if best is None or best > radius:
                return None
            w = smooth_falloff(best / radius) * smooth_falloff(max(0.0, (0.5 - facing) / 0.5))
            return Vector(co) + n * (sign * amount * w)
        return fn

    names = []

    # ---- knuckles ------------------------------------------------------------------------------
    # The MCP heads ride up under the dorsal skin as the hand closes. Centres are the measured head
    # positions pushed out to the skin along the dorsal normal.
    knuckle_centres = [m - palmar * (flesh[f"{f}_01_{side}"]["mid"] * 0.45)
                       for f, m in mcp.items()]
    names.append(add_shape_key(
        body, f"HAND_{side.upper()}_KNUCKLES",
        bump(knuckle_centres, -palmar, 0.0052, 0.019)).name)

    # ---- finger roots --------------------------------------------------------------------------
    # Deepen the cleft between each adjacent pair of finger roots. This is the single strongest cue
    # against a mitten silhouette: without it the four roots share one continuous surface.
    order = list(fingers)
    clefts = []
    for a, b in zip(order, order[1:]):
        mid = (mcp[a] + mcp[b]) * 0.5 + distal * 0.010
        clefts.append(mid - palmar * 0.004)
        clefts.append(mid + palmar * 0.004)
    names.append(add_shape_key(
        body, f"HAND_{side.upper()}_FINGER_ROOTS",
        bump(clefts, lambda co: (Vector(co) - _nearest(clefts, co)).normalized()
             if (Vector(co) - _nearest(clefts, co)).length > 1e-6 else palmar,
             -0.0044, 0.015, facing_min=-1.0)).name)

    # ---- thumb web -----------------------------------------------------------------------------
    # The first web space bunches when the thumb opposes; the thenar eminence firms up beside it.
    web = (Vector(bones[f"thumb_01_{side}"].tail_local) + mcp["index"]) * 0.5
    thenar = (Vector(bones[f"thumb_01_{side}"].head_local)
              + Vector(bones[f"thumb_01_{side}"].tail_local)) * 0.5 + palmar * 0.012
    names.append(add_shape_key(
        body, f"THUMB_{side.upper()}_WEB",
        bump([web, thenar], palmar, 0.0044, 0.024, facing_min=0.0)).name)

    # ---- palm arch -----------------------------------------------------------------------------
    # A gripping palm cups: the transverse arch deepens across the middle of the hand and the
    # hypothenar rolls in towards the thumb.
    wrist = Vector(bones[f"hand_{side}"].head_local)
    arch = [wrist * 0.45 + (sum(mcp.values(), Vector()) / 4.0) * 0.55 + palmar * 0.014]
    names.append(add_shape_key(
        body, f"PALM_{side.upper()}_ARCH",
        bump(arch, palmar, -0.0046, 0.032, facing_min=0.0)).name)

    # ---- joint creases -------------------------------------------------------------------------
    # Palmar creases at every PIP and DIP. Skinning smooths straight through a closing joint; a real
    # finger folds into a crease there, and at close range its absence is what makes a finger read as
    # a bent cylinder rather than a jointed digit.
    creases = []
    for f in fingers:
        for seg in ("01", "02"):
            b = bones[f"{f}_{seg}_{side}"]
            creases.append(Vector(b.tail_local) + palmar * flesh[f"{f}_{seg}_{side}"]["mid"] * 0.6)
    names.append(add_shape_key(
        body, f"HAND_{side.upper()}_JOINT_CREASE",
        bump(creases, palmar, -0.0027, 0.010, facing_min=0.0)).name)

    return names


def _nearest(points, co) -> Vector:
    p = Vector(co)
    return min(points, key=lambda c: (p - c).length_squared)
