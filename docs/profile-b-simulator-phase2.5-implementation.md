# Profile-B Simulator — Phase 2.5 Implementation Report

**Phase 2.5: Anatomical Scale Validation (anatomy registry only).** This phase upgraded the
five-layer skin cross-section's draw weights from **purely ordinal** (Phase 2) to
**evidence-anchored schematic** (Phase 2.5), using located anatomical literature. It is
confined to `simulator/data/anatomy.registry.json`, its model accessors, the anatomy tests,
and documentation. **No biology, particles, motion, diffusion, cells, vessels, collagen,
microscopy, shaders, or new rendering features were added.** Production `web`/`R`/`app`/`tests`
and CI workflows are **untouched**; PR #3 is **not merged**.

Full auditable evidence record: [`docs/profile-b-anatomy-scale-validation.md`](./profile-b-anatomy-scale-validation.md).

---

## 1. Objective (as scoped)
Determine whether scientifically justified **relative thickness** information exists for the
already-implemented layers (stratum corneum, viable epidermis, dermis, subcutis) and, only if
justified, replace the ordinal schematic ordering with an **evidence-based schematic** ordering.
The weights remain **drawing weights, not physical measurements**, and the UI keeps
"schematic" / "not to scale" unless the literature genuinely supports exact scaling (it does
not — see §5).

## 2. Literature reviewed (by species — never mixed)

### Human skin (best supported)
| Layer | Reported thickness | Source | Confidence |
|---|---|---|---|
| Stratum corneum | **18.3 µm** dorsal forearm (11.0 shoulder, 14.9 buttock; ~20 general) | Sandby-Møller et al. 2003, *Acta Derm Venereol* (PubMed 14690333) | HIGH |
| Viable epidermis | **56.6 µm** forearm (70.3 shoulder, 81.5 buttock; ~50–100 general) | Sandby-Møller 2003; systematic review (ResearchGate 359694655) | HIGH |
| Dermis | **1–3 mm** (site/age dependent) | consensus (OpenStax A&P; Turkish J Plast Surg 2018) | MEDIUM (wide range) |
| Subcutis | highly variable (site/BMI); **no fixed thickness** | consensus | NOT_DETERMINED |

### Rat skin (Profile-B ex-vivo permeation model)
| Layer | Reported | Source | Confidence |
|---|---|---|---|
| Viable epidermis | ~20 µm (rodent) | PMC5620574 (CC BY) species review | MEDIUM |
| Stratum corneum / dermis / subcutis | thinner-than-human (SC, qualitative); no clean per-layer µm located | PMC5620574 | INCOMPLETE |

### Mouse skin (C57BL/6 in-vivo model)
| Layer | Reported | Source | Confidence |
|---|---|---|---|
| Total skin | ~540 µm (C57BL/6, 4–6 wk) | Annex JVSAH barrier study | MEDIUM |
| Viable epidermis | ~20 µm (rodent, approx) | PMC5620574 (CC BY) | LOW |
| Per-layer SC / dermis split | **not cleanly resolved** in accessible sources | — | INCOMPLETE |

> Web full-text fetch is blocked in this environment and the rat-specific per-layer search hit
> a session limit. Figures above are recorded honestly at the source level; every gap is marked
> `INCOMPLETE` rather than filled by invention.

## 3. Final anatomical model selected
The scaffold is **CONTEXTUAL / generic** — it has never been tied to a single specimen. The
frozen biological-visualization blueprint keeps the four Profile-B (B1) experimental contexts
**separate and labelled**: ex-vivo rat skin permeation, in-vitro HaCaT keratinocytes, in-vitro
B16BL6 murine melanoma, and in-vivo C57BL/6 mouse. Because **human per-layer thicknesses are
the best supported**, the default scaffold uses the **human profile**; **rat** and **mouse**
profiles are provided but flagged **INCOMPLETE**. **Multiple profiles are kept; no universal
average is invented** (`model_scope.multi_model = true`, `default_profile = "human_contextual"`).

## 4. Registry changes (`simulator/data/anatomy.registry.json`, schema 1.0 → 1.1)
- **Default layer `draw_weight` = `log10(representative_um)`** for the evidence-anchored layers:
  - Stratum corneum → `log10(18.3)` = **1.26**
  - Viable epidermis → `log10(56.6)` = **1.75**
  - Dermis → `log10(2000)` = **3.30** (2000 µm = documented **display anchor** = midpoint of
    the cited 1–3 mm range; the full range is recorded; it is **not** a measurement)
  - Subcutis → **2.0**, explicitly **ILLUSTRATIVE / orientation-only** (thickness genuinely
    indeterminate; **not** evidence-derived)
  - Skin surface → **0.3**, interface strip (not a measured layer)
- **Added** `thickness_evidence` per layer per species (representative_um, range_um, site,
  source, confidence); `weight_profiles` (`human_contextual` / `rat` / `mouse`); `model_scope`;
  `weight_basis`; and expanded `provenance_sources`.
- **Retained** `not_to_scale: true` and a documented `why_still_not_to_scale`.
- **Unchanged:** scale levels (L1–L6), clip plane, labels, zoom mapping, scenes, palette.

New model accessors (`simulator/src/anatomy/anatomyModel.js`, additive):
`profiles()`, `defaultProfile()`, `weightsForSpecies(profileId)`, `hasThicknessEvidence(layerId, species)`.
All read from the registry — **no biological value is hardcoded in code**.

## 5. Scientific justification
- **Why evidence-anchored is now justified:** unlike the Profile-B *drug-permeation* evidence
  (where measured layer thicknesses are `NOT_REPORTED`), general **anatomical** thickness
  literature for human skin is well established (Sandby-Møller 2003 gives site-resolved SC and
  epidermis in µm). This supports **relative** proportions without inventing anything.
- **Why still "not to scale":** the dynamic range is ~100× (dermis ~2000 µm vs SC ~18 µm). A
  true-to-scale cross-section would render the SC sub-pixel. Weights are therefore
  **log-compressed schematic** values, and the UI keeps the "schematic - not to scale" caption.
  Exact scaling is **not** claimed.
- **Accepted (anchors):** human SC 18.3 µm and viable epidermis 56.6 µm (both Sandby-Møller
  dorsal forearm — a single cited site, **not** an average); dermis 1–3 mm range with a flagged
  midpoint display anchor; rodent viable epidermis ~20 µm (rat/mouse profiles).
- **Rejected / not used as anchors:** any single "dermis = X µm" point value (range too wide →
  used as a range); rat/mouse per-layer SC & dermis µm (**not located** → kept ordinal, flagged
  INCOMPLETE, **not invented**); subcutis thickness (variable → orientation-only, not anchored).
- **Not averaged:** the human SC/epidermis site values (11.0/14.9/18.3; 56.6/70.3/81.5) were
  **not** averaged; a single representative site (dorsal forearm) was chosen and documented.

## 6. Remaining uncertainty
- Human dermis varies 1–3 mm by site/age — recorded as a range; the display anchor is flagged.
- Human epidermis is site-dependent (palms/soles up to ~1 mm) — the general non-glabrous value
  is used and flagged.
- Rat and mouse per-layer thicknesses are **not resolved** at the µm level in accessible
  sources → those profiles stay ordinal / `INCOMPLETE` (ordering preserved, magnitudes not
  claimed).
- Subcutis thickness is genuinely indeterminate for a generic cross-section → its weight is
  orientation-only and never presented as evidence-derived.

## 7. Tests executed
Updated `simulator/tests/anatomy.test.mjs` (Phase-2 checks retained; Phase-2.5 checks added):
- draw weights read from the registry (no hardcoded biological values);
- SC < epidermis < dermis ordering preserved (1.26 < 1.75 < 3.30);
- evidence-anchored layers satisfy `draw_weight ≈ log10(representative_um)`; each carries a
  provenance source + confidence;
- `hasThicknessEvidence` gate: human SC/epidermis/dermis anchored, subcutis and mouse-SC
  **not** falsely claimed;
- per-species profiles present (`human_contextual`/`rat`/`mouse`), default = human, rat profile
  keeps correct ordering, unknown profile falls back safely;
- `not_to_scale` still true; scale levels / clip plane / labels / zoom / scenes **unchanged**.

**Results**
- Simulator suite: **139 passed, 0 failed** (`node simulator/tests/run.mjs`; was 109 in Phase 2).
- TypeScript contract: **compiles clean** (`npx tsc --noEmit -p simulator/tsconfig.json`).
- Registry: **valid JSON**, schema 1.1, 6 layers, 3 profiles.
- Hidden-character guard: **clean** (`python3 tools/check_hidden_chars.py`).

## 8. CI status
- Production `web`/`R`/`app`/`tests`/`.github` diff vs `origin/main`: **empty** (nothing changed).
- Production JS model tests: **99 passed, 0 failed** (`node tests/js/model.test.mjs`).
- Production R regression: **11 passed, 0 failed** (`Rscript tests/regression/baseline_test.R`).
- CI jobs (`js-tests`, `r-tests`, `hidden-char-check`) exercise exactly these unchanged
  production suites, so they remain green. PR #3 **not merged**.

---

**Stop.** Phase 2.5 complete: evidence-anchored schematic scaling of the existing static
anatomy, fully auditable, with no biology and no rendering changes. Phase 3 (cells / particles /
diffusion / motion / animation / microscopy) is **not** started.
