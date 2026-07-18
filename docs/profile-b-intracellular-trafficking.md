# Profile-B — Intracellular Trafficking Documentation (Phase 4C)

The intracellular entry phase: how a carrier nanoparticle is internalized and trafficked, and what
is deliberately excluded.

## Particle classes
- **Carrier nanoparticle** (transport `Particle`): may undergo **endocytosis**.
- **Free drug molecule** (`DrugMolecule`, Phase 4B): stays free and does **passive** cytoplasmic
  uptake; it is **never** endocytosed.

These are distinct objects and never merge.

## Uptake decision
When a carrier contacts a cell membrane, the engine decides from **registry** data:
1. `endocytosis_probability` — does this carrier internalise?
2. `pathway_weights` — which pathway (clathrin / caveolae / macropinocytosis)?

Nothing is hard-coded. Free drug molecules bypass this entirely (they do passive uptake).

## Endocytic pathways (only three)
| Pathway | Schematic visual |
|---|---|
| Clathrin-mediated | hexagonal lattice pit deepens → vesicle pinches off |
| Caveolae-mediated | small flask-shaped membrane invagination |
| Macropinocytosis | large membrane ruffle → cup → closure → large vesicle |

**Not implemented:** phagocytosis, receptor-specific internalization, Fc receptors, antibody
uptake, active-transporter uptake, lipid-raft signalling, exocytosis.

## Fate state machine (strict)
Every carrier always has exactly one state:
```
EXTRACELLULAR → MEMBRANE_CONTACT → WRAPPING → INTERNALIZED
  → EARLY_ENDOSOME → LATE_ENDOSOME → LYSOSOME
  → (ESCAPED → CYTOPLASM)          [only if the formulation evidence supports escape]
```
- **Terminal:** LYSOSOME (no escape) or CYTOPLASM (after a supported escape).
- **Illegal transitions are rejected** (e.g. Extracellular→Lysosome, Wrapping→Cytoplasm,
  Lysosome→Extracellular). The FSM throws on any illegal transition.
- Maturation is **gradual** (registry dwell times); no stage is skipped.

## Endocytosis animation
Smooth and physical — contact → membrane curvature (wrapping progress 0→1) → vesicle → internalized
— never a teleport or instant disappearance. The carrier colour is unchanged; the state is shown by
the wrapping arc, the vesicle ring, and a compartment label.

## Intracellular compartments (only three)
| Compartment | Visual |
|---|---|
| Early Endosome | coloured vesicle ring + "Early endosome" label |
| Late Endosome | distinct coloured ring + "Late endosome" label |
| Lysosome | distinct ring + "Lysosome" label — schematic small acidic vesicle; **no** enzymes, machinery or degradation chemistry |

**Not present:** Golgi, ER, mitochondria, nucleus, ribosomes, cytoskeleton.

## Endosomal escape (evidence-gated)
Escape is animated **only** when the formulation's registry escape profile supports it
(`state` ≠ `no_escape` and `escape_probability` > 0). Possible profiles: no escape / partial /
efficient. When escape occurs, the membrane gradually ruptures and the drug exits to the cytoplasm
while the endosome remains — no explosion, no disappearance.

For the **B1 celastrol NLC**, endosomal escape is **NOT REPORTED** → escape is **Unavailable**, so
carriers terminate in the **lysosome**.

## Species behaviour
Endocytosis and trafficking are **Predictive for all species** (the pathway is unresolved and
trafficking is not measured for this formulation). Rat has no cellular-uptake observation;
human/mouse have observed uptake (HaCaT/B16BL6) but the pathway is unresolved. Parameters are
formulation-level (identical across species); only the evidence level is exposed per species — no
rat parameters are copied into human, and no validation is claimed that does not exist.

## Separation of layers
The endocytosis engine **reads** the uptake/transport outputs (carriers + cells) read-only and
**modifies nothing upstream**. Per-carrier fate lives only in the endocytosis engine. Transport,
Release, Diffusion, Passive Uptake and Endocytosis remain independent.

## Stops here
The phase ends at the lysosome (or cytoplasm after a supported escape). Nothing beyond
intracellular trafficking — no receptor signalling, nucleus, DNA/RNA, transcription/translation,
PD, PK, target interaction, apoptosis, immune response or tumour killing.
