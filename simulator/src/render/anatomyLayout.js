// Pure anatomical layout engine (Phase 2). Given the anatomy model, a scale
// level, and a viewport size, it computes the cross-section band rectangles,
// their visibility, dim state, and label placement. NO drawing happens here, so
// it is fully unit-testable in Node without a canvas/DOM.
//
// Coordinate model: a vertical cross-section. y grows downward from the surface.
// The full tissue stack maps to a normalized depth axis [0,1]; a scale level's
// depth_window [top,bottom] selects the visible slice (this IS the "zoom").

/**
 * @typedef {object} Band
 * @property {string} id
 * @property {string} name
 * @property {number} y        top pixel
 * @property {number} h        height pixels
 * @property {number} yBottom
 * @property {string} color
 * @property {boolean} emphasized
 * @property {boolean} labelVisible
 * @property {number} labelY    band centre (pixels)
 */

/**
 * @param {import('../anatomy/anatomyModel.js').AnatomyModel} model
 * @param {string} levelId
 * @param {{ width:number, height:number }} viewport
 * @returns {{ bands: Band[], notToScale: boolean, level: string, window: [number,number] }}
 */
export function computeAnatomyLayout(model, levelId, viewport) {
  const cfg = model.levelConfig(levelId) || { visible: model.tissueLayers().map((l) => l.id), emphasized: [], depth_window: [0, 1] };
  const win = normWindow(cfg.depth_window);
  const visibleIds = new Set(cfg.visible || []);
  const emphasized = new Set(cfg.emphasized || []);
  const weights = model.weights();
  const minLabelPx = (model.labelsCfg && model.labelsCfg.min_band_px_for_label) || 14;

  // Build cumulative normalized offsets for the ORDERED tissue stack using draw
  // weights (schematic, ordinal). 'air' is excluded from the tissue depth axis.
  const stack = model.layers.filter((l) => l.id !== 'air');
  const total = stack.reduce((s, l) => s + (weights[l.id] || 0), 0) || 1;
  let acc = 0;
  const spans = stack.map((l) => {
    const start = acc / total;
    acc += (weights[l.id] || 0);
    const end = acc / total;
    return { id: l.id, name: l.name, start, end };
  });

  const [wTop, wBot] = win;
  const winSpan = Math.max(1e-6, wBot - wTop);

  /** @type {Band[]} */
  const bands = [];
  for (const s of spans) {
    if (!visibleIds.has(s.id)) continue;
    // Map this layer's normalized span into the visible depth window, then to px.
    const nTop = clamp01((s.start - wTop) / winSpan);
    const nBot = clamp01((s.end - wTop) / winSpan);
    if (nBot <= 0 || nTop >= 1) continue; // fully outside the window
    const y = nTop * viewport.height;
    const yBottom = nBot * viewport.height;
    const h = Math.max(0, yBottom - y);
    bands.push({
      id: s.id,
      name: s.name,
      y,
      h,
      yBottom,
      color: model.colorOf(s.id),
      emphasized: emphasized.size === 0 ? true : emphasized.has(s.id),
      labelVisible: h >= minLabelPx && !!(model.layer(s.id) && model.layer(s.id).label),
      labelY: y + h / 2,
    });
  }
  return { bands, notToScale: model.notToScale, level: levelId, window: win };
}

/**
 * Resolve non-overlapping label positions from a layout. Labels nudge to avoid
 * collisions while staying within their band where possible. Pure + testable.
 * @param {Band[]} bands @param {number} lineHeight
 * @returns {Array<{ id:string, text:string, y:number }>}
 */
export function computeLabelPlacements(bands, lineHeight = 16) {
  const labels = bands.filter((b) => b.labelVisible).map((b) => ({ id: b.id, text: b.name, y: b.labelY, min: b.y, max: b.yBottom }));
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i += 1) {
    const prev = labels[i - 1];
    const cur = labels[i];
    if (cur.y - prev.y < lineHeight) cur.y = prev.y + lineHeight;
  }
  return labels.map((l) => ({ id: l.id, text: l.text, y: l.y }));
}

function normWindow(w) {
  if (!Array.isArray(w) || w.length !== 2) return [0, 1];
  const top = clamp01(w[0]);
  const bot = clamp01(w[1]);
  return bot > top ? [top, bot] : [0, 1];
}
function clamp01(v) { return Math.max(0, Math.min(1, v)); }

export default computeAnatomyLayout;
