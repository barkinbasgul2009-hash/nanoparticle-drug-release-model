// Phase-2B BAKED PRESENTATION. Plays the Blender-authored clip from human_application_baked.glb.
//
// THE ONE RULE THIS FILE EXISTS TO ENFORCE: there is exactly one narrative clock, masterProgress,
// and this scene only ever REFLECTS it (ss25).
//
//     clipTime = clamp(masterProgress, 0, 1) * clipDuration
//     action.time = clipTime;  mixer.update(0)
//
// `mixer.update(delta)` is never used as the playback source, the action stays `paused`, and there
// is no Clock, interval, accumulator or per-object timer anywhere in this module. Direct seek and
// continuous playback therefore reach byte-identical bone, morph, product and camera state — which
// is exactly what the deterministic frame capture and the timeline tests assert.
//
// Ownership (ss24): in this mode the baked clip owns bones, fingers, the product transform, the
// tube morphs, the skin indentation and the cream morphs. Three.js keeps the camera, visibility
// orchestration and bounded surface polish. Nothing procedural is instantiated.

import * as THREE from '../../vendor/three/three.module.js';
import { RoomEnvironment } from '../../vendor/three/addons/environments/RoomEnvironment.js';
import { applyHumanPresentation } from './humanPresentation.js';
import { validateAgainstAsset, eventAt, betweenEvents } from './applicationManifest.js';
import { ApplicationCameraDirector } from './applicationCameraDirector.js';
import { PRESENTATION_MODES } from './presentationMode.js';
import { buildStudioLighting } from './humanApplicationScene.js';
import { disposeObject } from './disposal.js';

/** Bounded, VISUAL_ONLY surface polish for the cream (ss27). Never generates scientific state. */
export const CREAM_POLISH = Object.freeze({
  // Warm ivory: bright enough to separate from skin, warm enough not to read as white paint under
  // the studio key.
  colour: 0xefe0c4,
  roughness: 0.17,
  clearcoat: 0.9,
  clearcoatRoughness: 0.14,
  sheen: 0.35,
  sheenColour: 0xe6eef7,
  envMapIntensity: 1.15,
});

const CREAM_MATERIAL_RE = /^CREAM_/;
const PRODUCT_MATERIAL_RE = /^NANODERM_/;

export class BakedApplicationScene {
  /**
   * @param {{ gltf:object, manifest:object, renderer:THREE.WebGLRenderer, aspect?:number,
   *           cleanClothing?:boolean }} opts
   */
  constructor(opts = {}) {
    this.id = 'human_application_baked';
    this.mode = PRESENTATION_MODES.BAKED;
    this.manifest = opts.manifest;
    this.disposed = false;
    this.lastFrame = null;
    this._owned = { materials: new Set(), geometries: new Set() };

    if (!this.manifest) throw new Error('BakedApplicationScene: manifest is required');

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x39424b);

    this.root = opts.gltf.scene;
    this.scene.add(this.root);

    // ---- resolve everything the manifest promises, and fail loudly if it lies -----------------
    // A Blender object with several material slots exports as one glTF mesh with several
    // primitives, which three.js loads as a GROUP whose children hold the geometry and the morph
    // dictionaries. Index every mesh under its own name AND under each named ancestor, so the
    // manifest can keep referring to the authored object name.
    const byName = new Map();
    const morphDictionaries = {};
    const morphMeshes = {};
    this.root.traverse((o) => {
      if (o.name && !byName.has(o.name)) byName.set(o.name, o);
      if (!o.isMesh || !o.morphTargetDictionary) return;
      for (let node = o; node && node !== this.root.parent; node = node.parent) {
        if (!node.name) continue;
        morphDictionaries[node.name] = Object.assign(morphDictionaries[node.name] || {}, o.morphTargetDictionary);
        (morphMeshes[node.name] || (morphMeshes[node.name] = [])).push(o);
      }
    });
    this.morphMeshes = morphMeshes;
    const clips = opts.gltf.animations || [];
    const check = validateAgainstAsset(this.manifest, {
      objectNames: new Set(byName.keys()),
      morphDictionaries,
      clipNames: clips.map((c) => c.name),
      clipDuration: clips.length ? clips[0].duration : undefined,
    });
    if (!check.ok) throw new Error(`baked asset does not match its manifest:\n  - ${check.errors.join('\n  - ')}`);

    this.objects = {};
    for (const [key, name] of Object.entries(this.manifest.objects)) this.objects[key] = byName.get(name) || null;
    this.morphDictionaries = morphDictionaries;

    // ---- presentation + polish ----------------------------------------------------------------
    this.presentation = applyHumanPresentation(this.root, { cleanClothing: opts.cleanClothing !== false });
    this._polishSurfaces();
    this.lighting = opts.renderer ? buildStudioLighting(this.scene, opts.renderer) : null;
    if (!opts.renderer) this.scene.environment = null;

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.22 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    // Floor height comes from the FIGURE only, and only after world matrices exist. Measuring the
    // whole root put the floor at the product tray's height and drew a slab across the shot.
    this.root.updateMatrixWorld(true);
    const figureBox = new THREE.Box3();
    this.root.traverse((o) => {
      if ((o.isMesh || o.isSkinnedMesh) && /^Human/i.test(o.name)) figureBox.expandByObject(o);
    });
    ground.position.y = (!figureBox.isEmpty() && Number.isFinite(figureBox.min.y))
      ? Math.min(0, figureBox.min.y) : 0;
    this.ground = ground;
    this.scene.add(ground);
    this._owned.geometries.add(ground.geometry);
    this._owned.materials.add(ground.material);

    // ---- the single clip -----------------------------------------------------------------------
    this.clip = clips.find((c) => c.name === this.manifest.clip.name);
    if (!this.clip) throw new Error(`baked clip "${this.manifest.clip.name}" not found in the asset`);
    this.mixer = new THREE.AnimationMixer(this.root);
    this.action = this.mixer.clipAction(this.clip);
    this.action.setLoop(THREE.LoopRepeat, Infinity);   // never auto-finishes; time is set explicitly
    this.action.clampWhenFinished = false;
    this.action.enabled = true;
    this.action.weight = 1;
    this.action.play();
    this.action.paused = true;                         // the master timeline is the only driver
    this.clipDuration = this.clip.duration;

    // ---- camera ---------------------------------------------------------------------------------
    this.director = new ApplicationCameraDirector(this.manifest, () => this._anchors(), {
      aspect: opts.aspect || 1,
    });
    this.camera = this.director.camera;

    this._v = new THREE.Vector3();
    this._forearmBone = this._findBone(/^lowerarm_l$/i);
    this._treatedHandBone = this._findBone(/^hand_l$/i);
    this._handBone = this._findBone(/^hand_r$/i);
    this._chestBone = this._findBone(/^spine_03$/i);
    this._anchorCache = {};
    this.update({ progress: 0 });
  }

  get ready() { return !this.disposed && !!this.action; }

  _findBone(pattern) {
    let found = null;
    this.root.traverse((o) => { if (!found && o.isBone && pattern.test(o.name)) found = o; });
    return found;
  }

  /** Bounded VISUAL_ONLY polish. Only materials this scene owns are touched (ss27, ss29). */
  _polishSurfaces() {
    const seen = new Set();
    this.root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || seen.has(m.uuid)) continue;
        seen.add(m.uuid);
        if (CREAM_MATERIAL_RE.test(m.name || '')) {
          m.color = new THREE.Color(CREAM_POLISH.colour);
          m.roughness = CREAM_POLISH.roughness;
          m.metalness = 0;
          m.envMapIntensity = CREAM_POLISH.envMapIntensity;
          if ('clearcoat' in m) { m.clearcoat = CREAM_POLISH.clearcoat; m.clearcoatRoughness = CREAM_POLISH.clearcoatRoughness; }
          if ('sheen' in m) { m.sheen = CREAM_POLISH.sheen; m.sheenColor = new THREE.Color(CREAM_POLISH.sheenColour); }
          m.polygonOffset = true;                 // the film sits on the skin: keep it off the z-fight edge
          m.polygonOffsetFactor = -2;
          m.polygonOffsetUnits = -2;
          m.needsUpdate = true;
        } else if (PRODUCT_MATERIAL_RE.test(m.name || '')) {
          m.envMapIntensity = 1.05;
          m.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Live anchors for the camera director, read from the posed scene each frame.
   *
   * The two important ones — the nozzle tip and the deposit point on the forearm — come from
   * ANCHOR_* marker nodes baked into the asset, so the camera tracks the exact points the Blender
   * animation was authored around instead of a re-derivation that can drift out of step with it.
   */
  _anchors() {
    const a = this._anchorCache;
    const get = (key) => {
      const o = this.objects[key];
      if (!o) return null;
      o.getWorldPosition(this._v);
      return this._v;
    };
    const put = (name, v) => { a[name] = (a[name] || new THREE.Vector3()).copy(v); return a[name]; };

    put('upperBody', this._chestBone ? this._chestBone.getWorldPosition(this._v) : new THREE.Vector3(0, 1.25, 0.05));

    // treated forearm mid-shaft, pushed off the skin so the camera frames the surface not the bone
    const elbow = new THREE.Vector3();
    const wrist = new THREE.Vector3();
    if (this._forearmBone && this._treatedHandBone) {
      this._forearmBone.getWorldPosition(elbow);
      this._treatedHandBone.getWorldPosition(wrist);
      put('forearm', elbow.clone().lerp(wrist, 0.45));
    } else {
      put('forearm', new THREE.Vector3(0.15, 1.2, 0.2));
    }

    const deposit = get('depositAnchor');
    put('deposit', deposit || a.forearm);
    const nozzle = get('nozzleAnchor');
    put('nozzle', nozzle || a.forearm);
    const tube = get('tube');
    put('product', tube || a.forearm);
    put('productLabel', tube || a.forearm);
    a.betweenProductAndArm = (a.betweenProductAndArm || new THREE.Vector3())
      .copy(a.product).lerp(a.deposit, 0.5);

    if (this._handBone) {
      this._handBone.getWorldPosition(this._v);
      put('palmContact', this._v.clone().lerp(a.deposit, 0.62));
    } else {
      put('palmContact', a.deposit);
    }
    return a;
  }

  // -------------------------------------------------------------------------------------------
  // SceneDirector contract
  // -------------------------------------------------------------------------------------------
  enter() { this.root.visible = true; return this; }
  exit() { return this; }

  /**
   * Reflect the master timeline. Pure in `progress` — no accumulation, no wall clock.
   * @param {{progress:number}|number} ctx
   */
  update(ctx = {}) {
    if (this.disposed) return null;
    const p = typeof ctx === 'number' ? ctx : ctx.progress;
    if (!Number.isFinite(p)) return null;
    const progress = Math.max(0, Math.min(1, p));
    const clipTime = progress * this.clipDuration;

    // absolute-time control: set the action's time, then flush with a ZERO delta
    this.action.paused = true;
    this.action.time = clipTime;
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);

    this._orchestrateVisibility(progress);
    const shot = this.director.update(progress);

    this.lastFrame = {
      progress,
      clipTime,
      mode: this.mode,
      event: eventAt(this.manifest, progress),
      shot,
      morphs: this.morphState(),
    };
    return this.lastFrame;
  }

  /**
   * Visibility is a JS responsibility even in baked mode (ss24). The only thing hidden here is the
   * cream strand while its morph weights are zero: its basis shape is a sub-millimetre stub, and
   * drawing it would put a hairline artefact at the nozzle for most of the clip. The product itself
   * is never hidden — it is returned to the tray, so it cannot pop out of existence (ss15).
   */
  _orchestrateVisibility(progress) {
    const strand = this.objects.creamStrand;
    if (strand) strand.visible = this._peakMorph(this.manifest.objects.creamStrand) > 0.01;
    const film = this.objects.creamDeposit;
    if (film) film.visible = this._peakMorph(this.manifest.objects.creamDeposit) > 0.005;
    this._creamProgress = betweenEvents(this.manifest, 'creamContact', 'heroStart', progress);
  }

  /** Current morph weights by semantic name — the state the visual tests assert against. */
  morphState() {
    const out = {};
    for (const [semantic, entry] of Object.entries(this.manifest.morphTargets)) {
      const meshes = this.morphMeshes[entry.mesh] || [];
      if (!meshes.length) continue;
      const values = {};
      for (const target of entry.targets) {
        let value = null;
        for (const mesh of meshes) {
          const idx = mesh.morphTargetDictionary ? mesh.morphTargetDictionary[target] : undefined;
          if (idx === undefined || !mesh.morphTargetInfluences) continue;
          value = mesh.morphTargetInfluences[idx];
          break;
        }
        values[target] = value;
      }
      out[semantic] = values;
    }
    return out;
  }

  /** Peak morph influence across every primitive of a named object. */
  _peakMorph(name) {
    let peak = 0;
    for (const mesh of (this.morphMeshes[name] || [])) {
      if (!mesh.morphTargetInfluences) continue;
      for (const v of mesh.morphTargetInfluences) if (v > peak) peak = v;
    }
    return peak;
  }

  /** Development diagnostics (ss24). Not shown in the production UI. */
  diagnostics() {
    return {
      presentationMode: this.mode,
      asset: this.manifest.asset,
      assetVersion: this.manifest.assetVersion,
      clip: this.manifest.clip.name,
      clipDuration: this.clipDuration,
      clipTime: this.lastFrame ? this.lastFrame.clipTime : 0,
      masterProgress: this.lastFrame ? this.lastFrame.progress : 0,
      event: this.lastFrame ? this.lastFrame.event : null,
      proceduralControllers: 'disabled',
      mixer: 'absolute-time (action.paused, mixer.update(0))',
      actionPaused: this.action ? this.action.paused : null,
    };
  }

  seek(p) { return this.update({ progress: p }); }
  reset() { return this.update({ progress: 0 }); }

  setAspect(aspect) { this.director.setAspect(aspect); }

  dispose() {
    if (this.disposed) return;
    if (this.action) { this.action.stop(); this.mixer.uncacheAction(this.clip, this.root); }
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheClip(this.clip); this.mixer.uncacheRoot(this.root); }
    this.action = null;
    this.mixer = null;
    if (this.lighting) this.lighting.dispose();
    disposeObject(this.ground);
    disposeObject(this.root);
    this.scene.environment = null;
    this.scene.clear();
    this.objects = {};
    this.lastFrame = null;
    this.disposed = true;
  }
}

export default BakedApplicationScene;
