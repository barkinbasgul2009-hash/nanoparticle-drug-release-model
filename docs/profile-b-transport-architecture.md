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

## Phase 5B.1 — Signal-Transduction Evidence & Graph Architecture (data + validator only)

Phase 5B.1 adds a **directed signaling-graph architecture** — schemas, evidence records,
registries, a validator, and types — but **no runtime engine, renderer, animation, or UI**.
It is frozen as the contract for a future Phase 5B.2.

```
simulator/data/
  signal-context.registry.json     contexts (species+cell+disease+drug+formulation+target); never mixed
  signal-nodes.registry.json       SignalingNode records (schematic activity 0.0-1.0 only)
  signal-edges.registry.json       SignalingEdge records (directed; activation/inhibition/translocation/...)
  signal-pathways.registry.json    pathway PROFILES binding one context to node/edge sets; accept/defer/reject log
  signal-evidence.registry.json    reference records (verification_status) + evidence audit trail
  signal-prediction.registry.json  explicit predictions + cross-context transfer ledger (no silent transfer)
simulator/src/biology/signalGraph.js   LOADER + VALIDATOR only (no propagation/animation)
simulator/src/types/signaling.ts       TypeScript contract for the six registries
simulator/src/evidence/evidenceEngine.js  SIGNAL_EVIDENCE_LEVELS (9) + isSignal* helpers
```

**Accepted profiles (all DAGs, exposure-driven):** 5B-H1 human HaCaT ROS→ERK/p38→Nrf2→ARE→HO-1;
5B-H2 human HaCaT NF-κB suppression→↓inflammatory output; 5B-M1 mouse B16BL6 PI3K→AKT→mTOR→↓survival
output. **5B-H3** deferred (crosstalk beyond evidence); **5B-R1** rat NOT REPORTED (empty; no transfer).

**Evidence discipline**
- Canonical intracellular edges = `EXPERIMENTAL_PATHWAY_SPECIFIC` (general biology, **no fabricated
  DOI**); celastrol-in-cell claims = `LITERATURE_DERIVED_PREDICTION` (`UNVERIFIED_IN_REPO`); nothing is
  `EXPERIMENTAL_FORMULATION_SPECIFIC`. The frozen package reports **no signaling**; molecular target is
  NOT REPORTED (Phase 5A) → signaling is exposure-driven prediction.
- Node activity is **schematic** (0.0–1.0 or ordinal), never concentration / phosphorylation % /
  abundance / occupancy. `temporal_order` is a schematic ordinal, not biological time.
- The graph **stops before gene regulation**: transcription factors may reach a `nuclear_localized`
  state, but transcription/translation/PD/apoptosis are forbidden node types and absent.

**Validator rules:** unique ids; no orphan edges; no species/cell-model mixing; DAG unless a cycle is
closed by a declared typed-feedback edge; forbidden node types absent; start/stop present;
evidence levels valid and experimental-vs-prediction unambiguous; evidence references resolve;
NOT_REPORTED profiles empty. Negative tests cover each violation.

## Phase 5B.2 — Signal Propagation Engine (first runtime signaling layer)

Phase 5B.2 turns the frozen 5B.1 graph into a live, deterministic signaling simulation.

```
biology/signalPropagationEngine.js  reads SignalGraph (5B.1) + signal-propagation.registry.json READ-ONLY
    │  propagates activity: activation / suppression / delay / attenuation / threshold /
    │  lifetime+decay / competition / declared-feedback / labelled predictions
    ▼
render/canvasRenderer.js  lastSignalFrame + lastSignalEdgeFrame (glow / fade / edge illumination /
                          prediction badge + dashed edges) - publication style, no gaming FX
biology/transportAnimator.js  steps the signal layer AFTER target engagement each tick
```

**Runtime dynamics** live in `signal-propagation.registry.json` (thresholds, delay
classes fast/medium/slow, attenuation, decay, activation lifetimes, layout) keyed to the
frozen 5B.1 ids. **Predicted extensions** (labelled, toggleable): a mechanistic
negative-feedback edge (HO-1 ⊣ ROS) and the STIM1 → Orai1 → SOCE → Ca²⁺ pathway.

**Behaviour:** 5B-H1 activates (ROS→ERK/p38→Nrf2→ARE→HO-1, transient pulse), 5B-H2 and
5B-M1 suppress baseline-active pathways, rat is idle (NOT REPORTED). Feedback executes
and is bounded (activity ∈ [0,1], no oscillation explosion). Deterministic (no RNG).

**Evidence discipline:** no experimental signaling data is fabricated; the frozen 5B.1
labels are unchanged; predictions are always labelled (`SIGNAL_PREDICTION_LEVELS` adds
`HYPOTHESIS`), visually distinct, toggleable, and never overwrite experimental nodes;
experimental always takes priority. The evidence panel gains an **eighth** section
(Signal Transduction). Stops at signaling — no transcription/translation/PD/PK/apoptosis/
immune/tumour/toxicity/phenotype. Docs: `docs/profile-b-simulator-phase5b2-implementation.md`,
`signal-propagation.md`, `signal-animation.md`, `signal-timeline.md`,
`phase5b2-validation-report.md`.

## Phase 5C — Gene Regulation & Transcription Runtime (first response downstream of signaling)

Phase 5C adds the first biological RESPONSE after signaling, stopping at mRNA.

```
biology/transcriptionEngine.js  reads SignalPropagationEngine (5B.2) + transcription.registry.json READ-ONLY
    │  TF activation -> nuclear translocation -> DNA promoter binding -> gene transcription -> mRNA
    │  (delays, occupancy/competition, multiple TFs, multiple genes, chromatin, decay)   ⟂ STOP at mRNA
    ▼
render/canvasRenderer.js  lastTranscriptionFrame (TF nuclear entry / promoter occupancy / gene glow / emerging mRNA)
biology/transportAnimator.js  steps the transcription layer AFTER signal propagation each tick
```

**Objects** (`transcriptionObjects.js`): TranscriptionFactor, PromoterRegion, Gene,
MessengerRNA. **Registry** (`transcription.registry.json`): human HaCaT ACTIVE
(Nrf2→ARE→HMOX1/NQO1; NF-κB→RE→inflammatory gene with Nrf2 cross-repression); mouse +
rat **NOT_REPORTED** (no TF node / no evidence; no transfer).

**Behaviour:** Nrf2 activates → imports to nucleus → binds ARE → (after transcription
delay) induces HMOX1/NQO1 25%→50% + mRNA; NF-κB is drug-suppressed → inflammatory gene
50%→25%; then relaxes to basal as signaling winds down. Deterministic (no RNG).

**Evidence discipline:** the frozen package has NO transcription data → gene regulation is
mostly labelled PREDICTION (`GENE_EVIDENCE_LEVELS` adds HIGH_CONFIDENCE + HYPOTHESIS);
nothing is EXPERIMENTAL without a real reference (validator warns otherwise); no DOI /
fold-change / kinetic / RNA copy number / protein abundance fabricated; experimental takes
priority; predictions are distinct + toggle-independent. Expression is a schematic level
`{0,25,50,75,100}`; mRNA is a copy state; half-life NOT_REPORTED. The evidence panel gains
a **ninth** section (Gene Regulation). STOPS at mRNA — no translation/protein/enzyme/
metabolism/cell-cycle/apoptosis/immune/tissue/PK/PD/toxicity/phenotype. Docs:
`docs/profile-b-simulator-phase5c-implementation.md`, `gene-regulation-transcription.md`,
`transcription-evidence-review.md`, `phase5c-validation-report.md`.

## Phase 5D — Translation & Protein Synthesis Runtime (mRNA → mature protein)

Phase 5D extends the chain from the 5C mRNA output to protein production, stopping at
mature protein + turnover.

```
biology/translationEngine.js  reads TranscriptionEngine (5C, mRNA) + translation/protein registries READ-ONLY
    │  mRNA gating -> ribosome recruitment -> initiation -> elongation -> termination ->
    │  nascent polypeptide -> schematic folding/maturation -> mature protein abundance -> turnover  ⟂ STOP
    ▼
render/canvasRenderer.js  lastTranslationFrame (mRNA strand / ribosome position / nascent chain / mature protein + abundance)
biology/transportAnimator.js  steps the translation layer AFTER transcription each tick
```

**Objects** (`translationObjects.js`): Ribosome, TranslationInitiationComplex,
NascentPolypeptide, Protein. **Registries** (three separable): `translation-context`
(profiles), `translation-machinery` (vocab + dynamics), `protein` (identities + turnover +
evidence + predictions). Human HaCaT ACTIVE (HMOX1→HO-1, NQO1→NQO1, suppressed
inflammatory mRNA→low protein); mouse + rat **NOT_REPORTED** (no 5C mRNA; no transfer).

**Behaviour:** HO-1 protein rises to ~50% (induced, transient, lagged) and exceeds the
suppressed inflammatory protein (~25%); turnover recycles units (conserved:
produced = folding+mature+degrading+degraded). Deterministic (no RNG).

**Evidence discipline:** frozen package has NO translation dataset → protein output is
mostly labelled PREDICTION (`TRANSLATION_EVIDENCE_LEVELS`, additive, 10 tiers). Nothing is
EXPERIMENTAL without a verified in-repo reference (HO-1 = LITERATURE_DERIVED_PREDICTION);
no rate/count/length/copy-number/half-life/folding-time/polysome/constant/fold-change
fabricated (unavailable = NOT_REPORTED); biological half-life kept distinct from the
schematic simulation decay class; protein catalytic FUNCTION never evaluated
(functional_state = not_evaluated). Global translation capacity (constitutive high for
human; signal-node-linked only where a profile permits, as a labelled prediction) is
separate from per-gene efficiency. Abundance is a schematic ladder {0,25,50,75,100}; timing
is schematic (not a biological timescale). The evidence panel gains a **tenth** section
(Translation & Protein Synthesis) that separates mRNA / translation / protein-abundance /
protein-function evidence. STOP at protein + turnover - no enzyme activity / receptor
function / metabolism / phenotype / apoptosis / immune / tissue / PK / PD / toxicity. Docs:
`docs/profile-b-simulator-phase5d-implementation.md`, `translation-protein-synthesis.md`,
`translation-evidence-review.md`, `protein-output-profiles.md`,
`translation-prediction-framework.md`, `phase5d-validation-report.md`,
`translation-animation-specification.md`, `translation-developer-notes.md`.

## Phase 6A — Protein Function & Early Cellular Response Runtime (mature protein → reversible cellular state)

Phase 6A adds the first functional cellular consequence, stopping before cell fate.

```
biology/proteinFunctionEngine.js  reads TranslationEngine (5D, mature proteins) + SignalPropagationEngine (5B) + Phase-6A registries READ-ONLY
    │  functional eligibility -> functional activation/inhibition -> reversible early
    │  cellular-state change -> homeostatic/stress response -> recovery   ⟂ STOP (before cell fate)
    ▼
render/canvasRenderer.js  lastFunctionFrame (functional proteins + cellular-state bars w/ baseline tick; restrained)
biology/transportAnimator.js  steps the protein-function layer AFTER translation each tick
```

**Objects** (`proteinFunctionObjects.js`): FunctionalProteinState, CellularStateVariable,
FunctionalEdge. **Registries** (four separable): `protein-function-context` (function
profiles), `cellular-state` (reversible 0-1 states), `functional-edges` (edges + declared
feedback + dynamics), `functional-evidence` (evidence + predictions).

**Human HaCaT:** HO-1/NQO1 function → antioxidant capacity ↑, oxidative stress ↓ (declared
antioxidant↔oxidative feedback), inflammatory state ↓ (NF-κB suppression + HO-1), adhesion
readiness ↓ (suppressed ICAM1-like protein) — all reversible, recovering to baseline.
**Mouse B16BL6 (signal-driven, no protein output):** survival signaling ↓, oxidative stress
↑, mitochondrial-stress readiness ↑, preparatory reversible stress readiness ↑ — explicitly
NOT apoptosis. **Rat:** NOT_REPORTED (idle). Deterministic (no RNG).

**Evidence discipline:** frozen package has NO functional dataset → early responses are
mostly labelled PREDICTION (`FUNCTION_EVIDENCE_LEVELS`, additive, 10 tiers). Nothing is
EXPERIMENTAL without a verified in-repo reference (HO-1 anti-inflammatory =
LITERATURE_DERIVED_PREDICTION); no enzyme kinetics/concentration/%/membrane-potential/
half-life/dose-response fabricated (unavailable = NOT_REPORTED); cellular states are
schematic 0-1, reversible, bounded; feedback is declared/typed/bounded/stable (no
undeclared cycles, no oscillation explosion); protein catalytic function is NOT evaluated
and **cell-fate evidence stays NOT_EVALUATED**. The evidence panel gains an **eleventh**
section (Protein Function & Early Cellular Response) separating protein-abundance /
protein-function / cellular-response / cell-fate evidence. STOP before cell fate - no
apoptosis/caspase/cytochrome-c/AIF/necrosis/cell-cycle execution/proliferation/migration/
tumour/immune/tissue/PK/PD/toxicity. Docs:
`docs/profile-b-simulator-phase6a-implementation.md`, `protein-function-runtime.md`,
`protein-function-evidence-review.md`, `early-cellular-response-profiles.md`,
`functional-prediction-framework.md`, `phase6a-validation-report.md`,
`phase6a-animation-specification.md`, `phase6a-developer-notes.md`.

## Phase 6B — Apoptosis commitment & execution runtime

`ApoptosisEngine` is the twelfth separate layer. It reads the Phase-6A
`ProteinFunctionEngine` cellular-stress states + the Phase-5B `SignalPropagationEngine`
**read-only** plus four Phase-6B registries, modifies nothing upstream, and is deterministic
(no RNG — **no random death probabilities**). `TransportAnimator` steps it **after** protein
function. It is the first phase where a single cell may enter an **irreversible** death
program:

```
persistent stress (6A) → apoptosis eligibility → reversible pre-commitment
  → commitment gate  ── IRREVERSIBLE ──▶ mitochondrial transition (ΔΨm loss, MOMP)
    → cytochrome-c → caspase-dependent branch │ AIF → AIF-associated branch
      → apoptotic morphology → apoptotic cell state   [STOP — single cell only]
```

**Objects** (`apoptosisObjects.js`): `ApoptosisState`, `MitochondrialApoptosisState`,
`CaspaseCascadeState`, `AIFExecutionState`, `ApoptosisIntervention`. **Registries** (four
separable): `apoptosis-dynamics` (strict FSM + ordinal vocabularies + dynamics defaults),
`apoptosis-context` (per-species/cell-model profiles), `apoptosis-interventions`,
`apoptosis-evidence`.

**Strict FSM with an irreversibility gate:** `stressed`/`apoptosis_eligible`/`pre_commitment`
are recoverable (pressure can fall, the cell steps back down); `committed` onward are
irreversible (`transitionTo` throws on any illegal transition; `validate()` proves the
registry never allows recovery from an irreversible state). Commitment requires *net* pressure
(pressure minus a survival offset) to persist above the commitment threshold for the
persistence window. Two parallel execution branches (caspase-dependent via cytochrome-c; AIF-
associated / caspase-independent via AIF) combine into a bounded schematic execution drive,
with **partial** caspase dependence.

**Cell-model policy:** default mouse = **B16BL6 = CONTEXT_TRANSFER_PREDICTION** (canonical
line; strongest mechanism evidence is in B16, so B16BL6 carries an explicit B16→B16BL6
transfer record — never a silent copy); **B16** and **B16-F10** are separate selectable
experimental profiles (B16-F10 also carries the PI3K-activator intervention); **HaCaT** and
**rat** are `NOT_REPORTED` → idle. **Interventions** are target-isolated and timing-sensitive:
ROS scavenger + PI3K activator act upstream and can *prevent* commitment before the gate;
caspase inhibitor (partial) + AIF knockdown (strong, dominant branch) act during execution and
only *attenuate* an already-committed cell.

**Evidence discipline:** `APOPTOSIS_EVIDENCE_LEVELS` (additive, 11 tiers, incl.
`CONTEXT_TRANSFER_PREDICTION`); all apoptosis citations are `NOT_REPORTED` (qualitative
relationships only — no fabricated DOI/rate/%/ΔΨm/kinetics); no hardcoded scientific values in
engine source. The evidence panel gains a **twelfth** section. **STOP at the single-cell
apoptotic state** — the cell object is never removed and `populationOutcomeEvidence` /
`tumourResponseEvidence` stay `NOT_EVALUATED`; no necrosis/necroptosis/pyroptosis/ferroptosis/
autophagic death, no population/tumour/tissue/immune outcome, no PK/PD/clinical. Docs:
`docs/profile-b-simulator-phase6b-implementation.md`, `apoptosis-runtime-architecture.md`,
`apoptosis-evidence-review.md`, `mitochondrial-apoptosis-pathway.md`,
`caspase-and-aif-execution-model.md`, `apoptosis-intervention-model.md`,
`apoptosis-context-transfer-policy.md`, `phase6b-validation-report.md`,
`phase6b-animation-specification.md`, `phase6b-developer-notes.md`.

## Phase 6C — Population response & tissue-level dynamics

`PopulationEngine` is the thirteenth separate layer and the first to reason about **many
cells at once** — but only as a **schematic virtual population** derived from the Phase-6B
single-cell apoptosis trajectory. It reads the `ApoptosisEngine` + six Phase-6C registries
**read-only**, modifies nothing upstream, invents no new intracellular biology, and is
deterministic (no RNG). `TransportAnimator` steps it **after** apoptosis:

```
… → apoptosis → population viability → population composition
  → population state evolution → population history → STOP
```

**Object** (`populationObjects.js`): `PopulationState` — normalized `[0,1]` fractions only
(`living`, `apoptotic`, `adapted`, `recovered`, `cumulativeApoptosis`), **never** a real cell
count / density / cellularity. **Registries** (six): `population-context` (per-species/
cell-model profiles), `population-state` (state vocabulary + composition thresholds),
`population-transitions` (FSM + dynamics defaults), `population-evidence`,
`population-prediction`, `population-interventions` (upstream-applied echo policy).

**Conservation + strict FSM:** `living + apoptotic = 1` at every step; apoptotic is
non-decreasing (committed cells never resurrect); recovery reclassifies surviving cells only
and is legal **only before** `apoptosis_dominant`. States: `healthy → minimal_response →
adaptive_response → partial_response → mixed_population → apoptosis_accumulating →
apoptosis_dominant → stable_terminal_state`. `transitionTo` throws on illegal transitions;
`validate()` proves no recovery out of an irreversible state. Deterministic **replay history**
(one entry per step) + a milestone timeline. No population growth / proliferation / mitosis.

**Evidence policy:** additive `POPULATION_EVIDENCE_LEVELS` (8 tiers, **no experimental
tier** — population is never experimental). A population profile is available only where
single-cell apoptosis evidence exists **and** population evidence is absent → a labelled
prediction. Mouse **B16BL6 = CONTEXT_TRANSFER_PREDICTION** (default; echoes the 6B B16→B16BL6
transfer); **B16 / B16-F10 = MECHANISTIC_PREDICTION** (separate, selectable); **HaCaT / rat =
NOT_REPORTED** (idle; no fallback). All citations `NOT_REPORTED` (qualitative only); no
hardcoded scientific values in engine source. Renderer draws a **restrained** stacked
composition bar (living/adaptive/recovered/apoptotic) + an apoptotic-fraction history
sparkline (no blood/explosions/dead-body graphics); the evidence panel gains a **thirteenth**
section. **STOP at population composition** — `tumourResponseEvidence` / `survivalEvidence` /
`clinicalOutcomeEvidence` stay `NOT_EVALUATED`; no tumour/immune/vascular/fibrosis/wound-
healing/PK/PD/toxicity/clinical outcome. Docs:
`docs/profile-b-simulator-phase6c-implementation.md`, `population-runtime-architecture.md`,
`population-response-model.md`, `population-evidence-review.md`,
`population-prediction-policy.md`, `population-state-machine.md`,
`population-validation-report.md`, `population-animation-specification.md`,
`population-developer-notes.md`, `population-limitations.md`.

## Phase 6D — Tumour growth, regression & treatment-response

`TumorResponseEngine` is the fourteenth separate layer and the first to represent a **schematic
tumour-level treatment response** — but NOT a clinical-response layer. It reads the Phase-6C
`PopulationEngine` (composition + history) **read-only** + eight Phase-6D registries, modifies
nothing upstream, is **population-gated** (no tumour response without population input), and is
deterministic (no RNG — no uncontrolled random growth/regression). `TransportAnimator` steps it
**after** population:

```
… → population composition → viable tumour-cell burden → growth pressure vs loss pressure
  → treatment-response trajectory → growth / stabilization / regression / rebound → STOP
```

**Objects** (`tumorObjects.js`): `TumorBurdenState` (normalized burden, baseline 1.0, never
mm³), `TumorGrowthPressure`, `TumorLossPressure` (two distinct treatment paths; living fraction
is a DISTINCT abstraction from proliferation; loss is reduced viable burden, NOT immune/physical
clearance), `TumorTreatmentEvent` (explicit reported-vs-schematic timing). **Registries** (eight):
`tumor-context`, `tumor-model`, `tumor-response`, `tumor-transitions`, `tumor-formulation`,
`tumor-treatment`, `tumor-evidence`, `tumor-prediction`.

**Strict response FSM:** `untreated_growth → treatment_started → growth_continues | growth_slowed
→ stable_burden → partial_regression → strong_regression → minimal_residual_burden`;
`treatment_ended → stable_post_treatment | rebound_possible → rebound_in_progress`.
`transitionTo` throws on illegal transitions; there is **no** regression from `untreated_growth`
and **no** `cure` / `complete_response` state. `net_growth_pressure = growth − loss` (schematic);
burden is bounded, non-negative, holds at a minimal-residual floor (not zero), and regresses
**gradually** (no instant disappearance). Deterministic **replay history** + a normalized
**response curve** + a milestone timeline.

**Evidence + cell-model policy:** additive `TUMOR_EVIDENCE_LEVELS` (11 tiers incl.
`EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC`). Unlike the population layer a tumour experimental tier
exists — the frozen package holds a verified in vivo antimelanoma PD study (Chen 2012,
doi:10.2147/IJN.S32476, B16BL6) supporting treatment **direction** + formulation **ranking**
(cationic > anionic/neutral; NLC > free) qualitatively; every exact value stays `NOT_REPORTED`.
Mouse **B16BL6 = EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC** (default; note this is experimental at the
tumour level, unlike the 6B/6C B16→B16BL6 apoptosis transfer); **B16 / B16-F10** separate
experimental (free tripterine); **human = predictive-exploratory / UNAVAILABLE** at runtime (no
active human melanoma population; mandated non-clinical warning); **rat = NOT_REPORTED**. Cationic
/ anionic / neutral NLC, free tripterine, and vehicle stay separate formulation profiles; the
ranking is B16BL6-specific and never transferred silently. No hardcoded scientific values in
engine source. Renderer draws a **restrained** relative-burden bar (viable/apoptotic partition,
baseline tick, treatment-on indicator) + a normalized response curve (no realistic tumour / blood
/ necrotic debris / clinical scan / sensational imagery); the evidence panel gains a
**fourteenth** section. **STOP at the response trajectory** — clinical / RECIST / survival /
metastasis / immune / PK evidence stay `NOT_EVALUATED`; no clinical response / patient outcome /
PBPK / toxicity / dose recommendation (Phase 7+). Docs:
`docs/profile-b-simulator-phase6d-implementation.md`, `tumor-response-runtime-architecture.md`,
`tumor-growth-regression-model.md`, `tumor-response-evidence-review.md`,
`formulation-response-profiles.md`, `tumor-prediction-framework.md`,
`tumor-context-transfer-policy.md`, `phase6d-validation-report.md`,
`phase6d-animation-specification.md`, `phase6d-developer-notes.md`, `tumor-response-limitations.md`.

## Phase 7A — Passive tumour microenvironment (TME)

`MicroenvironmentEngine` is the first tumour-microenvironment layer — a **passive modulator**,
not an immune / angiogenesis / metastasis / remodeling phase. It reads the nine Phase-7A
registries + the active species / tumour model / formulation and computes the passive physical /
biochemical environment (ECM / collagen / hyaluronic acid / interstitial space / oxygen / hypoxia
/ mechanical barrier) that **modifies drug penetration**. It is deterministic (no RNG),
registry-driven, evidence- and prediction-aware.

**Core principle:** the microenvironment MODIFIES transport / uptake / penetration — it never
REPLACES an upstream engine, alters upstream biological logic, or directly modifies intracellular
signalling. Its penetration modifier is ADVISORY (`modifiesTransport: true`, `replacesTransport:
false`, `modifiesSignalling: false`).

**Objects** (`microenvironmentObjects.js`): ECMState (+ CollagenNetwork / hyaluronic acid /
proteoglycan / fluid), InterstitialSpace, DiffusionBarrier, OxygenEnvironment, HypoxiaState,
MechanicalBarrier, PenetrationModifier, MicroenvironmentState — all schematic ordinal / 0-1, never
a real ECM density / collagen mass / interstitial pressure / oxygen concentration / diffusion
coefficient. **Registries** (nine): `microenvironment-context`, `ecm`, `diffusion`, `mechanical`,
`oxygen`, `hypoxia`, `penetration`, `microenvironment-evidence`, `microenvironment-prediction`.

**Model:** ECM / diffusion / mechanical / hypoxia resistances combine (weighted) into
`combinedRestriction`; `penetrationModifier = clamp(1 - combinedRestriction, floor, 1)`;
`microenvironmentState ∈ {permissive … extremely_restrictive}`. Denser ECM / stiffer barrier /
more hypoxia → lower penetration. Deterministic **evaluation timeline** (8 milestones) + a
`validate()` (registry + consistency: prediction labelling, evidence completeness, component-
variant existence, oxygen/hypoxia coherence, dense-ECM-not-permissive).

**Evidence + species policy:** additive `MICROENVIRONMENT_EVIDENCE_LEVELS` (8 tiers, **no
experimental tier** — the frozen package has no direct TME dataset). Mouse **B16BL6 =
MECHANISTIC_PREDICTION** (default); **human = predictive-exploratory** with its **own distinct**
values (not copied; mandated non-clinical warning); **rat = NOT_REPORTED** (idle). Strict species
isolation; no silent transfer. No hardcoded scientific values in engine source. Renderer draws a
**schematic** ECM mesh (density → spacing/opacity) + oxygen/hypoxia overlay + direct-vs-tortuous
penetration path (no photorealism / vasculature / immune cells); the evidence panel gains a
**fifteenth** section. Config key `tmeSources` (distinct from the frozen Phase-4B
`microenvironmentSources`). **STOP at penetration modification** — immune / vascular / remodeling
/ metastasis stay `NOT_EVALUATED`; no fibroblasts / CAF / MMP / angiogenesis / migration /
lymphatic / systemic biology. Docs: `docs/profile-b-simulator-phase7a-implementation.md`,
`microenvironment-runtime-architecture.md`, `passive-microenvironment-model.md`,
`microenvironment-evidence-review.md`, `microenvironment-prediction-policy.md`,
`microenvironment-registry-guide.md`, `microenvironment-renderer-guide.md`,
`microenvironment-validation-report.md`, `phase7a-developer-notes.md`,
`microenvironment-limitations.md` (+ `CHANGELOG.md`).

## Phase 7B — Tumour vasculature & angiogenesis

`VascularEngine` is the active vascular component of the tumour microenvironment — but NOT an
immune / metastasis / fibroblast phase. It reads nine Phase-7B registries + the active species /
tumour model / formulation (and, optionally, the Phase-7A microenvironment engine **read-only**)
and computes vascular architecture (density / maturity / organization), perfusion, oxygen +
nutrient supply, and permeability, combining them into a drug-**delivery** modifier. Deterministic
(no RNG), registry-driven, evidence- and prediction-aware.

**Core principle:** blood vessels do NOT signal and do NOT induce apoptosis. They MODIFY oxygen /
nutrient / drug accessibility / penetration opportunity only. The delivery modifier is ADVISORY
(`modifiesDelivery: true`, `modifiesSignalling: false`, `inducesApoptosis: false`,
`remodels: false`).

**Objects** (`vascularObjects.js`): VesselState, VascularNetwork, PerfusionState, OxygenSupply,
NutrientEnvironment, PermeabilityState, DeliveryModifier, VascularState — all schematic ordinal /
0-1, never a real vessel count / blood flow / pO2 / vascular diameter / perfusion rate.
**Registries** (nine): `vascular-context`, `angiogenesis`, `perfusion`, `oxygen-supply`,
`nutrient`, `permeability`, `delivery`, `vascular-evidence`, `vascular-prediction`.

**Model:** `deliveryModifier = clamp(w.perfusion·perfusionEff + w.permeability·permeability +
w.vessel_density·vesselDensity + w.maturity_efficiency·maturityEff, floor, 1)`; ordinal state
`poor_delivery … excellent_delivery`. Higher perfusion / permeability / vascularization / maturity
→ higher delivery. `effectiveDeliveryPenetration()` = delivery × Phase-7A penetration (read-only).
Deterministic **evaluation timeline** (8 milestones) + a `validate()` (registry + consistency:
prediction labelling, evidence completeness, component-state existence, support-list membership,
oxygen/perfusion coherence, no rat fallback).

**Evidence + species policy:** additive `VASCULAR_EVIDENCE_LEVELS` (8 tiers, **no experimental
tier** — the frozen package has no direct tumour-vasculature dataset). Mouse **B16BL6 =
MECHANISTIC_PREDICTION** (default; abnormal melanoma vasculature — highly vascularized but immature,
poorly perfused, leaky); **human = predictive-exploratory** with its **own distinct** states (not
copied; mandated non-clinical warning); **rat = NOT_REPORTED** (idle). Strict species isolation; no
silent transfer. No hardcoded scientific values in engine source. Renderer draws **schematic**
branching vessels (count/amplitude → density, opacity → maturity) + a perfusion tint + a
delivery-strength path (no endothelial cells / blood cells / flow vectors); the evidence panel
gains a **sixteenth** section. Config key `vascularSources` (distinct from `microenvironmentSources`
/ `tmeSources`). **STOP at delivery modification** — immune / VEGF / HIF / metastasis stay
`NOT_EVALUATED`; no VEGF/HIF signalling, vascular inflammation, immune trafficking, fibroblast /
CAF, ECM remodeling, lymphatics, or metastasis. Docs:
`docs/profile-b-simulator-phase7b-implementation.md`, `vascular-runtime-architecture.md`,
`tumor-vasculature-model.md`, `vascular-evidence-review.md`, `vascular-prediction-policy.md`,
`vascular-registry-guide.md`, `vascular-renderer-guide.md`, `vascular-validation-report.md`,
`phase7b-developer-notes.md`, `vascular-limitations.md` (+ `CHANGELOG.md`).
