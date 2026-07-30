// Phase-6A protein-function objects (schematic; reversible; no cell fate). Runtime data
// carriers the ProteinFunctionEngine drives. Nothing fabricates biology: functional
// capacity and cellular-state values are SCHEMATIC normalized 0-1 (never a concentration,
// activity %, biomarker, or clinical value). Cell fate is never represented.

/** Map a 0-1 schematic value to the ordinal ladder. */
export function stateOrdinal(v) {
  if (v < 0.2) return 'very_low';
  if (v < 0.4) return 'low';
  if (v < 0.6) return 'moderate';
  if (v < 0.8) return 'high';
  return 'very_high';
}

/** A functional protein state (a mature Phase-5D protein made functionally eligible). */
export class FunctionalProteinState {
  constructor(id, def) {
    this.id = id;                       // function-profile id (e.g. fn_ho1)
    this.proteinId = def.source_protein;
    this.geneId = def.gene_id;
    this.species = def.species;
    this.cellModel = def.cell_model || null;
    this.cellId = def.cell_id || null;
    this.functionType = def.function_type;
    this.functionalDirection = def.functional_direction;
    this.targetStates = def.target_cellular_states || [];
    this.requiredMaturity = def.required_maturity_state || 'mature';
    this.functionAvailable = def.function_available !== false;
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'MEDIUM';
    this.uncertainty = def.uncertainty || '';
    // runtime
    this.maturityState = 'unavailable';   // mirrors the source protein
    this.functionalState = 'unavailable'; // unavailable|not_reported|inactive|eligible|activating|active|partially_active|inhibited|recovering|degrading|inactive_after_degradation
    this.functionalCapacity = 0;          // schematic 0-1 (~ mature abundance, gated by evidence)
    this.activityState = 0;               // schematic 0-1 functional output level
    this.inhibitionState = 0;
    this.activatedAt = null;
    this.deactivatedAt = null;
    this.alive = true;
  }
}

/** A schematic, reversible cellular-state variable (0-1). NEVER a concentration/biomarker. */
export class CellularStateVariable {
  constructor(id, def) {
    this.id = id;
    this.canonicalName = def.canonical_name || id;
    this.displayName = def.display_name || id;
    this.species = def.species;
    this.cellModel = def.cell_model || null;
    this.cellId = def.cell_id || null;
    this.stateType = def.state_type;
    this.baseline = typeof def.baseline === 'number' ? def.baseline : 0.3;
    this.direction = def.direction || 'bidirectional';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'MEDIUM';
    this.reversible = def.reversible !== false;
    this.ordinalStates = def.ordinal_states || null;
    this.notes = def.notes || '';
    this.sourceProteins = [];
    this.sourceSignals = [];
    // runtime
    this.currentValue = this.baseline;
    this.updatedAt = null;
  }
}

/** A directed functional edge (source -> target cellular state). */
export class FunctionalEdge {
  constructor(id, def) {
    this.id = id;
    this.sourceType = def.source_type;   // protein_function | signal_node | cellular_state
    this.sourceId = def.source_id;
    this.targetStateId = def.target_state_id;
    this.relationshipType = def.relationship_type;
    this.direction = def.direction || 'forward';
    this.strengthClass = def.strength_class || 'moderate';
    this.delayClass = def.delay_class || 'early';
    this.reversibility = def.reversibility || 'reversible';
    this.baselineRelative = !!def.baseline_relative;
    this.sourceReference = typeof def.source_reference === 'number' ? def.source_reference : 0.5;
    this.feedback = !!def.feedback;
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'MEDIUM';
    this.rationale = def.rationale || '';
    this.referenceIds = def.reference_ids || [];
    this.uncertainty = def.uncertainty || '';
    // runtime
    this.active = false;
    this.contribution = 0;
  }
}
