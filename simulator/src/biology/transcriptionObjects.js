// Phase-5C transcription objects (schematic, no molecular dynamics). These are the
// runtime data carriers the TranscriptionEngine drives. Nothing here fabricates biology:
// activity/expression are SCHEMATIC (0-1 or snapped level buckets), and every object
// carries its evidence/prediction label. The chain stops at mRNA.

/** Snap a 0-1 fraction to the schematic expression ladder {0,25,50,75,100}. */
export function snapExpression(frac) {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  const levels = [0, 25, 50, 75, 100];
  let best = 0; let bestD = Infinity;
  for (const l of levels) { const d = Math.abs(pct - l); if (d < bestD) { bestD = d; best = l; } }
  return best;
}

/** Map a 0-1 schematic mRNA level to a copy state (never a molecule count). */
export function copyState(frac) {
  if (frac < 0.1) return 'none';
  if (frac < 0.4) return 'low';
  if (frac < 0.75) return 'moderate';
  return 'high';
}

/** A transcription factor. Its activity is inherited (schematically) from a signaling node. */
export class TranscriptionFactor {
  constructor(id, def) {
    this.id = id;
    this.name = def.name || id;
    this.family = def.family || 'NOT_REPORTED';
    this.species = def.species;
    this.cellModel = def.cell_model || null;
    this.sourceSignalNode = def.source_signal_node;
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'MEDIUM';
    this.rationale = def.rationale || '';
    this.activationThreshold = typeof def.activation_threshold === 'number' ? def.activation_threshold : 0.25;
    this.activationDelayH = typeof def.activation_delay_h === 'number' ? def.activation_delay_h : 1.0;
    this.translocationDelayH = typeof def.translocation_delay_h === 'number' ? def.translocation_delay_h : 2.0;
    this.bindingDelayH = typeof def.binding_delay_h === 'number' ? def.binding_delay_h : 2.0;
    this.layout = def.layout || { col: 0, row: 0 };
    // runtime state
    this.state = 'inactive';          // inactive|activated|cytoplasmic|nuclear|dna_bound|released|degraded
    this.activity = 0;                 // schematic 0-1 (inherited from source signal node)
    this.location = 'cytoplasm';       // cytoplasm|nucleus
    this.activationTime = null;
    this.deactivationTime = null;
    this.boundPromoters = [];
  }
}

/** A schematic promoter / response element (ARE, NF-kB RE, ...). No sequence, no chromosome. */
export class PromoterRegion {
  constructor(id, def) {
    this.id = id;
    this.geneId = def.gene_id;
    this.responseElement = def.response_element || id;
    this.bindingSites = typeof def.binding_sites === 'number' ? def.binding_sites : 1;
    this.chromatin = def.chromatin || 'open'; // closed|partially_open|open
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'MEDIUM';
    this.bindingTfs = (def.binding_tfs || []).map((b) => ({
      tfId: b.tf_id, relationship: b.relationship || 'activation', weight: typeof b.weight === 'number' ? b.weight : 1.0,
      evidenceLevel: b.evidence_level || 'MECHANISTIC_PREDICTION', note: b.note || '',
    }));
    this.layout = def.layout || { col: 1, row: 0 };
    // runtime state
    this.occupied = 0;      // occupied sites
    this.occupancy = 0;     // 0-1
    this.accessible = this.chromatin !== 'closed';
  }
}

/** A gene. Expression is a SCHEMATIC level bucket, never a fold-change. */
export class Gene {
  constructor(id, def) {
    this.id = id;
    this.symbol = def.symbol || id;
    this.geneName = def.gene_name || '';
    this.species = def.species;
    this.promoterId = def.promoter_id;
    this.basalExpression = typeof def.basal_expression === 'number' ? def.basal_expression : 0;
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    this.confidence = def.confidence || 'MEDIUM';
    this.transcriptionDelayH = typeof def.transcription_delay_h === 'number' ? def.transcription_delay_h : 3.0;
    this.rationale = def.rationale || '';
    this.layout = def.layout || { col: 2, row: 0 };
    // runtime state
    this.expressionFrac = this.basalExpression / 100; // continuous internal 0-1
    this.expressionState = this.basalExpression;      // snapped level bucket
    this.polymerase = 'not_recruited';                // schematic polymerase state
    this.transcribeStartTime = null;
  }
}

/** A messenger RNA. Copy state is SCHEMATIC; no molecule count, half-life NOT_REPORTED. */
export class MessengerRNA {
  constructor(def, geneId) {
    this.id = def.id;
    this.gene = geneId;
    this.decayRatePerHour = typeof def.decay_rate_per_hour === 'number' ? def.decay_rate_per_hour : 0.08;
    this.halfLifeH = def.half_life_h != null ? def.half_life_h : 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || 'MECHANISTIC_PREDICTION';
    // runtime state
    this.level = 0;             // schematic 0-1
    this.copyState = 'none';    // none|low|moderate|high
    this.birthTime = null;
    this.degrading = false;
  }
}
