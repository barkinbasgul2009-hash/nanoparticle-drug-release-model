# Profile-B Simulator — Phase 4B Implementation Report

**Phase 4B: Cellular Microenvironment & Passive Cellular Uptake.** Extends Phase 4A: the released
payload stops being a shrinking percentage inside the carrier and becomes a population of **free
drug molecules** that diffuse through the extracellular space and **passively** enter schematic
cells. All inside `simulator/`; production `web`/`R`/`app`/`tests` and CI **untouched**; PR #3
**not merged**. Transport (Phase 3/3.1) and release (Phase 4A) are **unchanged** — Phase 4B only
adds a new layer.

The full chain the simulator now shows and then **stops**:
```
Topical formulation → Nanoparticle transport → Drug release → Free drug diffusion
    → Cell membrane → Passive cellular uptake → molecules diffuse in cytoplasm   ⟂ STOP
```

**Forbidden and absent:** nucleus, DNA/RNA, lysosome, endosome, endocytosis, clathrin, caveolae,
macropinocytosis, phagocytosis, receptors, transporters, channels, pumps, target proteins,
enzymes, metabolism, PK, PD, immune response, tumour killing, apoptosis, exocytosis, organelles,
intracellular trafficking (registry `integrity.forbidden` lists 31 items). Only passive entry +
simple cytoplasmic diffusion.

Companion docs: cellular microenvironment (`docs/profile-b-cellular-microenvironment.md`),
passive-uptake evidence (`docs/profile-b-passive-uptake-evidence-report.md`), architecture update
(`docs/profile-b-transport-architecture.md`, Phase 4B section), validation
(`docs/profile-b-phase4b-validation-report.md`).

## Scientific basis & evidence level (the key call)
The frozen package (Chen 2012) reports **cellular uptake in HaCaT (human) and B16BL6 (mouse)**
cells (order cationic > neutral > anionic) — but that is **carrier** uptake with the mechanism
**unresolved**, and rat had **no** cell-uptake study (rat = skin permeation only). Phase 4B
animates **passive free-drug membrane crossing**, which is a **general biophysical principle**
(celastrol is a small lipophilic BCS-IV molecule; Shukla 2020) and is **not** the measured
carrier uptake. Therefore cell uptake is **PREDICTIVE for all three species** — matching the
brief (human/mouse Predictive; rat "according to available evidence" = predictive, since rat has
no uptake data). No rat parameters are copied; predictive records carry **no** permeation
citation, only principle references. Diffusion coefficients and membrane permeability are
**NOT REPORTED** → schematic; nothing quantitative is claimed.

## New modules (`simulator/src/biology/`)
| Module | Role |
|---|---|
| `drugMolecule.js` | **Free drug molecule** — id, x/u position, velocity, diffusion coefficient, species, release timestamp, alive flag, evidence tag, compartment. Independent; only diffuses. |
| `cellField.js` | Schematic cell geometry (membrane + cytoplasm **only**) in an isotropic (x,u) patch; containment + membrane-contact + confinement tests. Pure. |
| `uptakeEngine.js` | The molecule layer: spawns molecules from released payload, Brownian **diffusion**, **passive** membrane crossing (probability on contact), cytoplasmic diffusion. Reads transport/release, never writes them. |
| `data/microenvironment.registry.json` | Cells, molecule spec, passive uptake model, schematic diffusion, per-species uptake evidence, integrity (31 forbidden), provenance. |
| `render/canvasRenderer.js` (extended) | Semi-transparent cells + visible membranes + tiny free-drug dots (extracellular vs cytoplasm). |
| `biology/transportAnimator.js` (extended) | Steps the uptake layer after release each tick. |
| `types/uptake.ts` | TypeScript contract for the microenvironment + molecules. |

## Free drug molecules (largest new feature)
As each arrived carrier releases payload, molecules are spawned incrementally (continuous,
packetised, randomised emergence) so that **molecule count = released payload quantised**
(`moleculesPerCarrier` per fully-released carrier). Once free, each molecule is an **independent**
object that never merges back into the carrier; the carrier stays visible (empty shell). Molecules
are much smaller than carriers and undergo **only** Brownian diffusion.

## Passive uptake (contact → probability → cytoplasm)
Extracellular molecules that **contact** a membrane get a per-contact probability check; on
success the molecule crosses to just inside the membrane (a small radial step — never a teleport)
and becomes cytoplasmic; on failure it stays just outside. A molecule can **only** be in the
cytoplasm after contacting a membrane. Inside, it continues simple Brownian diffusion, confined
within the cell (no exocytosis). **No** receptors, channels, pumps, vesicles, or endocytosis.

## Evidence panel (three independent levels)
The evidence panel now reports **Transport / Release / Cell Uptake** independently, each
Experimental / Predictive / Unavailable. For rat: Experimental / Experimental / Predictive; for
human & mouse: Predictive / Predictive / Predictive. Release is a formulation-experimental model,
but the shown chain level is bounded by transport (experimental only where transport is). Every
predictive item is clearly labelled and carries its message.

## Species behaviour (only the selected species exists)
`app.setSpecies()` drives anatomy, transport, release (reset) and the uptake layer (re-species +
clears molecules), so only the selected species' particles and molecules ever exist. Rat runs the
experimental transport/release chain with predictive uptake; human/mouse run fully predictive.

## Tests & results
New `simulator/tests/uptake.test.mjs`: no molecules before release; molecules appear only after
release; **drug count equals released payload**; independent diffusion; molecules stay outside
until membrane contact; passive uptake only after contact; **no teleport** (bounded per-step
displacement); cells contain only membrane + cytoplasm (no forbidden structures); evidence levels
correct (rat transport Experimental; uptake Predictive for all); predictive clearly labelled;
species switching clears molecules; full-app chain transport→release→diffusion→uptake with the
renderer drawing cells + molecules. **Simulator suite: 847 passed, 0 failed** (was 769). `tsc`
compiles; hidden-char clean; production diff vs `origin/main` **empty**; production tests green
(**99 JS + 11 R**). PR #3 **not merged**.

---

**Stop.** Phase 4B ends with drug molecules diffusing inside the cytoplasm after passive entry.
No receptor binding, endocytosis, trafficking, lysosomes, nucleus, PK, PD, or target interaction
was implemented.
