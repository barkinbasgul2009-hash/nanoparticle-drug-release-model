# Population State Machine (Phase 6C)

The population layer runs a **strict** finite-state machine over the schematic population
composition. It is the population analogue of the Phase-6B single-cell FSM: recoverable early
states, an irreversibility gate, and no path back once the population is apoptosis-dominant.

## States

```
healthy → minimal_response → adaptive_response → partial_response
  → mixed_population → apoptosis_accumulating → apoptosis_dominant → stable_terminal_state
```

| State | Meaning |
|---|---|
| `healthy` | no meaningful stress; apoptotic negligible |
| `minimal_response` | detectable schematic stress; apoptotic still negligible |
| `adaptive_response` | surviving cells adapt; apoptotic still low |
| `partial_response` | a minority sub-population is apoptotic; living clearly dominant |
| `mixed_population` | apoptotic and living fractions comparable |
| `apoptosis_accumulating` | apoptotic is the majority and still rising |
| `apoptosis_dominant` | apoptotic past the dominance threshold (**irreversible**) |
| `stable_terminal_state` | apoptotic plateaued at its ceiling (**irreversible** terminal) |

Idle contexts use `not_reported` / `unavailable`.

## Legal transitions (`population-transitions.registry.json`)

```
healthy               → [minimal_response]
minimal_response      → [adaptive_response, healthy]
adaptive_response     → [partial_response, minimal_response]
partial_response      → [mixed_population, adaptive_response]
mixed_population      → [apoptosis_accumulating, partial_response]
apoptosis_accumulating→ [apoptosis_dominant, mixed_population]
apoptosis_dominant    → [stable_terminal_state]
stable_terminal_state → []
```

- **Recoverable states:** `minimal_response`, `adaptive_response`, `partial_response`,
  `mixed_population`, `apoptosis_accumulating` (each has a backward edge).
- **Irreversible states:** `apoptosis_dominant`, `stable_terminal_state` (no backward edge).

`transitionTo(next)` throws on any transition not listed here. `validate()` proves that no
irreversible state has a legal edge back to a recoverable state (or to `healthy`).

## How the state is chosen each tick

1. **Derive a target** from the composition against `composition_thresholds` on the apoptotic
   fraction (plus the schematic stress / adaptation signals for the low-apoptosis states):
   `apoptotic_partial < apoptotic_mixed < apoptotic_accumulating < apoptotic_dominant`.
2. **Advance at most one legal step** toward the target:
   - target index > current → step **forward** one state;
   - target index < current **and** current is recoverable → step **backward** one state
     (recovery);
   - otherwise stay.

Because the FSM moves one step per tick, every intermediate state is visited (and appears in
the timeline) even when the composition jumps.

## Recovery semantics

- Recovery (backward transitions) is legal **only before** `apoptosis_dominant`.
- Recovery reclassifies **surviving** cells only; it **never** lowers the apoptotic fraction —
  committed apoptotic cells are never resurrected. In practice, once the apoptotic fraction is
  high the composition target stays high, so backward transitions occur only among the
  low-apoptosis stress states (e.g. stress relieved → `partial_response` → `adaptive_response`).

## Terminal state

While in `apoptosis_dominant`, once the apoptotic fraction has **plateaued**
(`ΔA < terminal_epsilon`) for `terminal_plateau_hours`, the FSM transitions to
`stable_terminal_state` and emits `population_stabilized` then `terminal_population_state`.

## Forbidden by construction

No transition can resurrect apoptotic cells, spontaneously grow the population, or add cells:
`livingFraction + apoptoticFraction = 1` always, and the apoptotic fraction is monotonic — so
there is no proliferation, no mitosis, and no population growth anywhere in the machine.
