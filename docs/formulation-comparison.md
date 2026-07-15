# Formulation Comparison

Status: schema/plan only. No formulation transport parameters populated.
See `data/formulation-profiles.json` for the record structure.

The minimum modeling unit couples: API + exact carrier + composition + dosage
form + route + tissue + species + dose + conditions + endpoint. Distinct products
of the same API (e.g. free vs PEGylated-liposomal doxorubicin) are **different**
profiles and are never merged. Population is gated on verified sources + approval.
