// Translation engine (Phase 5D). The runtime layer after transcription:
//
//   mRNA availability -> ribosome recruitment -> translation initiation -> elongation
//     -> termination -> nascent polypeptide -> schematic folding/maturation
//     -> mature protein abundance -> turnover   [STOP - no protein FUNCTION]
//
// SEPARATE layer: reads the Phase-5C TranscriptionEngine (for mRNA) and the translation +
// protein registries READ-ONLY; modifies no upstream engine and never mutates the 5C mRNA
// objects. Deterministic (pure arithmetic, no RNG, fixed-dt). Everything is schematic:
// translation progress + abundance are normalized/bucketed; no rate, ribosome count,
// amino-acid length, half-life, or copy number is a measured value. Protein catalytic
// FUNCTION is never evaluated (functional_state stays not_evaluated).

import { Ribosome, TranslationInitiationComplex, NascentPolypeptide, Protein, snapAbundance, abundanceOrdinal } from './translationObjects.js';
import { isTranslationEvidenceLevel, isTranslationExperimental, isTranslationPrediction, translationLevelActive } from '../evidence/evidenceEngine.js';

export class TranslationEngine {
  /**
   * @param {{
   *   contextRegistry:any, machineryRegistry:any, proteinRegistry:any,
   *   transcriptionEngine: import('./transcriptionEngine.js').TranscriptionEngine,
   *   signalEngine?: object, species?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.contextRegistry || !deps.machineryRegistry || !deps.proteinRegistry || !deps.transcriptionEngine) {
      throw new Error('TranslationEngine requires contextRegistry, machineryRegistry, proteinRegistry, transcriptionEngine');
    }
    this.ctxReg = deps.contextRegistry;
    this.machReg = deps.machineryRegistry;
    this.protReg = deps.proteinRegistry;
    this.transcription = deps.transcriptionEngine; // read-only mRNA source
    this.signal = deps.signalEngine || null;       // optional (for signal-linked capacity)
    this.logger = deps.logger || null;
    this.defaults = this.machReg.defaults || {};
    this.species = deps.species || 'human';
    this._build();
  }

  _profileForSpecies() {
    return Object.values(this.ctxReg.profiles || {}).find((p) => p.species === this.species) || null;
  }

  _build() {
    /** @type {Map<string,object>} */ this.outputs = new Map();
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    const p = this._profileForSpecies();
    this.profile = p;
    this.summaryLevelName = p ? (p.summary_level || 'NOT_REPORTED') : 'NOT_REPORTED';
    this.globalCapacity = 0; this.capacityOrdinal = 'suppressed';
    if (!p || p.status !== 'ACTIVE') return; // NOT_REPORTED / absent -> idle

    // Global translation capacity (constitutive by default; signal-node-linked only if the
    // profile declares it - a labelled prediction, never applied automatically).
    const gc = p.global_capacity || {};
    this._capacityDef = gc;
    this._recomputeCapacity();

    const polysome = this.defaults.polysome_size || 1;
    const proteins = this.protReg.proteins || {};
    for (const [outId, out] of Object.entries(p.outputs || {})) {
      const pdef = proteins[out.protein_id];
      if (!pdef) continue;
      const protein = new Protein(out.protein_id, { ...pdef, species: this.species });
      const ribos = [];
      for (let i = 0; i < polysome; i++) ribos.push(new Ribosome(`${outId}_r${i}`, this.profile.cell_model, this.species));
      this.outputs.set(outId, {
        outId, def: out, protein, ribosomes: ribos,
        initComplexes: new Map(), nascents: [],
        mrnaSource: out.mrna_source, geneEfficiency: typeof out.gene_efficiency === 'number' ? out.gene_efficiency : (this.defaults.gene_efficiency_default ?? 0.8),
        evidenceLevel: out.evidence_level || 'NOT_REPORTED',
        units: [], // {state:'folding'|'mature'|'degrading'|'degraded', bornAt, matureAt, degradeAt}
      });
    }
  }

  _recomputeCapacity() {
    const gc = this._capacityDef || {};
    if (gc.source === 'signal_node_linked' && this.signal && this.signal.node && gc.signal_node) {
      // A profile-declared, labelled prediction: capacity follows an upstream node
      // (e.g. mTOR suppression -> reduced capacity). Only used where the profile permits.
      const n = this.signal.node(gc.signal_node);
      const act = n ? n.activity : (gc.level ?? 0.8);
      const base = gc.baseline != null ? gc.baseline : 0.8;
      this.globalCapacity = Math.max(0, Math.min(1, gc.relationship === 'suppression' ? act : act));
      if (gc.relationship === 'suppression') this.globalCapacity = Math.max(0, Math.min(1, act / (base || 1)));
    } else {
      this.globalCapacity = typeof gc.level === 'number' ? gc.level : (this.defaults.global_capacity_default ?? 0.8);
    }
    this.capacityOrdinal = this.globalCapacity < 0.1 ? 'suppressed' : this.globalCapacity < 0.4 ? 'low' : this.globalCapacity < 0.75 ? 'moderate' : 'high';
  }

  isIdle() { return this.outputs.size === 0; }

  // ---- runtime -----------------------------------------------------------

  restart() {
    for (const o of this.outputs.values()) {
      for (const r of o.ribosomes) { r.state = 'free'; r.boundMrnaId = null; r.positionOnMrna = 0; r.translationProgress = 0; r.currentProteinId = null; r.active = false; r.startTime = null; r.completionTime = null; r._recruitAt = null; r._initAt = null; }
      o.initComplexes.clear(); o.nascents = []; o.units = [];
      const p = o.protein;
      p.state = 'nascent'; p.foldingUnits = 0; p.matureUnits = 0; p.degradingUnits = 0; p.degradedUnits = 0; p.producedUnits = 0;
      p.abundanceFrac = 0; p.abundanceState = 0; p.createdAt = null; p.maturedAt = null; p.degradedAt = null;
    }
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    this._recomputeCapacity();
    return this;
  }
  reset() { return this.restart(); }

  _mrnaFor(o) { return this.transcription && this.transcription.mrna ? this.transcription.mrna(o.def.gene_id) : null; }

  /** Is an mRNA eligible to be translated for this output? (strict gating) */
  _eligible(o, mrna) {
    if (!o.def.translation_available) return false;
    if (o.evidenceLevel === 'UNAVAILABLE' || o.evidenceLevel === 'NOT_REPORTED') return false;
    if (!translationLevelActive(o.evidenceLevel)) return false;
    if (this.globalCapacity <= (this.defaults.capacity_threshold ?? 0.1)) return false;
    if (!mrna) return false;
    if (mrna.gene !== o.def.gene_id) return false;        // no cross-mRNA
    if (mrna.level <= (this.defaults.mrna_eligibility_threshold ?? 0.1)) return false; // alive
    if (mrna.degrading && mrna.level <= (this.defaults.mrna_eligibility_threshold ?? 0.1)) return false;
    return true;
  }

  _maxActiveUnits(o, mrna) {
    const maxUnits = this.defaults.max_protein_units ?? 4;
    const n = Math.round(maxUnits * Math.max(0, Math.min(1, mrna ? mrna.level : 0)) * o.geneEfficiency);
    return Math.max(0, Math.min(maxUnits, n));
  }

  _push(kind, id, event, extra) { this.timeline.push({ timeH: r2(this.timeH), kind, id, event, ...(extra || {}) }); }

  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.defaults.dt_hours ?? 0.5);
    if (this.isIdle()) { this.timeH += dt; this._stepCount += 1; return []; }
    this._recomputeCapacity();
    const events = [];
    const recruitDelay = this.defaults.recruitment_delay_h ?? 1.0;
    const initDelay = this.defaults.initiation_delay_h ?? 1.0;
    const matDelay = this.defaults.maturation_delay_h ?? 2.0;
    const elongBase = this.defaults.elongation_rate_per_hour ?? 0.35;
    const degHours = this.machReg.defaults && this.machReg.defaults.degradation_class_hours ? this.machReg.defaults.degradation_class_hours : { slow: 40, moderate: 20, fast: 8 };
    const degradeDelay = this.defaults.degrade_delay_h ?? 2.0;

    for (const o of this.outputs.values()) {
      const mrna = this._mrnaFor(o);
      const eligible = this._eligible(o, mrna);
      const maxActive = this._maxActiveUnits(o, mrna);
      const activeUnits = () => o.units.filter((u) => u.state === 'folding' || u.state === 'mature').length;
      o.protein.evidenceLevel = o.evidenceLevel;

      // --- ribosome lifecycle ---
      for (const r of o.ribosomes) {
        // suppression / unavailability signalling
        if (!eligible) {
          if (o.evidenceLevel === 'UNAVAILABLE') r.state = (r.state === 'elongating') ? r.state : 'unavailable';
          else if (this.globalCapacity <= (this.defaults.capacity_threshold ?? 0.1)) { if (r.state === 'free' || r.state === 'recruiting' || r.state === 'initiating') r.state = 'suppressed'; }
        } else if (r.state === 'suppressed' || r.state === 'unavailable') {
          r.state = 'free';
        }

        if (r.state === 'free' && eligible && activeUnits() < maxActive) {
          r.state = 'recruiting'; r.boundMrnaId = mrna.id; r._recruitAt = this.timeH; r.active = true;
          this._push('ribosome', r.id, 'recruited'); events.push({ type: 'translation:ribosome_recruited', id: r.id, timeH: this.timeH });
        } else if (r.state === 'recruiting') {
          if (!eligible) { r.state = 'free'; r.boundMrnaId = null; r.active = false; continue; }
          if (this.timeH - r._recruitAt >= recruitDelay) {
            r.state = 'initiating'; r._initAt = this.timeH;
            o.initComplexes.set(r.id, new TranslationInitiationComplex(`${r.id}_ic`, mrna.id, r.id, { evidence_level: o.evidenceLevel, prediction_level: o.def.evidence_level, cap_dependent: true }));
            o.initComplexes.get(r.id).state = 'assembling';
          }
        } else if (r.state === 'initiating') {
          const ic = o.initComplexes.get(r.id);
          if (!eligible) { if (ic) ic.state = 'suppressed'; r.state = 'free'; r.boundMrnaId = null; r.active = false; continue; }
          if (this.timeH - r._initAt >= initDelay) {
            if (activeUnits() >= maxActive) { r.state = 'free'; r.boundMrnaId = null; r.active = false; if (ic) ic.state = 'released'; continue; }
            if (ic) { ic.state = 'initiated'; }
            r.state = 'elongating'; r.translationProgress = 0; r.startTime = this.timeH;
            const np = new NascentPolypeptide(`${r.id}_np${o.protein.producedUnits}`, o.protein.id, mrna.id, r.id, this.timeH);
            np.evidenceLevel = o.evidenceLevel; np.predictionLevel = o.def.evidence_level;
            r.currentProteinId = o.protein.id;
            o.nascents.push(np);
            this._push('ribosome', r.id, 'initiation_complete'); this._push('protein', o.protein.id, 'elongation_started');
            events.push({ type: 'translation:initiation_complete', id: r.id, timeH: this.timeH });
          }
        } else if (r.state === 'elongating') {
          const np = o.nascents.find((n) => n.ribosomeId === r.id && n.alive && n.completedAt == null);
          // pause/suppress on lost capacity but keep progress (resume later)
          if (this.globalCapacity <= (this.defaults.capacity_threshold ?? 0.1)) { r.state = 'paused'; continue; }
          const rate = elongBase * this.globalCapacity * o.geneEfficiency;
          r.translationProgress = Math.max(0, Math.min(1, r.translationProgress + rate * dt));
          r.positionOnMrna = r.translationProgress;
          if (np) {
            const prev = np.progress; np.progress = r.translationProgress;
            np.lengthState = np.progress < 0.33 ? 'short' : np.progress < 0.9 ? 'extending' : 'full';
            np.foldingState = np.progress >= 0.5 ? 'partially_folded' : 'nascent';
            for (const mfrac of [0.25, 0.5, 0.75]) if (prev < mfrac && np.progress >= mfrac) this._push('protein', o.protein.id, `translation_${Math.round(mfrac * 100)}`);
          }
          if (r.translationProgress >= 1) r.state = 'terminating';
        } else if (r.state === 'paused') {
          if (this.globalCapacity > (this.defaults.capacity_threshold ?? 0.1)) r.state = 'elongating';
        } else if (r.state === 'terminating') {
          const np = o.nascents.find((n) => n.ribosomeId === r.id && n.completedAt == null);
          if (np) { np.completedAt = this.timeH; np.foldingState = 'newly_synthesized'; np.maturationState = 'folding'; np.lengthState = 'full'; }
          // release ribosome
          r.completionTime = this.timeH; r.state = 'released';
          this._push('ribosome', r.id, 'terminated'); this._push('protein', o.protein.id, 'nascent_protein_released');
          events.push({ type: 'translation:nascent_released', id: o.protein.id, timeH: this.timeH });
          // add a protein unit entering folding/maturation
          o.units.push({ state: 'folding', bornAt: this.timeH, matureAt: null, degradeAt: null });
          o.protein.producedUnits = o.units.length;
          if (o.protein.createdAt == null) o.protein.createdAt = this.timeH;
          this._push('protein', o.protein.id, 'maturation_started');
          const ic = o.initComplexes.get(r.id); if (ic) ic.state = 'released';
          o.initComplexes.delete(r.id);
        } else if (r.state === 'released') {
          r.state = 'free'; r.boundMrnaId = null; r.translationProgress = 0; r.positionOnMrna = 0; r.currentProteinId = null; r.active = false; r._recruitAt = null; r._initAt = null;
        }
      }

      // --- maturation + turnover (unit-conserved) ---
      const degLifetime = degHours[o.protein.degradationClass] ?? 20;
      for (const u of o.units) {
        if (u.state === 'folding' && this.timeH - u.bornAt >= matDelay) {
          u.state = 'mature'; u.matureAt = this.timeH;
          if (o.protein.maturedAt == null) o.protein.maturedAt = this.timeH;
          this._push('protein', o.protein.id, 'mature_protein_produced');
          events.push({ type: 'translation:mature_protein', id: o.protein.id, timeH: this.timeH });
        } else if (u.state === 'mature' && this.timeH - u.matureAt >= degLifetime) {
          u.state = 'degrading'; u.degradeAt = this.timeH;
          this._push('protein', o.protein.id, 'degradation_started');
        } else if (u.state === 'degrading' && this.timeH - u.degradeAt >= degradeDelay) {
          u.state = 'degraded';
          if (o.protein.degradedAt == null) o.protein.degradedAt = this.timeH;
          this._push('protein', o.protein.id, 'protein_degraded');
        }
      }

      // derive counts (conserved: produced == folding+mature+degrading+degraded)
      const p = o.protein;
      p.foldingUnits = o.units.filter((u) => u.state === 'folding').length;
      p.matureUnits = o.units.filter((u) => u.state === 'mature').length;
      p.degradingUnits = o.units.filter((u) => u.state === 'degrading').length;
      p.degradedUnits = o.units.filter((u) => u.state === 'degraded').length;
      p.producedUnits = o.units.length;
      const maxUnits = this.defaults.max_protein_units ?? 4;
      p.abundanceFrac = Math.max(0, Math.min(1, p.matureUnits / maxUnits));
      p.abundanceState = snapAbundance(p.abundanceFrac);
      p.turnoverState = p.degradingUnits > 0 ? 'degrading' : (p.matureUnits > 0 ? 'stable' : p.turnoverState);
      // protein aggregate state
      if (p.matureUnits > 0) p.state = 'mature';
      else if (p.foldingUnits > 0) p.state = 'folding';
      else if (p.degradingUnits > 0) p.state = 'degrading';
      else if (p.degradedUnits > 0 && p.producedUnits > 0) p.state = 'degraded';
      else p.state = 'nascent';
    }

    this.timeH += dt; this._stepCount += 1;
    return events;
  }

  run(steps, dtHours) { const ev = []; for (let i = 0; i < steps; i++) ev.push(...this.step(dtHours)); return ev; }
  stepOnce(dtHours) { return this.step(dtHours); }
  setSpecies(speciesId) { this.species = speciesId; this._build(); this._log('info', 'translation', `species -> ${speciesId} (${this.outputs.size} outputs)`); return this; }

  // ---- accessors / frame -------------------------------------------------

  output(id) { return this.outputs.get(id) || null; }
  protein(proteinId) { for (const o of this.outputs.values()) if (o.protein.id === proteinId) return o.protein; return null; }
  ribosomes(outId) { const o = this.outputs.get(outId); return o ? o.ribosomes.slice() : []; }
  getTimeline() { return this.timeline.slice(); }

  summaryLevel() { return this.isIdle() ? 'NOT_REPORTED' : (this.summaryLevelName || 'PREDICTIVE'); }
  summaryMessage() {
    if (this.isIdle()) return `Translation & protein synthesis: Not Reported for ${this.species} (no Phase-5C mRNA / no evidence).`;
    return `Translation & protein synthesis: Predictive - ${this.outputs.size} protein outputs; capacity ${this.capacityOrdinal}; schematic timing (not a biological timescale).`;
  }

  stats() {
    let recruited = 0, elongating = 0, mature = 0, degrading = 0, produced = 0;
    for (const o of this.outputs.values()) {
      for (const r of o.ribosomes) { if (r.state === 'recruiting' || r.state === 'initiating') recruited += 1; if (r.state === 'elongating') elongating += 1; }
      mature += o.protein.matureUnits; degrading += o.protein.degradingUnits; produced += o.protein.producedUnits;
    }
    let maxAbund = 0; for (const o of this.outputs.values()) maxAbund = Math.max(maxAbund, o.protein.abundanceState);
    return { outputs: this.outputs.size, recruitedRibosomes: recruited, elongatingRibosomes: elongating, matureUnits: mature, degradingUnits: degrading, producedUnits: produced, maxAbundance: maxAbund, capacity: this.capacityOrdinal, timeH: r2(this.timeH), steps: this._stepCount };
  }

  /** Publication-style render frame (headless-testable). */
  frame() {
    const outs = [...this.outputs.values()].map((o) => {
      const p = o.protein;
      const mrna = this._mrnaFor(o);
      const rib = o.ribosomes[0];
      return {
        outId: o.outId, proteinId: p.id, proteinName: p.canonicalName,
        mrnaId: o.mrnaSource, mrnaLevel: mrna ? r3(mrna.level) : 0,
        ribosomeState: rib ? rib.state : 'free', translationProgress: rib ? r3(rib.translationProgress) : 0,
        proteinState: p.state, abundanceState: p.abundanceState, abundanceOrdinal: abundanceOrdinal(p.abundanceFrac),
        matureUnits: p.matureUnits, foldingUnits: p.foldingUnits, degradingUnits: p.degradingUnits,
        turnoverState: p.turnoverState, halfLifeH: p.halfLifeH, degradationClass: p.degradationClass,
        predicted: isTranslationPrediction(o.evidenceLevel), evidenceLevel: o.evidenceLevel, predictionLevel: p.predictionLevel,
        confidence: p.confidence, functionalState: p.functionalState,
      };
    });
    return { outputs: outs, capacity: this.globalCapacity, capacityOrdinal: this.capacityOrdinal, timeH: r2(this.timeH), summaryLevel: this.summaryLevel() };
  }

  // ---- validation --------------------------------------------------------

  validate() {
    const errors = []; const warnings = [];
    const proteins = this.protReg.proteins || {};
    const profs = this.ctxReg.profiles || {};
    // unique protein ids (object keys unique; guard duplicate canonical names within a species)
    const seenProt = new Set();
    for (const [pid, pd] of Object.entries(proteins)) {
      if (seenProt.has(pid)) errors.push(`duplicate protein id: ${pid}`); seenProt.add(pid);
      if (!isTranslationEvidenceLevel(pd.evidence_level)) errors.push(`protein ${pid} invalid evidence_level`);
      if (isTranslationExperimental(pd.evidence_level) && (!pd.reference_ids || !pd.reference_ids.length)) errors.push(`protein ${pid} EXPERIMENTAL without a reference`);
      if (isTranslationExperimental(pd.evidence_level)) {
        const refs = this.protReg.protein_evidence || {};
        for (const rid of (pd.reference_ids || [])) if (refs[rid] && refs[rid].verification_status !== 'VERIFIED_IN_FROZEN_PACKAGE') errors.push(`protein ${pid} EXPERIMENTAL but reference ${rid} is not verified in repo`);
      }
      if (isTranslationPrediction(pd.evidence_level)) {
        const rec = (this.protReg.prediction_records || {});
        const has = Object.values(rec).some((r) => r.protein_id === pid && r.confidence && r.rationale === undefined ? false : r.protein_id === pid);
        // require a prediction record with confidence for predicted proteins
        const pr = Object.values(rec).find((r) => r.protein_id === pid);
        if (!pr || !pr.confidence) warnings.push(`predicted protein ${pid} lacks a prediction record with confidence`);
      }
      if (pd.functional_state && pd.functional_state !== 'not_evaluated') errors.push(`protein ${pid} functional_state must be not_evaluated in Phase 5D`);
      if (pd.turnover && typeof pd.turnover.half_life_h === 'number') warnings.push(`protein ${pid} asserts a numeric half-life - biological half-life should be NOT_REPORTED unless verified`);
    }
    // profiles
    for (const [prid, p] of Object.entries(profs)) {
      if (p.status === 'NOT_REPORTED') {
        if (Object.keys(p.outputs || {}).length) errors.push(`profile ${prid} is NOT_REPORTED but not empty`);
        continue;
      }
      const seenOut = new Set();
      for (const [oid, out] of Object.entries(p.outputs || {})) {
        if (seenOut.has(oid)) errors.push(`duplicate output id in ${prid}: ${oid}`); seenOut.add(oid);
        const pd = proteins[out.protein_id];
        if (!pd) { errors.push(`output ${oid} references missing protein: ${out.protein_id}`); continue; }
        if (pd.species !== p.species) errors.push(`output ${oid} cross-species: protein ${out.protein_id} is ${pd.species}, profile is ${p.species}`);
        if (pd.gene_id !== out.gene_id) errors.push(`output ${oid} gene mismatch: protein ${pd.gene_id} vs output ${out.gene_id}`);
        // mRNA must belong to Phase-5C for this species; if the transcription engine is on
        // the same species and has no such gene, that is a broken reference.
        if (this.transcription && this.transcription.species === p.species && !this.transcription.isIdle() && !this.transcription.gene(out.gene_id)) {
          errors.push(`output ${oid} references gene not present in Phase-5C transcription: ${out.gene_id}`);
        }
        if (!isTranslationEvidenceLevel(out.evidence_level)) errors.push(`output ${oid} invalid evidence_level`);
      }
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default TranslationEngine;
