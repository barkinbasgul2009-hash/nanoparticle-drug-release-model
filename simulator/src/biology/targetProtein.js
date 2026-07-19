// Target protein (Phase 5A). A schematic, generic molecular TARGET - an individual
// protein, NOT a cell or organelle. It holds identity, position, compartment, site
// capacity/occupancy, binding state, species, evidence level and kinetic model.
// It carries no disease-specific assumptions and nothing downstream of binding.

let _seq = 0;

export class TargetProtein {
  /**
   * @param {{ type:string, x:number, u:number, compartment:string, availableSites?:number,
   *   species:string, evidenceLevel?:string, kineticModel?:string, cellId?:string }} opts
   */
  constructor(opts) {
    if (!opts || !opts.type || !opts.species) throw new Error('TargetProtein requires type + species');
    _seq += 1;
    this.id = `tgt-${_seq}`;
    this.type = opts.type;                 // enzyme / receptor / nuclear_protein / ...
    this.x = opts.x;
    this.u = opts.u;
    this.compartment = opts.compartment || 'cytoplasm'; // 'cytoplasm' | 'nucleus'
    this.availableSites = typeof opts.availableSites === 'number' ? opts.availableSites : 1;
    this.occupiedSites = 0;
    this.species = opts.species;
    this.evidenceLevel = opts.evidenceLevel || 'NOT_REPORTED';
    this.kineticModel = opts.kineticModel || 'reversible'; // 'reversible' | 'irreversible'
    /** @type {string[]} ids of drug molecules currently bound. */
    this.boundDrugIds = [];
    this.cellId = opts.cellId || null;
  }

  hasFreeSite() { return this.occupiedSites < this.availableSites; }
  /** Fractional occupancy of THIS target (0..1). */
  occupancy() { return this.availableSites > 0 ? this.occupiedSites / this.availableSites : 0; }

  bind(drugId) {
    if (!this.hasFreeSite()) return false;
    if (this.boundDrugIds.includes(drugId)) return false;
    this.boundDrugIds.push(drugId);
    this.occupiedSites += 1;
    return true;
  }

  release(drugId) {
    const i = this.boundDrugIds.indexOf(drugId);
    if (i < 0) return false;
    this.boundDrugIds.splice(i, 1);
    this.occupiedSites = Math.max(0, this.occupiedSites - 1);
    return true;
  }

  static _resetSequence() { _seq = 0; }
}

export default TargetProtein;
