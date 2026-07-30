// Phase-6D tumour-response objects. Runtime data carriers the TumorResponseEngine drives.
// The tumour burden is a SCHEMATIC normalized value (0..upper_bound, baseline 1.0) - NEVER a
// real tumour volume (mm3) / diameter / weight / cellularity / RECIST measurement. Growth and
// loss pressures are schematic ordinal drivers. The final state is a schematic treatment-
// response trajectory; no clinical / survival / patient outcome is ever represented.

/** Top-level virtual tumour-burden state. */
export class TumorBurdenState {
  constructor(id, def) {
    this.id = id;
    this.species = def.species;
    this.cellModel = def.cell_model;
    this.tumorModel = def.tumor_model || 'ordinal_schematic';
    this.formulation = def.formulation || null;
    this.treatmentState = 'off';           // off | on
    this.baselineBurden = def.baseline_burden ?? 1.0;   // schematic reference (NOT mm3)
    this.currentBurden = def.baseline_burden ?? 1.0;    // schematic [lower_bound, upper_bound]
    this.normalizedViableBurden = this.currentBurden;   // schematic
    this.normalizedApoptoticBurden = 0;    // schematic
    this.normalizedTerminalBurden = 0;     // schematic
    this.growthPressure = 0;               // schematic 0-1
    this.lossPressure = 0;                 // schematic 0-1
    this.netGrowthPressure = 0;            // schematic (growth - loss)
    this.responseState = 'idle';           // FSM state (see tumor-response.registry.json)
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
    this.createdAt = 0;
    this.updatedAt = 0;
    this.stabilizedAt = null;
    this.regressionStartedAt = null;
    this.reboundStartedAt = null;
    this.notes = def.notes || '';
    // internal book-keeping (not part of the reported contract)
    this._stableSince = null;
  }
}

/** Growth-pressure sub-state (proliferative drive). Living fraction is NOT proliferation rate. */
export class TumorGrowthPressure {
  constructor() {
    this.baselineProliferativePressure = 0; // schematic
    this.survivalPressure = 0;               // schematic (from upstream survival signalling)
    this.populationViabilityInput = 0;       // schematic (living fraction; a DISTINCT abstraction)
    this.cellCycleInput = 1;                 // schematic cycling capacity / growth readiness
    this.treatmentSuppression = 0;           // schematic 0-1 (from the formulation)
    this.resourceLimitation = 1;             // schematic logistic damping
    this.netGrowthPressure = 0;              // schematic
    this.evidenceLevel = 'NOT_REPORTED';
    this.predictionLevel = 'NOT_REPORTED';
    this.confidence = 'LOW';
  }
}

/** Loss-pressure sub-state (reduced viable burden - NOT physical/immune clearance). */
export class TumorLossPressure {
  constructor() {
    this.apoptoticFractionInput = 0;   // schematic (from population)
    this.committedFractionInput = 0;   // schematic
    this.terminalFractionInput = 0;    // schematic
    this.treatmentInducedLoss = 0;     // schematic 0-1 (from the formulation)
    this.delayedLoss = 0;              // schematic
    this.clearanceExcluded = true;     // immune / physical clearance is NOT modelled
    this.netLossPressure = 0;          // schematic
    this.evidenceLevel = 'NOT_REPORTED';
    this.predictionLevel = 'NOT_REPORTED';
    this.confidence = 'LOW';
  }
}

/** A treatment event (schematic or reported timing - never blurred). */
export class TumorTreatmentEvent {
  constructor(id, def) {
    this.id = id;
    this.formulation = def.formulation || null;
    this.administrationRoute = def.administration_route || 'topical';
    this.treatmentStart = def.treatment_start ?? null;
    this.treatmentEnd = def.treatment_end ?? null;
    this.repeatIndex = def.repeat_index ?? 0;
    this.active = false;
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.timingType = def.timing_type || 'schematic_simulation'; // reported_biological | schematic_simulation
    this.notes = def.notes || '';
  }
}

export default TumorBurdenState;
