// Label system (Phase 2). Thin wrapper over the pure label placement in
// anatomyLayout: exposes the anatomical NAMES (no explanatory text) for the
// currently visible bands and their non-overlapping vertical positions. Rendering
// of the labels is done by the CanvasRenderer; this module is the data side so
// tests and UI can query "which labels are shown" without a canvas.

import { computeLabelPlacements } from '../render/anatomyLayout.js';

export class LabelSystem {
  /** @param {{ model: object }} opts */
  constructor(opts) {
    if (!opts || !opts.model) throw new Error('LabelSystem requires model');
    this.model = opts.model;
  }

  /**
   * @param {{ bands: Array<object> }} layout from computeAnatomyLayout
   * @returns {Array<{ id:string, text:string, y:number }>}
   */
  placements(layout) {
    return computeLabelPlacements(layout.bands || [], 16);
  }

  /** Anatomical names for the tissue layers (labels only, no descriptions). */
  names() {
    return this.model.tissueLayers().filter((l) => l.label).map((l) => ({ id: l.id, text: l.name }));
  }
}

export default LabelSystem;
