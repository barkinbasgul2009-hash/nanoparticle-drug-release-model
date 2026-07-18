// Canvas renderer (Phase 2). Implements the Phase-1 Renderer interface and draws
// STATIC anatomical cross-section bands only. No particles, no lighting engine,
// no shaders, no GPU simulation, no animation. It computes the layout with the
// pure anatomyLayout engine and, in a browser, paints flat bands + labels to a
// 2D canvas. In Node it computes the layout but paints nothing (still testable).

import { computeAnatomyLayout, computeLabelPlacements } from './anatomyLayout.js';

/** @implements {import('./renderer.js').Renderer} */
export class CanvasRenderer {
  constructor(opts = {}) {
    this.logger = opts.logger || null;
    this.kind = 'canvas';
    this.canvas = null;
    this.ctx = null;
    this.mounted = false;
    /** @type {import('../anatomy/anatomyModel.js').AnatomyModel|null} */
    this.model = null;
    this.levelId = 'L1';
    this.viewport = { width: 640, height: 400 };
    this.lastLayout = null;      // exposed for tests / debug
    this.showNotToScale = true;
    // Phase 3: optional transport particle overlay (static anatomy stays beneath).
    this.engine = null;          // TransportEngine (source of particles)
    this.releaseEngine = null;   // Phase 4: ReleaseEngine (payload state per particle)
    this.uptakeEngine = null;    // Phase 4B: UptakeEngine (free molecules + cells)
    this.endocytosisEngine = null; // Phase 4C: EndocytosisEngine (carrier fate)
    this.intracellularEngine = null; // Phase 4D: IntracellularReleaseEngine (nucleus + intra drug)
    this.lastParticleFrame = null; // [{id,x,y,state,status,payload,releaseState}] for tests
    this.lastMoleculeFrame = null; // Phase 4B: [{id,x,y,compartment,alive}] for tests
    this.lastCellFrame = null;     // Phase 4B: [{id,x,y,r}] for tests
    this.lastEndocytosisFrame = null; // Phase 4C: [{carrierId,x,y,state,pathway,compartment,wrap}]
    this.lastNucleusFrame = null;  // Phase 4D: [{cellId,x,y,r}]
    this.lastIntracellularFrame = null; // Phase 4D: [{id,x,y,compartment,alive,target}]
    this.particleColor = '#3a3f4b';
    this.moleculeColor = '#7a5a3c';
    this.intracellularColor = '#8a4b6b';
    this.cellFill = 'rgba(150,170,175,0.16)';
    this.membraneColor = '#6f8a86';
    this.nucleusFill = 'rgba(195,183,214,0.28)';
    this.nucleusColor = '#8b7aa8';
    this.compartmentColors = { early_endosome: '#bcd0a8', late_endosome: '#a8bcd0', lysosome: '#d0a8bc' };
  }

  /** @param {import('../anatomy/anatomyModel.js').AnatomyModel} model */
  setModel(model) { this.model = model; return this; }
  /** @param {string} levelId */
  setLevel(levelId) { this.levelId = levelId; this.draw(); return this; }
  /** Phase 3: attach the transport engine whose particles are drawn as flat dots. */
  setEngine(engine) { this.engine = engine; return this; }
  /** Phase 4: attach the release engine so payload emptying is drawn per particle. */
  setReleaseEngine(releaseEngine) { this.releaseEngine = releaseEngine; return this; }
  /** Phase 4B: attach the uptake engine so cells + free drug molecules are drawn. */
  setUptakeEngine(uptakeEngine) { this.uptakeEngine = uptakeEngine; return this; }
  /** Phase 4C: attach the endocytosis engine so carrier fate (vesicles) is drawn. */
  setEndocytosisEngine(endocytosisEngine) { this.endocytosisEngine = endocytosisEngine; return this; }
  /** Phase 4D: attach the intracellular engine so nucleus + intracellular drug are drawn. */
  setIntracellularEngine(intracellularEngine) { this.intracellularEngine = intracellularEngine; return this; }

  mount(mountEl) {
    this.mounted = true;
    if (typeof document !== 'undefined' && mountEl) {
      const canvas = document.createElement('canvas');
      canvas.className = 'sim-canvas';
      canvas.width = mountEl.clientWidth || this.viewport.width;
      canvas.height = mountEl.clientHeight || this.viewport.height;
      mountEl.appendChild(canvas);
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.viewport = { width: canvas.width, height: canvas.height };
    }
    this._log('info', 'app', 'CanvasRenderer mounted (static anatomy only)');
    this.draw();
  }

  clear() {
    if (this.ctx) this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);
  }

  setCamera(/* cameraDescriptor */) {
    // Phase 2 uses static viewpoints only; the camera descriptor is accepted but
    // no camera animation/orbit is performed.
  }

  /** Recompute the layout and (browser) paint it. Returns the layout for tests. */
  draw() {
    if (!this.model) return null;
    const layout = computeAnatomyLayout(this.model, this.levelId, this.viewport);
    this.lastLayout = layout;
    // Phase 3: compute the particle frame (headless-testable) whether or not we paint.
    this.lastParticleFrame = this._particleFrame(layout);
    // Phase 4B: compute the cell + molecule frames (headless-testable too).
    const micro = this._microFrames(layout);
    this.lastCellFrame = micro.cells;
    this.lastMoleculeFrame = micro.molecules;
    // Phase 4C: endocytosis carrier-fate frame.
    this.lastEndocytosisFrame = this._endocytosisFrame(layout);
    // Phase 4D: nucleus + intracellular drug frames.
    this.lastNucleusFrame = this._nucleusFrame();
    this.lastIntracellularFrame = this._intracellularFrame(layout);
    if (!this.ctx) return layout; // headless: computed but not painted

    this.clear();
    for (const band of layout.bands) {
      this.ctx.globalAlpha = band.emphasized ? 1 : 0.5;
      this.ctx.fillStyle = band.color;
      this.ctx.fillRect(0, band.y, this.viewport.width, band.h);
      this.ctx.globalAlpha = 1;
      // thin boundary line
      this.ctx.strokeStyle = this.model.palette.boundary_line || '#8a8072';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(0, band.y);
      this.ctx.lineTo(this.viewport.width, band.y);
      this.ctx.stroke();
    }
    // labels (anatomical names only)
    const labels = computeLabelPlacements(layout.bands, 16);
    this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
    this.ctx.font = '12px system-ui, sans-serif';
    this.ctx.textBaseline = 'middle';
    for (const l of labels) this.ctx.fillText(l.text, 8, l.y);

    // Phase 4B: cellular microenvironment beneath the carriers - semi-transparent
    // schematic cells (membrane + cytoplasm only), drawn once molecules exist.
    if (this.lastCellFrame && this.lastCellFrame.length) {
      for (const c of this.lastCellFrame) {
        this.ctx.fillStyle = this.cellFill;
        this.ctx.beginPath();
        this.ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = this.membraneColor; // thin visible membrane
        this.ctx.lineWidth = 1.2;
        this.ctx.stroke();
      }
    }

    // Phase 4D: schematic nucleus (membrane + interior + label) inside each cell.
    if (this.lastNucleusFrame && this.lastNucleusFrame.length) {
      this.ctx.font = '9px system-ui, sans-serif';
      this.ctx.textBaseline = 'middle';
      for (const n of this.lastNucleusFrame) {
        this.ctx.fillStyle = this.nucleusFill;
        this.ctx.beginPath();
        this.ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = this.nucleusColor; // nuclear membrane
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    }

    // Phase 3: particles as flat muted dots (no glow, no trail, no gaming FX).
    // Phase 3.1: carrier shell is dashed for PREDICTIVE, solid for EXPERIMENTAL.
    // Phase 4: an inner payload disc (area proportional to remaining payload)
    // shrinks as the drug releases, until the carrier is empty (shell only).
    if (this.lastParticleFrame && this.lastParticleFrame.length) {
      const r = this.engine && this.engine.transport ? this.engine.transport.particleRadiusPx() : 3;
      const predictive = !!(this.engine && this.engine.isPredictive && this.engine.isPredictive());
      this.ctx.strokeStyle = this.particleColor;
      this.ctx.fillStyle = this.particleColor;
      this.ctx.lineWidth = 1.2;
      for (const pt of this.lastParticleFrame) {
        if (this._isEndocytosed(pt.id)) continue; // carrier now drawn by the endocytosis layer
        this.ctx.globalAlpha = pt.status === 'arrived' ? 1 : 0.85;
        // carrier shell
        this.ctx.setLineDash(predictive ? [2, 2] : []);
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        this.ctx.stroke();
        // payload inside (shrinks to nothing when empty)
        const pr = r * Math.sqrt(Math.max(0, Math.min(1, pt.payload)));
        if (pr > 0.3) {
          this.ctx.beginPath();
          this.ctx.arc(pt.x, pt.y, pr, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.setLineDash([]);
      this.ctx.globalAlpha = 1;
    }

    // Phase 4B: free drug molecules - tiny muted dots (much smaller than carriers),
    // slightly dimmer inside the cytoplasm. No glow / trails / FX.
    if (this.lastMoleculeFrame && this.lastMoleculeFrame.length) {
      this.ctx.fillStyle = this.moleculeColor;
      for (const mo of this.lastMoleculeFrame) {
        this.ctx.globalAlpha = mo.compartment === 'cytoplasm' ? 0.9 : 0.7;
        this.ctx.beginPath();
        this.ctx.arc(mo.x, mo.y, mo.r, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
    }

    // Phase 4C: endocytosis carrier fate - membrane wrapping, vesicles, compartment
    // labels. Particle colour is unchanged; state is shown by vesicle + label + wrap.
    if (this.lastEndocytosisFrame && this.lastEndocytosisFrame.length) {
      this.ctx.font = '9px system-ui, sans-serif';
      this.ctx.textBaseline = 'middle';
      for (const e of this.lastEndocytosisFrame) {
        const r = 3;
        // compartment vesicle ring
        if (e.compartment) {
          this.ctx.strokeStyle = this.compartmentColors[e.compartment] || this.membraneColor;
          this.ctx.lineWidth = 1.6;
          this.ctx.setLineDash([]);
          this.ctx.beginPath();
          this.ctx.arc(e.x, e.y, r + 3.5, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.fillStyle = this.compartmentColors[e.compartment] || this.membraneColor;
          this.ctx.fillText(compLabel(e.compartment), e.x + r + 6, e.y);
        }
        // wrapping arc (membrane curvature during internalisation)
        if (e.state === 'WRAPPING') {
          this.ctx.strokeStyle = this.membraneColor;
          this.ctx.lineWidth = 1.6;
          this.ctx.beginPath();
          this.ctx.arc(e.x, e.y, r + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.05, e.wrap));
          this.ctx.stroke();
        }
        // carrier dot (colour unchanged)
        this.ctx.fillStyle = this.particleColor;
        this.ctx.globalAlpha = 1;
        this.ctx.beginPath();
        this.ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    // Phase 4D: intracellular free drug (released inside the cell) - tiny dots; a
    // subtle tick toward the nucleus when targeting is active. Degraded molecules fade.
    if (this.lastIntracellularFrame && this.lastIntracellularFrame.length) {
      for (const mo of this.lastIntracellularFrame) {
        this.ctx.globalAlpha = mo.alive ? (mo.compartment === 'nuclear_membrane' ? 1 : 0.85) : 0.25;
        this.ctx.fillStyle = this.intracellularColor;
        this.ctx.beginPath();
        this.ctx.arc(mo.x, mo.y, 1.3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
    }

    // Phase 3.1: evidence-level caption (users must always know the mode).
    if (this.engine && this.engine.evidenceLevelName && this.engine.particles && this.engine.particles.length) {
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
      this.ctx.font = '10px system-ui, sans-serif';
      this.ctx.fillText(`Evidence: ${cap(this.engine.evidenceLevelName())}`, 8, this.viewport.height - 22);
    }

    if (this.showNotToScale && layout.notToScale) {
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
      this.ctx.font = '10px system-ui, sans-serif';
      this.ctx.fillText('schematic - not to scale', 8, this.viewport.height - 8);
    }
    return layout;
  }

  /**
   * Map engine particles (normalized x in [0,1], depth d in [0,1]) into pixel
   * positions using the CURRENT layout's depth window. Pure - returns the frame.
   * @param {{ window:[number,number] }} layout
   */
  _particleFrame(layout) {
    if (!this.engine || !this.engine.particles || !this.engine.particles.length) return [];
    const [wTop, wBot] = layout.window || [0, 1];
    const span = Math.max(1e-6, wBot - wTop);
    const H = this.viewport.height;
    const W = this.viewport.width;
    const rel = this.releaseEngine || null;
    return this.engine.particles.map((p) => {
      const rs = rel ? rel.stateFor(p.id) : null;
      return {
        id: p.id,
        x: p.x * W,
        y: Math.max(0, Math.min(1, (p.d - wTop) / span)) * H,
        state: p.state,
        status: p.transportStatus,
        payload: rs ? rs.payloadFraction : 1,
        releaseState: rs ? rs.releaseState : null,
      };
    });
  }

  dispose() {
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.canvas = null; this.ctx = null; this.mounted = false;
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

/** Title-case an EVIDENCE_LEVEL for display (EXPERIMENTAL -> Experimental). */
function cap(s) { return typeof s === 'string' && s.length ? s[0] + s.slice(1).toLowerCase() : s; }

/** Short compartment label for the endocytosis vesicle. */
function compLabel(c) {
  return c === 'early_endosome' ? 'Early endosome' : c === 'late_endosome' ? 'Late endosome' : c === 'lysosome' ? 'Lysosome' : c;
}

/** True if a carrier id is being handled by the endocytosis layer (past extracellular). */
CanvasRenderer.prototype._isEndocytosed = function _isEndocytosed(id) {
  const eng = this.endocytosisEngine;
  if (!eng || !eng.states) return false;
  const s = eng.states.get(id);
  return !!(s && s.state !== 'EXTRACELLULAR');
};

// Phase 4C endocytosis frame: per-carrier fate mapped into pixel space via the dermis band.
CanvasRenderer.prototype._endocytosisFrame = function _endocytosisFrame(layout) {
  const eng = this.endocytosisEngine;
  if (!eng || !eng.states || !eng.states.size) return [];
  const band = (this.engine && this.engine.layerBands ? this.engine.layerBands : []).find((b) => b.id === 'dermis') || { start: 0.3, end: 0.7 };
  const span = Math.max(1e-6, band.end - band.start);
  const [wTop, wBot] = layout.window || [0, 1];
  const win = Math.max(1e-6, wBot - wTop);
  const H = this.viewport.height; const W = this.viewport.width;
  const yOf = (u) => Math.max(0, Math.min(1, ((band.start + u * span) - wTop) / win)) * H;
  return eng.frame().map((e) => ({
    carrierId: e.carrierId, x: e.x * W, y: yOf(e.u),
    state: e.state, pathway: e.pathway, compartment: e.compartment, wrap: e.wrap,
  }));
};

// Phase 4D: schematic nucleus per cell (concentric), derived from the cell frame.
CanvasRenderer.prototype._nucleusFrame = function _nucleusFrame() {
  const eng = this.intracellularEngine;
  if (!eng || !this.lastCellFrame || !this.lastCellFrame.length) return [];
  const frac = (eng.nucleusCfg && eng.nucleusCfg.radius_fraction) || 0.42;
  return this.lastCellFrame.map((c) => ({ cellId: c.id, x: c.x, y: c.y, r: Math.max(1.5, c.r * frac) }));
};

// Phase 4D: intracellular free drug molecules mapped into pixel space via the dermis band.
CanvasRenderer.prototype._intracellularFrame = function _intracellularFrame(layout) {
  const eng = this.intracellularEngine;
  if (!eng || !eng.molecules || !eng.molecules.length) return [];
  const band = (this.engine && this.engine.layerBands ? this.engine.layerBands : []).find((b) => b.id === 'dermis') || { start: 0.3, end: 0.7 };
  const span = Math.max(1e-6, band.end - band.start);
  const [wTop, wBot] = layout.window || [0, 1];
  const win = Math.max(1e-6, wBot - wTop);
  const H = this.viewport.height; const W = this.viewport.width;
  const yOf = (u) => Math.max(0, Math.min(1, ((band.start + u * span) - wTop) / win)) * H;
  return eng.molecules.map((m) => ({ id: m.id, x: m.x * W, y: yOf(m.u), compartment: m.compartment, alive: m.alive, target: m.targetCompartment }));
};

// Phase 4B micro-frame helper attached to the prototype below (kept out of draw()).
CanvasRenderer.prototype._microFrames = function _microFrames(layout) {
  const empty = { cells: [], molecules: [] };
  const up = this.uptakeEngine;
  if (!up || !up.molecules || !up.molecules.length) return empty; // cells appear with molecules
  const band = (this.engine && this.engine.layerBands ? this.engine.layerBands : []).find((b) => b.id === 'dermis') || { start: 0.3, end: 0.7 };
  const span = Math.max(1e-6, band.end - band.start);
  const [wTop, wBot] = layout.window || [0, 1];
  const win = Math.max(1e-6, wBot - wTop);
  const H = this.viewport.height; const W = this.viewport.width;
  const yOf = (u) => {
    const d = band.start + u * span;               // (x,u) patch -> global depth
    return Math.max(0, Math.min(1, (d - wTop) / win)) * H;
  };
  const bandPx = Math.abs(yOf(1) - yOf(0)) || H;    // dermis band height in px (u scale)
  const cells = (up.cells && up.cells.cells ? up.cells.cells : []).map((c) => ({
    id: c.id, x: c.x * W, y: yOf(c.u), r: Math.max(2, c.radius * bandPx),
  }));
  const molecules = up.molecules.map((m) => ({
    id: m.id, x: m.x * W, y: yOf(m.u), r: 1.3, compartment: m.compartment, alive: m.alive,
  }));
  return { cells, molecules };
};

export default CanvasRenderer;
