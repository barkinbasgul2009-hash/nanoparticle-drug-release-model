# Profile-B Simulator — Anatomical Scale Validation (Phase 2.5)

Auditable record of the literature review that upgraded the anatomy registry's layer draw
weights from **purely ordinal** (Phase 2) to **evidence-anchored schematic** (Phase 2.5).
Scope: `simulator/data/anatomy.registry.json` only. No biology/rendering/production changes;
PR #3 not merged.

> **Superseded architecture note (Phase 2.6):** the `weight_profiles` / `model_scope` structures
> described here were later folded into **independent per-species `species_profiles`** with a
> `species_scope`, making the engine species-driven with no human fallback. The Phase-2.5
> *values* below are unchanged (they became the human profile); the *structure* evolved. See
> `docs/profile-b-multi-species-anatomy.md` and `docs/profile-b-simulator-phase2.6-implementation.md`.

## Ground rules honored
- Never invent a measurement · never average conflicting sources · never pick a value because
  it is most common · record disagreement · every value has provenance · weights remain
  **schematic drawing weights, not measurements**, and the UI keeps "schematic - not to scale."

## Step 1 — Literature reviewed (by species; not mixed)

### Human skin (best supported)
| Layer | Reported thickness | Source | Confidence |
|---|---|---|---|
| Stratum corneum | 11.0 µm (shoulder), 14.9 µm (buttock), **18.3 µm (dorsal forearm)**; ~20 µm general | Sandby-Møller et al. 2003 (PubMed 14690333); consensus | HIGH |
| Viable epidermis | **56.6 µm (forearm)**, 70.3 (shoulder), 81.5 (buttock); ~50–100 µm general; palms/soles up to ~1 mm | Sandby-Møller 2003; systematic review (ResearchGate 359694655) | HIGH |
| Dermis | **1–3 mm (1000–3000 µm)**; site/age dependent | consensus (OpenStax; Turkish J Plast Surg 2018) | MEDIUM (wide range) |
| Subcutis | highly variable (site/BMI); **no fixed thickness** | consensus | NOT_DETERMINED |

### Rat skin (Profile-B permeation model)
| Layer | Reported | Source | Confidence |
|---|---|---|---|
| Viable epidermis | ~20 µm (rodent) | PMC5620574 (CC BY) species review | MEDIUM |
| Stratum corneum | thinner than human (qualitative) | PMC5620574 | INCOMPLETE (no per-layer µm) |
| Dermis | substantial (bulk); no clean per-layer µm located | PMC5620574 | INCOMPLETE |
| Subcutis | variable; includes panniculus | — | INCOMPLETE |

### Mouse skin (C57BL/6, in-vivo model)
| Layer | Reported | Source | Confidence |
|---|---|---|---|
| Total skin | ~540 µm (C57BL/6, 4–6 wk) | Annex JVSAH multiparametric barrier study | MEDIUM |
| Per-layer (SC/epidermis/dermis) | **not cleanly resolved** in accessible sources | — | INCOMPLETE |
| Viable epidermis | ~20 µm (rodent, approximate) | PMC5620574 (CC BY) | LOW |

*(Web full-text fetch is blocked in this environment; the rat-specific per-layer search also
hit a session limit. Values above are source-level figures recorded honestly, with the gaps
marked INCOMPLETE rather than filled by invention.)*

## Step 2 — Model selected
The anatomy scaffold is **CONTEXTUAL / generic** — it has never been tied to a single
specimen (the frozen biological-visualization blueprint keeps the four B1 contexts — ex vivo
rat skin, in-vitro HaCaT, in-vitro B16BL6, in-vivo mouse — **separate and labelled**). Because
**human per-layer thicknesses are the best supported**, the default scaffold uses the **human
profile**; **rat** and **mouse** profiles are provided but flagged **INCOMPLETE**. **Multiple
profiles are kept; no universal average is invented** (`model_scope.multi_model = true`).

## Step 3 — Registry update (what changed)
- Layer `draw_weight` (default = human profile) is now **`log10(representative_um)`** for the
  evidence-anchored layers:
  - Stratum corneum → log10(18.3) = **1.26**
  - Viable epidermis → log10(56.6) = **1.75**
  - Dermis → log10(2000) = **3.30** (2000 = documented **display anchor** = midpoint of the
    cited 1–3 mm range; the full range is recorded; it is **not** a measurement)
  - Subcutis → **2.0**, explicitly **ILLUSTRATIVE / orientation-only** (thickness genuinely
    indeterminate; **not** evidence-derived)
  - Skin surface → **0.3**, interface strip (not a measured layer)
- Added `thickness_evidence` per layer per species, `weight_profiles` (human/rat/mouse),
  `model_scope`, and `weight_basis`. `not_to_scale: true` is retained.
- **Unchanged:** scale levels, clip plane, labels, zoom, scenes, palette.

### Why still "not to scale"
The dynamic range is ~100× (dermis ~2000 µm vs SC ~18 µm). A true-to-scale cross-section would
render the SC sub-pixel. Weights are therefore **log-compressed schematic** values; the UI
keeps the "schematic - not to scale" caption. Exact scaling is **not** claimed.

## Step 4 — Accepted vs rejected values
- **Accepted (evidence-anchored):** human SC 18.3 µm, human viable epidermis 56.6 µm (both
  Sandby-Møller dorsal forearm — a single cited site, not an average); dermis 1–3 mm range with
  a flagged midpoint display anchor; rodent viable epidermis ~20 µm (rat/mouse profiles).
- **Rejected / not used as anchors:** any single "dermis = X µm" point value (range too wide →
  used as a range, not a value); mouse/rat per-layer SC & dermis µm (**not located** → kept
  ordinal, flagged INCOMPLETE, **not invented**); subcutis thickness (variable → not anchored).
- **Not averaged:** the human SC/epidermis site values (11.0/14.9/18.3; 56.6/70.3/81.5) were
  **not** averaged; a single representative site (dorsal forearm) was chosen and documented.

## Unresolved disagreement / uncertainty
- Human dermis thickness varies 1–3 mm by site/age — recorded as a range; the display anchor is
  flagged.
- Rat and mouse per-layer thicknesses are **not resolved** at the µm level in accessible
  sources → those profiles stay ordinal/INCOMPLETE.
- Human epidermis is site-dependent (palms/soles up to ~1 mm) — the general (non-glabrous)
  value is used and flagged.

## Step 5 — Validation
See the updated `simulator/tests/anatomy.test.mjs`: evidence blocks present, default weights
evidence-anchored (SC < epidermis < dermis preserved), `not_to_scale` retained, per-species
profiles load, and scale levels / clip plane / labels / zoom / scenes are unchanged. Full
suite: **`node simulator/tests/run.mjs`**. No biological values are hardcoded in code (all in
the registry).
