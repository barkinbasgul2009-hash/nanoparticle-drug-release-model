# Phase 6B Animation Specification — Apoptosis Commitment & Execution

This specifies the **restrained, publication-style** rendering of the apoptosis layer. The
design goal is legibility and honesty. Apoptosis is emotionally loaded; the renderer
deliberately avoids anything sensational.

## Explicitly forbidden visuals

**No** explosions, flames, skulls, blood, red-flash, shattering cells, "danger" iconography,
or any depiction of the cell being destroyed or removed. The cell object is never removed on
screen. Nothing implies a population, a tumour, or a body-level effect.

## Headless frame contract

`canvasRenderer` computes `lastApoptosisFrame` every `draw()` even with no canvas (headless
tests read it directly). When the engine is idle (`NOT_REPORTED` / unavailable) the frame is
`{ available: false, state, cellModel }` and nothing is painted.

When available the frame carries:

```
{ available, cellModel, state, reversibility, committed, contextTransfer, predicted,
  evidenceLevel,
  commitmentBar: { x, y, w, pressure, survival, locked },
  mitochondria: { membranePotential, baxBcl2, momp, cytochromeC, mompReadiness },
  caspaseBranch: { initiator, executioner, parp, contribution, inhibited },
  aifBranch:     { state, released, translocation, contribution, knockdown },
  totalExecutionDrive, morphology, interventions }
```

## Visual elements

### 1. Commitment progress bar
A horizontal bar whose fill tracks apoptotic pressure `[0,1]`:
- **Before commitment** — thin neutral border (`#9a938a`): the cell is still reversible.
- **After commitment** — thicker violet border (`#6a4bab`) plus a solid **locked-state
  marker** block to the right of the bar. The label appends `■ committed`.

The bar makes the single most important fact obvious at a glance: *has the irreversible gate
been crossed or not?*

### 2. State + evidence label
`Apoptosis [<cellModel>] <state>` with a suffix `(context-transfer prediction)` for B16BL6,
`(predicted)` for other prediction levels, or nothing for experimental. The evidence mode is
always visible; a transfer is never shown as experimental.

### 3. Branch indicators (caspase / AIF)
Two small text rows:
- `caspase: <executioner> / PARP <parp>` in muted green — **faded** (alpha 0.4) when the
  caspase inhibitor is present.
- `AIF: <state>` in muted brown — **faded** when AIF knockdown is active (state reads
  `suppressed_by_knockdown`).

Fading, not hiding, communicates attenuation while keeping the branch legible.

### 4. Mitochondrial / morphology status line
`mito <membranePotential> / MOMP <momp> / morph <morphology>` followed by the standing
caveat: **"schematic timing; single cell; population NOT evaluated."**

## Palette
Muted, desaturated tones consistent with earlier phases (violet for the commitment/locked
state, muted green for caspase, muted brown for AIF, the shared label-text colour for
neutral captions). No pure reds, no high-saturation alarm colours.

## Timing honesty
Every apoptosis timeline and every rendered progression is **schematic** — an ordering for
legibility, not a biological timescale. The status line states this on screen. No real-hour
label is ever shown for apoptosis stages.

## Placement
The diagram sits in the upper-left band of the viewport (`y ≈ 6% H`, `x ≈ 8% W`, bar width
≈ 40% W), above the existing evidence-mode and not-to-scale captions, so it never overlaps the
transport/particle field or the earlier-phase overlays.
