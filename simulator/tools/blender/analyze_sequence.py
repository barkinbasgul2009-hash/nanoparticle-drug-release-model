#!/usr/bin/env python3
"""Objective motion analysis over a captured frame sequence — the half-speed review, quantified.

Watching a clip at half speed is a way of catching discontinuities the eye skips at full rate:
popping, flicker, IK snaps, morph jumps. That is a measurable property of consecutive frames, so
this measures it instead of relying only on impressions.

For every adjacent pair it computes the mean absolute pixel difference on a downscaled copy (the
downscale is what makes 400+ frames tractable, and it suppresses shading noise while preserving real
motion). A frame whose difference is a large multiple of the local median is a candidate SNAP; an
isolated spike that immediately reverts is a candidate FLICKER.

    python analyze_sequence.py -- --frames DIR --out report.json [--width 160]

Run under a Blender Python (Blender is the only image decoder available in this environment).
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys

import bpy
import numpy as np


def _argv() -> list[str]:
    argv = sys.argv
    return argv[argv.index("--") + 1:] if "--" in argv else argv[1:]


def load_small(path: str, width: int, height: int) -> np.ndarray:
    img = bpy.data.images.load(path)
    try:
        img.scale(width, height)
        buf = np.empty(width * height * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        return buf.reshape(-1, 4)[:, :3]          # drop alpha; the capture is opaque
    finally:
        bpy.data.images.remove(img)


def analyse(frames_dir: str, width: int = 160, height: int = 90) -> dict:
    names = sorted(f for f in os.listdir(frames_dir) if f.lower().endswith((".png", ".jpg")))
    if len(names) < 3:
        raise SystemExit(f"need at least 3 frames in {frames_dir}")

    deltas: list[float] = []
    prev = load_small(os.path.join(frames_dir, names[0]), width, height)
    for name in names[1:]:
        cur = load_small(os.path.join(frames_dir, name), width, height)
        deltas.append(float(np.abs(cur - prev).mean()))
        prev = cur

    median = statistics.median(deltas)
    # a local window keeps a fast beat from flagging every frame in it
    WINDOW = 15
    snaps = []
    flickers = []
    for i, d in enumerate(deltas):
        lo = max(0, i - WINDOW)
        hi = min(len(deltas), i + WINDOW + 1)
        local = statistics.median(deltas[lo:hi]) or 1e-9
        ratio = d / local
        if ratio > 4.0 and d > median * 2.0:
            entry = {"pairIndex": i, "from": names[i], "to": names[i + 1],
                     "delta": round(d, 6), "localMedian": round(local, 6), "ratio": round(ratio, 2)}
            # a spike whose neighbours are quiet, i.e. it jumps out and straight back, is flicker
            before = deltas[i - 1] if i > 0 else d
            after = deltas[i + 1] if i + 1 < len(deltas) else d
            if before < local * 1.5 and after < local * 1.5:
                flickers.append(entry)
            else:
                snaps.append(entry)

    still = [i for i, d in enumerate(deltas) if d < median * 0.02]
    return {
        "frames": len(names),
        "pairs": len(deltas),
        "meanDelta": round(statistics.fmean(deltas), 6),
        "medianDelta": round(median, 6),
        "maxDelta": round(max(deltas), 6),
        "p95Delta": round(sorted(deltas)[int(len(deltas) * 0.95)], 6),
        "snapCandidates": snaps,
        "flickerCandidates": flickers,
        "frozenPairs": len(still),
        "deltas": [round(d, 6) for d in deltas],
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Frame-to-frame motion analysis")
    p.add_argument("--frames", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--width", type=int, default=160)
    p.add_argument("--height", type=int, default=90)
    a = p.parse_args(_argv())

    result = analyse(a.frames, a.width, a.height)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2)
        fh.write("\n")
    print(f"frames {result['frames']}  median delta {result['medianDelta']:.5f}  "
          f"max {result['maxDelta']:.5f}  snaps {len(result['snapCandidates'])}  "
          f"flickers {len(result['flickerCandidates'])}  frozen pairs {result['frozenPairs']}")
    for s in result["snapCandidates"][:12]:
        print(f"  SNAP    {s['from']} -> {s['to']}  x{s['ratio']}")
    for f in result["flickerCandidates"][:12]:
        print(f"  FLICKER {f['from']} -> {f['to']}  x{f['ratio']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
