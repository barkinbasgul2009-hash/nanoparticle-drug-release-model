// Transcription engine (Phase 5C). The first biological RESPONSE downstream of signaling:
//
//   signal propagation -> TF activation -> nuclear translocation -> DNA promoter binding
//     -> gene transcription -> mRNA production   [STOP - no translation/protein/etc.]
//
// It is a SEPARATE layer. It reads (read-only) the Phase-5B.2 SignalPropagationEngine for
// transcription-factor activity and the transcription registry; it modifies NO upstream
// engine. Deterministic (pure arithmetic, no RNG, fixed-dt). Everything is schematic:
// activities are 0-1, gene expression is a snapped level bucket {0,25,50,75,100}, mRNA is
// a copy STATE (none/low/moderate/high) - never a fold-change, rate, or molecule count.
//
// The frozen Profile-B package has NO transcription data, so gene regulation is mostly a
// LABELLED PREDICTION; nothing is EXPERIMENTAL unless the registry carries a real
// experimental reference (none does). Experimental always takes priority over prediction.

import { TranscriptionFactor, PromoterRegion, Gene, MessengerRNA, snapExpression, copyState } from './transcriptionObjects.js';
import { isGeneEvidenceLevel, isGeneExperimental, isGenePrediction } from '../evidence/evidenceEngine.js';

export class TranscriptionEngine {
  /**
   * @param {{
   *   registry: any,
   *   signalEngine: import('./signalPropagationEngine.js').SignalPropagationEngine,
   *   species?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.registry || !deps.signalEngine) {
      throw new Error('TranscriptionEngine requires registry + signalEngine');
    }
    this.reg = deps.registry;
    this.signal = deps.signalEngine; // read-only source of TF activity
    this.logger = deps.logger || null;
    this.defaults = this.reg.defaults || {};
    this.species = deps.species || 'human';
    this._build();
  }

  // ---- construction ------------------------------------------------------

  _profileForSpecies() {
    const profs = this.reg.profiles || {};
    return Object.values(profs).find((p) => p.species === this.species) || null;
  }

  _build() {
    /** @type {Map<string,TranscriptionFactor>} */ this.tfs = new Map();
    /** @type {Map<string,PromoterRegion>} */ this.promoters = new Map();
    /** @type {Map<string,Gene>} */ this.genes = new Map();
    /** @type {Map<string,MessengerRNA>} */ this.mrnas = new Map();
    this.timeH = 0;
    this._stepCount = 0;
    this.timeline = [];

    const p = this._profileForSpecies();
    this.profile = p;
    this.summaryLevelName = p ? (p.summary_level || 'NOT_REPORTED') : 'NOT_REPORTED';
    if (!p || p.status !== 'ACTIVE') return; // NOT_REPORTED / absent -> idle

    for (const [id, def] of Object.entries(p.transcription_factors || {})) {
      this.tfs.set(id, new TranscriptionFactor(id, { ...def, species: this.species, cell_model: p.cell_model }));
    }
    for (const [id, def] of Object.entries(p.promoters || {})) {
      this.promoters.set(id, new PromoterRegion(id, def));
    }
    for (const [id, def] of Object.entries(p.genes || {})) {
      const g = new Gene(id, { ...def, species: this.species });
      this.genes.set(id, g);
      if (def.mrna) { const m = new MessengerRNA(def.mrna, id); m.level = g.basalExpression / 100; m.copyState = copyState(m.level); this.mrnas.set(id, m); }
    }
  }

  /** Baseline activity of a TF's source signal node (0 for activation-driven; ~baseline
   * for a constitutively-active node like NF-kB). Drive is measured RELATIVE to this so
   * a suppressed baseline TF lowers its target genes and an activated TF raises them. */
  _tfBaseline(tf) {
    const n = this.signal && this.signal.node ? this.signal.node(tf.sourceSignalNode) : null;
    return n && n.baselineActive ? (n.baseline || 0) : 0;
  }

  /** Idle when there is no ACTIVE transcription profile for the species (mouse/rat). */
  isIdle() { return this.genes.size === 0; }

  // ---- runtime -----------------------------------------------------------

  restart() {
    for (const tf of this.tfs.values()) { tf.state = 'inactive'; tf.activity = 0; tf.location = 'cytoplasm'; tf.activationTime = null; tf.deactivationTime = null; tf.boundPromoters = []; tf._activatedAt = null; tf._nuclearAt = null; }
    for (const pr of this.promoters.values()) { pr.occupied = 0; pr.occupancy = 0; pr.accessible = pr.chromatin !== 'closed'; }
    for (const g of this.genes.values()) { g.expressionFrac = g.basalExpression / 100; g.expressionState = g.basalExpression; g.polymerase = 'not_recruited'; g.transcribeStartTime = null; }
    for (const [gid, m] of this.mrnas.entries()) { const g = this.genes.get(gid); m.level = g ? g.basalExpression / 100 : 0; m.copyState = copyState(m.level); m.birthTime = null; m.degrading = false; }
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    return this;
  }
  reset() { return this.restart(); }

  _srcActivity(tf) {
    if (this.signal.isIdle && this.signal.isIdle()) return 0;
    const n = this.signal.node(tf.sourceSignalNode);
    return n ? n.activity : 0;
  }

  /** One deterministic transcription step over dt hours. */
  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.defaults.dt_hours ?? 0.5);
    if (this.isIdle()) { this.timeH += dt; this._stepCount += 1; return []; }
    const events = [];
    const bindThresh = this.defaults.binding_threshold ?? 0.3;

    // 1) TF activity inherited from the signaling node; advance TF state machine.
    for (const tf of this.tfs.values()) {
      const src = this._srcActivity(tf);
      tf.activity = src;
      const above = src >= tf.activationThreshold;
      if (above && (tf.state === 'inactive' || tf.state === 'released' || tf.state === 'degraded')) {
        tf.state = 'activated'; tf.location = 'cytoplasm'; tf.activationTime = this.timeH; tf._activatedAt = this.timeH; tf._nuclearAt = null;
        this.timeline.push({ timeH: r2(this.timeH), kind: 'tf', id: tf.id, event: 'activated' });
        events.push({ type: 'transcription:tf_activated', id: tf.id, timeH: this.timeH });
      }
      if (tf.state === 'activated' && this.timeH - tf._activatedAt >= tf.activationDelayH) {
        tf.state = 'cytoplasmic';
      }
      if (tf.state === 'cytoplasmic' && this.timeH - tf._activatedAt >= tf.activationDelayH + tf.translocationDelayH) {
        tf.state = 'nuclear'; tf.location = 'nucleus'; tf._nuclearAt = this.timeH;
        this.timeline.push({ timeH: r2(this.timeH), kind: 'tf', id: tf.id, event: 'nuclear' });
        events.push({ type: 'transcription:tf_nuclear', id: tf.id, timeH: this.timeH });
      }
      if ((tf.state === 'nuclear' || tf.state === 'dna_bound') && !above) {
        // signal fell -> release from DNA, return toward inactive
        if (tf.boundPromoters.length) tf.boundPromoters = [];
        tf.state = 'released'; tf.location = 'cytoplasm'; tf.deactivationTime = this.timeH;
        this.timeline.push({ timeH: r2(this.timeH), kind: 'tf', id: tf.id, event: 'released' });
      }
    }

    // 2) Promoter binding (association / dissociation / occupancy / competition).
    for (const pr of this.promoters.values()) {
      pr.accessible = pr.chromatin !== 'closed';
      let boundCount = 0;
      for (const b of pr.bindingTfs) {
        const tf = this.tfs.get(b.tfId);
        b._bound = false;
        if (!tf || !pr.accessible) continue;
        const canBind = (tf.state === 'nuclear' || tf.state === 'dna_bound')
          && (this.timeH - (tf._nuclearAt ?? this.timeH)) >= tf.bindingDelayH
          && tf.activity >= bindThresh;
        if (canBind) {
          b._bound = true; boundCount += 1;
          if (tf.state === 'nuclear') { tf.state = 'dna_bound'; this.timeline.push({ timeH: r2(this.timeH), kind: 'tf', id: tf.id, event: 'dna_bound' }); events.push({ type: 'transcription:dna_bound', id: tf.id, timeH: this.timeH }); }
          if (!tf.boundPromoters.includes(pr.id)) tf.boundPromoters.push(pr.id);
        }
      }
      pr.occupied = Math.min(pr.bindingSites, boundCount);
      pr.occupancy = pr.bindingSites ? pr.occupied / pr.bindingSites : 0;
    }

    // 3) Gene expression driven by net promoter drive (activation - suppression),
    //    gated by chromatin accessibility, with a transcription delay; snap to a level.
    const relax = this.defaults.expression_relax_per_hour ?? 0.5;
    const chromGain = { closed: 0, partially_open: 0.6, open: 1.0 };
    for (const g of this.genes.values()) {
      const pr = this.promoters.get(g.promoterId);
      const basal = g.basalExpression / 100;
      // Net promoter drive, measured RELATIVE to each TF's baseline so an activated TF
      // raises the gene above basal and a suppressed baseline TF lowers it below basal.
      let drive = 0;
      let anyBound = false;
      if (pr && pr.accessible) {
        for (const b of pr.bindingTfs) {
          if (!b._bound) continue;
          anyBound = true;
          const tf = this.tfs.get(b.tfId);
          const sign = b.relationship === 'suppression' ? -1 : 1;
          const net = tf ? (tf.activity - this._tfBaseline(tf)) : 0; // + above baseline, - suppressed
          drive += sign * b.weight * net;
        }
        drive *= (chromGain[pr.chromatin] ?? 1.0);
      }
      // Target expression: basal shifted by the (delayed) drive. Positive drive raises
      // toward 1, negative drive lowers toward 0.
      const target = Math.max(0, Math.min(1, drive >= 0 ? basal + drive * (1 - basal) : basal + drive * basal));

      // Transcription delay: the STIMULATED response (above/below basal) only begins after
      // the promoter is occupied AND the transcription delay has elapsed. Until then the
      // gene sits at basal - signaling never instantly changes mRNA.
      const stimulated = anyBound && Math.abs(target - basal) > 0.02;
      if (stimulated && g.transcribeStartTime == null) g.transcribeStartTime = this.timeH + g.transcriptionDelayH;
      if (!stimulated) g.transcribeStartTime = null;
      const delayCleared = g.transcribeStartTime != null && this.timeH >= g.transcribeStartTime;
      const effTarget = delayCleared ? target : basal;
      g.expressionFrac += (effTarget - g.expressionFrac) * Math.min(1, relax * dt);
      g.expressionFrac = Math.max(0, Math.min(1, g.expressionFrac));
      const prevState = g.expressionState;
      g.expressionState = snapExpression(g.expressionFrac);

      // Schematic RNA-polymerase state.
      const before = g.polymerase;
      if (stimulated && !delayCleared) g.polymerase = 'recruiting';
      else if (g.expressionFrac < 0.05) g.polymerase = 'not_recruited';
      else if (g.expressionFrac < 0.2) g.polymerase = 'bound';
      else g.polymerase = 'transcribing';
      if (before !== 'transcribing' && g.polymerase === 'transcribing') {
        this.timeline.push({ timeH: r2(this.timeH), kind: 'gene', id: g.id, event: 'transcribing' });
        events.push({ type: 'transcription:transcribing', id: g.id, timeH: this.timeH });
      }
      if (delayCleared && prevState !== g.expressionState) {
        this.timeline.push({ timeH: r2(this.timeH), kind: 'gene', id: g.id, event: `expression_${g.expressionState}`, direction: g.expressionState > prevState ? 'up' : 'down' });
      }

      // 4) mRNA production + degradation (schematic copy state; basal mRNA present at init).
      const m = this.mrnas.get(g.id);
      if (m) {
        const producing = g.polymerase === 'transcribing';
        // "induced" = stimulated expression has risen above basal (a genuine new transcript
        // birth for basal-0 genes, or induction above basal otherwise).
        if (delayCleared && m.birthTime == null && g.expressionFrac > basal + 0.05) {
          m.birthTime = this.timeH;
          this.timeline.push({ timeH: r2(this.timeH), kind: 'mrna', id: m.id, event: basal < 0.05 ? 'born' : 'induced' });
          events.push({ type: 'transcription:mrna_induced', id: m.id, timeH: this.timeH });
        }
        m.degrading = !producing && m.level > (basal + 0.01);
        // mRNA level tracks expression (with production lag) and decays toward it otherwise.
        m.level += (g.expressionFrac - m.level) * Math.min(1, relax * dt);
        m.level = Math.max(0, Math.min(1, m.level));
        m.copyState = copyState(m.level);
      }
    }

    this.timeH += dt; this._stepCount += 1;
    return events;
  }

  run(steps, dtHours) { const ev = []; for (let i = 0; i < steps; i++) ev.push(...this.step(dtHours)); return ev; }
  stepOnce(dtHours) { return this.step(dtHours); }

  setSpecies(speciesId) { this.species = speciesId; this._build(); this._log('info', 'transcription', `species -> ${speciesId} (${this.genes.size} genes)`); return this; }

  // ---- accessors / frame -------------------------------------------------

  tf(id) { return this.tfs.get(id) || null; }
  gene(id) { return this.genes.get(id) || null; }
  promoter(id) { return this.promoters.get(id) || null; }
  mrna(geneId) { return this.mrnas.get(geneId) || null; }
  getTimeline() { return this.timeline.slice(); }

  summaryLevel() { return this.isIdle() ? 'NOT_REPORTED' : (this.summaryLevelName || 'PREDICTIVE'); }
  summaryMessage() {
    if (this.isIdle()) return `Gene regulation: Not Reported for ${this.species} (no transcription-factor node / no evidence).`;
    return `Gene regulation: Predictive (exposure-driven) - ${this.tfs.size} TFs, ${this.genes.size} genes; mostly mechanistic predictions.`;
  }

  stats() {
    let nuclear = 0, bound = 0, transcribing = 0, mrnaProduced = 0;
    for (const tf of this.tfs.values()) { if (tf.state === 'nuclear' || tf.state === 'dna_bound') nuclear += 1; if (tf.state === 'dna_bound') bound += 1; }
    for (const g of this.genes.values()) if (g.polymerase === 'transcribing') transcribing += 1;
    for (const m of this.mrnas.values()) if (m.level > 0.05) mrnaProduced += 1;
    let maxExpr = 0; for (const g of this.genes.values()) maxExpr = Math.max(maxExpr, g.expressionState);
    return { tfs: this.tfs.size, genes: this.genes.size, promoters: this.promoters.size, nuclearTfs: nuclear, dnaBoundTfs: bound, transcribingGenes: transcribing, mrnaProduced, maxExpression: maxExpr, timeH: r2(this.timeH), steps: this._stepCount };
  }

  /** Publication-style render frame (headless-testable). */
  frame() {
    const tfs = [...this.tfs.values()].map((tf) => ({
      id: tf.id, name: tf.name, state: tf.state, location: tf.location, activity: r3(tf.activity),
      predicted: isGenePrediction(tf.predictionLevel), predictionLevel: tf.predictionLevel, evidenceLevel: tf.evidenceLevel,
      confidence: tf.confidence, boundPromoters: tf.boundPromoters.slice(), layout: tf.layout,
    }));
    const promoters = [...this.promoters.values()].map((pr) => ({
      id: pr.id, geneId: pr.geneId, responseElement: pr.responseElement, occupancy: r3(pr.occupancy),
      occupied: pr.occupied, sites: pr.bindingSites, chromatin: pr.chromatin, accessible: pr.accessible,
      predictionLevel: pr.predictionLevel, layout: pr.layout,
    }));
    const genes = [...this.genes.values()].map((g) => {
      const m = this.mrnas.get(g.id);
      return {
        id: g.id, symbol: g.symbol, expressionState: g.expressionState, expressionFrac: r3(g.expressionFrac),
        polymerase: g.polymerase, predicted: isGenePrediction(g.predictionLevel), predictionLevel: g.predictionLevel,
        evidenceLevel: g.evidenceLevel, confidence: g.confidence, layout: g.layout,
        mrna: m ? { id: m.id, level: r3(m.level), copyState: m.copyState, degrading: m.degrading, predictionLevel: m.predictionLevel } : null,
      };
    });
    return { tfs, promoters, genes, timeH: r2(this.timeH), summaryLevel: this.summaryLevel() };
  }

  // ---- validation --------------------------------------------------------

  /** Validate the transcription profiles. Returns { ok, errors[], warnings[] }. */
  validate() {
    const errors = []; const warnings = [];
    const profs = this.reg.profiles || {};
    for (const [pid, p] of Object.entries(profs)) {
      const tfIds = new Set(Object.keys(p.transcription_factors || {}));
      const promIds = new Set(Object.keys(p.promoters || {}));
      const geneIds = new Set();
      // NOT_REPORTED profiles must be empty (no silent transfer).
      if (p.status === 'NOT_REPORTED') {
        if (Object.keys(p.transcription_factors || {}).length || Object.keys(p.promoters || {}).length || Object.keys(p.genes || {}).length) {
          errors.push(`profile ${pid} is NOT_REPORTED but not empty`);
        }
        continue;
      }
      // duplicate genes / promoters (object keys unique; guard symbol dupes + gene refs)
      const symbols = new Set();
      for (const [gid, g] of Object.entries(p.genes || {})) {
        geneIds.add(gid);
        if (symbols.has(g.symbol)) errors.push(`duplicate gene symbol in ${pid}: ${g.symbol}`);
        symbols.add(g.symbol);
        if (!g.evidence_level || !isGeneEvidenceLevel(g.evidence_level)) errors.push(`gene ${gid} invalid evidence_level`);
        if (isGeneExperimental(g.evidence_level)) warnings.push(`gene ${gid} claims EXPERIMENTAL - requires a real reference (none expected for Profile B)`);
        if (!p.promoters || !p.promoters[g.promoter_id]) errors.push(`gene ${gid} references missing promoter: ${g.promoter_id}`);
      }
      // promoters: gene refs, TF refs, species consistency
      const promoterGeneTargets = new Set();
      for (const [prid, pr] of Object.entries(p.promoters || {})) {
        if (!geneIds.has(pr.gene_id)) errors.push(`promoter ${prid} references missing gene: ${pr.gene_id}`);
        promoterGeneTargets.add(pr.gene_id);
        for (const b of (pr.binding_tfs || [])) {
          if (!tfIds.has(b.tf_id)) errors.push(`promoter ${prid} references missing TF: ${b.tf_id}`);
          if (b.relationship && b.relationship !== 'activation' && b.relationship !== 'suppression') errors.push(`promoter ${prid} invalid relationship: ${b.relationship}`);
        }
      }
      // orphan genes (a gene whose promoter is never listed, or promoter without a gene)
      for (const gid of geneIds) {
        const g = p.genes[gid];
        const pr = (p.promoters || {})[g.promoter_id];
        if (pr && pr.gene_id !== gid) errors.push(`gene ${gid} promoter ${g.promoter_id} points at a different gene (${pr.gene_id})`);
      }
      // species mismatch: TF source nodes must be in the signal graph for this species
      for (const [tid, tf] of Object.entries(p.transcription_factors || {})) {
        if (p.species && this.signal && this.signal.species && p.species === this.signal.species) {
          if (this.signal.node && !this.signal.node(tf.source_signal_node) && !this.signal.isIdle()) {
            warnings.push(`TF ${tid} source signal node not present for current species: ${tf.source_signal_node}`);
          }
        }
        if (!isGeneEvidenceLevel(tf.evidence_level)) errors.push(`TF ${tid} invalid evidence_level`);
      }
      // cycle detection: a gene must not (transitively) drive a TF that drives itself.
      // Genes here produce mRNA only (no TF feedback wired), so any gene->TF link is a cycle.
      for (const g of Object.values(p.genes || {})) {
        if (g.encodes_tf && tfIds.has(g.encodes_tf)) errors.push(`cycle: gene ${g.symbol} encodes TF ${g.encodes_tf} (gene->TF feedback not allowed in 5C)`);
      }
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default TranscriptionEngine;
