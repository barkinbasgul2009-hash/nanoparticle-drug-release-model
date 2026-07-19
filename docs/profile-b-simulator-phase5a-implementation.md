# Profile-B Simulator — Phase 5A Implementation Report

**Phase 5A: Target Engagement Engine.** The first pharmacology layer — molecular recognition
only. It asks "once the drug reaches its molecular target, does it bind?" and **stops immediately
after target binding**. All inside `simulator/`; every previous engine is read-only and unchanged;
production `web`/`R`/`app`/`tests` and CI **untouched**; PR #3 **not merged**.

Final chain, and it **stops here**:
```
… → intracellular drug release → cytoplasmic diffusion → optional nucleus targeting
  → target encounter → target binding → occupancy → optional dissociation  ⟂ STOP
```

**Forbidden and absent:** signalling / signal transduction, phosphorylation, MAPK/PI3K/AKT/mTOR/
NF-κB, kinase cascades, gene regulation, transcription, translation, protein synthesis, apoptosis,
proliferation, cell cycle, immune response, toxicity, efficacy, PK, PD downstream, tumour response
(registry `integrity.forbidden` = 24).

Companion docs: target engagement (`docs/target-engagement.md`), evidence review
(`docs/target-binding-evidence-review.md`), prediction framework (`docs/prediction-framework.md`),
architecture update (`docs/profile-b-transport-architecture.md`, Phase 5A section), validation
(`docs/phase5a-validation-report.md`).

## Scientific basis & the honest B1 outcome
Chen 2012 reports skin permeation, cellular uptake and in-vivo melanoma PD, but **no molecular
target identity and no binding constants** (Kd/Ki/IC50, kon/koff) for tripterine; Shukla's "binding
affinity" is celastrol–cyclodextrin **complexation**, not a protein target. So for the B1 NLC,
**target identity + binding are NOT REPORTED** — and since Phase 4D produced no intracellular drug
(B1 idle), target engagement is honestly **idle / Not Reported**. The full engine (targets,
encounter, reversible/irreversible binding, occupancy, saturation, competition, residence time,
affinity) is built and exhaustively tested via **test-only patched registries** (evidence-labelled
predictions), never committed as real evidence. No Kd/kon/koff is fabricated, and no outside
knowledge is used to fill the gap.

## New modules (`simulator/src/biology/`)
| Module | Role |
|---|---|
| `targetProtein.js` | Schematic molecular **target** (individual protein): id, type, position, compartment, site capacity/occupancy, binding state, species, evidence level, kinetic model. |
| `targetEngagementEngine.js` | Detects intracellular drug + nearby targets; encounter → binding → occupancy → (reversible) dissociation; competition + saturation; nuclear gate. Reads intracellular/uptake read-only. |
| `data/target-engagement.registry.json` | Target types, binding models, affinity metrics, prediction labels, per-formulation profile (B1 = NOT REPORTED), per-species evidence, integrity (24 forbidden). |
| `render/canvasRenderer.js` (extended) | Schematic protein glyphs + occupancy halo + bound-drug dots + occupancy caption. |
| `biology/transportAnimator.js` (extended) | Steps the target-engagement layer after intracellular release each tick. |
| `types/targetEngagement.ts` | TypeScript contract. |

Also: a **prediction-label vocabulary** (`PREDICTION_LABELS` + `labelAnimates` + `isPrediction`)
was added to the evidence engine.

## Molecular targets (generic, no disease assumptions)
Six generic target types (enzyme, receptor, cytoplasmic protein, transport protein, DNA-associated
protein, nuclear protein). Targets are **individual proteins**, not cells or organelles, placed in
the **cytoplasm** or **nucleus** (never ER/Golgi/mitochondria/ribosomes). Each has a site capacity;
occupancy never exceeds it.

## Encounter → binding → occupancy → dissociation
- **Encounter:** binding begins **only** after a drug molecule physically reaches a target's
  vicinity (a schematic reaction radius) — no long-distance attraction, no teleportation.
- **Binding:** reversible (Drug ⇄ Target) or irreversible (Drug → Target), gated by `kon`.
- **Occupancy / saturation:** occupied/available sites; overall saturation shown in 0/25/50/75/100%
  buckets.
- **Competition:** many drugs / one target — the first to bind occupies the site; the rest keep
  diffusing (Phase 4D unaffected). Many targets / one drug also supported.
- **Dissociation:** reversible binding may dissociate (`koff`); **irreversible never dissociates**.
- **Residence time = 1/koff; Kd = koff/kon** (only when both rates exist, else null).
- **Nuclear gate:** binding a nuclear target requires that Phase-4D nucleus targeting has occurred
  (the drug reached the nuclear membrane).

## Affinity & predictive mode
Kd/Ki/IC50 are shown **only** when evidence exists; otherwise a **prediction label** or **Not
Reported** — numeric values are never fabricated. When formulation-specific parameters are missing,
prediction is allowed **only when explicitly labelled**: Experimental / High-confidence Prediction
/ Mechanistic Prediction / Literature-derived Prediction / Unavailable / Not Reported. Predictions
are never presented as experimental facts (see `docs/prediction-framework.md`).

## Separation
The target-engagement engine **reads** the intracellular/uptake outputs read-only and **modifies
nothing upstream** — binding state lives only here (the Phase-4D molecule is never changed; the
renderer reconciles a bound drug at its target at draw time). Seven layers now stay separate:
Transport / Release / Diffusion / Passive Uptake / Endocytosis / Intracellular Release / Target
Engagement.

## Evidence panel (seven sections)
Transport / Release / Passive Uptake / Endocytosis / Intracellular Trafficking / Intracellular
Release / **Target Engagement**, each Experimental / Prediction / … / Not Reported. For B1 the
target-engagement level is **Not Reported**.

## Species
`app.setSpecies()` clears the drug, targets, binding states and occupancy — no stale objects.

## Tests & results
New `simulator/tests/targetEngagement.test.mjs`: prediction-label vocabulary; generic targets +
forbidden-downstream registry; **B1 idle (NOT REPORTED)**; no binding before intracellular
localization / before encounter; occupancy never exceeds capacity; reversible may dissociate;
irreversible never dissociates (monotonic occupancy); competition (single-site cap); saturation
buckets; Kd/residence time; nuclear gate (unbound without Phase-4D targeting, bindable with it);
per-species evidence labels; species switching clears state; full-app idle + seven-section panel;
previous phases unchanged. **Simulator suite: 1175 passed, 0 failed** (was 1100; exceeds the 1100+
target). `tsc` compiles; hidden-char clean; production diff vs `origin/main` **empty**; production
tests green (**99 JS + 11 R**). PR #3 **not merged**.

---

**Stop.** Phase 5A ends at target binding / occupancy / optional dissociation. No signal
transduction, kinase cascades, gene regulation, transcription, translation, apoptosis, immune or
tumour response, PD downstream, or toxicity was implemented — those belong to Phase 5B and later.
