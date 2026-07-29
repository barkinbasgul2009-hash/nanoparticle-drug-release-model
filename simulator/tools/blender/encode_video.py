#!/usr/bin/env python3
"""Encode a captured PNG/JPEG frame sequence into a playable video using Blender's bundled FFmpeg.

This environment has no standalone ffmpeg binary. Blender ships one, reachable through the Video
Sequence Editor, so the same dependency that authors the animation also encodes the QA videos and
nothing else has to be installed.

Two modes:

    single      one frame directory -> one video
    sidebyside  two frame directories -> one video, A on the left, B on the right

Run under a Blender Python (either ``blender --background --python encode_video.py -- ...`` or the
``bpy`` module interpreter, which is what CI in this container uses)::

    python encode_video.py -- --frames DIR --out out.mp4 --fps 30
    python encode_video.py -- --mode sidebyside --frames A --frames-b B --out ab.mp4 --fps 30 \\
        --label-a "procedural-fallback" --label-b "blender-baked"

Half speed is produced by asking for the same frame sequence at half the output fps: the animation
state per frame is identical, only the display duration doubles (Phase 2B ss32).
"""

from __future__ import annotations

import argparse
import os
import sys

import bpy


def _argv() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else argv[1:]


def _frame_files(directory: str) -> list[str]:
    exts = (".png", ".jpg", ".jpeg")
    files = sorted(f for f in os.listdir(directory) if f.lower().endswith(exts))
    if not files:
        raise SystemExit(f"no image frames in {directory}")
    return files


def _image_size(path: str) -> tuple[int, int]:
    img = bpy.data.images.load(path)
    size = (img.size[0], img.size[1])
    bpy.data.images.remove(img)
    return size


def _reset_scene(fps: int, width: int, height: int, out: str, codec: str, container: str) -> bpy.types.Scene:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.fps = fps
    scene.render.fps_base = 1.0
    # Pass the captured pixels through UNCHANGED. Blender's default view transform (AgX) would
    # tone-map frames that are already final sRGB output from the browser, so the encoded video
    # would not match the renderer it is supposed to document.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.sequencer_colorspace_settings.name = "sRGB"
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = container
    scene.render.ffmpeg.codec = codec
    scene.render.ffmpeg.constant_rate_factor = "HIGH"
    scene.render.ffmpeg.ffmpeg_preset = "GOOD"
    scene.render.ffmpeg.audio_codec = "NONE"
    scene.render.filepath = out
    scene.sequence_editor_create()
    return scene


def _add_strip(scene, name: str, directory: str, files: list[str], channel: int, start: int = 1):
    strip = scene.sequence_editor.sequences.new_image(
        name=name, filepath=os.path.join(directory, files[0]), channel=channel, frame_start=start,
    )
    for f in files[1:]:
        strip.elements.append(f)
    return strip


def _add_text(scene, text: str, channel: int, length: int, x: float):
    strip = scene.sequence_editor.sequences.new_effect(
        name=f"label_{text}", type="TEXT", channel=channel, frame_start=1, frame_end=1 + length,
    )
    strip.text = text
    strip.font_size = 28
    strip.location = (x, 0.035)
    strip.anchor_x = "CENTER"
    strip.use_shadow = True
    strip.blend_type = "ALPHA_OVER"
    return strip


def encode_single(frames_dir: str, out: str, fps: int, codec: str, container: str) -> dict:
    files = _frame_files(frames_dir)
    width, height = _image_size(os.path.join(frames_dir, files[0]))
    scene = _reset_scene(fps, width, height, out, codec, container)
    _add_strip(scene, "seq", frames_dir, files, channel=1)
    scene.frame_start = 1
    scene.frame_end = len(files)
    bpy.ops.render.render(animation=True)
    return {"frames": len(files), "width": width, "height": height, "fps": fps}


def encode_side_by_side(dir_a: str, dir_b: str, out: str, fps: int, codec: str, container: str,
                        label_a: str = "", label_b: str = "") -> dict:
    files_a = _frame_files(dir_a)
    files_b = _frame_files(dir_b)
    count = min(len(files_a), len(files_b))
    files_a, files_b = files_a[:count], files_b[:count]
    w, h = _image_size(os.path.join(dir_a, files_a[0]))

    scene = _reset_scene(fps, w * 2, h, out, codec, container)
    a = _add_strip(scene, "A", dir_a, files_a, channel=1)
    b = _add_strip(scene, "B", dir_b, files_b, channel=2)
    # Each source is half the output width, so shift them to opposite halves rather than scaling.
    a.transform.offset_x = -w / 2
    b.transform.offset_x = w / 2
    b.blend_type = "ALPHA_OVER"
    if label_a:
        _add_text(scene, label_a, 3, count, 0.25)
    if label_b:
        _add_text(scene, label_b, 4, count, 0.75)
    scene.frame_start = 1
    scene.frame_end = count
    bpy.ops.render.render(animation=True)
    return {"frames": count, "width": w * 2, "height": h, "fps": fps}


def main() -> int:
    p = argparse.ArgumentParser(description="Encode captured frames with Blender's FFmpeg")
    p.add_argument("--mode", choices=["single", "sidebyside"], default="single")
    p.add_argument("--frames", required=True, help="frame directory (A in sidebyside mode)")
    p.add_argument("--frames-b", help="second frame directory for sidebyside mode")
    p.add_argument("--out", required=True)
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--codec", default="H264", choices=["H264", "WEBM", "AV1", "H265", "MPEG4", "THEORA"])
    p.add_argument("--container", default="MPEG4", choices=["MPEG4", "MKV", "WEBM", "AVI", "OGG", "QUICKTIME"])
    p.add_argument("--label-a", default="")
    p.add_argument("--label-b", default="")
    a = p.parse_args(_argv())

    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    if a.mode == "sidebyside":
        if not a.frames_b:
            raise SystemExit("--frames-b is required in sidebyside mode")
        info = encode_side_by_side(a.frames, a.frames_b, a.out, a.fps, a.codec, a.container,
                                   a.label_a, a.label_b)
    else:
        info = encode_single(a.frames, a.out, a.fps, a.codec, a.container)

    if not os.path.exists(a.out):
        raise SystemExit(f"encoder produced no file at {a.out}")
    info["bytes"] = os.path.getsize(a.out)
    info["path"] = a.out
    print("ENCODED " + repr(info))
    return 0


if __name__ == "__main__":
    sys.exit(main())
