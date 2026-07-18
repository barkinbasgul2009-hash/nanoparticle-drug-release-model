# Profile-B Simulator — Phase 4 Implementation Report

**Phase 4: Drug Release Engine.** After a nanoparticle **arrives** at the target region (Phase 3),
it begins releasing its payload: drug inside decreases, released amount increases, the release
curve updates, and the carrier eventually **empties**. Everything inside `simulator/`; production
`web`/`R`/`app`/`tests` and CI **untouched**; PR #3 **not merged**.

**Drug release only.** Release is a **completely separate** process from transport — the
transport engine still only *moves* particles; the release engine only *releases payload from
arrived particles*, and neither writes the other's state. Nothing beyond release is implemented:
no cellular uptake, membrane crossing, receptor binding, endocytosis, endosome/lysosome,
cytoplasm/nucleus, intracellular trafficking, degradation, PK, PD, circulation, immune system,
toxicity, tumour killing, apoptosis, or pharmacology (all listed in
`integrity.excluded_downstream`).

Companion docs: drug-release documentation (`docs/profile-b-drug-release.md`), evidence report
(`docs/profile-b-release-evidence-report.md`), architecture update
(`docs/profile-b-transport-architecture.md`, Phase 4 section), validation
(`docs/profile-b-phase4-validation-report.md`).

## The release sequence (exactly the required flow)
```
Nanoparticle arrives (transportStatus = 'arrived')
      ↓   release begins ONLY here — transport has ended
Drug begins to release      (releaseState: loaded → releasing)
      ↓
Drug inside the particle decreases   (payloadFraction 1 → 0)
Released drug amount increases        (releasedFraction 0 → 1;  payload + released = 1)
      ↓
Release curve updates                 (aggregate mean released vs time)
      ↓
Particle eventually becomes empty     (releaseState → empty)   ← phase ends here
```

## Scientific basis
From the **frozen** evidence package (Chen 2012): release kinetics were fit to zero-order,
first-order, Higuchi and Ritger-Peppas, and **FIRST-ORDER was selected** (good correlation);
release was followed over **1–48 h**; tripterine is **amorphous** in the NLC. So the engine uses
the evidence-**selected** first-order model `F(t) = 1 − e^(−k·t)`. The numeric **rate constant k
is NOT restated** in the frozen package, so k is a **schematic** simulation rate anchored to
span the reported 1–48 h window — no exact k or %-released value is claimed. Release is a
**formulation** property (in-vitro release of the NLC), so the model is **not species-specific**
and no per-species rate is fabricated.

## Modules created (`simulator/src/biology/`)
| Module | Role |
|---|---|
| `releaseModel.js` | Wraps the registry: first-order evaluator `fractionReleased(t,k)`, evidence descriptor, states, scope guard. Pure. |
| `releaseEngine.js` | The release simulation: per-particle payload state (keyed by id), first-order stepping of **arrived** particles, aggregate release curve, `allEmpty()`. Reads (never writes) transport status; never moves particles. |
| `data/release.registry.json` | Kinetic model + rate-constant record (NOT REPORTED) + lifecycle states + trigger + integrity + provenance. |
| `render/canvasRenderer.js` (extended) | Particle glyph = carrier shell + inner **payload disc** whose area ∝ remaining payload; shrinks to empty. |
| `biology/transportAnimator.js` (extended) | Optionally drives the release engine **after** each transport step; `untilReleased` runs to empty. |
| `types/release.ts` | TypeScript contract for the release domain. |

## Separation of concerns (transport ≠ release)
- Release state lives in the **ReleaseEngine** (a `Map` keyed by particle id), **not** on the
  transport `Particle`. The transport domain is untouched.
- `ReleaseEngine.step()` processes only particles with `transportStatus === 'arrived'`; during
  transport nothing releases.
- The release engine never mutates `x`, `d`, or `transportStatus` — verified by test (positions
  and status are unchanged across a full release run).

## Renderer & integration
The particle is drawn as a carrier **shell** (dashed for predictive species, solid for
experimental — Phase 3.1 preserved) with an inner **payload disc** that shrinks as the drug
releases, until only the shell remains (empty). `app.release` exposes the engine, curve, and
stats; the animator drives transport→arrival→release→empty; the information panel shows the
release model + mean released + empty count. Static anatomy (Phases 2–2.6) and transport
(Phase 3/3.1) render unchanged beneath.

## Tests & results
New `simulator/tests/release.test.mjs`: first-order model (monotonic, conservation, k schematic,
cites Chen 2012, excludes downstream biology); **release never starts before arrival**;
arrive→release→empty with `payload + released = 1`; **release never moves particles**; release
curve updates and is monotonic to full release; formulation-level model runs for predictive
species too; determinism; the animator drives the full sequence; and the full-app path (renderer
shows empty payload, panel shows the model). **Simulator suite: 769 passed, 0 failed** (was 315).
`tsc` compiles; hidden-char clean; production diff vs `origin/main` **empty**; production tests
green (**99 JS + 11 R**). PR #3 **not merged**.

---

**Stop.** Phase 4 complete: an arrived nanoparticle releases its payload by first-order kinetics
until empty, as a process fully separate from transport. Nothing beyond release was implemented.
