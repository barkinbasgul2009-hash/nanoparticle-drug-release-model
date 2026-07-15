# Data Provenance

Status: current.

## Principle
Every numerical value shown in the website must be traceable to a record in the
`data/` registries — no anonymous hard-coded biological constants in UI or
animation code.

## Current state
- `data/source-registry.json` — 3 **verified** methodology/regulatory anchors
  (FDA PBPK guidance 2018; Open Systems Pharmacology suite; Wilhelm et al. 2016).
  **Zero tissue parameters.**
- `data/api-candidates.json` — candidate identification only (approval facts
  flagged unverified, pending Drugs@FDA / EMA).
- `data/{tissue,route,formulation}-profiles.json`, `parameter-registry.json`,
  `validation-datasets.json` — **schema only / empty** (except the illustrative
  generic-tissue defaults, explicitly marked non-qualified).

## Rule for adding any value
Verify against the actual source (title, authors, year, DOI/PMID, locator,
species, tissue, route, formulation, units, status measured/fitted/assumed) per
docs/evidence-matrix.md, then record it in the appropriate registry with a
`source_id`. No value is added by guessing or by cross-context transfer.
