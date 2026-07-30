// Phase-7A passive tumour-microenvironment (TME) objects. Runtime data carriers the
// MicroenvironmentEngine drives. The TME is a PASSIVE modulator: every field is a schematic
// ordinal state or a normalized 0-1 value - never a real ECM fibre density, collagen mass,
// interstitial pressure, oxygen concentration, or diffusion coefficient. The engine's single
// meaningful output is a drug-PENETRATION modifier that (downstream, advisory) scales
// EFFECTIVE drug availability - it never modifies drug chemistry / binding / signalling.

/** Passive collagen structural network (ordinal density/alignment/packing). */
export class CollagenNetwork {
  constructor(def = {}) {
    this.variant = def.variant || 'moderate';
    this.density = def.density ?? 0.5;              // schematic 0-1
    this.alignment = def.alignment || 'mixed';
    this.packing = def.packing || 'medium';
    this.porosityEffect = def.porosity_effect ?? 0.5;
    this.penetrationEffect = def.penetration_effect ?? 0.4;
  }
}

/** Passive extracellular matrix composite. */
export class ECMState {
  constructor() {
    this.collagen = new CollagenNetwork();
    this.hyaluronicAcid = { variant: 'moderate', diffusionModifier: 0.35, interstitialResistance: 0.4, hydrationModifier: 0.5 };
    this.proteoglycan = { variant: 'moderate', resistance: 0.35 };
    this.extracellularFluid = { variant: 'moderate', porosity: 0.45 };
    this.density = 0.5;               // schematic 0-1
    this.porosity = 0.5;             // schematic 0-1
    this.stiffness = 0.5;            // schematic 0-1
    this.diffusionResistance = 0.4;  // schematic 0-1
    this.penetrationResistance = 0.4; // schematic 0-1
  }
}

/** Passive interstitial space (available volume / path length / mobility). No fluid solver. */
export class InterstitialSpace {
  constructor(def = {}) {
    this.variant = def.variant || 'moderate';
    this.availableVolume = def.available_volume ?? 0.5;
    this.fluidResistance = def.fluid_resistance ?? 0.4;
    this.pathLength = def.path_length ?? 0.5;
    this.mobilityModifier = def.mobility_modifier ?? 0.6;
    this.diffusionResistance = def.diffusion_resistance ?? 0.4;
  }
}

/** Passive diffusion barrier (derived from ECM + interstitial). */
export class DiffusionBarrier {
  constructor() { this.resistance = 0.4; /* schematic 0-1 */ this.mobilityModifier = 0.6; }
}

/** Passive oxygen environment (qualitative state + schematic availability). No vasculature. */
export class OxygenEnvironment {
  constructor(def = {}) {
    this.state = def.state || 'normoxic';   // normoxic | mild_hypoxia | moderate_hypoxia | severe_hypoxia
    this.availability = def.availability ?? 0.9;
    this.diffusion = def.diffusion ?? 0.85;
  }
}

/** Passive hypoxia state (modifies penetration / effectiveness / stress susceptibility only). */
export class HypoxiaState {
  constructor(def = {}) {
    this.state = def.state || 'normoxic';   // normoxic | mild | moderate | severe
    this.severity = def.severity ?? 0.0;
    this.penetrationModifier = def.penetration_modifier ?? 1.0;
    this.drugEffectivenessModifier = def.drug_effectiveness_modifier ?? 1.0;
    this.stressSusceptibility = def.stress_susceptibility ?? 0.0;
    this.predictionConfidence = def.prediction_confidence || 'MEDIUM';
  }
}

/** Passive mechanical barrier (ordinal only). No modulus / pressure. */
export class MechanicalBarrier {
  constructor(def = {}) { this.state = def.state || 'moderate'; this.score = def.score ?? 0.4; }
}

/** The key output: a drug-penetration modifier (effective availability only). */
export class PenetrationModifier {
  constructor() {
    this.combinedRestriction = 0;    // schematic 0-1
    this.penetrationModifier = 1;    // schematic 0-1 (1 = full penetration)
    this.effectiveAvailability = 1;  // schematic 0-1
    this.microenvironmentState = 'permissive';
  }
}

/** Top-level passive microenvironment state. */
export class MicroenvironmentState {
  constructor(id, def) {
    this.id = id;
    this.species = def.species;
    this.tumourModel = def.tumour_model;
    this.formulation = def.formulation || null;
    this.ecm = new ECMState();
    this.interstitial = new InterstitialSpace();
    this.diffusion = new DiffusionBarrier();
    this.oxygen = new OxygenEnvironment();
    this.hypoxia = new HypoxiaState();
    this.mechanical = new MechanicalBarrier();
    this.penetration = new PenetrationModifier();
    this.microenvironmentState = 'permissive';
    this.evidenceLevel = def.evidence_level || 'NOT_REPORTED';
    this.predictionLevel = def.prediction_level || def.evidence_level || 'NOT_REPORTED';
    this.confidence = def.confidence || 'LOW';
    this.uncertainty = def.uncertainty || '';
    this.updatedAt = 0;
  }
}

export default MicroenvironmentState;
