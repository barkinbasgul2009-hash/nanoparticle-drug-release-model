# Mitochondrial Apoptosis Pathway (Phase 6B)

This document describes the mitochondrial (intrinsic) apoptotic transition as modelled by the
Phase-6B runtime: the reversible pre-commitment priming, the irreversible transition after
the commitment gate, MOMP, and the release of cytochrome-c and AIF. All quantities are
schematic ordinal states — never ΔΨm in millivolts, never a release percentage, never a rate.

## Reversible priming (before commitment)

While the cell is still in a recoverable state (`stressed` / `apoptosis_eligible` /
`pre_commitment`) the mitochondrion is only *primed*, and priming tracks apoptotic pressure
`P` reversibly:

| Pressure P | Bax/Bcl-2 balance | MOMP state | Membrane potential |
|---|---|---|---|
| `< eligibility` | `anti_apoptotic_dominant` | `inactive` | `normal` |
| `≥ eligibility` | `balanced` | `inactive` | `normal` |
| `≥ pre_commitment` | `pro_apoptotic_shift` | `sensitized` | `slightly_reduced` |

If pressure falls, these revert. Nothing here is committed.

## The commitment gate

When net pressure has stayed above the commitment threshold for the persistence window, the
cell crosses `commitment_threshold_reached → committed`. At that instant:

- `reversibility` becomes `irreversible` (strict FSM; no path back to a recoverable state);
- Bax/Bcl-2 locks to `strong_pro_apoptotic_shift`;
- a `apoptosis:committed` event is emitted.

## Irreversible mitochondrial transition (after commitment)

`_advanceExecution()` advances by *time since commitment* (`tc`) plus per-stage delays from
`stage_delay_hours`. All timing is **schematic** — a legibility ordering, not a biological
timescale.

1. **Mitochondrial transition** (`tc ≥ mitochondrial_transition` delay): state →
   `mitochondrial_transition`; membrane potential steps `reduced → severely_reduced →
   collapsed` as `tc` grows.
2. **MOMP** (`tc ≥ transition + momp`): `mompState` → `active`, `mompReadiness` rises toward
   1. On activation, cytochrome-c becomes `release_ready` and mitochondrial AIF becomes
   `release_ready`; a `momp_initiated` event fires once.
3. **Release** (`tc ≥ transition + momp + release`):
   - cytochrome-c → `released` (`cytochrome_c_released` event) — feeds the **caspase**
     branch;
   - AIF → `released` (`aif_released` event) — feeds the **AIF-associated** branch — *unless*
     a strong AIF knockdown has silenced it (then AIF stays `suppressed_by_knockdown` and is
     never released);
   - the cell advances `mitochondrial_transition → execution_in_progress`.

## Two outlets from one mitochondrial event

MOMP is the single upstream event that opens **both** downstream branches:

```
                         ┌─ cytochrome-c released ─▶ caspase-dependent branch
   MOMP (irreversible) ──┤
                         └─ AIF released ──────────▶ AIF-associated branch (caspase-independent)
```

This is why partial caspase inhibition does not rescue the cell (the AIF outlet remains) and
why AIF knockdown attenuates but does not, by itself, prevent commitment — see
`caspase-and-aif-execution-model.md`.

## Ordinal vocabularies (from the dynamics registry)

- **Membrane potential:** `normal → slightly_reduced → reduced → severely_reduced → collapsed`
- **Bax/Bcl-2:** `anti_apoptotic_dominant → balanced → pro_apoptotic_shift →
  strong_pro_apoptotic_shift`
- **MOMP:** `inactive → sensitized → initiating → active → complete`
- **Cytochrome-c:** `retained → release_ready → released`
- **AIF (mitochondrial):** `mitochondrial → release_ready → released → translocation_ready →
  execution_active` (plus `suppressed_by_knockdown`)

## Honesty boundaries

- No ΔΨm voltage, no cytochrome-c/AIF concentration or release fraction, no MOMP pore count,
  no timing in real hours — all schematic.
- The mitochondrion is a single schematic compartment; no cristae, no permeability-transition
  pore biophysics, no Ca²⁺ handling.
- The pathway stops at the apoptotic single-cell state; nothing downstream of that cell is
  evaluated.
