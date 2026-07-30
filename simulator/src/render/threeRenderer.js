// Minimal WebGL renderer behind the EXISTING Renderer interface (see renderer.js).
//
// Scope note: this is only the shell Phase 2 needs to put the application shot on screen — mount a
// canvas, own the colour/tone-mapping/shadow configuration, draw a scene from a camera, dispose
// cleanly. It deliberately does NOT take over scene graph ownership, camera choreography or the
// timeline; those belong to the scene (humanApplicationScene.js) and the master clock.
//
// The NullRenderer and CanvasRenderer paths are untouched, so every existing call site and the 2D
// scientific tools behave exactly as before.

import * as THREE from '../../vendor/three/three.module.js';

export class ThreeRenderer {
  constructor(opts = {}) {
    this.kind = 'three';
    this.logger = opts.logger || null;
    this.mounted = false;
    this.renderer = null;
    this.canvas = null;
    this._camera = null;
    this._pixelRatioCap = opts.pixelRatioCap || 2;
    // Headless screenshot capture reads the canvas outside the rAF that drew it; without this the
    // drawing buffer may already be cleared and the capture comes back empty. Off by default
    // (it costs a buffer copy per frame); the dev preview and the validation gate turn it on.
    this._preserveDrawingBuffer = !!opts.preserveDrawingBuffer;
  }

  mount(mountEl) {
    if (this.mounted) return this.renderer;
    const el = mountEl || (typeof document !== 'undefined' ? document.body : null);
    if (!el) throw new Error('ThreeRenderer.mount: no mount element');

    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, preserveDrawingBuffer: this._preserveDrawingBuffer,
    });
    this.renderer.setPixelRatio(Math.min(
      (typeof window !== 'undefined' && window.devicePixelRatio) || 1, this._pixelRatioCap,
    ));
    this.renderer.setSize(el.clientWidth || 960, el.clientHeight || 640);
    // colour pipeline — matches the Phase-0 human preview so lookdev transfers unchanged
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.canvas = this.renderer.domElement;
    el.appendChild(this.canvas);
    this.mounted = true;
    this._log('info', 'app', 'ThreeRenderer mounted');
    return this.renderer;
  }

  /** @param {{camera?:THREE.Camera}} descriptor */
  setCamera(descriptor) { this._camera = (descriptor && descriptor.camera) || descriptor || null; }

  clear() { if (this.renderer) this.renderer.clear(); }

  /** Draw one frame. Carries no clock: the caller decides when a frame is due. */
  render(scene, camera) {
    const cam = camera || this._camera;
    if (!this.renderer || !scene || !cam) return false;
    this.renderer.render(scene, cam);
    return true;
  }

  setSize(w, h) {
    if (!this.renderer || !(w > 0) || !(h > 0)) return;
    this.renderer.setSize(w, h, false);
  }

  dispose() {
    if (this.renderer) {
      this.renderer.dispose();
      if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    }
    this.renderer = null; this.canvas = null; this._camera = null; this.mounted = false;
  }

  _log(level, cat, msg, data) { if (this.logger && this.logger[level]) this.logger[level](cat, msg, data); }
}

export default ThreeRenderer;
