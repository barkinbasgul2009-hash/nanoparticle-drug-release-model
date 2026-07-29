#!/usr/bin/env python3
"""Compose Phase 2B comparison stills from captured frames, using Blender's sequencer.

Two outputs (ss30, ss35):

  --mode ab       one frame from each presentation mode, side by side, labelled
  --mode sheet    a contact sheet: the matched progress points down the page, procedural on the
                  left and Blender-baked on the right

Blender is already the project's image/video tool here (it carries the only FFmpeg in this
environment), so the contact sheet is built with the same dependency rather than adding an image
library for two pictures.

    python compose_sheets.py -- --mode ab --a A/f0.png --b B/f0.png --out ab.png \\
        --label-a procedural-fallback --label-b blender-baked
    python compose_sheets.py -- --mode sheet --a-dir A --b-dir B --names 01,02,... --out sheet.png
"""

from __future__ import annotations

import argparse
import os
import sys

import bpy


def _argv() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else argv[1:]


def _size(path: str) -> tuple[int, int]:
    img = bpy.data.images.load(path)
    out = (img.size[0], img.size[1])
    bpy.data.images.remove(img)
    return out


def _scene(width: int, height: int, out: str):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    sc = bpy.context.scene
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    # Pass the captured pixels through UNCHANGED. Blender's default view transform (AgX) would
    # tone-map frames that are already final sRGB output from the browser, so the encoded video
    # would not match the renderer it is supposed to document.
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    sc.sequencer_colorspace_settings.name = "sRGB"
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = out
    sc.frame_start = 1
    sc.frame_end = 1
    sc.sequence_editor_create()
    return sc


def _image(sc, name, path, channel, x, y, scale=1.0):
    strip = sc.sequence_editor.sequences.new_image(
        name=name, filepath=path, channel=channel, frame_start=1,
    )
    strip.frame_final_duration = 1
    strip.transform.offset_x = x
    strip.transform.offset_y = y
    strip.transform.scale_x = scale
    strip.transform.scale_y = scale
    if channel > 1:
        strip.blend_type = "ALPHA_OVER"
    return strip


def _text(sc, text, channel, x, y, size=26):
    strip = sc.sequence_editor.sequences.new_effect(
        name=f"t{channel}", type="TEXT", channel=channel, frame_start=1, frame_end=2,
    )
    strip.text = text
    strip.font_size = size
    strip.location = (x, y)
    strip.anchor_x = "CENTER"
    strip.anchor_y = "BOTTOM"
    strip.use_shadow = True
    strip.blend_type = "ALPHA_OVER"
    return strip


def compose_ab(a: str, b: str, out: str, label_a: str, label_b: str) -> dict:
    w, h = _size(a)
    sc = _scene(w * 2, h, out)
    _image(sc, "A", a, 1, -w / 2, 0)
    _image(sc, "B", b, 2, w / 2, 0)
    _text(sc, label_a, 3, 0.25, 0.03)
    _text(sc, label_b, 4, 0.75, 0.03)
    bpy.ops.render.render(write_still=True)
    return {"width": w * 2, "height": h}


def compose_sheet(a_dir: str, b_dir: str, names: list[str], out: str,
                  label_a: str, label_b: str, columns: int = 1) -> dict:
    rows = len(names)
    first = os.path.join(a_dir, f"{names[0]}.png")
    w, h = _size(first)
    scale = 0.30
    cell_w, cell_h = int(w * scale), int(h * scale)
    header = 42
    sheet_w = cell_w * 2
    sheet_h = cell_h * rows + header
    sc = _scene(sheet_w, sheet_h, out)

    channel = 1
    for i, name in enumerate(names):
        # sequencer offsets are measured from the centre of the output
        y = (sheet_h / 2) - header - cell_h * (i + 0.5)
        for side, directory in (("a", a_dir), ("b", b_dir)):
            path = os.path.join(directory, f"{name}.png")
            if not os.path.exists(path):
                continue
            x = (-cell_w / 2) if side == "a" else (cell_w / 2)
            _image(sc, f"{side}{i}", path, channel, x, y, scale)
            channel += 1
        _text(sc, name, channel, 0.5, (y + cell_h / 2 - 18 + sheet_h / 2) / sheet_h, size=16)
        channel += 1
    _text(sc, label_a, channel, 0.25, (sheet_h - header + 10) / sheet_h, size=22)
    _text(sc, label_b, channel + 1, 0.75, (sheet_h - header + 10) / sheet_h, size=22)
    bpy.ops.render.render(write_still=True)
    _ = columns
    return {"width": sheet_w, "height": sheet_h, "rows": rows}


def main() -> int:
    p = argparse.ArgumentParser(description="Compose Phase 2B comparison stills")
    p.add_argument("--mode", choices=["ab", "sheet"], required=True)
    p.add_argument("--a"), p.add_argument("--b")
    p.add_argument("--a-dir"), p.add_argument("--b-dir")
    p.add_argument("--names", help="comma-separated frame basenames (no extension)")
    p.add_argument("--out", required=True)
    p.add_argument("--label-a", default="procedural-fallback")
    p.add_argument("--label-b", default="blender-baked")
    a = p.parse_args(_argv())

    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    if a.mode == "ab":
        info = compose_ab(a.a, a.b, a.out, a.label_a, a.label_b)
    else:
        info = compose_sheet(a.a_dir, a.b_dir, a.names.split(","), a.out, a.label_a, a.label_b)

    # Blender appends the frame number when writing a still through the sequencer
    if not os.path.exists(a.out):
        stem, ext = os.path.splitext(a.out)
        numbered = f"{stem}0001{ext}"
        if os.path.exists(numbered):
            os.replace(numbered, a.out)
    if not os.path.exists(a.out):
        raise SystemExit(f"compose produced no file at {a.out}")
    info["bytes"] = os.path.getsize(a.out)
    info["path"] = a.out
    print("COMPOSED " + repr(info))
    return 0


if __name__ == "__main__":
    sys.exit(main())
