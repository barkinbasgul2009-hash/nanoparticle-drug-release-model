# Biological Environment Comparison (structure; values pending sources)

For each candidate route/tissue, the environment must be characterized from sourced
values. Under the Stage-2 access block, quantitative cells are intentionally left
`null / pending full-text` (see `full-text-access-log.md`) rather than guessed.

| Factor | Tumour (local) | Skin (topical) | Bladder (intravesical) |
|---|---|---|---|
| Dominant barrier | interstitial matrix / IFP | stratum corneum | urothelium (GAG layer) |
| pH | pending | ~skin surface acidic (pending) | urine pH variable (pending) |
| Clearance mechanism | perfusion / lymphatic | dermal blood flow | urine washout / turnover |
| Key structure | ECM (collagen, HA) | SC lipids, corneocytes, follicles | GAG layer, urothelium |
| Fluid dynamics | interstitial flow | none (ex vivo) | bladder filling/voiding |
| Model-critical params | D_interstitium, k_e | D_SC, K, layer L | urothelium P, wall D |

Populate `data/environment-profiles.json` and per-parameter
`data/environment-information-cards.json` only from opened sources. Central value +
range + variability + species + disease state + confidence are required per entry.

---

## Stage-2 CONTINUATION — sourced environment values
- **Skin:** SC transport now sourced (small molecule) — K_SC/v ≈ 2.7 (caffeine) to
  39.5 (7-EC); D_SC/H²_SC ≈ 0.03–0.23 h⁻¹ (Rothe 2017); experimental geometry
  split-thickness 200–400 µm at 32±1 °C (OECD TG 428). Dermal clearance not sourced.
- **Bladder:** qualitative only (Sarfraz 2022 review) — urothelium = main barrier,
  GAG/mucin layer, three-layer wall; urine pH/calcium/urea modulate permeability.
  No primary depth–concentration values.
- **Tumour:** no sourced values (Dreher/Chen unavailable).
Full numeric provenance in `data/study-level-extraction.json` and `evidence-matrix.md`.
