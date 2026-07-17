# Profile-B Simulator — Transport Engine Architecture (Phase 3)

How the biological transport engine is structured. Design goal: **scientific realism over
visual effects** — every moving thing corresponds to registry evidence, and the whole engine is
pure/deterministic so it can be validated headless.

## Layered design
```
data/transport.registry.json         (evidence backbone: states, transitions, mechanisms,
                                       barriers, species support, particle spec, integrity)
        │  loaded + validated (JsonLoader)
        ▼
biology/transportModel.js            barrier mobility · mechanisms · per-species support · evidence
biology/transportStates.js           BiologicalStateMachine (cited linear pathway)
        │
        ▼
biology/transportEngine.js  ◄── anatomy/anatomyModel.js (species-driven layer depth bands)
   │   pure physics: Brownian + concentration drift × evidence-based mobility
   │   evidence gate (evidence/evidenceEngine.js canAnimate)
   │   emits: spawn / transition / barrier-crossing / arrival events
   ▼
biology/particle.js                  independent particle objects (id/species/pos/state/evidence)
        │
        ▼
biology/transportAnimator.js         time driver (rAF in browser · tick()/runHeadless() in tests)
        │
        ▼
render/canvasRenderer.js             flat-dot particle overlay over static anatomy
```

## Key boundaries
- **Data vs code.** No biology is hardcoded. States, transitions, mechanisms, barrier mobility,
  species support and the particle spec are all registry data with provenance + confidence.
- **Pure engine.** `TransportEngine` has no canvas/DOM dependency. Given a seed it is fully
  deterministic, so the physics and the pathway are unit-testable in Node.
- **Renderer is dumb.** The renderer reads particle positions and paints flat dots; it makes no
  biological decisions. Removing it changes nothing about the simulation.
- **Evidence gate is first-class.** The engine asks the Phase-1 `EvidenceEngine.canAnimate()`
  whether the selected species may animate. `NOT_REPORTED` → blocked. This is the same gate
  that has guarded the project since Phase 1.

## Coordinate model
Resolution-independent normalized coordinates: `x ∈ [0,1]` across the cross-section, `d ∈ [0,1]`
depth from the surface (0) to the bottom of the tissue stack (1). Layer **depth bands** are
computed from the **active species'** anatomy draw weights (`computeLayerBands`), so switching
species moves the barriers — transport follows anatomy. The renderer maps `(x,d)` into pixels
through the *current zoom window*, so particles stay registered with the anatomy at every scale.

## Simulation step (per tick)
For each non-arrived particle:
1. Resolve the current layer at depth `d` → look up its **evidence-based mobility** `m`.
2. **Concentration drift** (down): `Δd += driftRate · m · dt`.
3. **Brownian jitter** (both axes): `± brownianAmp · m · √dt · N(0,1)`.
4. Clamp `d` to the dermis floor (topical target; no deeper travel).
5. Re-resolve state; flag `crossing_barrier` inside the SC; flag `arrived` at the target depth.
6. On a state change, attach the transition's evidence and emit a transition/arrival event.

`driftRate`, `brownianAmp`, `dt` are **schematic simulation-scale** constants (relative timing
only), documented as *not* biological rates; the biological content is the registry mobility
**ordering** and the reported time window.

## Species-driven control flow
`app.setSpecies(id)` → `anatomyModel.setSpecies(id)` (barrier depths) → `engine.setSpecies(id)`
(recompute bands, re-evaluate the gate, clear particles) → renderer redraws. Unsupported species
become blocked with **no fallback**; the engine exposes `isBlocked()`, `blockReason()`, and a
`speciesEvidence()` descriptor for UI badges.

## Extension points (later phases, NOT built here)
The terminal state `target_region` is the hand-off point. Drug release, cell entry/uptake,
endocytosis, payload diffusion, and PK/PD would attach *after* arrival — none exist yet, and the
registry lists them under `integrity.excluded_downstream`.
