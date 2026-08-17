#!/usr/bin/env python3
"""
Inline every asset into a single self-contained page.

The published experience has to run with no external requests at all, so the
product photography, the grain tile and the piece geometry are all embedded
into index.html at build time. Edit index.template.html, then run this.
"""
import base64
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).parent
ASSETS = ROOT / "assets"

IMAGES = {
    "__BOTTLE__": "bottle.webp",
    "__BOTTLE_OPEN__": "bottle_open.webp",
    "__BASE__": "base.webp",
    "__OUTERBOX__": "outerbox.webp",
    "__LID__": "lid.webp",
    "__CAP__": "cap.webp",
    "__MACRO_GLASS__": "macro_glass.webp",
    "__MACRO_CRYSTAL__": "macro_crystal.webp",
    "__MACRO_PLAQUE__": "macro_plaque.webp",
    "__GRAIN__": "grain.png",
}
MIME = {".webp": "image/webp", ".png": "image/png"}


def data_uri(name: str) -> str:
    path = ASSETS / name
    if not path.exists():
        sys.exit(f"missing asset: {path}")
    mime = MIME[path.suffix]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def main() -> None:
    html = (ROOT / "index.template.html").read_text()

    for token, name in IMAGES.items():
        if token in html:
            html = html.replace(token, data_uri(name))

    pieces = json.loads((ASSETS / "pieces.json").read_text())
    trimmed = {
        k: {a: v[a] for a in ("left", "top", "width", "height")}
        for k, v in pieces.items()
    }
    html = html.replace("__PIECES__", json.dumps(trimmed, separators=(",", ":")))

    leftovers = [t for t in list(IMAGES) + ["__PIECES__"] if t in html]
    if leftovers:
        sys.exit(f"unreplaced tokens: {leftovers}")

    out = ROOT / "index.html"
    out.write_text(html)
    print(f"built {out}  ({len(html) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
