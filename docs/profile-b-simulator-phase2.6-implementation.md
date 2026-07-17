# Profile-B Simulator — Phase 2.6 Implementation Report

**Phase 2.6: Multi-Species Anatomy Architecture.** An architectural refinement (required before
Phase 3) that makes the anatomy engine **species-driven** with **independent** Human / Mouse /
Rat profiles and **no hidden fallback to human**. Confined to `simulator/` (registry, model,
config, state, one panel field, tests) plus docs. **No nanoparticles, diffusion, drug release,
cells, tumours, animation, microscopy, rendering improvements, or biology** were added.
Production `web`/`R`/`app`/`tests` and CI are **untouched**; PR #3 is **not merged**.

Auditable literature + architecture record: [`docs/profile-b-multi-species-anatomy.md`](./profile-b-multi-species-anatomy.md).

---

## 1. Literature reviewed (per species — never mixed)
Objective: **ordering + relative prominence**, not exact micrometres.
- **Human** — SC thin (18.3 µm), viable epidermis medium (56.6 µm), dermis thick (1–3 mm),
  subcutis present/variable. Ordering SC < epidermis < dermis. Provenance complete (Sandby-Møller
  2003 PubMed 14690333; OpenStax CC BY; StatPearls; Turkish J Plast Surg 2018). **HIGH.**
- **Mouse (C57BL/6)** — SC very thin, epidermis thin (~20 µm rodent), dermis medium (total skin
  ~540 µm), subcutis present & relatively prominent (panniculus carnosus). Per-layer µm **not
  established**. **LOW-MEDIUM** (PMC5620574 CC BY; Annex JVSAH; standard histology).
- **Rat (ex-vivo permeation context)** — SC very thin, epidermis thin (~20 µm), dermis thick
  (dominant layer; rat skin thicker than mouse overall), subcutis present. Per-layer µm **not
  established**. **LOW-MEDIUM** (PMC5620574 CC BY; Chen 2012 ex-vivo rat abdominal skin).

Rodent per-layer micrometres were **not located** (web fetch blocked; a prior rat search hit a
session limit), so rodent profiles use an **ordinal prominence ladder**, not invented numbers.

## 2. Final anatomical model
Three **independent** profiles, selected by species — no universal/average profile, no species
inheriting another's values.

| Layer | Human (log10 µm, HIGH) | Mouse (ordinal, LOW-MED) | Rat (ordinal, LOW-MED) |
|---|---|---|---|
| skin_surface | 0.3 (interface strip) | 0.3 (interface strip) | 0.3 (interface strip) |
| stratum_corneum | **1.26** = log10(18.3) | **0.7** very thin | **0.7** very thin |
| viable_epidermis | **1.75** = log10(56.6) | **1.2** thin | **1.2** thin |
| dermis | **3.30** = log10(2000, flagged) | **2.0** medium | **2.8** thick |
| subcutis | 2.0 (illustrative) | 2.0 (present, panniculus carnosus) | 2.0 (present) |

Ordinal ladder: `very_thin 0.7 · thin 1.2 · medium 2.0 · thick 2.8`. **Independence:** none of
human's `1.26 / 1.75 / 3.30` appears in either rodent profile. Mouse and rat share the rodent
SC/epidermis ladder (literature doesn't distinguish them there) and differ on the dermis (rat
thicker overall) — an honest position, not a fabricated distinction.

## 3. Architecture changes
- **Registry (`anatomy.registry.json`, schema 1.1 → 1.2):** replaced `model_scope` +
  `weight_profiles` with `species_scope` (`supported: [human, mouse, rat]`, `initial: human`,
  `fallback: null`) and **independent `species_profiles`** — each with `layer_order`,
  `prominence`, `draw_weights`, `subcutis_present`, `weight_basis`, `confidence`, `references`,
  `uncertainty`. Layer `thickness_evidence`, scale levels, clip, labels, zoom, scenes, palette
  **unchanged**.
- **`AnatomyModel`:** now takes `{ species }`; tracks `activeSpecies`. New/changed accessors:
  `species()`, `initialSpecies()`, `profileFor()`, `setSpecies()`, `subcutisPresent()`,
  `weightsForSpecies()` (**throws** on unknown species — no human fallback), and `weights()`
  which follows `activeSpecies`. All read the registry; **no hardcoded biology**.
- **Layout/renderer:** unchanged — `computeAnatomyLayout` already reads `model.weights()`, so the
  cross-section is automatically species-driven.
- **Config:** added `anatomy.species: 'human'` (boot selection, documented as a choice, not a
  fallback).
- **App/state:** `state.species` tracked; `app.setSpecies(id)` loads the profile, updates state,
  and redraws the current static frame — **prepares a future Species selector without adding UI**;
  it **throws** on unsupported species.
- **UI:** not redesigned; the information panel model gains a read-only `species` field.

## 4. Scientific justification
- Human remains **evidence-anchored** (log10 µm) because human per-layer thicknesses are
  established. Rodents use an **evidence-supported ordinal ordering** because per-layer µm are
  not — this claims only what the literature supports (ordering + prominence) and invents nothing.
- Weights stay **schematic** ("schematic - not to scale"): the human dynamic range alone is ~100×,
  and rodent magnitudes are ordinal.
- Removing the human fallback matches the intended long-term architecture: species selection
  determines anatomy; human is one profile among three, not a universal default.

## 5. Remaining uncertainty
- Rodent per-layer µm unresolved → mouse/rat magnitudes are ordinal, LOW-MEDIUM confidence.
- Rat-thicker-than-mouse dermis is a general, low-confidence claim.
- Human dermis 1–3 mm (flagged anchor); human epidermis site-dependent; subcutis magnitude
  variable in all species (orientation-only).

## 6. Tests executed
`simulator/tests/anatomy.test.mjs` updated (all Phase-2 / 2.5 checks retained; Phase-2.6 added):
- three independent profiles present (`human`/`mouse`/`rat`); default active species = human
  (boot selection, not fallback); each profile defines all five tissue layers, keeps
  SC < epidermis < dermis, declares subcutis present;
- **independence:** mouse/rat SC, epidermis, dermis weights ≠ human (not copied);
- **no hidden fallback:** `weightsForSpecies` / `setSpecies` / `app.setSpecies` **throw** on an
  unsupported species;
- **species-driven layout:** switching species changes the computed dermis band height (model-
  level and full-app renderer level);
- scenes / labels / zoom / clip plane **unchanged**.

**Results**
- Simulator suite: **173 passed, 0 failed** (`node simulator/tests/run.mjs`; was 139 in Phase 2.5).
- TypeScript contract: **compiles clean** (`npx tsc --noEmit -p simulator/tsconfig.json`).
- Registry: **valid JSON**, schema 1.2, `species_scope.supported = [human, mouse, rat]`, three
  independent profiles.
- Hidden-character guard: **clean**.

## 7. CI status
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty**.
- Production JS model tests: **99 passed, 0 failed**.
- Production R regression: **11 passed, 0 failed**.
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise the unchanged production suites →
  remain green. PR #3 **not merged**.

---

**Stop.** Phase 2.6 complete: the anatomy architecture now supports independent Human, Mouse, and
Rat profiles, species-driven with no hidden fallback. Phase 3 (particles / diffusion / drug
release / cells / motion / animation) is **not** started.
