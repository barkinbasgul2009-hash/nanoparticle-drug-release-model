# Early Cellular-Response Profiles (Profile B, Phase 6A)

Accepted, deferred, and rejected early cellular-response profiles for the protein-function
runtime. All states are schematic, reversible, and bounded `[0,1]`; the phase stops before
cell fate.

## Human HaCaT (accepted, protein + signal driven)

Cellular states: `oxidative_stress`, `antioxidant_capacity`, `inflammatory_state`,
`adhesion_readiness`.

- **Antioxidant capacity ↑** — active HO-1 + predicted NQO1 function.
- **Oxidative stress ↓ (transient)** — ROS raises it; antioxidant capacity counteracts it
  (declared homeostatic feedback); recovers toward baseline.
- **Inflammatory state ↓** — NF-κB suppression + HO-1 anti-inflammatory function.
- **Adhesion readiness ↓** — suppressed inflammatory (ICAM1-like) protein abundance. Stops
  at readiness; no monocytes/recruitment.

Functional proteins: HO-1, NQO1 (predicted), inflammatory/ICAM1-like. HO-1 catalytic
function (heme degradation, bilirubin/CO/iron) is **excluded**.

## Mouse B16BL6 (accepted, signal-driven — no protein output from 5D)

Cellular states: `survival_signaling`, `oxidative_stress`, `mitochondrial_stress`,
`stress_readiness` (general_stress).

- **Survival signaling ↓** — PI3K/AKT/mTOR suppression.
- **Oxidative stress ↑** — celastrol exposure.
- **Mitochondrial-stress readiness ↑** — reduced survival + oxidative stress (preparatory).
- **Stress readiness ↑** — converging stress; reduced survival. **Preparatory + reversible;
  NOT apoptosis.**

Excluded: Bax/Bcl-2, cytochrome-c, AIF, caspases, PARP, apoptosis, cell-cycle arrest,
growth/migration inhibition, tumour-volume reduction (Phase 6B+).

## Rat (NOT_REPORTED)

No Phase-5D protein and no validated functional response → idle. No fallback.

## Deferred / rejected

- **HO-1 as EXPERIMENTAL functional relationship** — rejected: no verified in-repo primary
  functional source. Kept as LITERATURE_DERIVED_PREDICTION.
- **ICAM1 named identity** — not adopted; schematic inflammatory protein used.
- **Rat functional profile** — deferred (may be added only with explicit justification;
  disabled by default).
- **HO-1 enzymatic chemistry / antioxidant phenotype / ROS reduction as a protein effect**
  — excluded from Phase 6A (later phases with direct evidence).

## Reversibility & feedback

States relax toward baseline as signaling winds down (recovery). A declared, bounded
negative-feedback loop (antioxidant capacity ↔ oxidative stress) stabilises the response;
no oscillation explosion; no undeclared cycles.
