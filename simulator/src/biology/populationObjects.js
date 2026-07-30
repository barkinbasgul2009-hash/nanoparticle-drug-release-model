// Phase-6C population objects. Runtime data carriers the PopulationEngine drives. This is
// the first phase that reasons about MANY cells at once, but only as a SCHEMATIC virtual
// population: every field is a normalized [0,1] simulation fraction - never a real cell
// count, density, cellularity, or tumour geometry. Conservation holds at all times
// (living_fraction + apoptotic_fraction == 1). Committed apoptotic cells never resurrect,
// so apoptotic_fraction / cumulative_apoptosis are non-decreasing. The simulator STOPS at
// population composition; tumour / clinical / survival outcome is NEVER represented.

/** The composition + state of a schematic virtual cell population. */
export class PopulationState {
  constructor(id, def) {
    this.populationId = id;
    this.species = def.species;
    this.cellModel = def.cell_model;
    this.livingFraction = 1;             // schematic [0,1]; living + apoptotic == 1
    this.apoptoticFraction = 0;          // schematic [0,1]; non-decreasing
    this.adaptedFraction = 0;            // schematic [0,1]; sub-fraction of living
    this.recoveredFraction = 0;          // schematic [0,1]; sub-fraction of living
    this.cumulativeApoptosis = 0;        // schematic [0,1]; == apoptoticFraction (kept for history)
    this.populationState = 'idle';       // FSM state (see population-state.registry.json)
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.updatedAt = 0;
    // internal book-keeping (not part of the reported contract)
    this._stressSignal = 0;              // schematic driver derived from the single cell
    this._terminalSince = null;          // when apoptotic accumulation plateaued (for terminal state)
  }
}

export default PopulationState;
