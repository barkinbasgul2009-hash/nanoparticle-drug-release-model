# Stage-2 Prompt Compliance Matrix

Requirement-by-requirement audit against the original Stage-2 spec, honestly graded.

| Requirement | Status | Evidence / location | Remaining action |
|---|---|---|---|
| Verify every uploaded file | **DONE** | source-ingestion-audit.md | — |
| Identify wrong/missing files | **DONE** | audit + critical-paywalled-sources.md (Potts&Guy wrong; Dreher/Chen/Potts&Guy missing) | user to provide 3 PDFs |
| Do not limit to uploads; expand search | **PARTIAL (blocked)** | search-log.md (backward citation from PDFs done; forward citation web-blocked) | source-enabled pass |
| Full-text quantitative extraction | **DONE for provided** | evidence-matrix.md, study-level-extraction.json | extract tumour/NP-skin once provided |
| Release-data extraction | **NOT POSSIBLE** | no release dataset in provided sources (skin permeation ≠ NP release) | needs NP-formulation primary |
| Free/encapsulated/total API | **DONE (assessment)** | free-vs-encapsulated-api.md (all provided = free small molecule) | NP source needed for encapsulated |
| Release-to-tissue coupling | **DONE (design)** | release-to-tissue-coupling.md | fix per selected NP profile |
| Mass-balance design | **DONE (design)** | mass-balance-candidate-design.md | implement in Stage 3 |
| Biological environment profiles | **PARTIAL (skin sourced; tumour/bladder pending)** | environment-profiles.json, biological-environment-comparison.md | primaries for tumour/bladder |
| Parameter classification + maps | **DONE** | parameter-classification.md, parameter-to-equation-map.md | refine on selection |
| Study-level extraction | **DONE for provided** | study-level-extraction.json | tumour/NP pending |
| Risk-of-bias APPLIED | **DONE for opened** | risk-of-bias.md | assess unopened when provided |
| Calibration + independent validation | **DONE (assessment): none adequate** | calibration-validation-inventory.md | independent NP validation needed |
| Identifiability / sensitivity / uncertainty | **DONE (plans)** | respective docs | execute in Stage 3 |
| Penetration endpoint definitions | **DONE** | penetration-endpoint-definitions.md | — |
| Educational-layer specs + content | **DONE (specs); skin content partially sourced** | interactive-knowledge-layer-spec.md, parameter-explanations.json | populate tumour content |
| Evidence grades re-evaluated | **DONE** | tissue-profiles.json, stage3-recommendation.md | — |
| Finalist decision re-done | **DONE** | stage3-recommendation.md (skin primary; tumour fallback blocked) | — |
| Final scientific decision (A/B/C) | **DONE: OUTCOME B** | stage3-recommendation.md | — |
| JSON valid / provenance | **DONE** | all data/*.json valid | — |
| Update PR #3, do not merge | **DONE** | this branch/PR | — |

**Honest overall:** Stage 2 is complete **to the extent the available evidence
allows**. Two hard blockers remain, both requiring user-provided PDFs or network
access: (1) tumour candidate sources (Dreher, Chen); (2) any nanoparticle-formulation
primary with release + penetration. Until then, no QUALIFIED profile is possible and
the skin sub-model is the maximum defensible (RESEARCH_SUPPORTED) selection.
