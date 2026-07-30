# Profile B — Biological Animation Confidence Guide

Design only. Controlled vocabulary used across all Profile-B biological registries. Every
scene and biological event carries exactly one label, and the label is exposed to the user
through the information interface.

## Controlled vocabulary
| Label | Meaning | Animation permission |
|---|---|---|
| `DIRECTLY_OBSERVED` | measured in the preset's source | animate (as measured; ordinal/qualitative if no value) |
| `QUANTITATIVELY_SUPPORTED` | a value/range exists | animate with the value + legend |
| `QUALITATIVELY_SUPPORTED` | event reported, no exact magnitude/timing | animate qualitatively + info note |
| `ABSTRACT_SUPPORTED` | abstract/mechanism level only | qualitative, no numeric labels/timing (B2) |
| `CONTEXTUAL_ANATOMY` | general anatomy scaffold, not the specimen | show as clearly-labelled context |
| `MECHANISTIC_TRANSFER` | general mechanism applied by analogy | info note, greyed |
| `INFERRED_RISK` | risk implied, not measured | ghosted cue + warning badge, never a timed event |
| `ILLUSTRATIVE_ONLY` | visual aid (e.g. Brownian jitter, RBC color) | show, labelled illustrative |
| `NOT_REPORTED` | absent from the source | do not animate; display "NOT REPORTED" |
| `UNSUPPORTED_DO_NOT_ANIMATE` | explicitly unsupported/contradicted | never animate; text note only |
| `NOT_APPLICABLE` | the preset's route/system lacks this | omit |

## Application examples (B1)
- Depth-layer deposition (0–30/30–60/60–90 µm) → `DIRECTLY_OBSERVED`.
- Charge-ordinal uptake → `QUALITATIVELY_SUPPORTED` (+ confound note).
- Sustained/delayed release → `QUALITATIVELY_SUPPORTED` (`OBSERVED_TIMING_UNKNOWN` note).
- Human skin cross-section scaffold → `CONTEXTUAL_ANATOMY`.
- Released-celastrol precipitation → `INFERRED_RISK` (poor solubility) → ghosted risk cue only.
- Systemic circulation, organelle trafficking (B1) → `UNSUPPORTED_DO_NOT_ANIMATE`.
- PDI / zeta / drug-loading / PK → `NOT_REPORTED`.

## Rule
The confidence label is the gate: it decides whether an element is animated, shown as
context, shown as a warning, or omitted. It is always visible to the user (badge + hover).
