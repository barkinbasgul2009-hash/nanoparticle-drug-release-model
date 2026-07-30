# Profile-B Simulator — Phase 3 Implementation Report

**Phase 3: Biological Transport Engine.** The first biological simulation: passive
transport of the topical NLC carrier from the formulation **through the skin** to the target
region (Topical Formulation → Skin Surface → Stratum Corneum → Viable Epidermis → Dermis →
Target Region). Built entirely inside `simulator/`; production `web`/`R`/`app`/`tests` and CI
are **untouched**; PR #3 **not merged**.

**This is transport only.** No drug release, payload diffusion, cell entry, endocytosis,
receptor binding, lysosomes, nucleus, PK, PD, apoptosis, tumour/immune response, circulation,
lymphatics, or metabolism — those belong to later phases and are explicitly excluded in the
registry (`integrity.excluded_downstream`).

Companion docs: architecture (`docs/profile-b-transport-architecture.md`), biology
(`docs/profile-b-biological-transport.md`), evidence (`docs/profile-b-transport-evidence-report.md`),
validation (`docs/profile-b-transport-validation-report.md`).

## Scientific integrity (the central finding)
Reviewing the **frozen** evidence package (`data/profile-b-evidence-package.json`, authoritative):
- **Only rat** has topical skin-permeation evidence for this formulation — Chen 2012, ex-vivo
  full-thickness abdominal rat skin, Franz cell, permeation time series 1–12 h, depth sections
  0–30/30–60/60–90 µm, NLC size 84.5–90.2 nm.
- **Human** skin permeation is **NOT REPORTED** (Chen used HaCaT keratinocytes for in-vitro
  *cellular uptake* — a later intracellular topic — not skin permeation).
- **Mouse** skin permeation is **NOT REPORTED** (C57BL/6 mice were used for melanoma
  *pharmacodynamics*, not permeation).

So the engine is **evidence-gated per species with no fallback**: rat transport animates;
human and mouse are **blocked** (`canAnimate` = false via the existing evidence gate). Rodents
never borrow rat's evidence. Per-layer diffusion coefficients / flux / lag are **not restated
in the frozen package**, so movement uses the reported **time window** (1–12 h) and the
biologically-supported **barrier ordering** only — magnitudes are **schematic**, nothing is
invented. Whether the *intact* NLC (vs released drug) reaches the deep dermis is itself
NOT REPORTED and is flagged, not asserted.

## Modules created (`simulator/src/biology/`)
| Module | Role |
|---|---|
| `transportStates.js` | **Biological state machine** — the cited linear pathway; `validate()`, `next()`, `evidenceForTransition()` |
| `transportModel.js` | Wraps the registry: barrier mobility, mechanisms, per-species support, `evidenceForSpecies()`, particle spec |
| `particle.js` | **Particle object** — id, species, charge, position/velocity, state/layer, transport status, evidence tag, crossings |
| `transportEngine.js` | **Simulation core** — Brownian + concentration drift × evidence-based mobility; species-driven depth bands; evidence gate; deterministic (seeded) |
| `transportAnimator.js` | Time driver — spawn/step/repaint; browser `requestAnimationFrame`, headless `tick()`/`runHeadless()` |
| `rng.js` | Dependency-free seeded PRNG (reproducible Brownian motion) |
| `render/canvasRenderer.js` (extended) | Particle overlay: flat muted dots (no glow/trail/FX) mapped through the current zoom window |
| `data/transport.registry.json` | The evidence backbone: states, transitions, mechanisms, barriers, species support, particle spec, integrity |
| `types/transport.ts` | TypeScript contract for the transport objects |

## Transport mechanisms (passive only — Step 3/4)
- **Brownian (thermal) motion** — universal for ~85–90 nm carriers (mechanistic).
- **Concentration-driven (Fickian) drift** — net inward, supported by the time-increasing
  permeation series.
- **Stratum-corneum barrier slowing** — SC is the rate-limiting barrier (consensus + Chen's
  enhancement framing).
- **Post-SC mobility increase** — viable epidermis then dermis resist a small carrier less.
- **Active transport is EXCLUDED** (`kind: EXCLUDED`, never animated).

Barrier mobility is a **schematic ordinal** modifier (SC 0.15 < viable epidermis 0.5 < dermis
1.0). Only the *ordering* is evidence-based; each modifier carries a biological **rationale +
references** (not an arbitrary multiplier), and every magnitude is flagged
`SCHEMATIC_ORDINAL` / not a measured diffusion coefficient.

## Renderer & animation (Step 6/7)
Particles are flat, muted dots — **no glow, no trails, no explosions, no gaming effects** —
resembling scientific molecular animation. Motion is smooth because it is many small
evidence-based steps, not scripted keyframes. Implemented events: **spawn, movement, barrier
crossing, layer transition, arrival**. No intracellular animation. Static anatomy (Phases 2–2.6)
renders unchanged beneath the particles, and particle depth maps through the same zoom window as
the anatomy layout.

## Species + evidence integration (Step 8/9)
The engine reads `anatomyModel.activeSpecies`; `app.setSpecies()` drives both anatomy and
transport (recomputing barrier depths and re-evaluating the gate). Every transition exposes its
supporting paper, confidence and notes; the engine surfaces a per-species evidence descriptor
and a human-readable block reason for unsupported species.

## Tests & results
New `simulator/tests/transport.test.mjs` covers: state-machine validation; barrier ordering;
excluded active transport; evidence gating (rat supported, human/mouse blocked, no fallback);
particle independence; **rat particles traversing formulation→target in order and crossing the
SC barrier**; blocked species producing zero particles; species switching; determinism;
animator run-to-completion; and the full-app path (renderer draws particles, static anatomy
intact). **Simulator suite: 293 passed, 0 failed** (was 173). `tsc` compiles; hidden-char guard
clean.

## CI status
Production diff vs `origin/main` **empty**; production tests green (**99 JS + 11 R**). PR #3
**not merged**.

---

**Stop.** Phase 3 complete: nanoparticles travel from the topical formulation to the target
region, evidence-gated and species-driven. No drug release, cell entry, uptake, endocytosis,
payload, PK or PD was implemented.
