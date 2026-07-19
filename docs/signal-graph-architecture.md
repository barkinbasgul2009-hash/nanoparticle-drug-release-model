# Signal-Graph Architecture (Profile B, Phase 5B.1)

This document specifies the **frozen** directed-graph architecture for signal
transduction. It defines the schemas, the graph semantics, and the validation rules
that `simulator/src/biology/signalGraph.js` enforces. There is **no runtime engine**:
this phase produces a data model + validator only.

## 1. Design principles

1. **Registry-driven.** Nothing biological is hardcoded in source; every node, edge,
   and evidence record lives in a `signal-*.registry.json` file.
2. **Six separable concerns.** Context, nodes, edges, pathway profiles, evidence, and
   prediction are independent registries and can be validated independently.
3. **Context-keyed, never mixed.** A profile binds exactly one context
   (species + cell model + disease + drug + formulation). No edge crosses species or
   cell models; no pathway is silently transferred across contexts.
4. **Evidence is per-node and per-edge.** Each carries its own `evidence_level`,
   `reference_ids`, `confidence`, and `uncertainty`.
5. **Experimental ≠ prediction.** The two are always distinguishable; a prediction is
   never presented as experimental.
6. **Schematic activity only.** Node activity is normalized (0.0–1.0) or ordinal
   (0–3) — never concentration, phosphorylation %, protein abundance, receptor
   occupancy, or therapeutic effect.
7. **The graph stops before gene regulation.** Forbidden node types (gene, mRNA,
   ribosome, translated protein, apoptosis, proliferation, PK, …) are not representable.

## 2. `SignalingNode` schema

Fields (see `simulator/src/types/signaling.ts`): `profile_id`, `canonical_name`,
`display_name`, `aliases`, `node_type`, `species`, `cell_model`, `disease_context`,
`compartment`, `baseline_state`, `allowed_states`, `effect_direction`,
`upstream_nodes`, `downstream_nodes`, `evidence_level`, `reference_ids`, `confidence`,
`uncertainty`, `measured_readout`, `measurement_method`, `reported_timepoints`,
`formulation_specific`, `drug_specific`, `context_specific`, `notes`.

**Allowed node types:** `molecular_target`, `second_messenger`, `reactive_species`,
`kinase`, `phosphatase`, `transcription_factor`, `ion_channel_complex`,
`calcium_signal`, `regulatory_state`, `signaling_output`, `pathway_placeholder`.

**Phosphorylation-state architecture.** Kinase nodes carry phospho-relevant
`allowed_states` (`unphosphorylated`, `partially_activated`, `phosphorylated_active`,
`inhibited`) as **discrete schematic states** — never a phosphorylation percentage.

**Transcription-factor boundary.** A transcription factor (e.g. Nrf2, NF-κB) may reach
a `nuclear_localized` state, but the graph **stops there** — no DNA binding,
transcription, or gene regulation.

## 3. `SignalingEdge` schema

Fields: `profile_id`, `source`, `target`, `relationship_type`, `direction`,
`required`, `effect_strength`, `temporal_order`, `delay_basis`, `evidence_level`,
`reference_ids`, `confidence`, `uncertainty`, `formulation_specific`, `drug_specific`,
`species_specific`, `cell_model_specific`, `measurement_basis`, `notes`.

**Relationship types:** `activation`, `inhibition`, `required`, `permissive`,
`amplification`, `attenuation`, `positive_feedback`, `negative_feedback`, `recovery`,
`adaptation`, `desensitization`, `translocation`, `phosphorylation`,
`dephosphorylation`, `association`, `dissociation`.

**Direction.** `forward` or, when uncertain, `unresolved` — directionality is never
invented.

**Activation / inhibition semantics.** An edge only records the *sign* and *type* of a
relationship. Any future runtime maps this onto schematic normalized activity
(0.0–1.0) or the ordinal ladder (0=inactive, 1=low, 2=moderate, 3=high). No
concentrations or rate constants are stored.

**Amplification / attenuation.** `effect_strength` is **qualitative** only
(`low`/`moderate`/`high`/`not_reported`) — never a fold-change, rate constant, or
percentage.

**Time architecture.** `temporal_order` is a **schematic ordinal** (the relative step
in the cascade), explicitly **not** a biological timestamp. `delay_basis` records why an
ordering is asserted; where no timing is reported it is `NOT_REPORTED`. This separates
**biological time** (not claimed) from **schematic simulation ordering** (all a future
engine may use).

## 4. Graph semantics

- A **profile** is a directed graph over its own node set, closed under its own edge
  set (edges never leave the profile).
- Every accepted profile is a **DAG**. A cycle is permitted **only** if it is closed by
  a declared typed-feedback edge (`positive_feedback`, `negative_feedback`, `recovery`,
  `adaptation`, `desensitization`). In 5B.1 **no feedback/crosstalk edge is asserted**
  (feedback = NOT REPORTED); the capability exists for a later phase.
- **Compartments** (`cytoplasm`, `nucleus`, `membrane`, `extracellular`) are recorded
  per node; a `translocation` edge represents a schematic compartment change (e.g.
  Nrf2 cytoplasm→nucleus) without simulating nuclear-pore transport.
- **Target-engagement gating.** Because the Phase-5A molecular target is NOT REPORTED,
  no target-mediated start exists; every profile starts from a declared
  `drug_exposure` condition (or `none` for rat).

## 5. Validation rules (enforced by `signalGraph.js`)

`SignalGraph.validate()` returns `{ ok, errors[], warnings[] }` and checks:

1. Unique node ids; unique edge ids.
2. Every edge references existing source/target nodes (**no orphan edges**).
3. No edge mixes species or cell models; no edge crosses profiles.
4. Every profile is a DAG **unless** a cycle is a declared typed-feedback cycle.
5. Forbidden node types are absent; node types are within `node_types_allowed`.
6. Each non-empty profile declares a `start_condition` and a `stop_condition`.
7. Every node/edge `evidence_level` is a valid `SIGNAL_EVIDENCE_LEVELS` value and is
   unambiguously experimental **or** prediction (never both).
8. Referenced evidence ids resolve to reference records (unresolved → warning).
9. Profile membership is consistent (a profile only claims nodes/edges it owns).
10. `NOT_REPORTED` profiles are empty (no silent transfer).

## 6. What is deliberately excluded

No propagation, activation/inhibition at runtime, phosphorylation dynamics, animation,
rendering, or UI. No transcription, translation, protein synthesis, gene regulation,
apoptosis, proliferation, cell cycle, tumour killing, immune response, toxicity, PK, or
clinical efficacy. This architecture is **frozen** as the contract for Phase 5B.2.
