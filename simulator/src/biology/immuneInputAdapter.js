// Phase-7C immune input adapter. Normalizes inconsistent upstream engine outputs into a single
// validated ImmuneInputSnapshot so the core immune engine never depends on raw upstream shapes.
// Reads upstream engines READ-ONLY (defensive: typeof checks, never assumes a field exists) and
// applies the availability/fallback policy - a missing input becomes an explicit UNAVAILABLE field
// with a warning, NEVER a silent zero. Deterministic; mutates nothing upstream.

import {
  AVAILABILITY, ImmuneInputField, ImmuneInputSnapshot, ImmuneRuntimeIssue, ISSUE_SEVERITY,
  SourceFrameReference, isFiniteNumber,
} from './immuneObjects.js';

function num(x) { return isFiniteNumber(x) ? x : null; }

/** Build a normalized field; availability follows presence unless overridden. */
function field(value, source, frameTime, availability) {
  const v = num(value);
  return new ImmuneInputField({ value: v, source, frameTime, availability: availability || (v == null ? AVAILABILITY.UNAVAILABLE : AVAILABILITY.AVAILABLE) });
}

function engineAvailable(eng) { return !!eng && (typeof eng.isIdle !== 'function' || !eng.isIdle()); }

export class ImmuneInputAdapter {
  /**
   * @param {{ microenvironmentEngine?:object, vascularEngine?:object, populationEngine?:object,
   *   tumorEngine?:object, apoptosisEngine?:object }} engines
   */
  constructor(engines = {}) {
    this.micro = engines.microenvironmentEngine || null;   // Phase 7A
    this.vascular = engines.vascularEngine || null;        // Phase 7B
    this.population = engines.populationEngine || null;
    this.tumor = engines.tumorEngine || null;
    this.apoptosis = engines.apoptosisEngine || null;
  }

  /** Read one upstream engine's frame()/stats() defensively (read-only). */
  _safeStats(eng) { try { return (eng && typeof eng.stats === 'function') ? eng.stats() : null; } catch { return null; } }
  _safeFrame(eng) { try { return (eng && typeof eng.frame === 'function') ? eng.frame() : null; } catch { return null; } }

  /**
   * @param {{ temporalContext?:object, treatmentContext?:object, simulationContext?:object,
   *   priorImmuneFrame?:object, registries?:object }} ctx
   * @returns {{ snapshot: ImmuneInputSnapshot, sourceRefs: SourceFrameReference[], issues: ImmuneRuntimeIssue[] }}
   */
  build(ctx = {}) {
    const issues = [];
    const sourceRefs = [];
    const availabilitySummary = {};

    const note = (code, msg, field) => issues.push(new ImmuneRuntimeIssue({ code, severity: ISSUE_SEVERITY.INFO, module: 'immuneInputAdapter', message: msg, affectedField: field, recoverable: true }));
    const ref = (engineName, eng, avail) => {
      const st = this._safeStats(eng) || {};
      sourceRefs.push(new SourceFrameReference({ engineName, frameId: null, simulationTime: num(st.timeH), availability: avail, compatibilityStatus: avail === AVAILABILITY.UNAVAILABLE ? 'UNAVAILABLE' : 'COMPATIBLE' }));
    };

    // --- Phase 7A passive microenvironment (READ-ONLY) ---
    let passive = {};
    if (engineAvailable(this.micro)) {
      const f = this._safeFrame(this.micro) || {};
      passive = {
        oxygenAvailability: field(f.oxygen ? f.oxygen.availability : null, 'microenvironmentEngine', num(f.timeH)),
        hypoxiaSeverity: field(f.hypoxia ? f.hypoxia.severity : null, 'microenvironmentEngine', num(f.timeH)),
        penetrationModifier: field(typeof this.micro.penetrationModifier === 'function' ? this.micro.penetrationModifier() : (f.penetration ? f.penetration.penetrationModifier : null), 'microenvironmentEngine', num(f.timeH)),
        effectiveAvailability: field(f.penetration ? f.penetration.effectiveAvailability : null, 'microenvironmentEngine', num(f.timeH)),
      };
      availabilitySummary.passiveMicroenvironment = AVAILABILITY.AVAILABLE;
      ref('microenvironmentEngine', this.micro, AVAILABILITY.AVAILABLE);
    } else {
      // 7A unavailable: do NOT assume normal oxygen / unrestricted ECM.
      passive = { oxygenAvailability: field(null, 'microenvironmentEngine', null, AVAILABILITY.UNAVAILABLE), hypoxiaSeverity: field(null, 'microenvironmentEngine', null, AVAILABILITY.UNAVAILABLE), penetrationModifier: field(null, 'microenvironmentEngine', null, AVAILABILITY.UNAVAILABLE), effectiveAvailability: field(null, 'microenvironmentEngine', null, AVAILABILITY.UNAVAILABLE) };
      availabilitySummary.passiveMicroenvironment = AVAILABILITY.UNAVAILABLE;
      note('IMMUNE_UPSTREAM_FRAME_UNAVAILABLE', 'Phase 7A microenvironment unavailable; passive-microenvironment immune inputs marked UNAVAILABLE (not assumed normal).', 'passiveMicroenvironmentContext');
      ref('microenvironmentEngine', this.micro, AVAILABILITY.UNAVAILABLE);
    }

    // --- Phase 7B vasculature (READ-ONLY) ---
    let vascular = {};
    if (engineAvailable(this.vascular)) {
      const f = this._safeFrame(this.vascular) || {};
      vascular = {
        deliveryModifier: field(typeof this.vascular.deliveryModifier === 'function' ? this.vascular.deliveryModifier() : (f.delivery ? f.delivery.deliveryModifier : null), 'vascularEngine', num(f.timeH)),
        perfusion: field(f.perfusion ? f.perfusion.efficiency : null, 'vascularEngine', num(f.timeH)),
        permeability: field(f.permeability ? f.permeability.value : null, 'vascularEngine', num(f.timeH)),
        vesselDensity: field(typeof this.vascular.vesselDensity === 'function' ? this.vascular.vesselDensity() : (f.vessels ? f.vessels.density : null), 'vascularEngine', num(f.timeH)),
      };
      availabilitySummary.vascular = AVAILABILITY.AVAILABLE;
      ref('vascularEngine', this.vascular, AVAILABILITY.AVAILABLE);
    } else {
      // 7B unavailable: do NOT assume normal perfusion / immune access.
      vascular = { deliveryModifier: field(null, 'vascularEngine', null, AVAILABILITY.UNAVAILABLE), perfusion: field(null, 'vascularEngine', null, AVAILABILITY.UNAVAILABLE), permeability: field(null, 'vascularEngine', null, AVAILABILITY.UNAVAILABLE), vesselDensity: field(null, 'vascularEngine', null, AVAILABILITY.UNAVAILABLE) };
      availabilitySummary.vascular = AVAILABILITY.UNAVAILABLE;
      note('IMMUNE_UPSTREAM_FRAME_UNAVAILABLE', 'Phase 7B vasculature unavailable; vascular-access immune inputs marked UNAVAILABLE (not assumed normal).', 'vascularContext');
      ref('vascularEngine', this.vascular, AVAILABILITY.UNAVAILABLE);
    }

    // --- tumour / population (READ-ONLY) ---
    let tumor = {};
    const popStats = engineAvailable(this.population) ? this._safeStats(this.population) : null;
    const tumStats = engineAvailable(this.tumor) ? this._safeStats(this.tumor) : null;
    if (popStats || tumStats) {
      tumor = {
        viableBurden: field(tumStats ? tumStats.normalizedViableBurden : null, 'tumorResponseEngine', tumStats ? num(tumStats.timeH) : null),
        apoptoticFraction: field(popStats ? popStats.apoptoticFraction : null, 'populationEngine', popStats ? num(popStats.timeH) : null),
        livingFraction: field(popStats ? popStats.livingFraction : null, 'populationEngine', popStats ? num(popStats.timeH) : null),
      };
      availabilitySummary.tumor = (popStats && tumStats) ? AVAILABILITY.AVAILABLE : AVAILABILITY.PARTIALLY_AVAILABLE;
      if (popStats) ref('populationEngine', this.population, AVAILABILITY.AVAILABLE);
      if (tumStats) ref('tumorResponseEngine', this.tumor, AVAILABILITY.AVAILABLE);
    } else {
      tumor = { viableBurden: field(null, 'tumorResponseEngine', null, AVAILABILITY.UNAVAILABLE), apoptoticFraction: field(null, 'populationEngine', null, AVAILABILITY.UNAVAILABLE), livingFraction: field(null, 'populationEngine', null, AVAILABILITY.UNAVAILABLE) };
      availabilitySummary.tumor = AVAILABILITY.UNAVAILABLE;
      note('IMMUNE_UPSTREAM_FRAME_UNAVAILABLE', 'Tumour/population unavailable; baseline tumour visibility inputs marked UNAVAILABLE.', 'tumorContext');
    }

    // --- treatment-induced damage / apoptosis (READ-ONLY) ---
    let damage = {};
    if (engineAvailable(this.apoptosis)) {
      const st = this._safeStats(this.apoptosis) || {};
      damage = { apoptoticPressure: field(st.apoptoticPressure, 'apoptosisEngine', num(st.timeH)), survivalPressure: field(st.survivalPressure, 'apoptosisEngine', num(st.timeH)) };
      availabilitySummary.damage = AVAILABILITY.AVAILABLE;
      ref('apoptosisEngine', this.apoptosis, AVAILABILITY.AVAILABLE);
    } else {
      // damage unavailable: do NOT infer treatment-induced antigen release (baseline visibility may still exist).
      damage = { apoptoticPressure: field(null, 'apoptosisEngine', null, AVAILABILITY.UNAVAILABLE), survivalPressure: field(null, 'apoptosisEngine', null, AVAILABILITY.UNAVAILABLE) };
      availabilitySummary.damage = AVAILABILITY.UNAVAILABLE;
      note('IMMUNE_INPUT_MISSING', 'Tumour damage/apoptosis unavailable; treatment-induced antigen release not inferred.', 'damageContext');
    }

    // --- treatment context (as provided; normalized) ---
    const t = ctx.treatmentContext || {};
    const treatment = {
      activeTreatment: field(t.active === true ? 1 : t.active === false ? 0 : null, 'treatmentContext', null),
      intensity: field(t.intensity, 'treatmentContext', null),
      cumulativeExposure: field(t.cumulativeExposure, 'treatmentContext', null),
    };
    availabilitySummary.treatment = (t.active != null || t.intensity != null) ? AVAILABILITY.PARTIALLY_AVAILABLE : AVAILABILITY.UNAVAILABLE;

    // --- prior immune frame ---
    const prior = ctx.priorImmuneFrame || null;
    availabilitySummary.priorImmune = prior ? AVAILABILITY.AVAILABLE : AVAILABILITY.UNAVAILABLE;
    if (!prior) note('IMMUNE_PRIOR_FRAME_UNAVAILABLE', 'No prior immune frame; temporal state machines will initialize from registry initial states.', 'priorImmuneContext');

    const snapshot = new ImmuneInputSnapshot({
      simulationContext: ctx.simulationContext || {},
      temporalContext: ctx.temporalContext,
      tumorContext: tumor,
      treatmentContext: treatment,
      exposureContext: {},
      damageContext: damage,
      passiveMicroenvironmentContext: passive,
      vascularContext: vascular,
      priorImmuneContext: prior,
      registryContext: ctx.registries || {},
      availabilitySummary,
      warnings: issues.slice(),
    });
    return { snapshot, sourceRefs, issues };
  }
}

export default ImmuneInputAdapter;
