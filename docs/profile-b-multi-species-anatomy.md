# Profile-B Simulator — Multi-Species Anatomy (Phase 2.6)

Auditable record for the architectural change that made the anatomy engine
**species-driven** with **independent** Human / Mouse / Rat profiles. Scope:
`simulator/data/anatomy.registry.json` + model accessors + tests. No biology, motion, or
rendering features were added; production is untouched; PR #3 not merged.

## Why this phase exists
Phase 2.5 added evidence-anchored weights but **defaulted to human** because human thickness
data is the most complete. That made "human" an implicit universal profile. Phase 2.6 removes
that: each species has its **own independent profile**, the active profile **always follows the
selected species**, and there is **no silent fallback to human** — an unsupported species is an
error, not a coercion to human.

## Ground rules honored
Never invent a measurement · never average conflicting sources · never copy human values into
mouse/rat · record disagreement · every value has provenance + confidence · weights remain
**schematic drawing weights, not measurements**; the UI keeps "schematic - not to scale."

## Step 1 — Literature reviewed (per species; never mixed)
The goal here is **ordering and relative prominence**, not exact micrometres.

### Human skin
| Layer | Ordering / prominence | Basis | Confidence |
|---|---|---|---|
| Stratum corneum | thin (18.3 µm dorsal forearm) | Sandby-Møller 2003 (PubMed 14690333) | HIGH |
| Viable epidermis | medium (56.6 µm forearm; ~50–100 general) | Sandby-Møller 2003; systematic review | HIGH |
| Dermis | thick (1–3 mm) | consensus (OpenStax CC BY; Turkish J Plast Surg 2018) | MEDIUM (wide range) |
| Subcutis | present, variable (site/BMI) | consensus | present / thickness NOT_DETERMINED |

Ordering: **SC < viable epidermis < dermis**, subcutis present. Provenance-complete.

### Mouse skin (C57BL/6 context)
| Layer | Ordering / prominence | Basis | Confidence |
|---|---|---|---|
| Stratum corneum | very thin | rodent SC thinner than human (qualitative), PMC5620574 (CC BY) | LOW-MEDIUM |
| Viable epidermis | thin (~20 µm rodent) | PMC5620574 (CC BY) | MEDIUM |
| Dermis | medium (bulk of a thin skin) | C57BL/6 total skin ~540 µm (Annex JVSAH) | LOW-MEDIUM |
| Subcutis | present, relatively prominent (panniculus carnosus) | standard rodent histology | MEDIUM (presence), LOW (magnitude) |

Ordering: **SC < epidermis < dermis**; subcutis present. Per-layer µm **not established**.

### Rat skin (ex-vivo permeation context)
| Layer | Ordering / prominence | Basis | Confidence |
|---|---|---|---|
| Stratum corneum | very thin | rodent SC thin (qualitative), PMC5620574 | LOW-MEDIUM |
| Viable epidermis | thin (~20 µm rodent) | PMC5620574 (CC BY) | MEDIUM |
| Dermis | thick (dominant tissue layer; rat skin thicker than mouse overall) | rodent histology consensus; Chen 2012 ex-vivo rat abdominal skin (Profile-B permeation context) | LOW-MEDIUM |
| Subcutis | present (panniculus carnosus) | standard rodent histology | MEDIUM (presence), LOW (magnitude) |

Ordering: **SC < epidermis < dermis**; subcutis present. Per-layer µm **not established**.

> Web full-text fetch is blocked in this environment and a prior rat-specific search hit a
> session limit. Rodent per-layer micrometre values were **not located**, so rodent profiles use
> an **ordinal prominence ladder**, not fabricated numbers. Only the ordering and relative
> prominence are claimed.

## Step 2 — Independent profiles (drawing weights, NOT measurements)
A shared **ordinal prominence ladder** encodes schematic magnitudes where µm are unavailable:
`very_thin = 0.7 · thin = 1.2 · medium = 2.0 · thick = 2.8`. `skin_surface = 0.3` is a
**non-biological interface strip** (a rendering constant shared across species, not a copied
measurement).

| Layer | Human (evidence-anchored, log10 µm) | Mouse (ordinal) | Rat (ordinal) |
|---|---|---|---|
| skin_surface | 0.3 (interface strip) | 0.3 (interface strip) | 0.3 (interface strip) |
| stratum_corneum | **1.26** = log10(18.3) | **0.7** very thin | **0.7** very thin |
| viable_epidermis | **1.75** = log10(56.6) | **1.2** thin | **1.2** thin |
| dermis | **3.30** = log10(2000, flagged anchor) | **2.0** medium | **2.8** thick |
| subcutis | 2.0 (illustrative) | 2.0 (present, panniculus carnosus) | 2.0 (present) |
| **confidence** | HIGH | LOW-MEDIUM | LOW-MEDIUM |

**Independence check:** the biologically-meaningful layers (SC, epidermis, dermis) differ
between human and both rodents — none of human's `1.26 / 1.75 / 3.30` appears in mouse or rat.
Mouse and rat share the rodent SC/epidermis ladder (both rodent-thin — the literature does not
distinguish them there) and differ on the dermis (rat skin is thicker overall than mouse). This
is an honest position, not a fabricated distinction. `skin_surface` and `subcutis` may coincide
numerically but are independently justified (interface strip; subcutis present in all three).

## Step 3 — Runtime architecture (species-driven, no hidden fallback)
- `species_scope` = `{ supported: [human, mouse, rat], initial: human, fallback: null }`.
  `initial` is the **boot selection** (configurable via `app.config.anatomy.species` and a future
  Species selector calling `app.setSpecies()`), **not** an anatomical fallback.
- `AnatomyModel(registry, { species })` sets an `activeSpecies`; `weights()` returns that
  species' independent profile. `setSpecies(id)` / `weightsForSpecies(id)` **throw** on an
  unsupported species — there is **no silent coercion to human**.
- The pure layout engine already reads `model.weights()`, so the cross-section becomes
  species-driven with no change to the renderer.
- UI is **not** redesigned; the architecture simply exposes `app.setSpecies()` and tracks
  `state.species` so a future selector can drive it.

## Step 4 — Remaining uncertainty
- Rodent per-layer µm are **not established** → mouse/rat magnitudes are schematic (ordinal),
  LOW-MEDIUM confidence; only ordering + prominence are claimed.
- The rat-thicker-than-mouse dermis difference is a **general, low-confidence** claim.
- Human dermis is a 1–3 mm range (flagged midpoint anchor); human epidermis is site-dependent.
- Subcutis magnitude is genuinely variable in every species → weighted for orientation only.

## Provenance sources
- Sandby-Møller J, Poulsen T, Wulf HC. Epidermal thickness at different body sites (PubMed 14690333) — human SC + viable epidermis µm.
- OpenStax Anatomy & Physiology 5.1 (CC BY 4.0); StatPearls "Histology, Skin" NBK537325 — layer ordering.
- Turkish J Plast Surg 2018 — human dermis range context.
- Pharmaceutics 2017;9(3):33 / PMC5620574 (CC BY) — rodent viable epidermis ~20 µm; species differences.
- Multiparametric barrier study of C57BL/6J mice (Annex JVSAH) — mouse total skin ~540 µm.
- Standard dermatology histology — rodent panniculus carnosus (subcutaneous striated muscle).
- Chen et al. 2012 (Int J Nanomedicine) — Profile-B ex-vivo **rat** full-thickness abdominal skin permeation context.
