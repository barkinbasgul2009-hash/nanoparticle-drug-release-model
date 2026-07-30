# Gene Regulation & Transcription (Profile B, Phase 5C)

Architecture, runtime, registries, and animation for the transcription layer
(`simulator/src/biology/transcriptionEngine.js`). It consumes the Phase-5B.2 signal
output and the transcription registry **read-only** and drives:

```
TF activation → nuclear translocation → DNA promoter binding → gene transcription → mRNA
```

The chain **stops at mRNA**.

## 1. Objects

`simulator/src/biology/transcriptionObjects.js`:

- **`TranscriptionFactor`** — id, name, family, species, cell_model, `sourceSignalNode`,
  prediction/evidence level, confidence, rationale, delays; runtime: state, activity,
  location, activation/deactivation time, boundPromoters.
- **`PromoterRegion`** — geneId, responseElement, bindingSites, chromatin, prediction
  level, `bindingTfs` (each with relationship activation/suppression + weight + evidence);
  runtime: occupied, occupancy, accessible.
- **`Gene`** — symbol, species, promoterId, basalExpression, prediction/evidence level,
  transcription delay, rationale; runtime: expressionFrac (internal 0–1), expressionState
  (snapped bucket), polymerase, transcribeStartTime.
- **`MessengerRNA`** — id, gene, decayRate, halfLife (`NOT_REPORTED`), prediction level;
  runtime: level (0–1), copyState, birthTime, degrading.

## 2. DNA model (schematic only)

No chromosomes, no sequence, no epigenetic chemistry. DNA is represented by named
**response elements** on promoters: `ARE`, `NF-κB response element`, etc. Chromatin is a
three-level schematic: `closed` / `partially_open` / `open`.

## 3. Transcription-factor state machine

`inactive → activated → cytoplasmic → nuclear → dna_bound → released → (degraded)`.

- **Activation:** the TF's activity is inherited from its source signaling node; it
  activates when that activity crosses the TF's threshold.
- **Nuclear translocation:** schematic movement cytoplasm → nucleus after the activation +
  translocation delays (no molecular dynamics).
- **DNA binding:** in the nucleus, after the binding delay, the TF binds accessible
  promoters (association); when the signal falls it releases (dissociation).
- All transitions are deterministic.

## 4. Binding engine

Association / dissociation / occupancy / competition:

- A promoter has N binding sites; occupancy = bound TFs / N.
- **Multiple TFs** may bind one promoter (e.g. the inflammatory promoter receives NF-κB
  activation **and** Nrf2 suppression → competition).
- **Multiple genes** may be driven by one TF (Nrf2 → HMOX1 **and** NQO1 → branching).

## 5. Gene expression + RNA polymerase

- Net promoter drive = Σ over bound TFs of `sign · weight · (TF activity − TF baseline)`,
  scaled by chromatin gain. Measuring relative to the TF baseline makes an **activated** TF
  raise the gene above basal and a **suppressed** baseline TF (NF-κB) lower it below basal.
- The stimulated response begins only after the promoter is occupied **and** the
  **transcription delay** elapses — signaling never instantly changes mRNA.
- Expression is snapped to `{0, 25, 50, 75, 100}` — never a fold-change.
- RNA polymerase is schematic: `not_recruited → recruiting → bound → transcribing →
  released`, following expression.

## 6. mRNA

- Copy state is schematic (`none/low/moderate/high`); basal mRNA is present at init.
- Birth/induction is recorded (with delay) when stimulated expression rises above basal.
- Degradation (a schematic decay rate) occurs when transcription stops; half-life is
  `NOT_REPORTED`. No molecule count is invented.

## 7. Transcription registry

`simulator/data/transcription.registry.json` — species-keyed profiles:

- **`human_hacat` (ACTIVE):** TFs `tf_nrf2` (← `h1_nrf2`), `tf_nfkb` (← `h2_nfkb`);
  promoters `p_are_hmox1`, `p_are_nqo1`, `p_nfkb_infl`; genes `g_hmox1` (HMOX1),
  `g_nqo1` (NQO1), `g_infl` (schematic NF-κB target) with mRNA each.
- **`mouse_b16bl6` / `rat_skin` (NOT_REPORTED):** empty. The mouse signal graph has no
  transcription-factor node and there is no transcription evidence; rat has no cellular
  signaling profile. No human profile is transferred.

`vocabularies` and `defaults` (delays, thresholds, decay, dt) are registry-driven; no
scientific value is hardcoded in source.

## 8. Animation specification

Publication-style, headless-testable via `renderer.lastTranscriptionFrame`
(`{ tfs, promoters, genes }`), painted in a reserved band above the signaling diagram:

- **Transcription factors** — glyph on a col/row grid; violet outline + `⌁` badge when
  predicted; fill/position reflects nuclear vs cytoplasmic location; label shows state.
- **Nuclear entry** — the TF glyph moves to the nucleus row on translocation.
- **Promoter highlights + DNA binding** — an occupancy ring proportional to occupancy.
- **RNA polymerase / gene-activation glow** — gene glyph glow scales with expression;
  the polymerase state is exposed in the frame.
- **Emerging mRNA** — a small dot appears at a gene once its mRNA level rises.
- Everything schematic; no artistic DNA, no gaming effects; predictions always distinct.

## 9. Boundaries

Stops at mRNA. No translation, ribosomes, proteins, enzymes, metabolism, cell cycle,
apoptosis, immune/tissue response, PK/PD, toxicity, or phenotype.
