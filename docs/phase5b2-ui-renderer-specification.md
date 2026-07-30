# Phase 5B.2 UI & Renderer Specification (forward-looking; NOT implemented in 5B.1)

This document specifies how a **future** Phase 5B.2 should render and control the
signaling graph. **Nothing here is implemented in Phase 5B.1** — 5B.1 delivered data +
validator + types only. This spec is the contract a later phase must honour so the
frozen architecture and its evidence discipline survive into the UI.

## 1. Non-negotiable inheritance from 5B.1

- The renderer/engine **consumes** the six `signal-*.registry.json` files and the
  `SignalGraph` validator. It must call `SignalGraph.validate()` and refuse to run a
  profile that does not validate.
- **Evidence gating on animation.** A node/edge may animate **only** if
  `signalLevelAnimates(level)` is true. `NOT_REPORTED` and `UNAVAILABLE` must never
  animate — they render as explicit "Not Reported" placeholders.
- **Experimental vs prediction must remain visually distinct** (see §4).
- **No downstream biology.** The renderer stops at signaling outputs; it must never draw
  transcription, translation, apoptosis, proliferation, tumour killing, immune
  response, PK, or PD.

## 2. Layout

- One profile at a time, bound to the active context (species + cell model). Never draw
  two species/cell models in the same graph.
- Left-to-right or top-to-bottom **DAG layout**; the H1 diamond (ROS → {ERK, p38} →
  Nrf2) must read as a fork/merge.
- Compartment bands: `membrane` → `cytoplasm` → `nucleus`. A `translocation` edge (e.g.
  Nrf2 → ARE) crosses the cytoplasm→nucleus band; the graph still stops at the nuclear
  boundary conceptually (no transcription).

## 3. Node & edge visual language

- **Node glyph by type:** reactive_species, kinase, phosphatase, transcription_factor,
  regulatory_state, signaling_output, pathway_placeholder each get a distinct schematic
  glyph (no photorealism).
- **Activity encoding:** normalized schematic activity 0.0–1.0 (or ordinal
  inactive/low/moderate/high) mapped to fill intensity or a small gauge — **never** a
  number implying concentration or phosphorylation %.
- **Phosphorylation state:** a discrete badge for `unphosphorylated` /
  `partially_activated` / `phosphorylated_active` / `inhibited` — discrete states, not a
  percentage.
- **Edge sign:** activation = arrowhead; inhibition = bar/⊣; translocation = dashed
  arrow across a compartment band; feedback types (if ever added) = a curved
  distinctly-styled edge.
- **Effect strength:** if shown, qualitative only (low/moderate/high) — never numeric.

## 4. Evidence overlay (mandatory)

- Each node and edge shows its evidence tier: **experimental** (solid/filled) vs
  **prediction** (outlined/hatched), mirroring the transport/pharmacology convention
  used in earlier phases.
- A per-element tooltip/badge shows `evidence_level`, `reference_ids`, `confidence`, and
  `verification_status`. Canonical relationships display "canonical general biology (no
  context-specific citation)"; celastrol claims display "UNVERIFIED_IN_REPO".
- A profile-level banner states the honest position: "Signaling is exposure-driven
  prediction; the frozen package reports no signaling; molecular target NOT REPORTED".

## 5. Time & controls

- Time is **schematic ordinal** (the `temporal_order` step), not biological time. A
  step/scrub control advances the cascade by ordinal step; it must not display a
  biological timestamp unless `delay_basis` provides one (currently all NOT_REPORTED).
- A species/context selector switches profiles; switching must clear all runtime
  signaling state (as `app.setSpecies` clears downstream layers today).
- Rat selection shows an explicit "Signal transduction: NOT REPORTED" state — no empty
  canvas that could be misread as "nothing happens".

## 6. Integration with existing layers

- Signaling is a **separate layer** stepped **after** target engagement, reading it (and
  intracellular drug) read-only and modifying nothing upstream — the same discipline as
  every prior engine.
- The evidence panel gains an eighth section, "Signal Transduction", showing the active
  profile's summary evidence level (or NOT_REPORTED).

## 7. Acceptance criteria for 5B.2

1. Runs only validated profiles; refuses invalid graphs.
2. NOT_REPORTED / UNAVAILABLE never animate.
3. Experimental and prediction are visually distinguishable at a glance.
4. No numeric concentration / phosphorylation-% / rate constant is ever shown.
5. No species/cell-model mixing on screen; rat is an explicit NOT REPORTED state.
6. No downstream biology is rendered.
7. Previous phases remain unchanged; production untouched.
