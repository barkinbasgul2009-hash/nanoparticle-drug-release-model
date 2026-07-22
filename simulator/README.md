# Profile-B Simulator — Phases 1–5A

This directory is the Profile-B animation simulator. It is completely separate from the
project's production artifacts (`web/`, `R/`, `app/`, `tests/`), which are untouched.

- **Phase 1 — Foundation (infrastructure only):** config, logging, events, state, JSON
  loading + validation, preset/scene/scale/camera systems, evidence + citation engines, UI
  framework, debug tools, and the TypeScript interface contract. No rendering.
- **Phase 2 — Anatomical world (static anatomy only):** the five skin layers rendered as an
  evidence-driven cross-section with a clip plane, continuous zoom, scene switching, and
  anatomical labels. **Still zero biology**: no particles, diffusion, motion, cells, vessels,
  collagen, lamellae, microscopy, animation, shaders, or lighting.
- **Phase 2.5 — Anatomical scale validation (registry only):** the layer draw weights were
  upgraded from **purely ordinal** to **evidence-anchored schematic** using located
  literature (`draw_weight = log10(representative µm)` for the layers with real thickness
  evidence). Per-species profiles (human / rat / mouse) are kept separate — **no universal
  average is invented** — and the cross-section stays **`not_to_scale`**. Registry + tests +
  evidence doc only; no rendering or biology added.
- **Phase 2.6 — Multi-species anatomy architecture (registry + engine):** the anatomy engine is
  now **species-driven** with **independent** human / mouse / rat profiles (`species_profiles`).
  The active profile **always follows the selected species** and there is **no silent fallback
  to human** — an unsupported species is an error. Human stays evidence-anchored; mouse/rat use
  an evidence-supported **ordinal prominence ladder** (per-layer rodent µm are not established).
  `app.setSpecies()` + `state.species` prepare a future Species selector **without redesigning
  the UI**. Still zero biology. Audit: `docs/profile-b-multi-species-anatomy.md`.
- **Phase 3 — Biological transport engine (first biology):** passive transport of the topical
  NLC carrier **through the skin** (Topical Formulation → Skin Surface → Stratum Corneum →
  Viable Epidermis → Dermis → Target Region). A cited **biological state machine**, passive
  **mechanisms** (Brownian + concentration drift + SC barrier slowing; active transport
  **excluded**), evidence-based per-layer **mobility**, independent **particle objects**, a flat-
  dot renderer overlay (no glow/FX), and a deterministic engine. **Evidence-gated + species-
  driven with no fallback:** only **rat** has topical-permeation evidence (Chen 2012), so human
  and mouse are **blocked (NOT REPORTED)**. **Transport only** — no drug release, cell entry,
  uptake, payload, PK or PD. Docs: `docs/profile-b-simulator-phase3-implementation.md`,
  `docs/profile-b-transport-architecture.md`, `docs/profile-b-biological-transport.md`,
  `docs/profile-b-transport-evidence-report.md`, `docs/profile-b-transport-validation-report.md`.
- **Phase 3.1 — Predictive human & mouse transport (Evidence Level system):** an **Evidence
  Level** (Experimental / Predictive / Unavailable) replaces available/blocked. **Rat stays
  Experimental** (unchanged). **Human and mouse now animate in Predictive mode** — via their
  **own** anatomy + general passive-transport principles (`MECHANISTIC_TRANSFER`), clearly
  labelled, **not** experimentally validated, with **no rat parameters copied** and no
  quantitative claims. Predictive particles render as **outlined** dots (experimental = filled) +
  an evidence caption; experimental data is never replaced by a prediction. Docs:
  `docs/profile-b-simulator-phase3.1-implementation.md`, `docs/profile-b-predictive-transport.md`,
  `docs/profile-b-predictive-evidence-justification.md`, `docs/profile-b-phase3.1-validation-report.md`.
- **Phase 4 — Drug release engine (separate process):** after a particle **arrives**, its payload
  releases by the evidence-**selected first-order** model (`F(t)=1−e^(−k·t)`; Chen 2012) — drug
  inside decreases, released amount increases, a release curve updates, and the carrier eventually
  **empties**. Release is **completely separate** from transport (reads, never writes, transport
  state; never moves particles; release begins only after arrival). The rate `k` is **schematic**
  (NOT REPORTED); the model is **formulation-level** (no per-species k). The particle glyph gains
  an inner **payload disc** that shrinks to empty. **Release only** — no uptake, membrane
  crossing, endocytosis, PK, PD, etc. Docs: `docs/profile-b-simulator-phase4-implementation.md`,
  `docs/profile-b-drug-release.md`, `docs/profile-b-release-evidence-report.md`,
  `docs/profile-b-phase4-validation-report.md`.
- **Phase 4B — Cellular microenvironment & passive uptake (separate layer):** the released payload
  becomes independent **free drug molecules** that diffuse (Brownian) through the extracellular
  space and **passively** cross the membrane of schematic **cells** (membrane + cytoplasm only)
  into the cytoplasm, where they keep diffusing. Molecule count equals the released payload;
  molecules enter the cytoplasm **only after membrane contact** (no teleport). Cell uptake is
  **Predictive for all species** (passive free-drug crossing is a general principle, not the
  measured carrier uptake); the evidence panel now shows **three** independent levels
  (Transport / Release / Cell Uptake). **Passive entry only** — no receptors, endocytosis,
  organelles, nucleus, PK or PD. Docs: `docs/profile-b-simulator-phase4b-implementation.md`,
  `docs/profile-b-cellular-microenvironment.md`, `docs/profile-b-passive-uptake-evidence-report.md`,
  `docs/profile-b-phase4b-validation-report.md`.
- **Phase 4C — Endocytosis & intracellular trafficking (separate layer):** carrier nanoparticles
  contact a cell membrane and are internalized via **clathrin / caveolae / macropinocytosis**
  (registry-selected), then traffic a strict FSM **Membrane Contact → Wrapping → Internalized →
  Early Endosome → Late Endosome → Lysosome → (Escaped → Cytoplasm, only if the formulation
  evidence supports escape)**. Illegal transitions are rejected; maturation is gradual. Endocytosis
  applies to **carriers only** (free molecules stay free). Endocytosis + trafficking are
  **Predictive for all species** (pathway unresolved); escape is **Unavailable** for the B1 NLC
  (NOT REPORTED). The evidence panel now shows **five** levels (Transport / Release / Passive
  Uptake / Endocytosis / Intracellular Trafficking). **Intracellular entry only** — no nucleus,
  receptor signalling, PD, PK, apoptosis, immune response, etc. Docs:
  `docs/profile-b-simulator-phase4c-implementation.md`, `docs/profile-b-endocytosis-evidence-review.md`,
  `docs/profile-b-intracellular-trafficking.md`, `docs/profile-b-phase4c-validation-report.md`.
- **Phase 4D — Intracellular drug release (separate layer):** a carrier that has reached the
  **cytoplasm** (post escape) may release payload via burst / first-order / zero-order / Higuchi /
  Korsmeyer–Peppas **only if evidence exists**; released **intracellular free drug** diffuses
  (Brownian) **only inside its own cell**, may **degrade** (evidence-gated), and — with a schematic
  **nucleus** present — may **target the nucleus** (evidence-gated), stopping at the nuclear
  membrane and **never entering**. For the **B1 NLC** all of this is **NOT REPORTED** (and escape
  is Unavailable), so the intracellular stage is honestly **idle**. The evidence panel now shows
  **six** levels (… + Intracellular Release). `NOT_REPORTED` added as an evidence level. **No** DNA/
  RNA, transcription, PD, PK, apoptosis, nuclear-pore transport, or any downstream biology. Docs:
  `docs/profile-b-simulator-phase4d-implementation.md`, `docs/intracellular-drug-release.md`,
  `docs/intracellular-drug-evidence-review.md`, `docs/profile-b-phase4d-validation-report.md`.
- **Phase 5A — Target engagement (first pharmacology layer, separate):** molecular recognition
  only — schematic molecular **targets** (enzyme/receptor/etc., in cytoplasm or nucleus), drug–
  target **encounter** (proximity only, no attraction), **reversible** (kon/koff) + **irreversible**
  binding, **occupancy / saturation / residence time**, and **competition** (first bound occupies,
  others keep diffusing). Nuclear targets require Phase-4D nucleus targeting. Affinity (Kd/Ki/IC50)
  only if evidence, else a labelled **prediction** or **Not Reported** — never fabricated (see the
  prediction-label vocabulary). For the **B1 NLC** the target + binding are **NOT REPORTED**, so the
  layer is honestly **idle**. The evidence panel now shows **seven** levels (… + Target Engagement).
  **Stops at binding** — no signalling, PD downstream, apoptosis, or any response. Docs:
  `docs/profile-b-simulator-phase5a-implementation.md`, `docs/target-engagement.md`,
  `docs/target-binding-evidence-review.md`, `docs/prediction-framework.md`,
  `docs/phase5a-validation-report.md`.
- **Phase 5B.1 — Signal-transduction evidence & graph architecture (data + validator ONLY):** a
  registry-driven **directed signaling graph** — `SignalingNode`/`SignalingEdge` schemas, a
  9-level signal evidence vocabulary, six separable registries
  (`signal-context/nodes/edges/pathways/evidence/prediction.registry.json`), a
  **loader + validator** (`src/biology/signalGraph.js`, no runtime propagation/animation/UI), and
  types (`src/types/signaling.ts`). Profiles are **context-keyed** (never mixing species/cell models)
  and **exposure-driven** (molecular target NOT REPORTED). Accepted DAGs: **5B-H1** human HaCaT
  ROS→ERK/p38→Nrf2→ARE→HO-1; **5B-H2** human HaCaT NF-κB suppression; **5B-M1** mouse B16BL6
  PI3K→AKT→mTOR; **5B-H3** deferred; **5B-R1** rat NOT REPORTED. Canonical edges =
  `EXPERIMENTAL_PATHWAY_SPECIFIC` (no fabricated DOI); celastrol claims =
  `LITERATURE_DERIVED_PREDICTION` (UNVERIFIED_IN_REPO). Activity is **schematic** (0.0–1.0), time is
  a **schematic ordinal**, and the graph **stops before gene regulation**. No runtime engine is
  wired. Docs: `docs/profile-b-simulator-phase5b1-implementation.md`,
  `docs/signal-transduction-evidence-review.md`, `docs/signal-graph-architecture.md`,
  `docs/signal-context-profiles.md`, `docs/signal-node-edge-evidence-matrix.md`,
  `docs/signal-prediction-framework.md`, `docs/phase5b1-validation-report.md`,
  `docs/phase5b2-ui-renderer-specification.md`.
- **Phase 5B.2 — Signal propagation engine (first RUNTIME signaling layer):** the frozen
  5B.1 graph comes alive. A new `SignalPropagationEngine` reads the 5B.1 registries + a
  runtime-dynamics registry (`signal-propagation.registry.json`) **read-only** and
  propagates activity over simulated time — node **activation**, edge **propagation** with
  **delay** + **attenuation**, **thresholds**, activity **decay** + auto-deactivation,
  baseline-pathway **suppression** (H2/M1), **competition** (Nrf2 ← ERK+p38), and
  **feedback** (a labelled predicted HO-1 ⊣ ROS edge; bounded, no oscillation explosion).
  **5B-H1** activates as a transient cytoprotective pulse; **5B-H2/5B-M1** suppress;
  **rat** is idle (Not Reported). Labelled **predictions** propagate too — the
  `STIM1 → Orai1 → SOCE → Ca²⁺` mechanistic-prediction pathway (deferred in 5B.1) — always
  visually distinct, toggleable, and never overwriting experimental nodes. An additive
  runtime vocabulary adds `HYPOTHESIS`; the frozen 5B.1 evidence labels are unchanged.
  A **timeline** + deterministic **playback** (play/pause/restart/step/speed) and evidence
  **overlays** (experimental/prediction/combined/unavailable/not-reported) are provided.
  The renderer gains publication-style signal frames; the evidence panel shows an **eighth**
  section. **Stops at signaling** — no transcription/translation/PD/PK/apoptosis/immune/
  tumour/toxicity. Docs: `docs/profile-b-simulator-phase5b2-implementation.md`,
  `docs/signal-propagation.md`, `docs/signal-animation.md`, `docs/signal-timeline.md`,
  `docs/phase5b2-validation-report.md`.
- **Phase 5C — Gene regulation & transcription runtime (first response after signaling):**
  a new `TranscriptionEngine` reads the 5B.2 signal output + a transcription registry
  **read-only** and drives **TF activation → nuclear translocation → DNA promoter binding →
  gene transcription → mRNA** — and **stops at mRNA**. Objects: `TranscriptionFactor`,
  `PromoterRegion`, `Gene`, `MessengerRNA`. Human HaCaT: Nrf2 → ARE → **HMOX1 + NQO1**
  (one TF → multiple genes) induced 25%→50% after a transcription **delay**; NF-κB is
  drug-**suppressed** so the inflammatory gene falls 50%→25% (multiple TFs on one promoter
  = competition/cooperation, with Nrf2 cross-repression). Expression is a schematic level
  `{0,25,50,75,100}`; mRNA is a **copy state** (none/low/moderate/high) with half-life
  **NOT_REPORTED**. Mouse/rat are **NOT_REPORTED** (idle; no TF node / no evidence; no
  transfer). Nothing is EXPERIMENTAL without a real reference; gene regulation is mostly a
  **labelled prediction** (`GENE_EVIDENCE_LEVELS` adds `HIGH_CONFIDENCE` + `HYPOTHESIS`);
  no DOI/fold-change/kinetic/RNA-copy-number/protein-abundance is fabricated. Deterministic;
  renderer draws a schematic gene-regulation diagram; the evidence panel shows a **ninth**
  section. **Stops at mRNA** — no translation/protein/enzyme/metabolism/cell-cycle/
  apoptosis/immune/tissue/PK/PD/toxicity. Docs:
  `docs/profile-b-simulator-phase5c-implementation.md`,
  `docs/gene-regulation-transcription.md`, `docs/transcription-evidence-review.md`,
  `docs/phase5c-validation-report.md`.
- **Phase 5D — Translation & protein synthesis runtime (mRNA → mature protein):** a new
  `TranslationEngine` reads the Phase-5C mRNA output + translation/protein registries
  **read-only** and drives **mRNA gating → ribosome recruitment → initiation → elongation →
  termination → nascent polypeptide → schematic folding/maturation → mature protein
  abundance → turnover** — and **stops at protein**. Objects: `Ribosome`,
  `TranslationInitiationComplex`, `NascentPolypeptide`, `Protein`. Human HaCaT: **HO-1**
  rises to ~50% (induced, transient), **NQO1** rises, and the **suppressed inflammatory
  protein** stays low (~25%) — reduced mRNA → reduced protein. Abundance is a schematic
  ladder `{0,25,50,75,100}`; turnover is conserved (`produced = folding+mature+degrading+
  degraded`); biological half-life is **NOT_REPORTED** (kept distinct from the schematic
  decay class). Global translation capacity (constitutive high for human; signal-node-linked
  only where a profile permits, as a labelled prediction) is separate from per-gene
  efficiency. Mouse/rat are **NOT_REPORTED** (no 5C mRNA; no transfer). Nothing is
  EXPERIMENTAL without a verified in-repo reference (HO-1 = LITERATURE_DERIVED_PREDICTION);
  `TRANSLATION_EVIDENCE_LEVELS` adds the 10-tier vocabulary; protein catalytic **function is
  never evaluated** (`functional_state = not_evaluated`); no rate/count/length/copy-number/
  half-life/folding-time is fabricated. Deterministic; renderer draws a schematic
  translation diagram; the evidence panel shows a **tenth** section separating mRNA /
  translation / protein-abundance / protein-function evidence. **Stops at protein +
  turnover** — no enzyme activity/receptor function/metabolism/phenotype/apoptosis/immune/
  tissue/PK/PD/toxicity. Docs: `docs/profile-b-simulator-phase5d-implementation.md`,
  `docs/translation-protein-synthesis.md`, `docs/translation-evidence-review.md`,
  `docs/protein-output-profiles.md`, `docs/translation-prediction-framework.md`,
  `docs/phase5d-validation-report.md`, `docs/translation-animation-specification.md`,
  `docs/translation-developer-notes.md`.
- **Phase 6A — Protein function & early cellular response (mature protein → reversible
  cellular state):** a new `ProteinFunctionEngine` reads the Phase-5D mature proteins +
  Phase-5B signaling + Phase-6A registries **read-only** and drives **functional eligibility
  → activation/inhibition → reversible early cellular-state change → homeostatic/stress
  response → recovery** — and **stops before cell fate**. Objects: `FunctionalProteinState`,
  `CellularStateVariable`, `FunctionalEdge`. Human HaCaT: HO-1/NQO1 function → antioxidant
  capacity ↑, oxidative stress ↓ (declared antioxidant↔oxidative feedback), inflammatory
  state ↓ (NF-κB suppression + HO-1), adhesion readiness ↓ (suppressed ICAM1-like protein) —
  all reversible. Mouse B16BL6 (signal-driven, no protein output): survival signaling ↓,
  oxidative/mitochondrial stress ↑, **preparatory reversible stress readiness** ↑ —
  explicitly **NOT apoptosis** (no cell dies). Rat: **NOT_REPORTED** (idle; no fallback).
  Cellular states are schematic `[0,1]`, reversible, bounded; feedback is declared/typed/
  bounded/stable. Nothing is EXPERIMENTAL without a verified in-repo reference
  (`FUNCTION_EVIDENCE_LEVELS`, additive, 10 tiers); no kinetics/concentration/%/
  membrane-potential/half-life/dose-response is fabricated; **cell-fate evidence stays
  NOT_EVALUATED**. Deterministic; renderer draws a restrained protein-function/cellular-state
  diagram (no flames/danger/dying-cell); the evidence panel shows an **eleventh** section
  separating protein-abundance / protein-function / cellular-response / cell-fate evidence.
  **Stops before cell fate** — no apoptosis/caspase/cytochrome-c/AIF/necrosis/cell-cycle
  execution/proliferation/migration/tumour/immune/tissue/PK/PD/toxicity. Docs:
  `docs/profile-b-simulator-phase6a-implementation.md`, `docs/protein-function-runtime.md`,
  `docs/protein-function-evidence-review.md`, `docs/early-cellular-response-profiles.md`,
  `docs/functional-prediction-framework.md`, `docs/phase6a-validation-report.md`,
  `docs/phase6a-animation-specification.md`, `docs/phase6a-developer-notes.md`.
- **Phase 6B — Apoptosis commitment & execution (persistent stress → irreversible death
  program):** a new `ApoptosisEngine` reads the Phase-6A cellular-stress states + Phase-5B
  signaling + Phase-6B registries **read-only** and drives **apoptosis eligibility →
  reversible pre-commitment → an irreversible commitment gate → mitochondrial transition
  (ΔΨm loss, MOMP) → cytochrome-c/caspase-dependent branch AND/OR AIF-associated
  (caspase-independent) branch → apoptotic cell state** — and **stops at the single cell**.
  Objects: `ApoptosisState`, `MitochondrialApoptosisState`, `CaspaseCascadeState`,
  `AIFExecutionState`, `ApoptosisIntervention`. Strict FSM: `stressed`/`apoptosis_eligible`/
  `pre_commitment` are recoverable; `committed` onward are **irreversible** (illegal
  transitions throw). Deterministic — **no RNG, no random death probabilities**; commitment
  needs *net* pressure (pressure minus a survival offset) sustained above threshold for the
  persistence window. Two parallel branches with **partial** caspase dependence combine into a
  bounded schematic execution drive. Default mouse = **B16BL6 = CONTEXT_TRANSFER_PREDICTION**
  (canonical line; explicit B16→B16BL6 transfer record, never a silent copy); **B16** &
  **B16-F10** are separate selectable experimental profiles (B16-F10 carries the PI3K
  activator); **HaCaT** & **rat** are **NOT_REPORTED** (idle). Interventions are
  target-isolated + timing-sensitive: ROS scavenger + PI3K activator can *prevent* commitment
  **before** the gate; caspase inhibitor (partial) + AIF knockdown (strong) only *attenuate* an
  already-committed cell. `APOPTOSIS_EVIDENCE_LEVELS` (additive, 11 tiers); all apoptosis
  citations `NOT_REPORTED` (qualitative only — no fabricated DOI/rate/%/ΔΨm/kinetics); no
  hardcoded scientific values in engine source. Renderer draws a **restrained** commitment
  bar + branch indicators (no explosions/flames/skulls/blood/red-flash); the evidence panel
  shows a **twelfth** section. **Stops at the single-cell apoptotic state** — the cell object
  is never removed; `populationOutcomeEvidence`/`tumourResponseEvidence` stay
  **NOT_EVALUATED**; no necrosis/necroptosis/pyroptosis/ferroptosis/autophagic death, no
  population/tumour/tissue/immune outcome, no PK/PD/clinical. Docs:
  `docs/profile-b-simulator-phase6b-implementation.md`,
  `docs/apoptosis-runtime-architecture.md`, `docs/apoptosis-evidence-review.md`,
  `docs/mitochondrial-apoptosis-pathway.md`, `docs/caspase-and-aif-execution-model.md`,
  `docs/apoptosis-intervention-model.md`, `docs/apoptosis-context-transfer-policy.md`,
  `docs/phase6b-validation-report.md`, `docs/phase6b-animation-specification.md`,
  `docs/phase6b-developer-notes.md`.
- **Phase 6C — Population response & tissue-level dynamics (single cell → population
  composition):** a new `PopulationEngine` reads the Phase-6B apoptosis trajectory + six
  Phase-6C registries **read-only** and derives a **schematic virtual population** —
  normalized fractions (`living`, `apoptotic`, `adapted`, `recovered`, `cumulativeApoptosis`)
  and a strict population state machine `healthy → minimal_response → adaptive_response →
  partial_response → mixed_population → apoptosis_accumulating → apoptosis_dominant →
  stable_terminal_state`. It answers *"what fraction of cells are in each state?"* and invents
  no new intracellular biology. Deterministic — **no RNG**; **conservation** `living +
  apoptotic = 1` at every step; apoptotic is **non-decreasing** (committed cells never
  resurrect); recovery reclassifies surviving cells only and is legal **only before**
  `apoptosis_dominant`; `transitionTo` throws on illegal transitions; **no population growth /
  proliferation / mitosis**. Deterministic **replay history** (one entry per step) + a
  milestone timeline. Object: `PopulationState` — **normalized fractions only, never real cell
  counts / density / cellularity**. Default mouse = **B16BL6 = CONTEXT_TRANSFER_PREDICTION**
  (echoes the 6B B16→B16BL6 transfer); **B16 / B16-F10 = MECHANISTIC_PREDICTION** (separate,
  selectable); **HaCaT / rat = NOT_REPORTED** (idle; no fallback). Additive
  `POPULATION_EVIDENCE_LEVELS` (8 tiers, **no experimental tier** — population is never
  experimental); a population profile is available only where single-cell apoptosis evidence
  exists **and** population evidence is absent; all citations `NOT_REPORTED`; no hardcoded
  scientific values in engine source. Renderer draws a **restrained** stacked composition bar
  (living/adaptive/recovered/apoptotic) + an apoptotic-fraction history sparkline (no
  blood/explosions/dead-body graphics); the evidence panel shows a **thirteenth** section.
  **Stops at population composition** — `tumourResponseEvidence` / `survivalEvidence` /
  `clinicalOutcomeEvidence` stay **NOT_EVALUATED**; no tumour/immune/vascular/fibrosis/
  wound-healing/PK/PD/toxicity/clinical outcome. Docs:
  `docs/profile-b-simulator-phase6c-implementation.md`,
  `docs/population-runtime-architecture.md`, `docs/population-response-model.md`,
  `docs/population-evidence-review.md`, `docs/population-prediction-policy.md`,
  `docs/population-state-machine.md`, `docs/population-validation-report.md`,
  `docs/population-animation-specification.md`, `docs/population-developer-notes.md`,
  `docs/population-limitations.md`.
- **Phase 6D — Tumour growth, regression & treatment response (population → schematic tumour
  burden):** a new `TumorResponseEngine` reads the Phase-6C population + eight Phase-6D
  registries **read-only** and derives a **schematic normalized tumour burden** (baseline 1.0,
  **never mm³**) and a treatment-response trajectory `untreated_growth → treatment_started →
  growth_continues/slowed → stable_burden → partial_regression → strong_regression →
  minimal_residual_burden`, with `treatment_ended → rebound_possible → rebound_in_progress`. It
  is the first tumour-level layer but **not** a clinical layer. Deterministic — **no RNG**;
  **population-gated** (no tumour response without population input); two **distinct** treatment
  paths (growth suppression **and** increased loss), `net = growth − loss` (schematic); burden
  bounded, non-negative, gradual (no instant disappearance), holds at a minimal-residual floor
  (not zero / not a cure); `transitionTo` throws on illegal transitions (no regression without
  treatment; no `cure` state). Deterministic **replay history** + a normalized **response
  curve**. Objects: `TumorBurdenState`, `TumorGrowthPressure`, `TumorLossPressure`,
  `TumorTreatmentEvent` (living fraction is a **distinct** abstraction from proliferation; loss
  is reduced viable burden, **not** immune/physical clearance). Additive `TUMOR_EVIDENCE_LEVELS`
  (11 tiers incl. `EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC`) — a tumour experimental tier exists
  because the package holds a verified in vivo antimelanoma PD study (Chen 2012,
  doi:10.2147/IJN.S32476, B16BL6) supporting treatment **direction** + formulation **ranking**
  (cationic > anionic/neutral; NLC > free) qualitatively; every exact value stays
  **NOT_REPORTED**. Default mouse = **B16BL6 = EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC** + cationic
  NLC; **B16 / B16-F10** separate experimental (free tripterine); **human = predictive-
  exploratory / UNAVAILABLE** (no active human melanoma population; mandated non-clinical
  warning); **rat = NOT_REPORTED**. Cationic / anionic / neutral NLC / free tripterine / vehicle
  stay separate formulation profiles; no hardcoded scientific values in engine source. Renderer
  draws a **restrained** relative-burden bar + response curve (no realistic tumour / blood /
  necrotic debris / clinical scan / sensational imagery); the evidence panel shows a
  **fourteenth** section. **Stops at the response trajectory** — clinical / RECIST / survival /
  metastasis / immune / PK stay **NOT_EVALUATED**; no clinical response / patient outcome /
  PBPK / toxicity / dose recommendation. Docs:
  `docs/profile-b-simulator-phase6d-implementation.md`,
  `docs/tumor-response-runtime-architecture.md`, `docs/tumor-growth-regression-model.md`,
  `docs/tumor-response-evidence-review.md`, `docs/formulation-response-profiles.md`,
  `docs/tumor-prediction-framework.md`, `docs/tumor-context-transfer-policy.md`,
  `docs/phase6d-validation-report.md`, `docs/phase6d-animation-specification.md`,
  `docs/phase6d-developer-notes.md`, `docs/tumor-response-limitations.md`.
- **Phase 7A — Passive tumour microenvironment (skin penetration → penetration modifier):** a new
  `MicroenvironmentEngine` models the **passive** physical / biochemical environment (ECM /
  collagen / hyaluronic acid / interstitial space / oxygen / hypoxia / mechanical barrier) that
  **modifies drug penetration**. It is the first tumour-microenvironment layer but **not** an
  immune / angiogenesis / metastasis / remodeling phase. **Core principle:** it MODIFIES transport
  / uptake / penetration — it never REPLACES an upstream engine, alters upstream logic, or touches
  intracellular signalling (`modifiesSignalling: false`); the penetration modifier is advisory.
  Deterministic (**no RNG**), registry-driven. Objects: `ECMState`, `CollagenNetwork`,
  `InterstitialSpace`, `DiffusionBarrier`, `OxygenEnvironment`, `HypoxiaState`, `MechanicalBarrier`,
  `PenetrationModifier` — all schematic ordinal / 0-1, never real ECM density / collagen mass /
  oxygen concentration / diffusion coefficient. ECM / diffusion / mechanical / hypoxia resistances
  combine into a schematic `penetrationModifier = clamp(1 − combinedRestriction, floor, 1)` + an
  ordinal state (`permissive … extremely_restrictive`); denser ECM / stiffer barrier / more
  hypoxia → lower penetration. Additive `MICROENVIRONMENT_EVIDENCE_LEVELS` (8 tiers, **no
  experimental tier** — the frozen package has no direct TME dataset). Mouse **B16BL6 =
  MECHANISTIC_PREDICTION** (default); **human = predictive-exploratory** with its **own distinct**
  values (not copied; non-clinical warning); **rat = NOT_REPORTED** (idle). Nine registries; no
  hardcoded science; config key `tmeSources` (distinct from the frozen Phase-4B
  `microenvironmentSources`). Renderer draws a **schematic** ECM mesh + oxygen/hypoxia overlay +
  direct-vs-tortuous penetration path (no photorealism / vasculature / immune cells); an eight-event
  evaluation timeline; a `validate()` (registry + consistency, e.g. rejects normoxia + severe
  hypoxia and dense-ECM-permissive); the evidence panel shows a **fifteenth** section. **Stops at
  penetration modification** — immune / vascular / remodeling / metastasis stay **NOT_EVALUATED**;
  no fibroblasts / CAF / MMP / angiogenesis / migration / lymphatic / systemic biology. Docs:
  `docs/profile-b-simulator-phase7a-implementation.md`,
  `docs/microenvironment-runtime-architecture.md`, `docs/passive-microenvironment-model.md`,
  `docs/microenvironment-evidence-review.md`, `docs/microenvironment-prediction-policy.md`,
  `docs/microenvironment-registry-guide.md`, `docs/microenvironment-renderer-guide.md`,
  `docs/microenvironment-validation-report.md`, `docs/phase7a-developer-notes.md`,
  `docs/microenvironment-limitations.md`, `CHANGELOG.md`.
- **Phase 7B — Tumour vasculature & angiogenesis (passive TME → drug delivery modifier):** a new
  `VascularEngine` models the **active vascular component** (vessel architecture / density /
  maturity / organization, perfusion, oxygen + nutrient supply, permeability) that **modifies drug
  delivery**. It is not an immune / metastasis / fibroblast phase. **Core principle:** blood
  vessels do NOT signal and do NOT induce apoptosis — they MODIFY oxygen / nutrient / drug
  accessibility / penetration opportunity only (`modifiesSignalling: false`,
  `inducesApoptosis: false`, `remodels: false`); the delivery modifier is advisory. Deterministic
  (**no RNG**), registry-driven; optionally reads the Phase-7A engine **read-only** for a combined
  delivery × penetration view. Objects: `VesselState`, `VascularNetwork`, `PerfusionState`,
  `OxygenSupply`, `NutrientEnvironment`, `PermeabilityState`, `DeliveryModifier` — all schematic
  ordinal / 0-1, never real vessel count / blood flow / pO₂ / diameter / perfusion rate. Vessel
  density / perfusion / permeability / maturity combine into `deliveryModifier = clamp(…, floor, 1)`
  + an ordinal delivery state (`poor … excellent`); higher perfusion / permeability /
  vascularization / maturity → higher delivery. Additive `VASCULAR_EVIDENCE_LEVELS` (8 tiers, **no
  experimental tier** — no direct vasculature dataset). Mouse **B16BL6 = MECHANISTIC_PREDICTION**
  (default; abnormal melanoma vasculature — highly vascularized but immature, poorly perfused,
  leaky); **human = predictive-exploratory** with its **own distinct** states (not copied;
  non-clinical warning); **rat = NOT_REPORTED** (idle). Nine registries; no hardcoded science;
  config key `vascularSources`. Renderer draws **schematic** branching vessels (count/amplitude →
  density, opacity → maturity) + a perfusion tint + a delivery-strength path (no endothelial cells /
  blood cells / flow vectors); an eight-event evaluation timeline; a `validate()` (registry +
  consistency, e.g. rejects `very_high` oxygen + `very_low` perfusion and an available rat
  vasculature); the evidence panel shows a **sixteenth** section. **Stops at delivery
  modification** — immune / VEGF / HIF / metastasis stay **NOT_EVALUATED**; no VEGF/HIF signalling /
  vascular inflammation / immune trafficking / fibroblast / CAF / ECM remodeling / lymphatics /
  metastasis. Docs: `docs/profile-b-simulator-phase7b-implementation.md`,
  `docs/vascular-runtime-architecture.md`, `docs/tumor-vasculature-model.md`,
  `docs/vascular-evidence-review.md`, `docs/vascular-prediction-policy.md`,
  `docs/vascular-registry-guide.md`, `docs/vascular-renderer-guide.md`,
  `docs/vascular-validation-report.md`, `docs/phase7b-developer-notes.md`,
  `docs/vascular-limitations.md`, `CHANGELOG.md`.

## Phase 2 + 2.5 + 2.6 at a glance
- **Anatomy is data, not code:** `simulator/data/anatomy.registry.json` defines the five
  layers, their biologically-correct ordering, **independent per-species draw-weight profiles
  (evidence-anchored schematic, explicitly `not_to_scale`)**, the scale-level -> visibility
  mapping, scenes, labels, and an illustrative palette. The code hardcodes **no** biological
  values.
- **Species-driven (Phase 2.6):** `species_scope` lists the supported species and the boot
  selection; `AnatomyModel` tracks an `activeSpecies` and refuses unsupported species (no silent
  fallback to human). `computeAnatomyLayout` reads `model.weights()`, so the cross-section
  follows the selected species automatically.
- **Scientific honesty:** Phase 2 encoded the correct **ordering** with **ordinal** weights
  because measured thicknesses are `NOT_REPORTED` in the frozen Profile-B evidence (Chen's
  0-30/30-60/60-90 µm are *sampling sections*, not thicknesses). Phase 2.5 then located
  general anatomical thickness literature (Sandby-Møller 2003 for human SC/epidermis; a
  flagged 1–3 mm dermis range; rodent epidermis ~20 µm) and replaced the ordinal ranks with
  **log-compressed, evidence-anchored** draw weights — still schematic, still
  "schematic - not to scale", every value with provenance and confidence. Rat/mouse per-layer
  µm were **not located**, so those profiles stay ordinal and flagged `INCOMPLETE` rather than
  invented. Full audit trail: `docs/profile-b-anatomy-scale-validation.md`. Ordering
  provenance: OpenStax CC BY / StatPearls.
- **Renderer:** `CanvasRenderer` (static 2D bands) behind the Phase-1 `createRenderer`
  interface. A pure `computeAnatomyLayout()` engine computes bands/labels and is unit-tested
  headless (no canvas needed).

## Original Phase-1 note
The foundation remains **infrastructure**; Phase 2 adds only static anatomy on top of it
without changing its wiring.

It is completely separate from the project's production artifacts (`web/`, `R/`, `app/`,
`tests/`), which are untouched.

## Run it
- **Browser:** serve the repo root and open `simulator/index.html` (it loads real data from
  `../data/` via `fetch`). You'll see the empty panel layout; inspect `window.__SIM__` in the
  console for loaded presets, citations, scale levels, camera descriptor, and app state.
- **Headless (Node):** `node simulator/tests/run.mjs` boots the whole foundation with a
  filesystem fetcher and runs the architecture tests.
- **Type contract:** `npx tsc --noEmit -p simulator/tsconfig.json`.

## Architecture (clear responsibilities)
```
simulator/src/
  config/     app.config.js      # all wiring/config; NO hardcoded scientific values
  core/       logger, eventBus, state
  data/       jsonLoader (+ injectable fetcher), schema (shape validation)
  presets/    presetEngine        # B1/B2/B3 metadata (model/species/evidence/refs/permissions/limits)
  scene/      sceneManager        # register/lifecycle/transition/cleanup/shared state/metadata
  scale/      scaleSystem         # L1..L6 hierarchy (visible structures/labels/camera limits/transitions)
  camera/     cameraSystem        # perspective/ortho + clip-plane + nav-mode descriptors (no rendering)
  render/     renderer            # NullRenderer only (rendering boundary; WebGL deferred)
  evidence/   evidenceEngine      # confidence vocab + the canAnimate() gate
  references/ citationEngine      # reference/license index
  ui/         uiFramework, panels # 8 empty panel shells (Main/Nav/Evidence/Citation/Legend/Info/Timeline/Debug)
  debug/      debugTools          # status snapshot + optional FPS meter (browser)
  types/      *.ts                # TypeScript interface contract (biology/evidence/scene/preset)
simulator/tests/                  # zero-dependency architecture tests
```

## Design rules honored
- **No hardcoded scientific values** — all science is loaded at runtime from the frozen
  `data/profile-b-*.json` registries the previous phases produced.
- **Evidence gate is first-class** — `evidenceEngine.canAnimate()` blocks
  `NOT_REPORTED` / `UNSUPPORTED_DO_NOT_ANIMATE` / `NOT_APPLICABLE` so later phases cannot
  render unsupported claims by accident.
- **Rendering is a swappable boundary** — Phase 1 ships a `NullRenderer`; a real renderer
  slots in later without touching call sites.
- **Self-contained** — no external runtime dependencies; ES modules; Node-testable via an
  injected fetcher.

## Not in Phase 1 (by design)
Skin/anatomy/cells/nanoparticles/particle-simulation/diffusion/shaders/materials/lighting/
animation and any B1/B2/B3 scene. Those are Phase 2+.
