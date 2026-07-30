# Profile-B — Cellular Microenvironment Documentation (Phase 4B)

The first microscopic biological environment: free drug molecules, extracellular space, schematic
cells, and passive membrane crossing. Deliberately minimal.

## Compartments
The microenvironment is the target (dermis) tissue, parameterised as an isotropic **(x, u)** unit
patch (u = relative position within the dermis band). It has two compartments:
- **Extracellular** — fluid outside every cell; molecules diffuse here after release.
- **Cytoplasm** — the interior of a cell, inside its membrane.

No interstitial flow, no blood, no lymphatics — **pure diffusion**.

## Free drug molecules
When an arrived carrier releases payload, the released fraction becomes discrete **free drug
molecules**. Each is an independent object:

| Field | Meaning |
|---|---|
| `id` | unique id |
| `x`, `u` | position (u is the "y"/depth in the patch) |
| `vx`, `vu` | velocity (last Brownian step) |
| `diffusion` | schematic diffusion coefficient (sim units) |
| `species` | the selected species |
| `releaseTimeH` | release timestamp |
| `alive` | alive flag |
| `evidenceTag` | the uptake evidence descriptor |
| `compartment` | `extracellular` or `cytoplasm` |

Molecules are **much smaller** than carriers, emerge **continuously** in small packets (not
explosively), become **independent** immediately, and never merge back. They undergo **only**
diffusion — no chemistry, reactions, degradation, or metabolism.

## Cells
Schematic, minimal, and clean — **membrane + cytoplasm only**:

| Field | Meaning |
|---|---|
| `id` | cell id |
| `x`, `u` | centre in the patch |
| `radius` | normalized radius |

There is **no** nucleus, mitochondria, ER, Golgi, lysosome, endosome, receptor, protein, or any
other intracellular structure. Cells occupy only part of the tissue; the rest is extracellular
fluid. Cells are rendered **semi-transparent** with a clearly visible **membrane**.

## Cell membrane
A thin visible boundary at the cell radius. It is the **first cellular barrier**. It has **no**
transporter proteins, receptors, channels, or pumps — it is simply a boundary a molecule may
passively cross.

## Passive uptake (the only entry route)
```
free molecule diffuses  →  contacts membrane  →  per-contact probability check
     → success: crosses to just inside the membrane → now in cytoplasm
     → failure: stays just outside the membrane
```
- A molecule can enter the cytoplasm **only after contacting** a membrane.
- Crossing is a small radial step across the thin membrane — **never a teleport**.
- **Forbidden:** receptor-mediated uptake, active transport, vesicles, endocytosis,
  phagocytosis, caveolae, clathrin, macropinocytosis.

## Diffusion inside the cytoplasm
Once inside, a molecule continues **simple Brownian diffusion**, confined within its cell. Nothing
more — no binding, reactions, degradation, target engagement, lysosome, nucleus, ER, Golgi, or
mitochondria. The molecule simply exists and diffuses in the cytoplasm.

## Visual language
Muted scientific colours; **no glow, trails, explosions, or gaming effects**. Cells are
semi-transparent with visible membranes; free molecules are tiny individually-visible dots
(slightly dimmer inside the cytoplasm); carriers remain visible as (now empty) shells.

## Separation of layers
Transport, Release, Diffusion and Passive Uptake are separate concerns. The uptake layer **reads**
(never writes) transport + release state and **never moves carriers**. Molecule state lives in the
uptake engine, not on the transport particle. Future phases extend each layer independently.

## Stops here
The phase ends with molecules diffusing in the cytoplasm. Nothing downstream (receptor binding,
trafficking, lysosomes, nucleus, PK, PD, target interaction) is implemented.
