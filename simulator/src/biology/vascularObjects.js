// Phase-7B tumour-vasculature / angiogenesis objects. Runtime data carriers the
// VascularEngine drives. The vasculature is an ACTIVE architectural component but a PASSIVE
// modulator of drug delivery: every field is a schematic ordinal state or a normalized 0-1
// value - never a real vessel count, blood flow, oxygen partial pressure, vascular diameter,
// or perfusion rate. Vessels MODIFY oxygen / nutrient / drug accessibility / penetration
// opportunity only - they never signal, induce apoptosis, or remodel. The engine's key
// output is a drug-DELIVERY modifier (effective drug arrival) that is advisory downstream.

/** Vessel architecture (density / branching / maturity / organization). No endothelial cells. */
export class VesselState {
  constructor(def = {}) {
    this.angiogenicState = def.angiogenic_state || 'moderately_vascularized';
    this.vesselDensity = def.vessel_density ?? 0.5;      // schematic 0-1
    this.branchingComplexity = def.branching_complexity || 'moderate';
    this.organization = def.organization || 'irregular';
    this.maturity = def.maturity || 'developing';
    this.maturityValue = def.maturity_value ?? 0.45;     // schematic 0-1
    this.deliveryEfficiency = def.delivery_efficiency ?? 0.5;
  }
}

/** The vascular network (top-level vessel container). */
export class VascularNetwork {
  constructor() { this.vessels = new VesselState(); this.density = 0.5; this.organization = 'irregular'; }
}

/** Perfusion state (ordinal efficiency). No blood-flow calculation. */
export class PerfusionState {
  constructor(def = {}) { this.state = def.state || 'moderate'; this.efficiency = def.efficiency ?? 0.55; }
}

/** Vascular oxygen supply (independent from the ECM passive oxygen field). */
export class OxygenSupply {
  constructor(def = {}) { this.state = def.state || 'moderate'; this.supply = def.supply ?? 0.55; }
}

/** Nutrient environment (ordinal relative availability). */
export class NutrientEnvironment {
  constructor(def = {}) { this.state = def.state || 'adequate'; this.availability = def.availability ?? 0.65; }
}

/** Vascular permeability (ordinal; abstracted leakiness). No junction / pore-size model. */
export class PermeabilityState {
  constructor(def = {}) { this.state = def.state || 'moderate'; this.value = def.value ?? 0.45; }
}

/** The key output: a drug-delivery modifier (effective drug arrival only). */
export class DeliveryModifier {
  constructor() {
    this.deliveryModifier = 1;       // schematic 0-1 (1 = unrestricted vascular delivery)
    this.effectiveArrival = 1;       // schematic 0-1
    this.deliveryState = 'good_delivery';
  }
}

/** Top-level vascular state. */
export class VascularState {
  constructor(id, def) {
    this.id = id;
    this.species = def.species;
    this.tumourModel = def.tumour_model;
    this.formulation = def.formulation || null;
    this.network = new VascularNetwork();
    this.perfusion = new PerfusionState();
    this.oxygen = new OxygenSupply();
    this.nutrient = new NutrientEnvironment();
    this.permeability = new PermeabilityState();
    this.delivery = new DeliveryModifier();
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
    this.updatedAt = 0;
  }
}

export default VascularState;
