# Profile-B — Intracellular Drug Release Documentation (Phase 4D)

What happens after the carrier is inside the cytoplasm, and what is deliberately excluded.

## Trigger
Intracellular release begins **only** for a carrier whose endocytosis state is `CYTOPLASM`
(reached via endosomal escape, Phase 4C). It is **completely independent** of the extracellular
release (Phase 4A) — its own model, its own molecules.

## Release models (evidence-gated)
Supported: **burst**, **first-order**, **zero-order**, **Higuchi**, **Korsmeyer–Peppas**. A
formulation uses a model **only if evidence exists** (model id + rate constants in the registry).
If none, the model is `null` and **nothing releases** — NOT REPORTED stays NOT REPORTED. Rate
constants are never invented.

| Model | Cumulative released F(t) |
|---|---|
| burst | 1 for t>0 |
| first-order | 1 − e^(−k·t) |
| zero-order | min(1, k·t) |
| Higuchi | min(1, k·√t) |
| Korsmeyer–Peppas | min(1, k·tⁿ) |

## Intracellular free drug
Released drug becomes **independent** molecules (`intracellularDrug.js`): id, parent carrier,
species, position, velocity, diffusion coefficient, release timestamp, compartment, alive flag,
evidence level, target compartment. Count = released fraction quantised per carrier. A molecule
never merges back into the carrier.

## Cytoplasmic diffusion
Once released, drug diffuses by **bounded Brownian motion** (no teleport, no jumps, no active
transport) **only inside its own cell's cytoplasm** — the annulus between the nuclear membrane and
the cell membrane. It **never exits the cell** and **never enters a neighbouring cell**.

## Degradation (evidence-gated)
Modes: **stable** / **partial** / **complete**, applied **only** when formulation evidence
supports it (rate from evidence). `partial` keeps a residual fraction alive; `complete` degrades
toward full loss. Half-life is **never fabricated**. Conservation holds: `alive + degraded =
total`.

## Nucleus (schematic only)
A schematic nucleus sits concentrically inside each cell: **membrane + interior + label**. There
is **no** DNA, chromosomes, nucleolus, histones, RNA or transcription machinery.

## Nucleus targeting (evidence-gated)
| Mode | Behaviour |
|---|---|
| none | no targeting; drug stays in the cytoplasm |
| passive | weak drift toward the nucleus (only if evidence supports) |
| evidence_supported | directed drift toward the nucleus (only with evidence) |

Targeted molecules **stop at the nuclear membrane** and **never enter the nucleus**. Nuclear-pore
transport (importin/exportin/Ran-GTP/NPC) is a **later phase** and is not implemented. With no
evidence, molecules remain in the cytoplasm.

## The B1 outcome (honest)
For the B1 celastrol NLC, intracellular release, degradation and nucleus targeting are all **NOT
REPORTED**, and endosomal escape is **Unavailable** (Phase 4C) → no carrier reaches the cytoplasm.
So the intracellular stage is **idle**: no intracellular drug is produced, and the evidence panel
reports **Intracellular Release: Not Reported**. The full engine is exercised in tests via an
evidence-supported hypothetical (test-only patched registry), never committed as real evidence.

## Visualization
Schematic nucleus (semi-transparent interior + visible membrane + label), tiny intracellular drug
dots (degraded ones fade), carrier release conveyed by the emerging drug cloud. Muted scientific
colours, no gaming effects.

## Separation of layers
The intracellular engine **reads** the endocytosis/uptake outputs read-only and **modifies nothing
upstream**; intracellular molecules live only in this engine. Six layers now stay independent:
Transport / Release / Diffusion / Passive Uptake / Endocytosis / Intracellular Release.

## Stops here
Ends at cytoplasmic diffusion, or (if targeting supported) at the nuclear membrane. No DNA/RNA
interaction, transcription, translation, PD, PK, apoptosis, tumour killing, immune response, or any
downstream biology.
