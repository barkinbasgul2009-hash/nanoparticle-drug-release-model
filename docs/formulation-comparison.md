# Formulation Comparison

Status: schema/plan only. No formulation transport parameters populated.
See `data/formulation-profiles.json` for the record structure.

The minimum modeling unit couples: API + exact carrier + composition + dosage
form + route + tissue + species + dose + conditions + endpoint. Distinct products
of the same API (e.g. free vs PEGylated-liposomal doxorubicin) are **different**
profiles and are never merged. Population is gated on verified sources + approval.

---

## Stage-2 update
Formulation-level quantitative characterization (size, PDI, zeta, loading, EE,
release method/time points, excipients) must be extracted per candidate from opened
primary sources. Under the access block none were opened, so
`data/formulation-profiles.json` remains schema-level with `pending full-text`
markers rather than guessed values. Priority formulations to characterize in a
source-enabled pass: the primary/fallback systems in `stage3-recommendation.md`
(a local tumour depot formulation; and a topical nanoparticle with Franz-cell
release/permeation data). The minimum modelling unit (API + carrier + composition +
dosage form + route + tissue + species + dose + conditions + endpoint) applies.
