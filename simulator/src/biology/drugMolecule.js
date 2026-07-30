// Drug molecule (Phase 4B). An INDEPENDENT free-drug simulation object created when
// a carrier releases payload. It undergoes ONLY diffusion (Brownian) - no chemistry,
// reactions, degradation or metabolism. Coordinates live in the isotropic (x,u) patch
// of the target tissue (u = relative depth within the dermis band). Once free it is
// never merged back into the carrier.

let _seq = 0;

export class DrugMolecule {
  /**
   * @param {{ x:number, u:number, species:string, diffusion:number,
   *   releaseTimeH?:number, evidence?:object, carrierId?:string }} opts
   */
  constructor(opts) {
    if (!opts || !opts.species) throw new Error('DrugMolecule requires a species');
    _seq += 1;
    this.id = `dm-${_seq}`;
    this.x = opts.x;
    this.u = opts.u;                 // "y" position (relative depth in the dermis patch)
    this.vx = 0;
    this.vu = 0;                     // velocity components
    this.diffusion = opts.diffusion; // schematic diffusion coefficient (sim units)
    this.species = opts.species;
    this.releaseTimeH = typeof opts.releaseTimeH === 'number' ? opts.releaseTimeH : 0; // timestamp
    this.alive = true;
    this.evidenceTag = opts.evidence || null;
    this.carrierId = opts.carrierId || null;
    /** @type {'extracellular'|'cytoplasm'} */
    this.compartment = 'extracellular';
    this.cellId = null;
    this.contacted = false;          // has it ever touched a membrane? (uptake requires contact)
  }

  /** Position accessor {x,y} (y = u). */
  get position() { return { x: this.x, y: this.u }; }

  static _resetSequence() { _seq = 0; }
}

export default DrugMolecule;
