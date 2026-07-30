// Particle object (Phase 3). An independent simulation object representing ONE
// topical NLC carrier. It holds identity, species compatibility, current layer +
// state, normalized position/velocity, transport status, and an evidence tag. It
// carries NO drug payload and models NO cell entry - transport only.
//
// Coordinate model (normalized, resolution-independent): x in [0,1] across the
// cross-section; d (depth) in [0,1] from the surface (0) to the bottom of the
// tissue stack (1). The renderer maps (x,d) to pixels.

let _seq = 0;

export class Particle {
  /**
   * @param {{ species:string, x?:number, d?:number, state?:string, layer?:string,
   *   charge?:string, evidence?:object }} opts
   */
  constructor(opts) {
    if (!opts || !opts.species) throw new Error('Particle requires a species');
    _seq += 1;
    this.id = `np-${_seq}`;
    this.species = opts.species;         // species this particle belongs to
    this.charge = opts.charge || 'cationic'; // label only (Chen surface-charge class)
    this.x = typeof opts.x === 'number' ? opts.x : 0.5;
    this.d = typeof opts.d === 'number' ? opts.d : 0; // depth 0..1
    this.vx = 0;
    this.vd = 0;
    this.state = opts.state || 'formulation';
    this.layer = opts.layer || null;
    /** @type {'spawned'|'moving'|'crossing_barrier'|'arrived'} */
    this.transportStatus = 'spawned';
    this.evidenceTag = opts.evidence || null; // evidence descriptor for its current transition
    this.crossings = [];                 // ordered record of layer/state boundaries crossed
  }

  /** Does this particle belong to the given species? (species-driven; no fallback) */
  compatibleWith(species) { return this.species === species; }

  /** Mark a boundary crossing (for tests / evidence exposure). */
  recordCrossing(fromState, toState, evidence) {
    this.crossings.push({ from: fromState, to: toState, evidence: evidence || null });
  }

  /** Reset the id sequence (tests only). */
  static _resetSequence() { _seq = 0; }
}

export default Particle;
