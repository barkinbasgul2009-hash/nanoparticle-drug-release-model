// Intracellular drug molecule (Phase 4D). An INDEPENDENT free-drug object created
// when a carrier releases its payload INSIDE the cell. It only diffuses (Brownian)
// within its cell's cytoplasm and may (evidence-gated) degrade or drift toward the
// nucleus. It never merges back into the carrier, never exits the cell, and never
// enters a neighbouring cell. Coordinates live in the isotropic (x,u) tissue patch.

let _seq = 0;

export class IntracellularDrug {
  /**
   * @param {{ x:number, u:number, species:string, diffusion:number, cellId:string,
   *   parentCarrierId:string, releaseTimeH?:number, evidenceLevel?:string,
   *   targetCompartment?:string }} opts
   */
  constructor(opts) {
    if (!opts || !opts.species) throw new Error('IntracellularDrug requires a species');
    _seq += 1;
    this.id = `icd-${_seq}`;
    this.parentCarrierId = opts.parentCarrierId || null;
    this.species = opts.species;
    this.x = opts.x;
    this.u = opts.u;                 // "y" position (relative depth in the patch)
    this.vx = 0;
    this.vu = 0;
    this.diffusion = opts.diffusion; // schematic diffusion coefficient (sim units)
    this.releaseTimeH = typeof opts.releaseTimeH === 'number' ? opts.releaseTimeH : 0;
    this.cellId = opts.cellId || null;
    /** @type {'cytoplasm'|'nuclear_membrane'} */
    this.compartment = 'cytoplasm';
    this.alive = true;               // becomes false only via evidence-gated degradation
    this.evidenceLevel = opts.evidenceLevel || 'NOT_REPORTED';
    this.targetCompartment = opts.targetCompartment || 'cytoplasm'; // 'cytoplasm' | 'nucleus'
  }

  get position() { return { x: this.x, y: this.u }; }

  static _resetSequence() { _seq = 0; }
}

export default IntracellularDrug;
