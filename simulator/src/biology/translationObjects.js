// Phase-5D translation objects (schematic; no molecular structure). Runtime data carriers
// the TranslationEngine drives. Nothing fabricates biology: translation progress and
// protein abundance are SCHEMATIC (normalized 0-1 / bucketed), and every object carries an
// evidence/prediction label. The chain stops at mature protein + turnover; protein
// FUNCTION is never evaluated (functional_state stays not_evaluated).

/** Snap a 0-1 fraction to the schematic abundance ladder {0,25,50,75,100}. */
export function snapAbundance(frac) {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  const levels = [0, 25, 50, 75, 100];
  let best = 0; let bestD = Infinity;
  for (const l of levels) { const d = Math.abs(pct - l); if (d < bestD) { bestD = d; best = l; } }
  return best;
}

/** Map a 0-1 schematic abundance to an ordinal (never a molecule count). */
export function abundanceOrdinal(frac) {
  if (frac < 0.1) return 'none';
  if (frac < 0.4) return 'low';
  if (frac < 0.75) return 'moderate';
  return 'high';
}

/** A ribosome (schematic restrained complex; NOT atomic structure). */
export class Ribosome {
  constructor(id, cellId, species) {
    this.id = id;
    this.cellId = cellId;
    this.species = species;
    this.state = 'free';               // free|recruiting|initiating|elongating|terminating|released|paused|suppressed|unavailable
    this.boundMrnaId = null;
    this.positionOnMrna = 0;           // schematic 0-1 position (NOT a nucleotide index)
    this.translationProgress = 0;      // schematic 0-1 progress
    this.currentProteinId = null;
    this.evidenceLevel = 'NOT_REPORTED';
    this.active = false;
    this.startTime = null;
    this.completionTime = null;
    this._recruitAt = null;
    this._initAt = null;
  }
}

/** A schematic translation-initiation complex (general machinery; not quantitative factors). */
export class TranslationInitiationComplex {
  constructor(id, mrnaId, ribosomeId, def) {
    this.id = id;
    this.mrnaId = mrnaId;
    this.ribosomeId = ribosomeId;
    this.state = 'not_assembled';      // not_assembled|assembling|assembled|initiated|failed|suppressed|released
    this.capDependent = def && def.cap_dependent !== false;
    this.initiationCapacity = def && typeof def.initiation_capacity === 'number' ? def.initiation_capacity : 1;
    this.evidenceLevel = def && def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def && def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def && def.confidence || 'MEDIUM';
    this.rationale = def && def.rationale || '';
  }
}

/** A nascent polypeptide (schematic progress + folding; no sequence, no length). */
export class NascentPolypeptide {
  constructor(id, proteinId, mrnaId, ribosomeId, createdAt) {
    this.id = id;
    this.proteinId = proteinId;
    this.sourceMrnaId = mrnaId;
    this.ribosomeId = ribosomeId;
    this.progress = 0;                 // schematic translation progress 0-1
    this.lengthState = 'short';        // short|extending|full (schematic, NOT residues)
    this.foldingState = 'nascent';     // nascent|partially_folded|newly_synthesized|folding|mature|misfolded
    this.maturationState = 'newly_synthesized';
    this.alive = true;
    this.evidenceLevel = 'NOT_REPORTED';
    this.predictionLevel = 'MECHANISTIC_PREDICTION';
    this.createdAt = createdAt;
    this.completedAt = null;
  }
}

/** A protein (schematic abundance + turnover; catalytic FUNCTION never evaluated). */
export class Protein {
  constructor(id, def) {
    this.id = id;
    this.canonicalName = def.canonical_name || id;
    this.geneId = def.gene_id;
    this.sourceMrnaId = def.source_mrna_id;
    this.species = def.species;
    this.cellModel = def.cell_model || null;
    this.compartment = def.compartment || 'cytoplasm';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'MEDIUM';
    this.maturationModel = def.maturation_model || 'generic';
    this.chaperone = def.chaperone || 'none';
    const to = def.turnover || {};
    this.turnoverState = to.state || 'stable';
    this.halfLifeH = to.half_life_h != null ? to.half_life_h : 'NOT_REPORTED';
    this.degradationClass = to.degradation_class || 'moderate';
    this.referenceIds = def.reference_ids || [];
    this.rationale = def.rationale || '';
    // runtime state (schematic protein-unit pools; conserved)
    this.state = 'nascent';            // nascent|newly_synthesized|folding|maturing|mature|misfolded|inactive|degrading|degraded
    this.foldingUnits = 0;             // units still folding/maturing
    this.matureUnits = 0;              // mature units
    this.degradingUnits = 0;           // units being turned over
    this.degradedUnits = 0;            // fully degraded (cumulative)
    this.producedUnits = 0;            // cumulative produced (= folding+mature+degrading+degraded)
    this.abundanceFrac = 0;            // schematic 0-1 (matureUnits / maxUnits)
    this.abundanceState = 0;           // snapped bucket
    this.functionalState = 'not_evaluated'; // NEVER evaluated in this phase
    this.createdAt = null;
    this.maturedAt = null;
    this.degradedAt = null;
  }
}
