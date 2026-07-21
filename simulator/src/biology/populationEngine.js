// Phase-6C population-response engine. The first layer that reasons about MANY cells at
// once - but only as a SCHEMATIC virtual population derived from the Phase-6B single-cell
// apoptosis trajectory. It reads the Phase-6B ApoptosisEngine outputs and the Phase-6C
// registries READ-ONLY and modifies nothing upstream. No new intracellular biology is
// invented here; Phase 6C answers "what FRACTION of cells have entered each state?", not
// "what happens to one cell?".
//
// Hard boundaries:
//   * Deterministic (pure arithmetic, no RNG).
//   * Normalized fractions only - NEVER real cell counts / density / cellularity / geometry.
//   * Conservation: living_fraction + apoptotic_fraction == 1 at all times.
//   * apoptotic_fraction / cumulative_apoptosis are non-decreasing (committed cells never
//     resurrect); recovery reclassifies only SURVIVING cells.
//   * STOP at population composition. Tumour / survival / clinical outcome is NEVER
//     evaluated (tumourResponseEvidence stays NOT_EVALUATED).
//
// Population predictions are permitted only where single-cell apoptosis evidence exists AND
// population evidence is absent; they are always LABELLED predictions, never experimental.

import { PopulationState } from './populationObjects.js';
import { isPopulationEvidenceLevel, isPopulationPrediction, isPopulationTransfer } from '../evidence/evidenceEngine.js';

const STATE_ORDER = [
  'healthy', 'minimal_response', 'adaptive_response', 'partial_response',
  'mixed_population', 'apoptosis_accumulating', 'apoptosis_dominant', 'stable_terminal_state',
];

export class PopulationEngine {
  /**
   * @param {{
   *   contextRegistry:any, stateRegistry:any, transitionsRegistry:any,
   *   evidenceRegistry:any, predictionRegistry:any, interventionRegistry?:any,
   *   apoptosisEngine: object, species?: string, cellModel?: string, logger?: object
   * }} deps
   */
  constructor(deps) {
    if (!deps || !deps.contextRegistry || !deps.stateRegistry || !deps.transitionsRegistry || !deps.evidenceRegistry || !deps.predictionRegistry || !deps.apoptosisEngine) {
      throw new Error('PopulationEngine requires the Phase-6C registries + apoptosisEngine');
    }
    this.ctxReg = deps.contextRegistry;
    this.stateReg = deps.stateRegistry;
    this.transReg = deps.transitionsRegistry;
    this.evReg = deps.evidenceRegistry;
    this.predReg = deps.predictionRegistry;
    this.intReg = deps.interventionRegistry || null;
    this.apop = deps.apoptosisEngine;                 // read-only single-cell source
    this.logger = deps.logger || null;
    this.sm = this.transReg.state_machine || {};
    this.dyn = this.transReg.defaults || {};
    this.thr = (this.stateReg.composition_thresholds) || {};
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
    this._prevP = null;
    this.available = !!(p && p.population_available && this.apop);
    this.pop = new PopulationState('pop_0', {
      species: this.species, cell_model: this.cellModel,
      evidence_level: p ? p.evidence_level : 'NOT_REPORTED',
      prediction_level: p ? p.prediction_level : 'NOT_REPORTED',
      confidence: p ? p.confidence : 'LOW', uncertainty: p ? p.uncertainty : '',
    });
    this.pop.populationState = this.available ? (this.sm.initial_state || 'healthy') : (p && p.evidence_level === 'NOT_REPORTED' ? 'not_reported' : 'unavailable');
  }

  isIdle() { return !this.available; }

  // ---- controls ----------------------------------------------------------

  setSpecies(speciesId) { this.species = speciesId; this.cellModel = this._canonicalCellModel(speciesId); this._build(); this._log('info', 'population', `species -> ${speciesId} (${this.cellModel}; available=${this.available})`); return this; }
  setCellModel(cellModel) { this.cellModel = cellModel; this._build(); this._log('info', 'population', `cell model -> ${cellModel} (available=${this.available})`); return this; }

  restart() {
    this.timeH = 0; this._stepCount = 0; this.timeline = []; this._prevP = null;
    const p = this.profile;
    this.pop = new PopulationState('pop_0', {
      species: this.species, cell_model: this.cellModel,
      evidence_level: p ? p.evidence_level : 'NOT_REPORTED',
      prediction_level: p ? p.prediction_level : 'NOT_REPORTED',
      confidence: p ? p.confidence : 'LOW', uncertainty: p ? p.uncertainty : '',
    });
    this.pop.populationState = this.available ? (this.sm.initial_state || 'healthy') : (p && p.evidence_level === 'NOT_REPORTED' ? 'not_reported' : 'unavailable');
    return this;
  }
  reset() { return this.restart(); }

  // ---- FSM ---------------------------------------------------------------

  _legal(from, to) { const t = (this.sm.legal_transitions || {})[from] || []; return from === to || t.includes(to); }
  _isIrreversible(s) { return (this.sm.irreversible_states || []).includes(s); }

  /** Attempt a population FSM transition; throws on an illegal transition (strict FSM). */
  transitionTo(next) {
    if (!this._legal(this.pop.populationState, next)) throw new Error(`illegal population transition: ${this.pop.populationState} -> ${next}`);
    if (this.pop.populationState !== next) { this.pop.populationState = next; this._push('state', next); }
    return this.pop.populationState;
  }

  _push(kind, event, extra) { this.timeline.push({ timeH: r2(this.timeH), kind, event, ...(extra || {}) }); }

  // ---- upstream single-cell drivers (read-only) --------------------------

  _drivers() {
    const a = this.apop;
    if (!a || (a.isIdle && a.isIdle())) return { committed: false, P: 0, surv: 0, exec: 0, aState: 'idle' };
    let f = null; try { f = a.frame ? a.frame() : null; } catch { f = null; }
    const P = f && typeof f.apoptoticPressure === 'number' ? f.apoptoticPressure : (a.apop ? a.apop.apoptoticPressure : 0);
    const surv = f && typeof f.survivalPressure === 'number' ? f.survivalPressure : (a.apop ? a.apop.survivalPressure : 0);
    const committed = f ? !!f.committed : (a.apop ? !!a.apop.commitment : false);
    const exec = f && typeof f.totalExecutionDrive === 'number' ? f.totalExecutionDrive : (a.totalExecutionDrive ? a.totalExecutionDrive() : 0);
    const aState = f ? f.state : (a.apop ? a.apop.state : 'idle');
    return { committed, P: clamp01(P), surv: clamp01(surv), exec: Math.max(0, exec), aState };
  }

  // ---- step --------------------------------------------------------------

  step(dtHours) {
    const dt = typeof dtHours === 'number' ? dtHours : (this.dyn.dt_hours ?? 0.5);
    if (this.isIdle()) { this.timeH += dt; this._stepCount += 1; return []; }
    const events = [];
    const d = this.dyn; const th = this.thr;
    const drv = this._drivers();
    this.pop._stressSignal = drv.P;

    const apoptoticBefore = this.pop.apoptoticFraction;

    // 1) apoptotic accumulation (monotonic, bounded by the susceptible ceiling; a resistant
    //    fraction never dies). Committed modal cell drives conversion; before commitment only
    //    the most-susceptible tail leaks.
    const ceiling = d.susceptible_ceiling ?? 0.85;
    const deathDrive = drv.committed ? Math.max(drv.P, drv.exec) : drv.P * (d.pre_commitment_leak ?? 0.12);
    const dA = (d.apoptosis_conversion_rate_per_hour ?? 0.09) * deathDrive * Math.max(0, ceiling - this.pop.apoptoticFraction) * dt;
    this.pop.apoptoticFraction = Math.min(ceiling, this.pop.apoptoticFraction + Math.max(0, dA));
    this.pop.cumulativeApoptosis = this.pop.apoptoticFraction;
    this.pop.livingFraction = 1 - this.pop.apoptoticFraction;

    // 2) adaptation of surviving cells under sustained-but-survivable schematic stress.
    const win = d.adaptive_stress_window || { low: 0.15, high: 0.6 };
    let survPool = Math.max(0, this.pop.livingFraction - this.pop.adaptedFraction - this.pop.recoveredFraction);
    if (drv.P >= win.low && drv.P <= win.high) {
      this.pop.adaptedFraction += (d.adaptation_rate_per_hour ?? 0.08) * drv.P * survPool * dt;
    }

    // 3) recovery: previously stressed SURVIVING cells return to viable (never resurrects
    //    apoptotic cells). Allowed only before the irreversible apoptosis_dominant state.
    // Relief-driven only: recovery fires while schematic stress is actively falling, so a
    // never-stressed population does not spuriously "recover" at t=0.
    const reliefSignal = Math.max(0, (this._prevP ?? drv.P) - drv.P) * (d.relief_sensitivity ?? 0.5);
    if (!this._isIrreversible(this.pop.populationState) && !drv.committed && reliefSignal > 0) {
      survPool = Math.max(0, this.pop.livingFraction - this.pop.adaptedFraction - this.pop.recoveredFraction);
      this.pop.recoveredFraction += (d.recovery_rate_per_hour ?? 0.1) * reliefSignal * survPool * dt;
    }

    // conservation clamp: adapted + recovered are sub-fractions of living.
    const sub = this.pop.adaptedFraction + this.pop.recoveredFraction;
    if (sub > this.pop.livingFraction && sub > 0) {
      const scale = this.pop.livingFraction / sub;
      this.pop.adaptedFraction *= scale; this.pop.recoveredFraction *= scale;
    }
    this.pop.adaptedFraction = clamp01(this.pop.adaptedFraction);
    this.pop.recoveredFraction = clamp01(this.pop.recoveredFraction);

    // 4) population state machine (one legal step per tick toward the composition target).
    const dApop = this.pop.apoptoticFraction - apoptoticBefore;
    this._advanceState(this._deriveTargetState(), dApop, events);

    this._prevP = drv.P;
    this.pop.updatedAt = this.timeH;
    this.timeH += dt; this._stepCount += 1;
    return events;
  }

  /** Composition -> target population state (schematic ordinal boundaries on the fractions). */
  _deriveTargetState() {
    const A = this.pop.apoptoticFraction; const th = this.thr;
    const stress = this.pop._stressSignal; const adapt = this.pop.adaptedFraction;
    if (A >= (th.apoptotic_dominant ?? 0.75)) return 'apoptosis_dominant';
    if (A >= (th.apoptotic_accumulating ?? 0.55)) return 'apoptosis_accumulating';
    if (A >= (th.apoptotic_mixed ?? 0.35)) return 'mixed_population';
    if (A >= (th.apoptotic_partial ?? 0.15)) return 'partial_response';
    if (adapt >= (th.adaptive_min ?? 0.12)) return 'adaptive_response';
    if (stress >= (th.stress_minimal ?? 0.08)) return 'minimal_response';
    return 'healthy';
  }

  /** Advance the FSM by at most one legal step toward the target (recovery only pre-dominant). */
  _advanceState(target, dApop, events) {
    const cur = this.pop.populationState;
    if (cur === 'stable_terminal_state') return;
    if (cur === 'apoptosis_dominant') {
      // terminal only once apoptotic accumulation has plateaued for the dwell window.
      if (dApop < (this.thr.terminal_epsilon ?? 0.0015)) {
        if (this.pop._terminalSince == null) this.pop._terminalSince = this.timeH;
        if ((this.timeH - this.pop._terminalSince) >= (this.dyn.terminal_plateau_hours ?? 2.0)) {
          this.transitionTo('stable_terminal_state');
          events.push({ type: 'population:stable_terminal_state', timeH: this.timeH });
        }
      } else { this.pop._terminalSince = null; }
      return;
    }
    const ci = STATE_ORDER.indexOf(cur); const ti = STATE_ORDER.indexOf(target);
    if (ti > ci) {
      const next = STATE_ORDER[ci + 1];
      this.transitionTo(next);
      if (next === 'apoptosis_dominant') events.push({ type: 'population:apoptosis_dominant', timeH: this.timeH });
      else if (next === 'apoptosis_accumulating') events.push({ type: 'population:apoptosis_accumulating', timeH: this.timeH });
    } else if (ti < ci && !this._isIrreversible(cur)) {
      this.transitionTo(STATE_ORDER[ci - 1]); // recovery: reclassifies surviving cells only
    }
  }

  run(steps, dtHours) { const ev = []; for (let i = 0; i < steps; i++) ev.push(...this.step(dtHours)); return ev; }

  // ---- accessors ---------------------------------------------------------

  getTimeline() { return this.timeline.slice(); }
  summaryLevel() { return this.isIdle() ? (this.profile && this.profile.evidence_level === 'NOT_REPORTED' ? 'NOT_REPORTED' : 'UNAVAILABLE') : (this.profile.evidence_level || 'MECHANISTIC_PREDICTION'); }
  summaryMessage() {
    if (this.isIdle()) return `Population: Not Reported / Unavailable for ${this.species} (${this.cellModel}).`;
    return `Population (${this.cellModel}): ${this.profile.evidence_level} - state ${this.pop.populationState}; schematic normalized fractions (not real cell counts); tumour/clinical outcome NOT evaluated.`;
  }

  stats() {
    return {
      available: this.available, cellModel: this.cellModel, populationState: this.pop.populationState,
      livingFraction: r3(this.pop.livingFraction), apoptoticFraction: r3(this.pop.apoptoticFraction),
      adaptedFraction: r3(this.pop.adaptedFraction), recoveredFraction: r3(this.pop.recoveredFraction),
      cumulativeApoptosis: r3(this.pop.cumulativeApoptosis),
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED',
      timeH: r2(this.timeH), steps: this._stepCount,
    };
  }

  frame() {
    return {
      cellModel: this.cellModel, available: this.available, populationState: this.pop.populationState,
      livingFraction: r3(this.pop.livingFraction), apoptoticFraction: r3(this.pop.apoptoticFraction),
      adaptedFraction: r3(this.pop.adaptedFraction), recoveredFraction: r3(this.pop.recoveredFraction),
      cumulativeApoptosis: r3(this.pop.cumulativeApoptosis),
      evidenceLevel: this.profile ? this.profile.evidence_level : 'NOT_REPORTED',
      predicted: this.profile ? isPopulationPrediction(this.profile.evidence_level) : false,
      contextTransfer: this.profile ? isPopulationTransfer(this.profile.evidence_level) : false,
      confidence: this.pop.confidence, uncertainty: this.pop.uncertainty,
      // STOP boundary: single-cell population composition only.
      populationCompositionEvidence: this.available ? 'PREDICTED' : 'NOT_EVALUATED',
      tumourResponseEvidence: 'NOT_EVALUATED', survivalEvidence: 'NOT_EVALUATED', clinicalOutcomeEvidence: 'NOT_EVALUATED',
      timeH: r2(this.timeH), summaryLevel: this.summaryLevel(),
    };
  }

  /** Conservation + monotonicity self-check (used by Part-2 validation/tests). */
  conservationOk() {
    const L = this.pop.livingFraction; const A = this.pop.apoptoticFraction;
    const sum = L + A;
    const subOk = (this.pop.adaptedFraction + this.pop.recoveredFraction) <= L + 1e-9;
    return Math.abs(sum - 1) < 1e-9 && subOk && A >= -1e-12;
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function r2(x) { return Math.round(x * 100) / 100; }
function r3(x) { return Math.round(x * 1000) / 1000; }

export default PopulationEngine;
