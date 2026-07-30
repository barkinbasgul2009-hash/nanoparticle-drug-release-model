// Apoptosis commitment & execution engine (Phase 6B). The first phase where a single cell
// may enter an IRREVERSIBLE death program:
//
//   persistent stress -> apoptosis eligibility -> reversible pre-commitment
//     -> commitment gate (irreversible) -> mitochondrial transition
//     -> cytochrome-c / caspase branch AND/OR AIF branch execution
//     -> apoptotic cell state   [STOP - single cell; no population/tumour outcome]
//
// SEPARATE layer. Reads the Phase-6A ProteinFunctionEngine (cellular-stress states) and the
// Phase-5B SignalPropagationEngine plus the Phase-6B registries READ-ONLY; modifies nothing
// upstream. Deterministic (pure arithmetic, no RNG - no random death probabilities). All
// pressures are schematic 0-1; mitochondrial / caspase / AIF / morphology are ordinal
// states. Strict finite-state machine: irreversible after the commitment gate. The cell is
// never removed; population / tumour / immune outcome is NEVER evaluated.

import { ApoptosisState, MitochondrialApoptosisState, CaspaseCascadeState, AIFExecutionState, ApoptosisIntervention } from './apoptosisObjects.js';
import { isApoptosisEvidenceLevel, isApoptosisExperimental, isApoptosisPrediction, isApoptosisTransfer, apoptosisLevelActive } from '../evidence/evidenceEngine.js';

export class ApoptosisEngine {
  /**
   * @param {{
   *   contextRegistry:any, dynamicsRegistry:any, interventionRegistry:any, evidenceRegistry:any,
   *   proteinFunctionEngine: object, signalEngine?: object, species?: string, cellModel?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.contextRegistry || !deps.dynamicsRegistry || !deps.interventionRegistry || !deps.evidenceRegistry || !deps.proteinFunctionEngine) {
      throw new Error('ApoptosisEngine requires the four Phase-6B registries + proteinFunctionEngine');
    }
    this.ctxReg = deps.contextRegistry;
    this.dynReg = deps.dynamicsRegistry;
    this.intReg = deps.interventionRegistry;
    this.evReg = deps.evidenceRegistry;
    this.func = deps.proteinFunctionEngine; // read-only cellular-stress source
    this.signal = deps.signalEngine || null;
    this.logger = deps.logger || null;
    this.dyn = this.dynReg.defaults || {};
    this.sm = this.dynReg.state_machine || {};
    this.species = deps.species || 'human';
    this.cellModel = deps.cellModel || this._canonicalCellModel(this.species);
    this._build();
  }

  _canonicalCellModel(species) { return species === 'mouse' ? 'B16BL6' : species === 'human' ? 'HaCaT' : species === 'rat' ? 'ex_vivo_skin' : null; }

  _profile() {
    return Object.values(this.ctxReg.profiles || {}).find((p) => p.species === this.species && p.cell_model === this.cellModel) || null;
  }

  _build() {
    const p = this._profile();
    this.profile = p;
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    const available = p && p.apoptosis_available && p.status !== 'NOT_REPORTED';
    this.available = !!available;
    this.summaryLevelName = p ? (p.evidence_level || 'NOT_REPORTED') : 'NOT_REPORTED';
    this.branchWeights = (p && p.branch_weights) || { caspase_weight: 0.4, aif_weight: 0.4, other_weight: 0.1 };
    // runtime objects
    this.apop = new ApoptosisState('apop_cell_0', { cell_id: 'cell_0', species: this.species, cell_model: this.cellModel, evidence_level: p ? p.evidence_level : 'NOT_REPORTED', prediction_level: p ? p.prediction_level : 'NOT_REPORTED', confidence: p ? p.confidence : 'MEDIUM' });
    this.mito = new MitochondrialApoptosisState('cell_0');
    this.caspase = new CaspaseCascadeState('cell_0');
    this.aif = new AIFExecutionState('cell_0');
    this.mito.evidenceLevel = this.caspase.evidenceLevel = this.aif.evidenceLevel = p ? p.evidence_level : 'NOT_REPORTED';
    this.mito.predictionLevel = this.caspase.predictionLevel = this.aif.predictionLevel = p ? p.prediction_level : 'NOT_REPORTED';
    // interventions for this profile
    this.interventions = new Map();
    const iprof = (this.intReg.interventions || {})[this._profileKey()] || {};
    for (const [k, def] of Object.entries(iprof)) this.interventions.set(def.intervention_type, new ApoptosisIntervention(k, def));
    // initial FSM state
    this.apop.state = available ? 'homeostatic' : (p && p.status === 'NOT_REPORTED' ? 'not_reported' : 'unavailable');
  }

  _profileKey() { return Object.keys(this.ctxReg.profiles || {}).find((k) => this.ctxReg.profiles[k] === this.profile) || null; }

  isIdle() { return !this.available; }

  // ---- controls ----------------------------------------------------------

  setSpecies(speciesId) { this.species = speciesId; this.cellModel = this._canonicalCellModel(speciesId); this._build(); this._log('info', 'apoptosis', `species -> ${speciesId} (${this.cellModel}; available=${this.available})`); return this; }
  setCellModel(cellModel) { this.cellModel = cellModel; this._build(); this._log('info', 'apoptosis', `cell model -> ${cellModel} (available=${this.available})`); return this; }
  setIntervention(type, active) { const iv = this.interventions.get(type); if (iv) iv.active = !!active; return this; }
  interventionActive(type) { const iv = this.interventions.get(type); return !!(iv && iv.active); }

  restart() {
    this.timeH = 0; this._stepCount = 0; this.timeline = [];
    const p = this.profile;
    this.apop = new ApoptosisState('apop_cell_0', { cell_id: 'cell_0', species: this.species, cell_model: this.cellModel, evidence_level: p ? p.evidence_level : 'NOT_REPORTED', prediction_level: p ? p.prediction_level : 'NOT_REPORTED', confidence: p ? p.confidence : 'MEDIUM' });
    this.mito = new MitochondrialApoptosisState('cell_0');
    this.caspase = new CaspaseCascadeState('cell_0');
    this.aif = new AIFExecutionState('cell_0');
    this.apop.state = this.available ? 'homeostatic' : (p && p.status === 'NOT_REPORTED' ? 'not_reported' : 'unavailable');
    return this;
  }
  reset() { return this.restart(); }

  // ---- FSM ---------------------------------------------------------------

  _legal(from, to) { const t = (this.sm.legal_transitions || {})[from] || []; return from === to || t.includes(to); }
  _isIrreversible(s) { return (this.sm.irreversible_states || []).includes(s); }

  /** Attempt an FSM transition; throws on an illegal transition (strict FSM). */
  transitionTo(next) {
    if (!this._legal(this.apop.state, next)) throw new Error(`illegal apoptosis transition: ${this.apop.state} -> ${next}`);
    if (this.apop.state !== next) { this.apop.state = next; this._push('state', next); if (this._isIrreversible(next)) this.apop.reversibility = 'irreversible'; }
    return this.apop.state;
  }

  _push(kind, event, extra) { this.timeline.push({ timeH: r2(this.timeH), kind, event, ...(extra || {}) }); }

  // ---- upstream inputs (read-only) ---------------------------------------

  _stressInputs() {
    const map = { oxidative_stress: 0, survival_signaling: 0.8, mitochondrial_stress: 0, stress_readiness: 0 };
    if (!this.func || this.func.isIdle || (this.func.isIdle && this.func.isIdle())) {
      // fall through; read states below
    }
    const wantByType = { oxidative_stress: 'oxidative_stress', survival_signaling: 'survival_signaling', mitochondrial_stress: 'mitochondrial_stress', general_stress: 'stress_readiness' };
    if (this.func && this.func.frame && !this.func.isIdle()) {
      for (const s of this.func.frame().states) {
        const key = wantByType[s.stateType];
        if (key) map[key] = s.value;
      }
    }
    // interventions (upstream, before commitment): ROS scavenger reduces oxidative stress;
    // PI3K activator restores survival signaling.
    const scav = this.interventions.get('ros_scavenger');
    if (scav && scav.active) map.oxidative_stress *= (1 - this._strength(scav.strengthClass));
    const pi3k = this.interventions.get('pi3k_activator');
    if (pi3k && pi3k.active) map.survival_signaling = map.survival_signaling + this._strength(pi3k.strengthClass) * (1 - map.survival_signaling);
    return map;
  }

  _strength(cls) { const m = (this.intReg.strength_class_values) || { partial: 0.5, strong: 0.8, complete: 1.0 }; return typeof m[cls] === 'number' ? m[cls] : 0.5; }

  // ---- step --------------------------------------------------------------

  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.dyn.dt_hours ?? 0.5);
    if (this.isIdle()) { this.timeH += dt; this._stepCount += 1; return []; }
    const events = [];
    const w = this.dyn.pressure_weights || { oxidative_stress: 0.4, survival_withdrawal: 0.35, mitochondrial_stress: 0.2, stress_readiness: 0.05 };
    const inp = this._stressInputs();
    const stressTarget = Math.max(0, Math.min(1,
      w.oxidative_stress * inp.oxidative_stress +
      w.survival_withdrawal * (1 - inp.survival_signaling) +
      w.mitochondrial_stress * inp.mitochondrial_stress +
      w.stress_readiness * inp.stress_readiness));
    this.apop.survivalPressure = inp.survival_signaling;

    // 1) apoptotic-pressure accumulation / relief (persistence + reversibility). Strong
    // survival signaling actively dampens the net pro-apoptotic drive (Akt-style hold-off),
    // so a cell rescued by survival signaling stops accumulating pressure toward commitment.
    const effectiveStress = stressTarget - (this.dyn.survival_accumulation_penalty ?? 0.1) * this.apop.survivalPressure;
    if (!this._isIrreversible(this.apop.state)) {
      if (effectiveStress >= (this.dyn.eligibility_threshold ?? 0.25)) this.apop.apoptoticPressure = Math.min(1, this.apop.apoptoticPressure + (this.dyn.accumulation_rate_per_hour ?? 0.12) * stressTarget * dt);
      else this.apop.apoptoticPressure = Math.max(0, this.apop.apoptoticPressure - (this.dyn.relief_rate_per_hour ?? 0.18) * dt);
    }
    // Survival signaling opposes commitment as a persistent offset (PI3K/Akt-style hold-off),
    // NOT diluted by current pressure - strong survival can keep a stressed cell below the
    // commitment gate even once apoptotic pressure is high.
    const netPressure = this.apop.apoptoticPressure - (this.dyn.survival_counter_weight ?? 0.35) * this.apop.survivalPressure;

    // 2) reversible FSM up/down before commitment.
    const P = this.apop.apoptoticPressure;
    const st = this.apop.state;
    if (!this._isIrreversible(st)) {
      const elig = this.dyn.eligibility_threshold ?? 0.25;
      const preT = this.dyn.pre_commitment_threshold ?? 0.4;
      const comT = this.dyn.commitment_threshold ?? 0.6;
      if (st === 'homeostatic' && stressTarget >= 0.15) this.transitionTo('stressed');
      else if (st === 'stressed') { if (P >= elig) this.transitionTo('apoptosis_eligible'); else if (stressTarget < 0.1 && P < 0.05) this.transitionTo('homeostatic'); }
      else if (st === 'apoptosis_eligible') { if (P >= preT) this.transitionTo('pre_commitment'); else if (P < elig * 0.6) this.transitionTo('stressed'); }
      else if (st === 'pre_commitment') {
        const meets = netPressure >= comT;
        if (meets) { if (this.apop._pressureAboveSince == null) this.apop._pressureAboveSince = this.timeH; }
        else { this.apop._pressureAboveSince = null; if (P < preT * 0.7) this.transitionTo('apoptosis_eligible'); }
        if (this.apop._pressureAboveSince != null && (this.timeH - this.apop._pressureAboveSince) >= (this.dyn.commitment_persist_hours ?? 4.0)) {
          this.transitionTo('commitment_threshold_reached');
        }
      }
      this.apop.eligibility = ['apoptosis_eligible', 'pre_commitment', 'commitment_threshold_reached'].includes(this.apop.state);
    }

    // 3) irreversible commitment + deterministic execution progression.
    if (this.apop.state === 'commitment_threshold_reached') {
      this.transitionTo('committed'); this.apop.commitment = true; this.apop.committedAt = this.timeH;
      this.mito.baxBcl2Balance = 'strong_pro_apoptotic_shift';
      this._push('commit', 'apoptosis_committed');
      events.push({ type: 'apoptosis:committed', timeH: this.timeH });
    }
    if (this._isIrreversible(this.apop.state)) this._advanceExecution(dt, events);
    else {
      // pre-commitment mitochondrial priming (reversible)
      this.mito.baxBcl2Balance = P >= (this.dyn.pre_commitment_threshold ?? 0.4) ? 'pro_apoptotic_shift' : (P >= (this.dyn.eligibility_threshold ?? 0.25) ? 'balanced' : 'anti_apoptotic_dominant');
      this.mito.mompState = P >= (this.dyn.pre_commitment_threshold ?? 0.4) ? 'sensitized' : 'inactive';
      this.mito.membranePotentialState = P >= (this.dyn.pre_commitment_threshold ?? 0.4) ? 'slightly_reduced' : 'normal';
    }

    this.mito.updatedAt = this.caspase.updatedAt = this.aif.updatedAt = this.timeH;
    this.timeH += dt; this._stepCount += 1;
    return events;
  }

  /** Deterministic post-commitment execution: mitochondria -> MOMP -> branches -> apoptotic. */
  _advanceExecution(dt, events) {
    const d = this.dyn.stage_delay_hours || {};
    const tc = this.timeH - (this.apop.committedAt ?? this.timeH);
    const casInh = this.interventions.get('caspase_inhibitor');
    const aifKd = this.interventions.get('aif_knockdown');
    const casInhStr = casInh && casInh.active ? this._strength(casInh.strengthClass) : 0;
    const aifKdStr = aifKd && aifKd.active ? this._strength(aifKd.strengthClass) : 0;
    // A strong (or complete) AIF knockdown silences the AIF branch entirely; a partial
    // knockdown only attenuates its contribution (branch stays active, reduced weight).
    const aifSuppressed = aifKdStr >= this._strength('strong');

    // mitochondrial transition
    if (this.apop.state === 'committed' && tc >= (d.mitochondrial_transition ?? 2)) { this.transitionTo('mitochondrial_transition'); this._push('mito', 'mitochondrial_potential_reduced'); }
    if (this._stageReached('mitochondrial_transition')) {
      this.mito.membranePotentialState = tc >= (d.mitochondrial_transition ?? 2) + 4 ? 'collapsed' : tc >= (d.mitochondrial_transition ?? 2) + 2 ? 'severely_reduced' : 'reduced';
      this.mito.mompReadiness = Math.min(1, this.mito.mompReadiness + 0.3 * dt);
      this.mito.mompState = tc >= (d.mitochondrial_transition ?? 2) + (d.momp ?? 2) ? 'active' : 'initiating';
      if (this.mito.mompState === 'active') {
        if (this.mito.cytochromeCState === 'retained') { this.mito.cytochromeCState = 'release_ready'; }
        if (this.aif.mitochondrialAifState === 'mitochondrial') { this.aif.mitochondrialAifState = 'release_ready'; }
        if (!this._mompAnnounced) { this._push('momp', 'momp_initiated'); this._mompAnnounced = true; }
      }
    }

    // release + execution branches
    if (this.mito.mompState === 'active' && tc >= (d.mitochondrial_transition ?? 2) + (d.momp ?? 2) + (d.release ?? 2)) {
      if (this.mito.cytochromeCState !== 'released') { this.mito.cytochromeCState = 'released'; this._push('cytc', 'cytochrome_c_released'); }
      // AIF branch (suppressed by knockdown)
      if (aifSuppressed) { this.aif.mitochondrialAifState = 'suppressed_by_knockdown'; this.aif.released = false; }
      else if (this.aif.mitochondrialAifState !== 'suppressed_by_knockdown') {
        if (!this.aif.released) { this.aif.released = true; this.aif.mitochondrialAifState = 'released'; this._push('aif', 'aif_released'); }
      }
      if (this.apop.state === 'mitochondrial_transition') { this.transitionTo('execution_in_progress'); }
    }

    if (this._stageReached('execution_in_progress')) {
      const tcx = tc - ((d.mitochondrial_transition ?? 2) + (d.momp ?? 2) + (d.release ?? 2));
      // caspase-dependent branch
      const casW = (this.branchWeights.caspase_weight ?? 0.4) * (1 - casInhStr);
      if (casInhStr >= 0.999) { this.caspase.initiatorState = 'inhibited'; this.caspase.executionerState = 'inhibited'; }
      else {
        this.caspase.inhibitorPresent = casInhStr > 0;
        if (tcx >= 0 && this.caspase.initiatorState === 'inactive') { this.caspase.initiatorState = casInhStr > 0 ? 'partially_inhibited' : 'active'; this._push('caspase', 'initiator_caspase_activated'); }
        if (tcx >= (d.caspase ?? 3) && this.caspase.executionerState === 'inactive') { this.caspase.executionerState = casInhStr > 0 ? 'partially_inhibited' : 'active'; this._push('caspase', 'executioner_caspase_activated'); }
        if (tcx >= (d.caspase ?? 3) && this.caspase.parpState === 'intact') { this.caspase.parpState = 'cleavage_started'; this._push('parp', 'parp_cleavage_started'); }
        // A PARTIAL caspase inhibitor leaves PARP only partially cleaved (partial dependence);
        // full cleavage requires an uninhibited caspase branch.
        if (tcx >= (d.caspase ?? 3) + (d.parp ?? 3)) this.caspase.parpState = casInhStr > 0 ? 'partially_cleaved' : 'cleaved';
      }
      this.caspase.contribution = this.caspase.executionerState === 'inhibited' ? 0 : Math.min(casW, casW * (tcx / Math.max(0.5, (d.caspase ?? 3))));
      // AIF-associated branch
      const aifW = (this.branchWeights.aif_weight ?? 0.4) * (1 - aifKdStr);
      if (this.aif.released && !aifSuppressed) {
        if (tcx >= (d.aif ?? 3) && this.aif.translocationState === 'none') { this.aif.translocationState = 'active'; this.aif.mitochondrialAifState = 'execution_active'; this._push('aif', 'aif_execution_active'); }
        this.aif.executionContribution = Math.min(aifW, aifW * (tcx / Math.max(0.5, (d.aif ?? 3))));
      } else { this.aif.executionContribution = 0; }
      // total execution drive (schematic sum of distinct branch contributions)
      const other = this.branchWeights.other_weight ?? 0.1;
      this._totalExecutionDrive = this.caspase.contribution + this.aif.executionContribution + other;
      // morphology + completion (committed cell always completes; drive sets timeline richness)
      if (tcx >= (d.morphology ?? 4) && this.apop.state === 'execution_in_progress') { this.transitionTo('apoptotic'); this.apop.executedAt = this.timeH; this._push('morph', 'apoptotic_morphology_started'); }
    }

    if (this.apop.state === 'apoptotic' && (this.timeH - (this.apop.executedAt ?? this.timeH)) >= (d.complete ?? 4)) {
      this.transitionTo('execution_complete'); this._push('complete', 'execution_complete');
      events.push({ type: 'apoptosis:execution_complete', timeH: this.timeH });
    }
    this.apop.caspasePressure = this.caspase.contribution;
    this.apop.aifPressure = this.aif.executionContribution;
    this.apop.mitochondrialPressure = this.mito.mompReadiness;
  }

  _stageReached(s) {
    const order = ['committed', 'mitochondrial_transition', 'execution_in_progress', 'apoptotic', 'execution_complete'];
    return order.indexOf(this.apop.state) >= order.indexOf(s);
  }

  run(steps, dtHours) { const ev = []; for (let i = 0; i < steps; i++) ev.push(...this.step(dtHours)); return ev; }
  stepOnce(dtHours) { return this.step(dtHours); }

  // ---- accessors / frame -------------------------------------------------

  getTimeline() { return this.timeline.slice(); }
  morphologyState() {
    const map = { committed: 'normal', mitochondrial_transition: 'early_apoptotic', execution_in_progress: 'condensing', apoptotic: 'fragmentation_ready', execution_complete: 'late_apoptotic' };
    return map[this.apop.state] || 'normal';
  }
  totalExecutionDrive() { return r3(this._totalExecutionDrive || 0); }
  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.status === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'PREDICTIVE'); }
  summaryMessage() {
    if (this.isIdle()) return `Apoptosis: Not Reported / Unavailable for ${this.species} (${this.cellModel}).`;
    return `Apoptosis (${this.cellModel}): ${this.profile.evidence_level} - state ${this.apop.state}; schematic timing (not a biological timescale); population/tumour outcome NOT evaluated.`;
  }

  stats() {
    return { available: this.available, cellModel: this.cellModel, state: this.apop.state, committed: this.apop.commitment, reversibility: this.apop.reversibility,
      apoptoticPressure: r3(this.apop.apoptoticPressure), survivalPressure: r3(this.apop.survivalPressure),
      membranePotential: this.mito.membranePotentialState, baxBcl2: this.mito.baxBcl2Balance, momp: this.mito.mompState,
      cytochromeC: this.mito.cytochromeCState, aif: this.aif.mitochondrialAifState, caspaseExecutioner: this.caspase.executionerState, parp: this.caspase.parpState,
      caspaseContribution: r3(this.caspase.contribution), aifContribution: r3(this.aif.executionContribution), totalExecutionDrive: this.totalExecutionDrive(),
      timeH: r2(this.timeH), steps: this._stepCount };
  }

  frame() {
    return {
      cellModel: this.cellModel, available: this.available, state: this.apop.state, reversibility: this.apop.reversibility,
      apoptoticPressure: r3(this.apop.apoptoticPressure), survivalPressure: r3(this.apop.survivalPressure),
      committed: this.apop.commitment,
      mitochondria: { membranePotential: this.mito.membranePotentialState, baxBcl2: this.mito.baxBcl2Balance, momp: this.mito.mompState, cytochromeC: this.mito.cytochromeCState, mompReadiness: r3(this.mito.mompReadiness) },
      caspaseBranch: { initiator: this.caspase.initiatorState, executioner: this.caspase.executionerState, parp: this.caspase.parpState, contribution: r3(this.caspase.contribution), inhibited: this.caspase.inhibitorPresent },
      aifBranch: { state: this.aif.mitochondrialAifState, released: this.aif.released, translocation: this.aif.translocationState, contribution: r3(this.aif.executionContribution), knockdown: this.interventionActive('aif_knockdown') },
      totalExecutionDrive: this.totalExecutionDrive(),
      morphology: this.morphologyState(),
      interventions: [...this.interventions.values()].map((iv) => ({ type: iv.interventionType, active: iv.active, evidenceLevel: iv.evidenceLevel })),
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED',
      predicted: this.profile ? isApoptosisPrediction(this.profile.evidence_level) : false,
      contextTransfer: this.profile ? isApoptosisTransfer(this.profile.evidence_level) : false,
      cellFateEvidence: 'single_cell_only', populationOutcomeEvidence: 'NOT_EVALUATED', tumourResponseEvidence: 'NOT_EVALUATED',
      timeH: r2(this.timeH), summaryLevel: this.summaryLevel(),
    };
  }

  // ---- validation --------------------------------------------------------

  validate() {
    const errors = []; const warnings = [];
    const FORBIDDEN = ['necrosis', 'necroptosis', 'pyroptosis', 'ferroptosis', 'autophag', 'immune', 'macrophage', 'cytokine', 'tumour', 'tumor', 'population', 'proliferat', 'migrat', 'metasta', 'angiogen', 'pharmacokinet', 'pharmacodynam', 'clinical', 'viability'];
    const profs = this.ctxReg.profiles || {};
    const evRecs = this.evReg.evidence_records || {};
    const seen = new Set();
    for (const [pid, p] of Object.entries(profs)) {
      if (seen.has(pid)) errors.push(`duplicate apoptosis profile id: ${pid}`); seen.add(pid);
      if (!p.species || !p.cell_model) errors.push(`profile ${pid} missing species/cell_model`);
      if (p.status === 'NOT_REPORTED') { if (p.apoptosis_available) errors.push(`profile ${pid} NOT_REPORTED but apoptosis_available`); continue; }
      if (!isApoptosisEvidenceLevel(p.evidence_level)) errors.push(`profile ${pid} invalid evidence_level`);
      // experimental requires verified source; transfer must carry a transfer record
      if (isApoptosisExperimental(p.evidence_level)) {
        const refs = (p.evidence_refs || []).map((r) => evRecs[r]).filter(Boolean);
        if (!refs.length || refs.every((r) => r.verification_status !== 'VERIFIED_PRIMARY_STUDY' && r.verification_status !== 'VERIFIED_IN_FROZEN_PACKAGE')) errors.push(`profile ${pid} EXPERIMENTAL without a verified source`);
      }
      if (isApoptosisTransfer(p.evidence_level)) {
        if (!p.context_transfer || !p.context_transfer.source_cell_model || !p.context_transfer.target_cell_model) errors.push(`profile ${pid} CONTEXT_TRANSFER_PREDICTION without a transfer record`);
        if (p.context_transfer && p.context_transfer.source_cell_model === p.context_transfer.target_cell_model) errors.push(`profile ${pid} transfer source == target`);
      }
      // no silent cell-model mixing: a profile's evidence_refs must reference its own cell model or be a transfer
      for (const rid of (p.evidence_refs || [])) {
        const rec = evRecs[rid];
        if (rec && rec.cell_model && rec.cell_model !== p.cell_model && !isApoptosisTransfer(p.evidence_level)) errors.push(`profile ${pid} (${p.cell_model}) silently uses ${rec.cell_model} evidence ${rid} without a transfer label`);
      }
      // forbidden downstream concepts must not appear in excluded set as *implemented* (they are excluded, ok) - check profile fields don't declare them as available
      for (const bad of FORBIDDEN) if ((p.commitment_model || '').toLowerCase().includes(bad) || (p.caspase_model || '').toLowerCase().includes(bad)) errors.push(`profile ${pid} references a forbidden downstream concept: ${bad}`);
    }
    // FSM integrity: irreversible states must not transition back to reversible ones
    const irr = new Set(this.sm.irreversible_states || []);
    const rec = new Set(this.sm.recoverable_states || []);
    for (const [from, tos] of Object.entries(this.sm.legal_transitions || {})) {
      if (irr.has(from)) for (const to of tos) if (rec.has(to) || to === 'homeostatic' || to === 'idle') errors.push(`FSM allows recovery from irreversible state: ${from} -> ${to}`);
    }
    return { ok: errors.length === 0, errors, warnings };
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default ApoptosisEngine;
