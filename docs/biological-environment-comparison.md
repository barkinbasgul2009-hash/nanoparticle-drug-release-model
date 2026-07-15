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
