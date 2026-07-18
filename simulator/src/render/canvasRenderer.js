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
    this.lastParticleFrame = null; // [{id,x,y,state,status,payload,releaseState}] for tests
    this.particleColor = '#3a3f4b';
  }

  /** @param {import('../anatomy/anatomyModel.js').AnatomyModel} model */
  setModel(model) { this.model = model; return this; }
  /** @param {string} levelId */
  setLevel(levelId) { this.levelId = levelId; this.draw(); return this; }
  /** Phase 3: attach the transport engine whose particles are drawn as flat dots. */
  setEngine(engine) { this.engine = engine; return this; }
  /** Phase 4: attach the release engine so payload emptying is drawn per particle. */
  setReleaseEngine(releaseEngine) { this.releaseEngine = releaseEngine; return this; }

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

export default CanvasRenderer;
