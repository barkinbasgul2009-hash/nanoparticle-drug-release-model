// Phase-6B apoptosis objects (schematic; strict FSM; irreversible after commitment).
// Runtime data carriers the ApoptosisEngine drives. Nothing fabricates biology: pressures
// and branch contributions are SCHEMATIC normalized 0-1; mitochondrial / caspase / AIF /
// morphology are ORDINAL states. No %/fold/mV/concentration is represented. The final
// state is a single-cell apoptotic state - the cell object is never removed.

/** The top-level apoptosis state of a single cell. */
export class ApoptosisState {
  constructor(id, def) {
    this.id = id;
    this.cellId = def.cell_id || 'cell_0';
    this.species = def.species;
    this.cellModel = def.cell_model;
    this.state = 'idle';                 // FSM state (see apoptosis-dynamics.registry.json)
    this.eligibility = false;
    this.commitment = false;
    this.reversibility = 'reversible';   // reversible | irreversible
    this.apoptoticPressure = 0;          // schematic 0-1
    this.survivalPressure = 0;           // schematic 0-1
    this.mitochondrialPressure = 0;      // schematic 0-1
    this.caspasePressure = 0;            // schematic 0-1
    this.aifPressure = 0;                // schematic 0-1
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'MEDIUM';
    this.enteredAt = null;
    this.committedAt = null;
    this.executedAt = null;
    this._pressureAboveSince = null;     // for the commitment-persistence gate
    this.notes = def.notes || '';
  }
}

/** The mitochondrial apoptosis sub-state. */
export class MitochondrialApoptosisState {
  constructor(cellId) {
    this.cellId = cellId;
    this.membranePotentialState = 'normal'; // normal|slightly_reduced|reduced|severely_reduced|collapsed
    this.baxBcl2Balance = 'anti_apoptotic_dominant'; // ...|pro_apoptotic_shift|strong_pro_apoptotic_shift
    this.mompReadiness = 0;              // schematic 0-1
    this.mompState = 'inactive';         // inactive|sensitized|initiating|active|complete
    this.cytochromeCState = 'retained';  // retained|release_ready|released
    this.aifState = 'mitochondrial';     // mitochondrial|release_ready|released
    this.mitochondrialIntegrity = 1;     // schematic 0-1 (1 = intact)
    this.evidenceLevel = 'NOT_REPORTED';
    this.predictionLevel = 'NOT_REPORTED';
    this.confidence = 'MEDIUM';
    this.updatedAt = null;
  }
}

/** The caspase-dependent execution branch. */
export class CaspaseCascadeState {
  constructor(cellId) {
    this.cellId = cellId;
    this.initiatorState = 'inactive';    // inactive|primed|activating|active|partially_inhibited|inhibited|complete
    this.executionerState = 'inactive';
    this.parpState = 'intact';           // intact|cleavage_started|partially_cleaved|cleaved
    this.caspaseDependence = 'partial';  // schematic descriptor
    this.inhibitorPresent = false;
    this.contribution = 0;               // schematic 0-1 execution contribution
    this.evidenceLevel = 'NOT_REPORTED';
    this.predictionLevel = 'NOT_REPORTED';
    this.confidence = 'MEDIUM';
    this.updatedAt = null;
  }
}

/** The AIF-associated caspase-independent execution branch. */
export class AIFExecutionState {
  constructor(cellId) {
    this.cellId = cellId;
    this.mitochondrialAifState = 'mitochondrial'; // mitochondrial|release_ready|released|translocation_ready|execution_active|suppressed_by_knockdown
    this.released = false;
    this.translocationState = 'none';    // none|ready|active (schematic; no nuclear import machinery)
    this.executionContribution = 0;      // schematic 0-1
    this.knockdownActive = false;
    this.evidenceLevel = 'NOT_REPORTED';
    this.predictionLevel = 'NOT_REPORTED';
    this.confidence = 'MEDIUM';
    this.updatedAt = null;
  }
}

/** A registry-driven, testable intervention. */
export class ApoptosisIntervention {
  constructor(id, def) {
    this.id = id;
    this.interventionType = def.intervention_type;
    this.target = def.target;
    this.effect = def.effect;
    this.strengthClass = def.strength_class || 'partial';
    this.acts = def.acts || 'upstream_before_commitment';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.referenceIds = def.reference_ids || [];
    this.notes = def.notes || '';
    this.active = false;
  }
}
