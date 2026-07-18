# Profile-B Simulator — Phase 4C Implementation Report

**Phase 4C: Endocytosis & Intracellular Trafficking.** Implements ONLY the intracellular *entry*
phase: a carrier nanoparticle contacts a cell membrane, is internalized by an endocytic pathway,
traffics Early Endosome → Late Endosome → Lysosome, and — only if the formulation evidence
supports it — escapes to the cytoplasm. All inside `simulator/`; production `web`/`R`/`app`/`tests`
and CI **untouched**; PR #3 **not merged**. Previous engines are unchanged — Phase 4C only adds a
new layer.

The full chain the simulator now shows and then **stops**:
```
topical → transport → drug release → free-drug diffusion → passive uptake
   → endocytosis → early endosome → late endosome → lysosome → endosomal escape (if supported)  ⟂ STOP
```

**Forbidden and absent:** nucleus, DNA/RNA, transcription, translation, receptor signalling,
receptor-specific/Fc/antibody uptake, phagocytosis, active-transporter uptake, lipid-raft
signalling, exocytosis, apoptosis, immune response, complement, cytokines, PD, PK, target
interaction, tumour killing, blood circulation, efficacy, Golgi, ER, mitochondria, ribosomes,
cytoskeleton, degradation chemistry, enzymes (registry `integrity.forbidden` lists 32).

Companion docs: endocytosis evidence review (`docs/profile-b-endocytosis-evidence-review.md`),
intracellular trafficking (`docs/profile-b-intracellular-trafficking.md`), architecture update
(`docs/profile-b-transport-architecture.md`, Phase 4C section), validation
(`docs/profile-b-phase4c-validation-report.md`).

## Scientific basis & evidence levels
The frozen package (Chen 2012) reports **carrier** cellular uptake in HaCaT (human) and B16BL6
(mouse) cells (order cationic > neutral > anionic) but **does not resolve the pathway**, reports
**no endosomal escape**, and had **no rat** cell-uptake study. So:
- **Endocytosis** (carrier internalization): **Predictive** for all species — the pathway is
  unresolved; human/mouse have observational uptake support, rat none.
- **Intracellular trafficking** (endosome → lysosome): **Predictive** for all — general cell
  biology, not measured for this formulation.
- **Endosomal escape**: **Unavailable** for the B1 NLC (NOT REPORTED) → no escape; carriers
  terminate in the lysosome.

The general mechanisms (clathrin/caveolae/macropinocytosis, endosome maturation, lysosome
trafficking) are strong general evidence (category A) and endosomal escape is mechanistic
(category B), but the **formulation-specific** claim is Predictive/Unavailable as above. No rat
parameters are copied (parameters are formulation-level, not per-species); no fabricated citation.

## New modules (`simulator/src/biology/`)
| Module | Role |
|---|---|
| `endocytosisStates.js` | **Strict FSM** — legal states + transitions from the registry; rejects illegal transitions. |
| `endocytosisEngine.js` | Per-carrier fate: approach → contact → wrapping (pathway) → internalized → endosome maturation → lysosome → (escape → cytoplasm if allowed). Reads uptake/transport read-only; never moves carriers. |
| `data/endocytosis.registry.json` | Evidence review (A/B/C), pathways, per-formulation profile (weights, probabilities, dwell, escape), FSM, compartments, per-species evidence, integrity (32 forbidden). |
| `render/canvasRenderer.js` (extended) | Membrane wrapping arc, compartment vesicle rings + labels; carrier colour unchanged. |
| `biology/transportAnimator.js` (extended) | Steps the endocytosis layer after uptake each tick. |
| `types/endocytosis.ts` | TypeScript contract. |

## Particle classes (carrier vs molecule)
Endocytosis applies **only to carrier nanoparticles** (transport `Particle`s). **Free drug
molecules** (Phase 4B `DrugMolecule`s) stay free and are never endocytosed — they are separate
classes and never become the same object (verified by test: no molecule id ever has an
endocytosis state).

## Uptake decision (registry-driven)
When a carrier contacts a membrane, the engine rolls the formulation's `endocytosis_probability`
and, on success, selects a **pathway** by the registry `pathway_weights` (clathrin / caveolae /
macropinocytosis) — never hard-coded. The three pathways differ visually (clathrin lattice pit,
caveolae flask invagination, macropinocytosis ruffle→cup→large vesicle).

## Strict state machine (fate tracking)
Every carrier always has exactly one state:
`EXTRACELLULAR → MEMBRANE_CONTACT → WRAPPING → INTERNALIZED → EARLY_ENDOSOME → LATE_ENDOSOME →
LYSOSOME → (ESCAPED → CYTOPLASM)`. Illegal transitions (e.g. Extracellular→Lysosome,
Wrapping→Cytoplasm, Lysosome→Extracellular) are **rejected** (throw). Maturation is gradual
(registry dwell times); nothing jumps. Escape transitions are taken **only** when the formulation
escape profile allows.

## Animation & visuals
Endocytosis is smooth (contact → gradual membrane wrapping → vesicle → internalization), not a
teleport or instant disappearance. Compartments are visually distinct (coloured vesicle rings +
labels: Early/Late endosome, Lysosome). Escape (when allowed) is a gradual state change to
cytoplasm (no explosion). Particle colour is unchanged; state is shown by wrapping, vesicle rings,
compartment labels — muted, scientific, no gaming effects.

## Evidence panel (five sections)
Transport / Release / Passive Uptake / Endocytosis / Intracellular Trafficking, each
Experimental / Predictive / Unavailable with a short message. For rat: Experimental / Experimental
/ Predictive / Predictive / Predictive; for human & mouse: Predictive across the board.

## Tests & results
New `simulator/tests/endocytosis.test.mjs`: strict FSM (legal accepted, illegal rejected); exactly
the three allowed pathways; no endocytosis before carriers arrive / before contact; endocytosis
never touches free molecules; correct compartment sequence to lysosome; B1 no escape; escape only
when the formulation allows (patched registry); evidence levels correct + clearly labelled;
species switching clears state; full-app chain with the renderer drawing vesicles; five-section
evidence panel. **Simulator suite: 906 passed, 0 failed** (was 847). `tsc` compiles; hidden-char
clean; production diff vs `origin/main` **empty**; production tests green (**99 JS + 11 R**). PR #3
**not merged**.

---

**Stop.** Phase 4C ends at the lysosome (or the cytoplasm after a supported escape). No receptor
signalling, nucleus, DNA/RNA, transcription/translation, apoptosis, immune response, PD, PK,
target interaction or tumour killing was implemented.
