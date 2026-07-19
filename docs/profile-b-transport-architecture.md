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

## Phase 3.1 update — Evidence Level layer
Phase 3.1 adds an **Evidence Level** on top of the existing confidence gate, changing the choice
from *available/blocked* to *Experimental / Predictive / Unavailable* — without weakening the
gate.

```
transportModel.evidenceLevelFor(species)
   EXPERIMENTAL  → confidence QUALITATIVELY_SUPPORTED → canAnimate=true  (rat)
   PREDICTIVE    → confidence MECHANISTIC_TRANSFER    → canAnimate=true  (human, mouse)
   UNAVAILABLE   → confidence NOT_REPORTED            → canAnimate=false (no profile)
        │
        ▼
transportEngine  carries evidenceLevel + predictive flag; message()/evidenceLevelName()
        │
        ▼
canvasRenderer   filled dots (experimental) vs outlined dots (predictive) + evidence caption
uiPanels         information panel exposes { evidenceLevel, message }
```

- **`EVIDENCE_LEVELS`** lives in `evidence/evidenceEngine.js` (available throughout).
- The level is **registry data** (`species_transport[*].evidence_level`), so it is auditable and
  a future species is handled automatically: add anatomy + a transport record with a level.
- **No new species coupling:** the engine still reads `anatomyModel.weightsForSpecies()` for
  depth bands, so predictive species use their *own* anatomy — rat parameters are never copied.
- **Mode isolation:** the active species selects its own level; experimental (rat) and predictive
  (human/mouse) never mix, and experimental data is never overwritten by a prediction.

## Phase 4 update — Drug Release Engine (separate process)
Release is a **second, independent engine** bolted on *after* transport, never merged with it.

```
data/release.registry.json        (first-order model, k NOT REPORTED, states, trigger, integrity)
        │
        ▼
biology/releaseModel.js           F(t)=1-e^(-k t); evidence; scope guard (pure)
        │
        ▼
biology/releaseEngine.js  ── reads ──▶ transportEngine.particles (transportStatus only)
   │   per-particle payload state in its OWN Map (not on the transport Particle)
   │   steps ONLY 'arrived' particles: payload↓ / released↑ ; aggregate release curve
   │   emits: release_start / release_complete ; allEmpty()
   ▼
render/canvasRenderer.js          carrier shell + inner payload disc (shrinks to empty)
biology/transportAnimator.js      after each transport step, steps the release engine
                                  (untilReleased runs transport→arrival→release→empty)
```

**Separation guarantees**
- The release engine **reads** `transportStatus` and **never writes** transport state
  (`x`, `d`, status unchanged across a release run — asserted in tests).
- Release state lives in `ReleaseEngine.states` (keyed by particle id), **not** on the transport
  `Particle` — the two domains share only the particle identity.
- Release **cannot start before arrival**: `step()` skips any particle whose `transportStatus`
  is not `'arrived'`.

**Evidence & scope**
- The first-order **model** is registry data (evidence-selected, cites Chen 2012); the rate `k`
  is a **schematic** engine config value because it is NOT REPORTED.
- Release is **formulation-level** (species-independent); it runs for whichever particles
  arrived, experimental or predictive, using the same model.
- The lifecycle ends at `empty`; `integrity.excluded_downstream` lists every downstream process
  that is deliberately NOT implemented (uptake, endocytosis, PK, PD, …).

## Phase 4B update — Cellular microenvironment & passive uptake (separate layer)
A **third independent layer** is added after release: free drug molecules, a schematic cell field,
and passive membrane crossing. Transport and release are untouched.

```
data/microenvironment.registry.json   (cells, molecule spec, passive model, diffusion, species_uptake, integrity)
        │
        ├─ biology/cellField.js        schematic cells (membrane + cytoplasm ONLY); containment/contact (pure)
        └─ biology/drugMolecule.js     independent free-drug object (id/pos/vel/D/species/timestamp/alive/evidence)
                    │
                    ▼
biology/uptakeEngine.js ── reads ──▶ transportEngine.particles + releaseEngine.stateFor(id)
   │   spawnFromRelease()  molecules count = released payload quantised
   │   diffuse()           Brownian in extracellular + cytoplasm (bounded steps)
   │   attemptUptake()     PASSIVE crossing on membrane contact (probability); cytoplasm confinement
   │   evidence-gated per species (PREDICTIVE for all; UNAVAILABLE blocks)
   ▼
render/canvasRenderer.js  semi-transparent cells + membranes + tiny free-drug dots
biology/transportAnimator.js  steps the uptake layer AFTER release each tick
```

**Separation guarantees**
- The uptake engine **reads** transport + release state and **never writes** them; it **never
  moves carriers**. Molecule state lives in the uptake engine (not on the transport `Particle`).
- Molecules exist **only after release** (`molecule count == expectedMoleculeCount`), and a
  molecule enters the cytoplasm **only after** membrane contact (no teleport).
- Four concerns stay separate: **Transport / Release / Diffusion / Passive Uptake** — future
  phases extend each independently.

**Evidence**
- Uptake is `MECHANISTIC_TRANSFER` (Predictive) for all species — passive free-drug crossing is a
  general principle, not the measured carrier uptake; diffusion/permeability are NOT REPORTED
  (schematic). The evidence panel exposes three independent levels: Transport / Release / Cell
  Uptake.
- `integrity.forbidden` lists 31 downstream/intracellular structures that remain unimplemented.

## Phase 4C update — Endocytosis & intracellular trafficking (separate layer)
A **fourth independent layer** is added after uptake: carrier internalization, endosome→lysosome
trafficking, and (evidence-gated) endosomal escape. It applies to **carriers only**.

```
data/endocytosis.registry.json  (evidence review A/B/C, pathways, formulation profile, FSM, compartments, species evidence, integrity)
        │
        ├─ biology/endocytosisStates.js  strict FSM (legal transitions; rejects illegal)
        └─ biology/endocytosisEngine.js  per-carrier fate; pathway select (registry weights);
                    │                     gradual maturation; escape only if allowed
                    │  reads (read-only) uptakeEngine.transport.particles + uptakeEngine.cells
                    ▼
render/canvasRenderer.js  membrane wrapping arc + compartment vesicle rings + labels (carrier colour unchanged)
biology/transportAnimator.js  steps the endocytosis layer AFTER uptake each tick
```

**Separation guarantees**
- The endocytosis engine **reads** carriers + cells read-only and **modifies no upstream engine**;
  per-carrier fate lives only in the endocytosis engine (keyed by carrier id).
- Endocytosis applies to **carriers only** — free drug molecules (Phase 4B) are never endocytosed
  (no molecule id ever gets an endocytosis state).
- Five concerns now stay separate: **Transport / Release / Diffusion / Passive Uptake /
  Endocytosis**.

**Strict FSM + evidence**
- `EXTRACELLULAR → MEMBRANE_CONTACT → WRAPPING → INTERNALIZED → EARLY/LATE_ENDOSOME → LYSOSOME →
  (ESCAPED → CYTOPLASM)`; illegal transitions throw; maturation is gradual; escape is registry-gated.
- Endocytosis + trafficking are `MECHANISTIC_TRANSFER` (Predictive) for all species (pathway
  unresolved; trafficking not measured for this formulation); escape is `UNAVAILABLE` for the B1
  NLC (NOT REPORTED). The evidence panel now exposes **five** independent levels: Transport /
  Release / Passive Uptake / Endocytosis / Intracellular Trafficking.
- `integrity.forbidden` lists 32 downstream/intracellular structures that remain unimplemented.

## Phase 4D update — Intracellular drug release (separate layer)
A **fifth independent layer** is added after endocytosis: intracellular payload release, cytoplasmic
diffusion, degradation, a schematic nucleus, and optional nucleus targeting.

```
data/intracellular.registry.json  (release models, degradation/targeting modes, nucleus, per-formulation profile, species evidence, integrity)
        │
        ├─ biology/intracellularReleaseModel.js  model math (0 when NOT REPORTED); pure
        └─ biology/intracellularDrug.js           independent intracellular free-drug object
                    │
                    ▼
biology/intracellularReleaseEngine.js ── reads (read-only) ──▶ endocytosisEngine.states (CYTOPLASM carriers) + uptakeEngine.cells
   │   release intracellular drug (evidence-gated) ; bounded Brownian diffusion (cell-confined)
   │   degradation (evidence-gated) ; optional nucleus targeting -> STOP at nuclear membrane (never enter)
   ▼
render/canvasRenderer.js  schematic nucleus (membrane + interior) + intracellular drug dots
biology/transportAnimator.js  steps the intracellular layer AFTER endocytosis each tick
```

**Separation guarantees**
- Reads endocytosis/uptake outputs read-only; modifies no upstream engine. Intracellular molecules
  live only in this engine.
- Drug diffuses **only** inside its own cell (never exits, never enters a neighbour) and **never**
  enters the nucleus (targeting stops at the nuclear membrane).
- Six layers now stay separate: **Transport / Release / Diffusion / Passive Uptake / Endocytosis /
  Intracellular Release**.

**Evidence & scope**
- Release models (burst / first-order / zero-order / Higuchi / Korsmeyer–Peppas), degradation and
  targeting are used **only when evidence exists**; otherwise **NOT REPORTED** (idle). For B1 the
  whole intracellular stage is `NOT_REPORTED`. `NOT_REPORTED` was added to `EVIDENCE_LEVELS`.
- The evidence panel now exposes **six** independent levels: Transport / Release / Passive Uptake /
  Endocytosis / Intracellular Trafficking / Intracellular Release.
- `integrity.forbidden` lists 30 downstream structures (DNA/RNA, transcription, translation, PD,
  PK, apoptosis, nuclear-pore transport, …) that remain unimplemented.

## Phase 5A update — Target engagement (first pharmacology layer, separate)
A **sixth independent layer** is added after intracellular release: molecular recognition (binding)
only. It asks whether the drug binds its target and stops there.

```
data/target-engagement.registry.json  (target types, binding models, affinity metrics, prediction labels, per-formulation profile, species evidence, integrity)
        │
        ├─ biology/targetProtein.js            schematic molecular target (individual protein)
        └─ biology/targetEngagementEngine.js    encounter -> binding -> occupancy -> (reversible) dissociation
                    │  reads (read-only) intracellularEngine.molecules + uptakeEngine.cells
                    ▼
render/canvasRenderer.js  schematic proteins + occupancy halo + bound-drug dots + occupancy caption
biology/transportAnimator.js  steps the target-engagement layer AFTER intracellular release each tick
```

**Separation guarantees**
- Reads the intracellular/uptake outputs read-only; modifies no upstream engine. Binding state
  lives only here; the Phase-4D molecule is never modified (the renderer reconciles a bound drug at
  its target at draw time).
- Binding begins **only** on physical encounter (schematic reaction radius) — no attraction, no
  teleportation. Occupancy never exceeds capacity; irreversible never dissociates; nuclear targets
  require Phase-4D nucleus targeting.
- Seven layers now stay separate: **Transport / Release / Diffusion / Passive Uptake / Endocytosis
  / Intracellular Release / Target Engagement**.

**Evidence & prediction**
- A finer **prediction-label** vocabulary (`PREDICTION_LABELS`: Experimental / High-confidence /
  Mechanistic / Literature-derived Prediction / Unavailable / Not Reported) is added; a prediction
  is always labelled and never shown as experimental, and Kd/Ki/IC50/kon/koff are never fabricated.
- For B1 the target and binding constants are **NOT REPORTED** → the layer is idle. The evidence
  panel now exposes **seven** levels (… + Target Engagement).
- `integrity.forbidden` lists 24 downstream structures (signalling, kinase cascades, transcription,
  apoptosis, PD downstream, tumour response, …) that remain unimplemented.
