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
    this.lastFunctionFrame = null;      // Phase 6A: { functions, states } protein-function / cellular-response diagram
    this.lastApoptosisFrame = null;     // Phase 6B: apoptosis commitment/execution diagram
    this.lastPopulationFrame = null;    // Phase 6C: population composition/viability diagram
    this.lastTumorFrame = null;         // Phase 6D: tumour burden / treatment-response diagram
    this.lastMicroenvironmentFrame = null; // Phase 7A: passive TME diagram (ECM/oxygen/penetration)
    this.lastVascularFrame = null;      // Phase 7B: tumour-vasculature diagram (vessels/perfusion/delivery)
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
  /** Phase 6A: attach the protein-function engine so the cellular-response diagram is drawn. */
  setProteinFunctionEngine(proteinFunctionEngine) { this.proteinFunctionEngine = proteinFunctionEngine; return this; }
  /** Phase 6B: attach the apoptosis engine so the commitment/execution diagram is drawn. */
  setApoptosisEngine(apoptosisEngine) { this.apoptosisEngine = apoptosisEngine; return this; }
  /** Phase 6C: attach the population engine so the population composition diagram is drawn. */
  setPopulationEngine(populationEngine) { this.populationEngine = populationEngine; return this; }
  /** Phase 6D: attach the tumour engine so the tumour burden / response diagram is drawn. */
  setTumorEngine(tumorEngine) { this.tumorEngine = tumorEngine; return this; }
  /** Phase 7A: attach the microenvironment engine so the passive TME diagram is drawn. */
  setMicroenvironmentEngine(microenvironmentEngine) { this.microenvironmentEngine = microenvironmentEngine; return this; }
  /** Phase 7B: attach the vascular engine so the tumour-vasculature diagram is drawn. */
  setVascularEngine(vascularEngine) { this.vascularEngine = vascularEngine; return this; }

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
    // Phase 6A: protein-function / early-cellular-response diagram frame (headless-testable).
    this.lastFunctionFrame = this._functionFrame();
    // Phase 6B: apoptosis commitment/execution diagram frame (headless-testable).
    this.lastApoptosisFrame = this._apoptosisFrame();
    // Phase 6C: population composition/viability diagram frame (headless-testable).
    this.lastPopulationFrame = this._populationFrame();
    // Phase 6D: tumour burden / treatment-response diagram frame (headless-testable).
    this.lastTumorFrame = this._tumorFrame();
    // Phase 7A: passive tumour-microenvironment diagram frame (headless-testable).
    this.lastMicroenvironmentFrame = this._microenvironmentFrame();
    // Phase 7B: tumour-vasculature diagram frame (headless-testable).
    this.lastVascularFrame = this._vascularFrame();
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

    // Phase 6A: protein-function / early-cellular-response diagram (restrained, publication).
    const fn = this.lastFunctionFrame;
    if (fn && (fn.functions.length || fn.states.length)) {
      // functional proteins
      for (const p of fn.functions) {
        this.ctx.strokeStyle = '#4b6b57'; this.ctx.fillStyle = '#4b6b57';
        this.ctx.globalAlpha = p.active ? 0.85 : 0.4;
        this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        if (p.inhibited) { this.ctx.globalAlpha = 0.5; this.ctx.stroke(); } // muted for inhibited
        else if (p.active) this.ctx.fill(); else this.ctx.stroke();          // outlined = inactive
        this.ctx.globalAlpha = 1;
      }
      // cellular-state indicators: a small bar with a baseline tick; restrained up/down colour
      for (const s of fn.states) {
        const barW = 46; const bx = s.x; const by = s.y;
        this.ctx.strokeStyle = '#9a938a'; this.ctx.lineWidth = 1;
        this.ctx.strokeRect(bx, by - 4, barW, 8);
        // baseline tick
        this.ctx.beginPath(); this.ctx.moveTo(bx + barW * s.baseline, by - 5); this.ctx.lineTo(bx + barW * s.baseline, by + 5); this.ctx.stroke();
        // fill to current value; restrained muted colours (no red-flash)
        this.ctx.fillStyle = s.changed === 'up' ? '#7a8a6a' : s.changed === 'down' ? '#8a7a9a' : '#a0988c';
        this.ctx.globalAlpha = 0.7; this.ctx.fillRect(bx, by - 3, barW * Math.max(0, Math.min(1, s.value)), 6); this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '8px system-ui, sans-serif';
        this.ctx.fillText(`${s.name}: ${s.ordinal}`, bx + barW + 4, by + 2);
      }
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '10px system-ui, sans-serif';
      this.ctx.fillText('Protein function -> early cellular response (schematic, reversible; cell fate NOT evaluated)', 8, this.viewport.height - 86);
    }

    // Phase 6B: apoptosis commitment/execution diagram (restrained; single cell). No
    // explosions/flames/skulls/blood/red-flash - a commitment bar + branch indicators only.
    const ap = this.lastApoptosisFrame;
    if (ap && ap.available) {
      const cb = ap.commitmentBar;
      // commitment progress bar: reversible border pre-commitment, locked marker after
      this.ctx.strokeStyle = cb.locked ? '#6a4bab' : '#9a938a'; this.ctx.lineWidth = cb.locked ? 1.8 : 1;
      this.ctx.strokeRect(cb.x, cb.y, cb.w, 7);
      this.ctx.fillStyle = '#8a7a9a'; this.ctx.globalAlpha = 0.7;
      this.ctx.fillRect(cb.x, cb.y + 1, cb.w * Math.max(0, Math.min(1, cb.pressure)), 5); this.ctx.globalAlpha = 1;
      if (cb.locked) { this.ctx.fillStyle = '#6a4bab'; this.ctx.fillRect(cb.x + cb.w + 3, cb.y, 5, 7); } // locked-state marker
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
      const tag = ap.contextTransfer ? ' (context-transfer prediction)' : ap.predicted ? ' (predicted)' : '';
      this.ctx.fillText(`Apoptosis [${ap.cellModel}] ${ap.state}${cb.locked ? ' ■ committed' : ''}${tag}`, cb.x, cb.y - 3);
      // branch indicators (caspase / AIF), faded when inhibited/knocked-down
      const iy = cb.y + 16;
      this.ctx.font = '8px system-ui, sans-serif';
      this.ctx.globalAlpha = ap.caspaseBranch.inhibited ? 0.4 : 0.9; this.ctx.fillStyle = '#4b6b57';
      this.ctx.fillText(`caspase: ${ap.caspaseBranch.executioner} / PARP ${ap.caspaseBranch.parp}`, cb.x, iy);
      this.ctx.globalAlpha = ap.aifBranch.knockdown ? 0.4 : 0.9; this.ctx.fillStyle = '#7a5a3c';
      this.ctx.fillText(`AIF: ${ap.aifBranch.state}`, cb.x, iy + 10);
      this.ctx.globalAlpha = 1; this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
      this.ctx.fillText(`mito ${ap.mitochondria.membranePotential} / MOMP ${ap.mitochondria.momp} / morph ${ap.morphology} - schematic timing; single cell; population NOT evaluated`, cb.x, iy + 20);
    }

    // Phase 6C: population composition / viability diagram (restrained; schematic fractions).
    // A single stacked composition bar (living / adapted / recovered / apoptotic) + a small
    // history sparkline of the apoptotic fraction. No blood / explosions / dead-body graphics.
    const pop = this.lastPopulationFrame;
    if (pop && pop.available) {
      const pb = pop.compositionBar;
      // segment colours: living green, adaptive cyan, recovered blue, apoptotic orange.
      const segs = [
        { f: pb.living, c: '#4b9e5f' }, { f: pb.adapted, c: '#3fb6c4' },
        { f: pb.recovered, c: '#4b73ab' }, { f: pb.apoptotic, c: '#d08a3a' },
      ];
      let sx = pb.x;
      for (const s of segs) { const w = pb.w * Math.max(0, Math.min(1, s.f)); this.ctx.fillStyle = s.c; this.ctx.globalAlpha = pop.predicted ? 0.72 : 0.85; this.ctx.fillRect(sx, pb.y, w, 8); sx += w; }
      this.ctx.globalAlpha = 1; this.ctx.strokeStyle = '#9a938a'; this.ctx.lineWidth = 1; this.ctx.strokeRect(pb.x, pb.y, pb.w, 8);
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
      const ptag = pop.contextTransfer ? ' (context-transfer prediction)' : pop.predicted ? ' (predicted)' : '';
      this.ctx.fillText(`Population [${pop.cellModel}] ${pop.populationState}${ptag}`, pb.x, pb.y - 3);
      this.ctx.font = '8px system-ui, sans-serif';
      this.ctx.fillText(`living ${pop.livingFraction} | apoptotic ${pop.apoptoticFraction} | adaptive ${pop.adaptedFraction} | recovered ${pop.recoveredFraction}  (schematic population fraction; not cell counts)`, pb.x, pb.y + 20);
      // history sparkline of the apoptotic fraction (deterministic replay trace).
      const sp = pop.sparkline;
      if (sp && sp.points && sp.points.length > 1) {
        this.ctx.strokeStyle = '#d08a3a'; this.ctx.lineWidth = 1; this.ctx.beginPath();
        sp.points.forEach((v, i) => { const x = sp.x + (sp.w * i) / (sp.points.length - 1); const y = sp.y + sp.h - sp.h * Math.max(0, Math.min(1, v)); if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y); });
        this.ctx.stroke();
      }
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
      this.ctx.fillText('tumour / survival / clinical outcome NOT evaluated', pb.x, pb.y + 30);
    }

    // Phase 6D: tumour burden / treatment-response diagram (restrained; schematic). A relative
    // burden bar (viable + apoptotic) + a normalized response curve. No realistic tumour /
    // blood / necrotic debris / clinical scan / sensational imagery.
    const tum = this.lastTumorFrame;
    if (tum && tum.available) {
      const tb = tum.burdenBar;
      // burden region: viable (slate) + apoptotic (orange) partition of the relative burden.
      this.ctx.strokeStyle = '#9a938a'; this.ctx.lineWidth = 1; this.ctx.strokeRect(tb.x, tb.y, tb.w, 8);
      const vw = tb.w * Math.max(0, Math.min(1, tb.viable / tb.scale));
      const aw = tb.w * Math.max(0, Math.min(1, tb.apoptotic / tb.scale));
      this.ctx.globalAlpha = tum.predicted && !tum.experimental ? 0.72 : 0.85;
      this.ctx.fillStyle = '#5b6b86'; this.ctx.fillRect(tb.x, tb.y, vw, 8);
      this.ctx.fillStyle = '#d08a3a'; this.ctx.fillRect(tb.x + vw, tb.y, aw, 8);
      this.ctx.globalAlpha = 1;
      // baseline (1.0) reference tick
      const bx = tb.x + tb.w * Math.min(1, 1.0 / tb.scale); this.ctx.strokeStyle = '#6a4bab'; this.ctx.beginPath(); this.ctx.moveTo(bx, tb.y - 2); this.ctx.lineTo(bx, tb.y + 10); this.ctx.stroke();
      // treatment-on indicator
      if (tum.treatmentState === 'on') { this.ctx.fillStyle = '#4b9e5f'; this.ctx.fillRect(tb.x - 8, tb.y, 4, 8); }
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
      const ttag = tum.contextTransfer ? ' (context-transfer)' : tum.experimental ? ' (experimental direction)' : tum.predicted ? ' (predicted)' : '';
      this.ctx.fillText(`Tumour [${tum.cellModel} / ${tum.formulation}] ${tum.responseState}${ttag}`, tb.x, tb.y - 4);
      this.ctx.font = '8px system-ui, sans-serif';
      this.ctx.fillText(`rel. burden ${tum.currentBurden} | growth ${tum.growthPressure} | loss ${tum.lossPressure} | net ${tum.netGrowthPressure}  (normalized schematic; not mm3)`, tb.x, tb.y + 20);
      // normalized response curve (deterministic replay trace of relative burden)
      const rc = tum.curve;
      if (rc && rc.points && rc.points.length > 1) {
        this.ctx.strokeStyle = '#5b6b86'; this.ctx.lineWidth = 1; this.ctx.beginPath();
        rc.points.forEach((v, i) => { const x = rc.x + (rc.w * i) / (rc.points.length - 1); const y = rc.y + rc.h - rc.h * Math.max(0, Math.min(1, v / tb.scale)); if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y); });
        this.ctx.stroke();
      }
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b';
      this.ctx.fillText('clinical / RECIST / survival / metastasis / PK NOT evaluated', tb.x, tb.y + 30);
    }

    // Phase 7A: passive tumour-microenvironment diagram (schematic; scientific, not artistic).
    // A small ECM field (density -> mesh spacing + opacity) with an oxygen/hypoxia overlay
    // (hypoxic = darker) and a drug-penetration path that is DIRECT when permissive and
    // TORTUOUS when restrictive. No photorealism / vasculature / immune cells.
    const me = this.lastMicroenvironmentFrame;
    if (me && me.available) {
      const mb = me.field;
      // ECM mesh: spacing shrinks + opacity rises with density (denser = harder to penetrate).
      const spacing = Math.max(4, 16 - 12 * me.ecm.density);
      this.ctx.strokeStyle = '#7a7367'; this.ctx.globalAlpha = 0.2 + 0.5 * me.ecm.penetrationResistance; this.ctx.lineWidth = 1;
      for (let gx = mb.x; gx <= mb.x + mb.w; gx += spacing) { this.ctx.beginPath(); this.ctx.moveTo(gx, mb.y); this.ctx.lineTo(gx, mb.y + mb.h); this.ctx.stroke(); }
      for (let gy = mb.y; gy <= mb.y + mb.h; gy += spacing) { this.ctx.beginPath(); this.ctx.moveTo(mb.x, gy); this.ctx.lineTo(mb.x + mb.w, gy); this.ctx.stroke(); }
      // oxygen / hypoxia overlay: hypoxic regions are darker (severity-scaled).
      this.ctx.globalAlpha = 0.1 + 0.45 * me.hypoxia.severity; this.ctx.fillStyle = '#2b3a46'; this.ctx.fillRect(mb.x, mb.y, mb.w, mb.h);
      this.ctx.globalAlpha = 1;
      // penetration path: direct (permissive) -> tortuous (restrictive). Amplitude scales with restriction.
      const amp = mb.h * 0.35 * me.penetration.combinedRestriction;
      const segs = 24; this.ctx.strokeStyle = me.predicted ? '#8a7a9a' : '#4b6b57'; this.ctx.lineWidth = 1.4; this.ctx.beginPath();
      for (let i = 0; i <= segs; i++) { const t = i / segs; const x = mb.x + mb.w * t; const y = mb.y + mb.h * 0.5 + Math.sin(t * Math.PI * 5) * amp * (1 - t); if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y); }
      this.ctx.stroke();
      // border + labels
      this.ctx.strokeStyle = '#9a938a'; this.ctx.lineWidth = 1; this.ctx.strokeRect(mb.x, mb.y, mb.w, mb.h);
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
      const mtag = me.contextTransfer ? ' (context-transfer)' : me.predicted ? ' (predicted)' : '';
      this.ctx.fillText(`TME [${me.tumourModel}] ${me.microenvironmentState}${mtag}`, mb.x, mb.y - 4);
      this.ctx.font = '8px system-ui, sans-serif';
      this.ctx.fillText(`ECM ${me.ecm.collagen}/${me.ecm.hyaluronicAcid} | O2 ${me.oxygen.state} | penetration ${me.penetration.penetrationModifier} (schematic; modifies penetration only)`, mb.x, mb.y + mb.h + 12);
      this.ctx.fillText('immune / vascular / remodeling / metastasis NOT evaluated', mb.x, mb.y + mb.h + 22);
    }

    // Phase 7B: tumour-vasculature diagram (schematic; educational). Simplified branching
    // vessels (density/branching), a perfusion-tinted fill, and a drug-delivery path whose
    // strength tracks the delivery modifier. No endothelial cells / blood cells / flow vectors.
    const va = this.lastVascularFrame;
    if (va && va.available) {
      const vb = va.field;
      // perfusion tint (more perfused = warmer/brighter fill).
      this.ctx.globalAlpha = 0.08 + 0.22 * va.perfusion.efficiency; this.ctx.fillStyle = '#8a3a3a'; this.ctx.fillRect(vb.x, vb.y, vb.w, vb.h);
      this.ctx.globalAlpha = 1;
      // simplified branching vessels: count + branch amplitude track density; opacity tracks maturity.
      const nBranches = Math.max(2, Math.round(2 + 5 * va.vessels.density));
      this.ctx.strokeStyle = '#a34b4b'; this.ctx.lineWidth = 1;
      for (let b = 0; b < nBranches; b++) {
        const bx = vb.x + (vb.w * (b + 0.5)) / nBranches;
        this.ctx.globalAlpha = 0.35 + 0.5 * va.vessels.densityAlpha;
        this.ctx.beginPath(); this.ctx.moveTo(bx, vb.y + vb.h);
        // branch toward the top with a small fork (schematic vessel tree)
        this.ctx.lineTo(bx, vb.y + vb.h * 0.5);
        this.ctx.lineTo(bx - vb.w * 0.04, vb.y + vb.h * 0.2);
        this.ctx.moveTo(bx, vb.y + vb.h * 0.5); this.ctx.lineTo(bx + vb.w * 0.04, vb.y + vb.h * 0.2);
        this.ctx.stroke();
      }
      this.ctx.globalAlpha = 1;
      // drug-delivery path: thickness/opacity track the delivery modifier.
      this.ctx.strokeStyle = va.predicted ? '#8a7a9a' : '#4b6b57'; this.ctx.lineWidth = 0.8 + 2.4 * va.delivery.deliveryModifier;
      this.ctx.globalAlpha = 0.4 + 0.5 * va.delivery.deliveryModifier;
      this.ctx.beginPath(); this.ctx.moveTo(vb.x, vb.y + vb.h * 0.5); this.ctx.lineTo(vb.x + vb.w, vb.y + vb.h * 0.5); this.ctx.stroke();
      this.ctx.globalAlpha = 1;
      this.ctx.strokeStyle = '#9a938a'; this.ctx.lineWidth = 1; this.ctx.strokeRect(vb.x, vb.y, vb.w, vb.h);
      this.ctx.fillStyle = this.model.palette.label_text || '#33302b'; this.ctx.font = '9px system-ui, sans-serif';
      const vtag = va.contextTransfer ? ' (context-transfer)' : va.predicted ? ' (predicted)' : '';
      this.ctx.fillText(`Vasculature [${va.tumourModel}] ${va.vessels.angiogenicState} / ${va.delivery.deliveryState}${vtag}`, vb.x, vb.y - 4);
      this.ctx.font = '8px system-ui, sans-serif';
      this.ctx.fillText(`perfusion ${va.perfusion.state} | O2 ${va.oxygenSupply.state} | perm ${va.permeability.state} | delivery ${va.delivery.deliveryModifier} (schematic; modifies delivery only)`, vb.x, vb.y + vb.h + 12);
      this.ctx.fillText('immune / VEGF / HIF / metastasis NOT evaluated', vb.x, vb.y + vb.h + 22);
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

// Phase 6A protein-function / early-cellular-response diagram frame. Publication style,
// restrained: functional proteins (filled=active, outlined=inactive, hatched=inhibited) ->
// cellular-state indicators (bars with a baseline tick, upward/downward restrained change).
// Derived from the engine (read-only). No flames/explosions/danger/red-flash/dying-cell.
CanvasRenderer.prototype._functionFrame = function _functionFrame() {
  const eng = this.proteinFunctionEngine;
  if (!eng || eng.isIdle()) return { functions: [], states: [] };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const fnTop = H * 0.14; const stTop = H * 0.14; const rowH = 16;
  const functions = f.functions.map((fn, i) => ({
    id: fn.id, x: 0.08 * W, y: fnTop + i * rowH, proteinId: fn.proteinId, state: fn.functionalState,
    capacity: fn.capacity, active: fn.functionalState === 'active', inhibited: fn.functionalState === 'inhibited',
    predicted: fn.predicted, evidenceLevel: fn.evidenceLevel,
  }));
  const states = f.states.map((s, i) => ({
    id: s.id, x: 0.42 * W, y: stTop + i * rowH, name: s.name, value: s.value, baseline: s.baseline, ordinal: s.ordinal,
    changed: s.value > s.baseline + 0.02 ? 'up' : s.value < s.baseline - 0.02 ? 'down' : 'baseline',
    predicted: eng.state(s.id) ? true : true, evidenceLevel: s.evidenceLevel,
  }));
  const edges = f.edges.filter((e) => e.active).map((e) => ({ id: e.id, sign: e.sign, predicted: e.predicted, feedback: e.feedback }));
  return { functions, states, edges };
};

// Phase 6B apoptosis commitment/execution diagram frame. Publication style, restrained:
// a commitment progress bar (reversible border pre-commitment, locked marker after
// commitment), mitochondrial / caspase-branch / AIF-branch indicators, morphology label.
// Derived from the engine (read-only). No explosions/flames/skulls/blood/red-flash.
CanvasRenderer.prototype._apoptosisFrame = function _apoptosisFrame() {
  const eng = this.apoptosisEngine;
  if (!eng || eng.isIdle()) return { available: false, state: eng ? eng.apop.state : 'unavailable', cellModel: eng ? eng.cellModel : null };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const y = H * 0.06; const x0 = 0.08 * W; const barW = 0.4 * W;
  return {
    available: true, cellModel: f.cellModel, state: f.state, reversibility: f.reversibility, committed: f.committed,
    contextTransfer: f.contextTransfer, predicted: f.predicted, evidenceLevel: f.evidenceLevel,
    commitmentBar: { x: x0, y, w: barW, pressure: f.apoptoticPressure, survival: f.survivalPressure, locked: f.reversibility === 'irreversible' },
    mitochondria: f.mitochondria, caspaseBranch: f.caspaseBranch, aifBranch: f.aifBranch,
    totalExecutionDrive: f.totalExecutionDrive, morphology: f.morphology,
    interventions: f.interventions,
  };
};

// Phase 6C population composition / viability diagram frame. Publication style, restrained:
// a single stacked composition bar (living / adaptive / recovered / apoptotic) + a history
// sparkline of the apoptotic fraction (deterministic replay trace). Derived from the engine
// (read-only). Normalized SCHEMATIC fractions only - never real cell counts. No blood /
// explosions / dead-body graphics. Tumour / survival / clinical outcome is NOT evaluated.
CanvasRenderer.prototype._populationFrame = function _populationFrame() {
  const eng = this.populationEngine;
  if (!eng || eng.isIdle()) return { available: false, populationState: eng ? eng.pop.populationState : 'unavailable', cellModel: eng ? eng.cellModel : null };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const y = H * 0.16; const x0 = 0.08 * W; const barW = 0.4 * W;
  const hist = eng.getHistory();
  const points = hist.length ? hist.map((h) => h.apoptoticFraction) : [f.apoptoticFraction];
  return {
    available: true, cellModel: f.cellModel, populationState: f.populationState,
    livingFraction: f.livingFraction, apoptoticFraction: f.apoptoticFraction,
    adaptedFraction: f.adaptedFraction, recoveredFraction: f.recoveredFraction,
    cumulativeApoptosis: f.cumulativeApoptosis,
    predicted: f.predicted, contextTransfer: f.contextTransfer,
    evidenceLevel: f.evidenceLevel, confidence: f.confidence,
    compositionBar: { x: x0, y, w: barW, living: f.livingFraction, adapted: f.adaptedFraction, recovered: f.recoveredFraction, apoptotic: f.apoptoticFraction },
    sparkline: { x: x0, y: y + 34, w: barW, h: 14, points: points.slice(-120) },
    tumourResponseEvidence: f.tumourResponseEvidence, survivalEvidence: f.survivalEvidence, clinicalOutcomeEvidence: f.clinicalOutcomeEvidence,
  };
};

// Phase 6D tumour burden / treatment-response diagram frame. Publication style, restrained:
// a relative-burden bar (viable + apoptotic partition) with a baseline (1.0) reference tick +
// a treatment-on indicator, and a normalized response curve (deterministic replay trace of the
// relative burden). Derived from the engine (read-only). Normalized SCHEMATIC burden only -
// never a real tumour volume. No realistic tumour / blood / necrotic debris / clinical scan /
// sensational imagery. Clinical / survival outcome is NOT evaluated.
CanvasRenderer.prototype._tumorFrame = function _tumorFrame() {
  const eng = this.tumorEngine;
  if (!eng || eng.isIdle()) return { available: false, responseState: eng ? eng.burden.responseState : 'unavailable', cellModel: eng ? eng.cellModel : null };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const y = H * 0.27; const x0 = 0.08 * W; const barW = 0.4 * W;
  const scale = eng.upperBound || 1.5;
  const hist = eng.getHistory();
  const points = hist.length ? hist.map((h) => h.currentBurden) : [f.currentBurden];
  return {
    available: true, cellModel: f.cellModel, species: f.species, formulation: f.formulation, tumorModel: f.tumorModel,
    responseState: f.responseState, treatmentState: f.treatmentState,
    currentBurden: f.currentBurden, growthPressure: f.growthPressure, lossPressure: f.lossPressure, netGrowthPressure: f.netGrowthPressure,
    predicted: f.predicted, experimental: f.experimental, contextTransfer: f.contextTransfer,
    evidenceLevel: f.evidenceLevel, confidence: f.confidence, quantitativeStatus: f.quantitativeStatus,
    burdenBar: { x: x0, y, w: barW, scale, viable: f.normalizedViableBurden, apoptotic: f.normalizedApoptoticBurden },
    curve: { x: x0, y: y + 34, w: barW, h: 16, points: points.slice(-160) },
    tumourResponseEvidence: f.tumourResponseEvidence, clinicalResponseEvidence: f.clinicalResponseEvidence, survivalEvidence: f.survivalEvidence,
  };
};

// Phase 7A passive tumour-microenvironment diagram frame. Schematic + scientific (not
// artistic): an ECM mesh (density -> spacing/opacity), an oxygen/hypoxia overlay (hypoxic =
// darker), and a drug-penetration path (direct when permissive, tortuous when restrictive).
// Derived from the engine (read-only). Ordinal / schematic only - never real ECM density /
// oxygen concentration. No vasculature / immune cells / remodeling.
CanvasRenderer.prototype._microenvironmentFrame = function _microenvironmentFrame() {
  const eng = this.microenvironmentEngine;
  if (!eng || eng.isIdle()) return { available: false, microenvironmentState: eng ? eng.state.microenvironmentState : 'unavailable', tumourModel: eng ? eng.tumourModel : null };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const x0 = 0.55 * W; const y = H * 0.08; const w = 0.36 * W; const h = 0.2 * H;
  return {
    available: true, tumourModel: f.tumourModel, species: f.species, formulation: f.formulation,
    microenvironmentState: f.microenvironmentState,
    ecm: f.ecm, diffusion: f.diffusion, mechanical: f.mechanical, oxygen: f.oxygen, hypoxia: f.hypoxia, penetration: f.penetration,
    predicted: f.predicted, contextTransfer: f.contextTransfer, evidenceLevel: f.evidenceLevel,
    field: { x: x0, y, w, h },
    modifiesTransport: f.modifiesTransport, replacesTransport: f.replacesTransport, modifiesSignalling: f.modifiesSignalling,
    immuneEvidence: f.immuneEvidence, vascularEvidence: f.vascularEvidence, remodelingEvidence: f.remodelingEvidence,
  };
};

// Phase 7B tumour-vasculature diagram frame. Schematic + educational: simplified branching
// vessels (count/amplitude track density, opacity tracks maturity), a perfusion tint, and a
// drug-delivery path whose strength tracks the delivery modifier. Derived from the engine
// (read-only). Ordinal / schematic only - never real vessel count / blood flow / pO2. No
// endothelial cells / blood cells / capillary ultrastructure / flow vectors.
CanvasRenderer.prototype._vascularFrame = function _vascularFrame() {
  const eng = this.vascularEngine;
  if (!eng || eng.isIdle()) return { available: false, tumourModel: eng ? eng.tumourModel : null };
  const f = eng.frame();
  const W = this.viewport.width; const H = this.viewport.height;
  const x0 = 0.55 * W; const y = H * 0.34; const w = 0.36 * W; const h = 0.2 * H;
  const matAlpha = { immature: 0.3, developing: 0.5, mature: 0.8, stable: 0.95 };
  return {
    available: true, tumourModel: f.tumourModel, species: f.species, formulation: f.formulation,
    vessels: { angiogenicState: f.vessels.angiogenicState, density: f.vessels.density, densityAlpha: matAlpha[f.vessels.maturity] ?? 0.5, maturity: f.vessels.maturity },
    perfusion: f.perfusion, oxygenSupply: f.oxygenSupply, nutrient: f.nutrient, permeability: f.permeability, delivery: f.delivery,
    predicted: f.predicted, contextTransfer: f.contextTransfer, evidenceLevel: f.evidenceLevel,
    field: { x: x0, y, w, h },
    modifiesDelivery: f.modifiesDelivery, modifiesSignalling: f.modifiesSignalling,
    immuneEvidence: f.immuneEvidence, vegfSignallingEvidence: f.vegfSignallingEvidence, metastasisEvidence: f.metastasisEvidence,
  };
};

export default CanvasRenderer;
