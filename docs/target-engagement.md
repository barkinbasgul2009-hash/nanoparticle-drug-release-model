# Profile-B — Target Engagement Documentation (Phase 5A)

The first pharmacology layer: molecular recognition (binding) only. What it models, and what it
deliberately excludes.

## Molecular targets
Generic, schematic **individual proteins** — not cells or organelles, no disease-specific
assumptions. Supported types: enzyme, receptor, cytoplasmic protein, transport protein,
DNA-associated protein, nuclear protein. Each target has:

| Field | Meaning |
|---|---|
| id / type | identity |
| position (x, u) | location in the cell patch |
| compartment | `cytoplasm` or `nucleus` |
| availableSites / occupiedSites | site capacity + current occupancy |
| bindingState / boundDrugIds | which drug molecules are bound |
| species / evidenceLevel / kineticModel | context |

Targets are distributed in the **cytoplasm** or the **nucleus** per formulation — never ER, Golgi,
mitochondria or ribosomes.

## Drug–target encounter
Binding begins **only** after a drug molecule (Phase 4D intracellular free drug) physically reaches
a target's vicinity (a schematic reaction radius). There is **no long-distance attraction** and
**no teleportation** — pure diffusion-driven encounter (the drug's motion is owned by Phase 4D;
this layer only checks proximity).

## Binding models
| Model | Behaviour |
|---|---|
| Reversible (Drug ⇄ Target) | binds with `kon`; may dissociate with `koff` |
| Irreversible (Drug → Target) | binds with `kon`; **never** dissociates |

- **Occupancy** per target = occupied / available sites; **saturation** across all targets is shown
  in 0 / 25 / 50 / 75 / 100 % buckets.
- **Residence time = 1 / koff**; **Kd = koff / kon** (shown only when both rates exist).

## Affinity
Kd / Ki / IC50 are shown **only** when evidence exists; otherwise a **prediction label** or **Not
Reported**. Numeric affinity is **never fabricated**.

## Competition
- **Many drugs → one target:** the first molecule to bind occupies a site; once sites are full, the
  remaining molecules keep diffusing (they are never forced to bind and Phase 4D is unchanged).
- **One drug → many targets:** a free molecule may encounter any nearby target with a free site.

## Nuclear targets
Nuclear targets sit at the nuclear membrane. A drug can bind a nuclear target **only if** Phase-4D
nucleus targeting has occurred (the drug has reached the nuclear membrane). Without targeting, the
drug never reaches the nucleus, so nuclear targets stay unbound. The drug still **never enters** the
nucleus (Phase 4D rule).

## Visualization
Schematic protein glyphs (small squares), an occupancy halo (ring fraction ∝ occupancy), a
bound-drug dot on occupied targets, and an "Target occupancy: N%" caption. A bound drug is drawn at
its target (and suppressed from the free-drug layer at draw time — the Phase-4D molecule is not
modified). Muted scientific colours, no gaming effects.

## Separation of layers
The target-engagement engine **reads** the intracellular/uptake outputs read-only and **modifies
nothing upstream**. Binding state lives only in this engine. Seven layers stay independent:
Transport / Release / Diffusion / Passive Uptake / Endocytosis / Intracellular Release / Target
Engagement.

## The B1 outcome (honest)
For the B1 celastrol NLC, the molecular target and binding constants are **NOT REPORTED**, so no
targets are placed and the layer is **idle** (evidence panel: *Target Engagement — Not Reported*).
The full engine is exercised in tests via evidence-labelled predictions (test-only patched
registries), never committed as real evidence.

## Stops here
Ends at target binding / occupancy / optional dissociation. No signalling, kinase cascades, gene
regulation, transcription, translation, apoptosis, immune or tumour response, PD downstream, or
toxicity — those are Phase 5B and later.
