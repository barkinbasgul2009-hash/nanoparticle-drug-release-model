# Translation Animation Specification (Profile B, Phase 5D)

The first protein-synthesis animation. Rendering is derived entirely from the translation
engine (read-only) and is **publication quality** — no cartoon DNA/RNA helices, gaming
effects, glow, or atomic ribosome structure.

## 1. Render frame (headless-testable)

`canvasRenderer.lastTranslationFrame = { outputs, capacityOrdinal }`. Each output:
`{ outId, proteinName, mrnaId, mrnaLevel, strand{x0,x1,y}, ribosome{x,y,state,progress},
protein{x,y,state,abundanceState,abundanceOrdinal,turnoverState}, predicted, evidenceLevel,
predictionLevel, halfLifeH, functionalState }`. Laid out in a reserved band above the
gene-regulation diagram.

## 2. Animation chain

```
mRNA appears → ribosome approaches → initiation complex forms → ribosome progresses along
the strand → nascent chain emerges → translation completes → protein folds schematically →
mature protein appears → optional degradation begins → STOP
```

Deterministic; integrates with existing play / pause / restart / step / speed / timeline.
Timing is explicitly labelled schematic.

## 3. Visual language

- **experimental** — solid; **predicted** — dashed strand + outlined protein + `⌁` badge.
- **NOT_REPORTED** — disabled neutral placeholder (idle; e.g. mouse/rat).
- **suppressed translation** — reduced opacity ribosome.
- **active translation** — moderate emphasis; nascent chain tick grows with progress.
- **mature protein** — stable compact symbol; size scales with abundance.
- **degrading protein** — faded / segmented symbol.
- A caption states capacity ordinal and "schematic timing; stops at protein".

## 4. What is NOT drawn

Cartoon DNA helices, atomic ribosomes, decorative amino-acid chains, explosions, excessive
glow, protein function, or any downstream phenotype.

## 5. Timeline events

`mRNA available` (implicit), `ribosome recruited`, `initiation complete`,
`elongation started`, `translation 25/50/75`, `termination`, `nascent protein released`,
`maturation started`, `mature protein produced`, `degradation started`, `protein degraded`.
Biological seconds are never displayed.
