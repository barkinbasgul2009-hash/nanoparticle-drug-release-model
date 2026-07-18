// Cell field (Phase 4B). The schematic cellular microenvironment geometry: a set
// of minimal cells (membrane + cytoplasm ONLY) in an isotropic (x,u) unit-square
// patch of the target tissue. PURE geometry - containment + membrane-contact tests,
// no simulation, no rendering. Cells hold NO nucleus/organelles/receptors - the
// registry defines only id/x/u/radius. Everything comes from the registry.

export class CellField {
  /** @param {any} registry parsed microenvironment.registry.json */
  constructor(registry) {
    if (!registry || !registry.cells || !Array.isArray(registry.cells.list)) {
      throw new Error('CellField requires a registry with cells.list[]');
    }
    this.registry = registry;
    this.membraneThickness = registry.cells.membrane_thickness || 0.008;
    /** @type {Array<{id:string,x:number,u:number,radius:number}>} */
    this.cells = registry.cells.list.map((c) => ({ id: c.id, x: c.x, u: c.u, radius: c.radius }));
  }

  /** Distance from (x,u) to a cell centre. */
  _dist(x, u, cell) { return Math.hypot(x - cell.x, u - cell.u); }

  /** The cell whose cytoplasm (interior, inside the membrane) contains (x,u), or null. */
  cytoplasmCell(x, u) {
    for (const c of this.cells) {
      if (this._dist(x, u, c) < c.radius - this.membraneThickness) return c;
    }
    return null;
  }

  /** True if (x,u) is outside every cell (extracellular fluid). */
  isExtracellular(x, u) {
    for (const c of this.cells) if (this._dist(x, u, c) <= c.radius) return false;
    return true;
  }

  /**
   * If an extracellular point is within `band` of a cell's membrane, return that
   * contact { cell, dist }, else null. Used for the passive-crossing check.
   */
  membraneContact(x, u, band) {
    let best = null;
    for (const c of this.cells) {
      const d = this._dist(x, u, c);
      if (d >= c.radius && d <= c.radius + band) {
        if (!best || d < best.dist) best = { cell: c, dist: d };
      }
    }
    return best;
  }

  /**
   * A point just INSIDE the membrane of `cell` on the radial line through (x,u).
   * Used when a molecule passively crosses - a small radial step, never a teleport.
   */
  justInside(x, u, cell) {
    const dx = x - cell.x; const du = u - cell.u;
    const d = Math.hypot(dx, du) || 1e-9;
    const target = cell.radius - this.membraneThickness * 1.5;
    return { x: cell.x + (dx / d) * target, u: cell.u + (du / d) * target };
  }

  /** Reflect a cytoplasm point back inside its cell if it drifted past the membrane. */
  confineToCytoplasm(x, u, cell) {
    const dx = x - cell.x; const du = u - cell.u;
    const d = Math.hypot(dx, du);
    // keep a margin inside the membrane so points stay strictly within the cytoplasm
    const maxR = cell.radius - this.membraneThickness * 1.5;
    if (d <= maxR) return { x, u };
    const s = maxR / (d || 1e-9);
    return { x: cell.x + dx * s, u: cell.u + du * s };
  }
}

export default CellField;
