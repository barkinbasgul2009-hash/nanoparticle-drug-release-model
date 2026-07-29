# Phase 2B artifacts

Everything in this directory is **generated**. Nothing here is hand-authored, and nothing here is an
input to the build.

| file | produced by |
|---|---|
| `build-report.json` | `simulator/tools/blender/build_phase2_realism.py` — the Blender build's own record: version, grip solution, pole calibration, baked action statistics, exported/excluded objects |
| `report.json` | `simulator/tools/phase2b-report.mjs` — asset gate, manifest summary, browser performance, determinism probe, disposal counters, device-verification status |
| `report.md` | the human-readable Phase 2B report |
| `visual-qa.md` | the normal-speed and half-speed visual reviews, with every ss33/ss34 question answered |
| `browser-baked-normal.webm` | 421 deterministic frames of `presentationMode=blender-baked`, 1280x720 @ 30 fps |
| `browser-baked-half-speed.webm` | the same 421 frames at 15 fps — the same animation states, twice the display duration |
| `browser-procedural-normal.webm` | the procedural fallback over the same master progress |
| `browser-ab-comparison.webm` | procedural and baked side by side, frame-matched |
| `blender-preview-normal.mp4` | the Blender-authored preview render (EEVEE) |
| `ab-contact-sheet.png` | the matched progress points, procedural left / baked right |
| `frames/` | the 17 required named frame captures (ss35), straight from the browser |

## Reproducing

```sh
# 1. build (Blender 4.5 LTS)
blender --background --python-exit-code 1 \
  --python simulator/tools/blender/build_phase2_realism.py -- --repo . --preview

# 2. gate the generated asset
node simulator/tools/verify-baked-asset.mjs

# 3. serve simulator/ and capture
python3 -m http.server 8099 --bind 127.0.0.1 &   # from simulator/
node simulator/tools/capture-frames.mjs --url phase2b-preview.html \
  --out /tmp/frames-baked --frames 421 --size 1280x720 --mode blender-baked

# 4. encode with Blender's bundled FFmpeg (this environment has no standalone ffmpeg)
python simulator/tools/blender/encode_video.py -- \
  --frames /tmp/frames-baked --out simulator/artifacts/phase2b/browser-baked-normal.webm \
  --fps 30 --codec WEBM --container WEBM

# 5. measurement pass
node simulator/tools/phase2b-report.mjs
```

Frame capture is deterministic by construction: frame `i` is reached by setting
`masterProgress = i / (N - 1)` and drawing that exact value, never by an independent recording clock.
The half-speed file is the *same* frame sequence at half the output rate, so it shows the same
animation states over twice the duration rather than a different animation.
