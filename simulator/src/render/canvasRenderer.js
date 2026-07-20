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
    this.targetEngine = null;      // Phase 5A: TargetEngagementEngine (targets + binding)
    this.lastParticleFrame = null; // [{id,x,y,state,status,payload,releaseState}] for tests
    this.lastMoleculeFrame = null; // Phase 4B: [{id,x,y,compartment,alive}] for tests
    this.lastCellFrame = null;     // Phase 4B: [{id,x,y,r}] for tests
    this.lastEndocytosisFrame = null; // Phase 4C: [{carrierId,x,y,state,pathway,compartment,wrap}]
    this.lastNucleusFrame = null;  // Phase 4D: [{cellId,x,y,r}]
    this.lastIntracellularFrame = null; // Phase 4D: [{id,x,y,compartment,alive,target}]
    this.lastTargetFrame = null;   // Phase 5A: [{id,x,y,type,occupancy,occupied,available}]
    this.lastSignalFrame = null;      // Phase 5B.2: signaling nodes (activity/state/predicted/visible)
    this.lastSignalEdgeFrame = null;  // Phase 5B.2: signaling edges (flowing/active/predicted/visible)
    this.lastTranscriptionFrame = null; // Phase 5C: { tfs, promoters, genes } gene-regulation diagram
    this.lastTranslationFrame = null;   // Phase 5D: { outputs } translation / protein-synthesis diagram
    this.particleColor = '#3a3f4b';
    this.moleculeColor = '#7a5a3c';
    this.intracellularColor = '#8a4b6b';
    this.cellFill = 'rgba(150,170,175,0.16)';
    this.membraneColor = '#6f8a86';
    this.nucleusFill = 'rgba(195,183,214,0.28)';
    this.nucleusColor = '#8b7aa8';
    this.compartmentColors = { early_endosome: '#bcd0a8', late_endosome: '#a8bcd0', lysosome: '#d0a8bc' };
    this.targetColor = '#4b6b57';
    this.boundDrugColor = '#a83c3c';
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
  /** Phase 5A: attach the target-engagement engine so targets + bound drug are drawn. */
  setTargetEngagementEngine(targetEngine) { this.targetEngine = targetEngine; return this; }
  /** Phase 5B.2: attach the signal-propagation engine so the pathway diagram is drawn. */
  setSignalPropagationEngine(signalEngine) { this.signalEngine = signalEngine; return this; }
  /** Phase 5C: attach the transcription engine so the gene-regulation diagram is drawn. */
  setTranscriptionEngine(transcriptionEngine) { this.transcriptionEngine = transcriptionEngine; return this; }
  /** Phase 5D: attach the translation engine so the protein-synthesis diagram is drawn. */
  setTranslationEngine(translationEngine) { this.translationEngine = translationEngine; return this; }

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
    // Phase 5A: molecular targets + binding frame.
    this.lastTargetFrame = this._targetFrame(layout);
    // Phase 5B.2: signaling pathway diagram frame (headless-testable).
    const sig = this._signalFrames();
    this.lastSignalFrame = sig.nodes;
    this.lastSignalEdgeFrame = sig.edges;
    // Phase 5C: gene-regulation / transcription diagram frame (headless-testable).
    this.lastTranscriptionFrame = this._transcriptionFrame();
    // Phase 5D: translation / protein-synthesis diagram frame (headless-testable).
    this.lastTranslationFrame = this._translationFrame();
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
        if (this.targetEngine && this.targetEngine.isBound && this.targetEngine.isBound(mo.id)) continue; // drawn bound at its target
        this.ctx.globalAlpha = mo.alive ? (mo.compartment === 'nuclear_membrane' ? 1 : 0.85) : 0.25;
        this.ctx.fillStyle = this.intracellularColor;
        this.ctx.beginPath();
        this.ctx.arc(mo.x, mo.y, 1.3, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
    }

    // Phase 5A: molecular targets (schematic proteins) with an occupancy halo + bound drug.
    if (this.lastTargetFrame && this.lastTargetFrame.length) {
      for (const t of this.lastTargetFrame) {
        // occupancy halo (ring fraction reflects occupancy)
        if (t.occupancy > 0) {
          this.ctx.strokeStyle = this.boundDrugColor;
          this.ctx.lineWidth = 1.6;
          this.ctx.beginPath();
          this.ctx.arc(t.x, t.y, 4.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t.occupancy);
          this.ctx.stroke();
        }
        // schematic protein glyph (small square)
        this.ctx.fillStyle = this.targetColor;
        this.ctx.fillRect(t.x - 2.2, t.y - 2.2, 4.4, 4.4);
        // bound drug dot on occupied targets
        if (t.occupied > 0) {
          this.ctx.fillStyle = this.boundDrugColor;
          this.ctx.beginPath();
          this.ctx.arc(t.x, t.y, 1.4, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      // saturation caption
      if (this.targetEngine && this.targetEngine.targets && this.targetEngine.targets.length) {
        this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
        this.ctx.font = '10px system-ui, sans-serif';
        this.ctx.fillText(`Target occupancy: ${this.targetEngine.saturationBucket()}%`, 8, this.viewport.height - 36);
      }
    }

    // Phase 5B.2: signaling pathway diagram (publication-style; edges then nodes).
    if (this.lastSignalEdgeFrame && this.lastSignalEdgeFrame.length) {
      for (const e of this.lastSignalEdgeFrame) {
        if (!e.visible) continue;
        this.ctx.strokeStyle = e.sign < 0 ? '#a83c3c' : '#4b6b57';   // inhibition vs activation
        this.ctx.globalAlpha = e.flowing ? 0.95 : 0.28;              // illuminate while propagating
        this.ctx.lineWidth = e.flowing ? 2 : 1;
        if (e.predicted && this.ctx.setLineDash) this.ctx.setLineDash([4, 3]); // predicted = dashed
        this.ctx.beginPath(); this.ctx.moveTo(e.x1, e.y1); this.ctx.lineTo(e.x2, e.y2); this.ctx.stroke();
        if (this.ctx.setLineDash) this.ctx.setLineDash([]);
      }
      this.ctx.globalAlpha = 1;
    }
    if (this.lastSignalFrame && this.lastSignalFrame.length) {
      for (const n of this.lastSignalFrame) {
        if (!n.visible) continue;
        const col = n.state === 'suppressed' ? '#9aa0a6' : n.state === 'degraded' ? '#c8b18a' : '#4b6b57';
        // activity glow
        this.ctx.globalAlpha = 0.25 + 0.65 * Math.max(0, Math.min(1, n.glow));
        this.ctx.fillStyle = col;
        this.ctx.beginPath(); this.ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        if (n.predicted) { this.ctx.globalAlpha = 1; this.ctx.lineWidth = 1.4; this.ctx.strokeStyle = '#6a4bab'; this.ctx.stroke(); }
        else this.ctx.fill();
        this.ctx.globalAlpha = 1;
        // prediction badge + label
        this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
        this.ctx.font = '9px system-ui, sans-serif';
        this.ctx.fillText((n.predicted ? '⌁ ' : '') + n.label, n.x - n.r, n.y - n.r - 2);
      }
      this.ctx.font = '10px system-ui, sans-serif';
      this.ctx.fillText(`Signaling overlay: ${this.signalEngine ? this.signalEngine.overlay() : 'combined'} - t=${this.signalEngine ? this.signalEngine.timeH.toFixed(1) : 0}h`, 8, this.viewport.height - 50);
    }

    // Phase 5C: gene-regulation diagram (TF -> promoter -> gene, with mRNA). Schematic.
    const tf = this.lastTranscriptionFrame;
    if (tf && (tf.genes.length || tf.tfs.length)) {
      // transcription factors (violet = predicted; state label)
      for (const f of tf.tfs) {
        this.ctx.globalAlpha = 0.35 + 0.6 * Math.max(0, Math.min(1, f.activity));
        this.ctx.fillStyle = f.location === 'nucleus' ? '#6a4bab' : '#9a8fc0';
        this.ctx.beginPath(); this.ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
        if (f.predicted) { this.ctx.globalAlpha = 1; this.ctx.strokeStyle = '#6a4bab'; this.ctx.lineWidth = 1.4; this.ctx.stroke(); } else this.ctx.fill();
        this.ctx.globalAlpha = 1; this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
        this.ctx.fillText(`⌁ ${f.name} (${f.state})`, f.x - 6, f.y - 8);
      }
      // promoters (occupancy ring)
      for (const pr of tf.promoters) {
        this.ctx.strokeStyle = '#4b6b57'; this.ctx.lineWidth = 1.6;
        this.ctx.beginPath(); this.ctx.arc(pr.x, pr.y, 4.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pr.occupancy); this.ctx.stroke();
        this.ctx.fillStyle = '#4b6b57'; this.ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
      }
      // genes (glow ~ expression) + emerging mRNA dot
      for (const g of tf.genes) {
        this.ctx.globalAlpha = 0.3 + 0.6 * Math.max(0, Math.min(1, g.glow));
        this.ctx.fillStyle = '#b5843c';
        this.ctx.beginPath(); this.ctx.arc(g.x, g.y, 7, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.globalAlpha = 1; this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
        this.ctx.fillText(`⌁ ${g.symbol} ${g.expressionState}%`, g.x - 7, g.y - 9);
        if (g.mrna && g.mrna.level > 0.05) { this.ctx.fillStyle = '#a83c6b'; this.ctx.beginPath(); this.ctx.arc(g.x + 10, g.y, 1.6, 0, Math.PI * 2); this.ctx.fill(); }
      }
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '10px system-ui, sans-serif';
      this.ctx.fillText('Gene regulation (predicted) - stops at mRNA', 8, this.viewport.height - 62);
    }

    // Phase 5D: translation / protein-synthesis diagram (mRNA strand, ribosome, nascent
    // chain, mature protein + abundance). Schematic; no cartoon helices, no atomic detail.
    const tr = this.lastTranslationFrame;
    if (tr && tr.outputs.length) {
      for (const o of tr.outputs) {
        const s = o.strand;
        // mRNA strand (dashed if predicted)
        this.ctx.strokeStyle = '#7a5a3c'; this.ctx.lineWidth = 1.4; this.ctx.globalAlpha = 0.6 + 0.4 * Math.max(0, Math.min(1, o.mrnaLevel));
        if (o.predicted && this.ctx.setLineDash) this.ctx.setLineDash([4, 3]);
        this.ctx.beginPath(); this.ctx.moveTo(s.x0, s.y); this.ctx.lineTo(s.x1, s.y); this.ctx.stroke();
        if (this.ctx.setLineDash) this.ctx.setLineDash([]);
        this.ctx.globalAlpha = 1;
        // ribosome (restrained abstract complex) at its position
        const rib = o.ribosome;
        const active = rib.state === 'elongating' || rib.state === 'initiating' || rib.state === 'terminating';
        this.ctx.globalAlpha = rib.state === 'suppressed' || rib.state === 'unavailable' ? 0.3 : active ? 0.9 : 0.5;
        this.ctx.fillStyle = '#4b6b57';
        this.ctx.beginPath(); this.ctx.arc(rib.x, rib.y, 4.5, 0, Math.PI * 2); this.ctx.fill();
        // nascent chain emerging (short tick below the ribosome as it progresses)
        if (active && rib.progress > 0) { this.ctx.strokeStyle = '#8a4b6b'; this.ctx.lineWidth = 1; this.ctx.beginPath(); this.ctx.moveTo(rib.x, rib.y + 4); this.ctx.lineTo(rib.x, rib.y + 4 + 6 * rib.progress); this.ctx.stroke(); }
        this.ctx.globalAlpha = 1;
        // mature protein (compact symbol; segmented/faded when degrading)
        const pr = o.protein;
        const size = 3 + (pr.abundanceState / 100) * 5;
        this.ctx.fillStyle = pr.state === 'degrading' || pr.state === 'degraded' ? '#b0a08a' : '#a83c6b';
        this.ctx.globalAlpha = pr.abundanceState > 0 ? 0.85 : 0.25;
        this.ctx.beginPath(); this.ctx.arc(pr.x, pr.y, size, 0, Math.PI * 2);
        if (o.predicted) { this.ctx.globalAlpha = 1; this.ctx.strokeStyle = '#6a4bab'; this.ctx.lineWidth = 1.2; this.ctx.stroke(); } else this.ctx.fill();
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
        this.ctx.fillText(`${o.predicted ? '⌁ ' : ''}${o.proteinName} ${pr.abundanceState}% (${pr.turnoverState})`, pr.x + size + 3, pr.y + 3);
      }
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '10px system-ui, sans-serif';
      this.ctx.fillText(`Translation (predicted) capacity ${tr.capacityOrdinal} - schematic timing; stops at protein`, 8, this.viewport.height - 74);
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

// Phase 5A: molecular targets mapped into pixel space via the dermis band.
CanvasRenderer.prototype._targetFrame = function _targetFrame(layout) {
  const eng = this.targetEngine;
  if (!eng || !eng.targets || !eng.targets.length) return [];
  const band = (this.engine && this.engine.layerBands ? this.engine.layerBands : []).find((b) => b.id === 'dermis') || { start: 0.3, end: 0.7 };
  const span = Math.max(1e-6, band.end - band.start);
  const [wTop, wBot] = layout.window || [0, 1];
  const win = Math.max(1e-6, wBot - wTop);
  const H = this.viewport.height; const W = this.viewport.width;
  const yOf = (u) => Math.max(0, Math.min(1, ((band.start + u * span) - wTop) / win)) * H;
  return eng.targets.map((t) => ({
    id: t.id, x: t.x * W, y: yOf(t.u), type: t.type, compartment: t.compartment,
    occupancy: t.occupancy(), occupied: t.occupiedSites, available: t.availableSites,
  }));
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

// Phase 5B.2 signaling pathway diagram frame. Publication-style, schematic layout:
// nodes on a col/row grid, glow ~ activity, predicted nodes flagged distinct, edges
// illuminate while flowing. Positioned in a reserved band at the bottom of the canvas
// so it never overlaps the anatomy scene. Purely derived from the engine (read-only).
CanvasRenderer.prototype._signalFrames = function _signalFrames() {
  const eng = this.signalEngine;
  if (!eng || eng.isIdle()) return { nodes: [], edges: [] };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const cols = Math.max(1, ...f.nodes.map((n) => (n.layout && n.layout.col) || 0)) + 1;
  const rows = Math.max(1, ...f.nodes.map((n) => (n.layout && n.layout.row) || 0)) + 1;
  const panelTop = H * 0.72; const panelH = H * 0.26;               // reserved diagram band
  const xOf = (c) => (0.06 + 0.88 * (cols > 1 ? c / (cols - 1) : 0.5)) * W;
  const yOf = (r) => panelTop + (rows > 1 ? r / (rows - 1) : 0.5) * panelH;
  const pos = new Map();
  const nodes = f.nodes.map((n) => {
    const x = xOf((n.layout && n.layout.col) || 0);
    const y = yOf((n.layout && n.layout.row) || 0);
    pos.set(n.id, { x, y });
    return {
      id: n.id, x, y, label: n.displayName, nodeType: n.nodeType,
      activity: n.activity, state: n.state, glow: n.activity,
      predicted: n.predicted, predictionLevel: n.predictionLevel, evidenceLevel: n.evidenceLevel,
      confidence: n.confidence, visible: n.visible, isOutput: n.isOutput,
      // publication-style radius: outputs slightly larger; predicted rendered hollow
      r: (n.isOutput ? 9 : 7) + n.activity * 3,
    };
  });
  const edges = f.edges.map((e) => {
    const a = pos.get(e.source); const b = pos.get(e.target);
    return {
      id: e.id, x1: a ? a.x : 0, y1: a ? a.y : 0, x2: b ? b.x : 0, y2: b ? b.y : 0,
      relationship: e.relationship, sign: e.sign, flowing: e.flowing, active: e.active,
      predicted: e.predicted, visible: e.visible,
    };
  });
  return { nodes, edges };
};

// Phase 5C gene-regulation / transcription diagram frame. Publication style, schematic:
// TFs -> promoters -> genes on a col/row grid in a reserved band above the signaling band,
// gene glow ~ expression, promoter occupancy ring, mRNA dots, prediction styling. Derived
// entirely from the transcription engine (read-only). No artistic DNA.
CanvasRenderer.prototype._transcriptionFrame = function _transcriptionFrame() {
  const eng = this.transcriptionEngine;
  if (!eng || eng.isIdle()) return { tfs: [], promoters: [], genes: [] };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const all = [...f.tfs, ...f.promoters, ...f.genes];
  const cols = Math.max(1, ...all.map((n) => (n.layout && n.layout.col) || 0)) + 1;
  const rows = Math.max(1, ...all.map((n) => (n.layout && n.layout.row) || 0)) + 1;
  const panelTop = H * 0.48; const panelH = H * 0.22;   // reserved band above the signaling diagram
  const xOf = (c) => (0.08 + 0.84 * (cols > 1 ? c / (cols - 1) : 0.5)) * W;
  const yOf = (r) => panelTop + (rows > 1 ? r / (rows - 1) : 0.5) * panelH;
  const tfs = f.tfs.map((tf) => ({ id: tf.id, name: tf.name, x: xOf(tf.layout.col), y: yOf(tf.layout.row), state: tf.state, location: tf.location, activity: tf.activity, predicted: tf.predicted, predictionLevel: tf.predictionLevel }));
  const promoters = f.promoters.map((pr) => ({ id: pr.id, x: xOf(pr.layout.col), y: yOf(pr.layout.row), occupancy: pr.occupancy, responseElement: pr.responseElement, chromatin: pr.chromatin, predicted: true }));
  const genes = f.genes.map((g) => ({ id: g.id, symbol: g.symbol, x: xOf(g.layout.col), y: yOf(g.layout.row), expressionState: g.expressionState, glow: g.expressionFrac, polymerase: g.polymerase, predicted: g.predicted, predictionLevel: g.predictionLevel, mrna: g.mrna ? { copyState: g.mrna.copyState, level: g.mrna.level } : null }));
  return { tfs, promoters, genes };
};

// Phase 5D translation / protein-synthesis diagram frame. Publication style, schematic:
// per output a row with an mRNA strand, a ribosome (restrained abstract complex) advancing
// along it (position = translationProgress), a nascent chain emerging, and a compact mature
// protein symbol with an abundance indicator + turnover state. Derived from the engine
// (read-only). No cartoon helices, no atomic ribosome structure.
CanvasRenderer.prototype._translationFrame = function _translationFrame() {
  const eng = this.translationEngine;
  if (!eng || eng.isIdle()) return { outputs: [], capacityOrdinal: 'suppressed' };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const panelTop = H * 0.24; const rowH = Math.min(26, (H * 0.2) / Math.max(1, f.outputs.length));
  const x0 = 0.1 * W; const x1 = 0.6 * W;                 // mRNA strand span
  const outputs = f.outputs.map((o, i) => {
    const y = panelTop + i * rowH;
    return {
      outId: o.outId, proteinName: o.proteinName, mrnaId: o.mrnaId, mrnaLevel: o.mrnaLevel,
      strand: { x0, x1, y },
      ribosome: { x: x0 + (x1 - x0) * o.translationProgress, y, state: o.ribosomeState, progress: o.translationProgress },
      protein: { x: x1 + 30, y, state: o.proteinState, abundanceState: o.abundanceState, abundanceOrdinal: o.abundanceOrdinal, turnoverState: o.turnoverState },
      predicted: o.predicted, evidenceLevel: o.evidenceLevel, predictionLevel: o.predictionLevel,
      halfLifeH: o.halfLifeH, functionalState: o.functionalState,
    };
  });
  return { outputs, capacityOrdinal: f.capacityOrdinal };
};

export default CanvasRenderer;
