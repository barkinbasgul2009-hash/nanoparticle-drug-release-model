// Phase-2 SCENE — assembles the human, the cream layer, the studio lighting and the camera into
// one shot, driven entirely by the master timeline's progress.
//
// Implements the same scene contract as sceneDirector.js expects ({ id, enter, update, exit,
// dispose }) so it drops into the existing director without changing it. `update()` takes the
// director's ctx ({ progress, ... }) and is a PURE function of progress: no accumulation, no
// wall-clock reads, no second narrative clock.

import * as THREE from '../../vendor/three/three.module.js';
import { RoomEnvironment } from '../../vendor/three/addons/environments/RoomEnvironment.js';
import { applyHumanPresentation } from './humanPresentation.js';
import { buildCreamLayer } from './creamLayer.js';
import { buildCreamTube, buildCarton, PRODUCT } from './creamProduct.js';
import { buildCreamDispenser } from './creamDispenser.js';
import { attachSkinDeformation } from './skinDeformation.js';
import { ApplicationRig } from './applicationRig.js';
import { buildBoneMap } from './boneMap.js';
import { disposeObject } from './disposal.js';

/**
 * Neutral product-demo lighting: soft key, cool fill, rim separation, plus an image-based
 * environment so skin and the cream's specular have something to reflect. Deliberately even —
 * dramatic lighting reads as advertising, not as a scientific demo.
 */
export function buildStudioLighting(scene, renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;

  const key = new THREE.DirectionalLight(0xfff4e8, 2.0);
  key.position.set(1.4, 2.4, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 8;
  key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 2.4; key.shadow.camera.bottom = -0.4;
  key.shadow.bias = -0.0012;
  key.shadow.normalBias = 0.02;

  const fill = new THREE.DirectionalLight(0xdce8ff, 0.75);
  fill.position.set(-2.0, 1.4, 1.6);

  const rim = new THREE.DirectionalLight(0xffffff, 1.15);
  rim.position.set(-0.8, 2.2, -2.4);

  // RAKING light, almost parallel to the forearm: this is what makes cream ridges and the skin
  // indentation cast their own micro-shadows instead of washing out under flat frontal fill.
  const rake = new THREE.DirectionalLight(0xffeede, 1.5);
  rake.position.set(2.4, 1.45, 0.35);

  const hemi = new THREE.HemisphereLight(0xdfe7f0, 0x2a3138, 0.55);

  scene.add(key, fill, rim, rake, hemi);
  return { key, fill, rim, rake, hemi, env, pmrem, dispose() { pmrem.dispose(); env.dispose(); } };
}

export class HumanApplicationScene {
  /**
   * @param {{ gltf:object, renderer:THREE.WebGLRenderer, applyingSide?:'L'|'R',
   *           cleanClothing?:boolean, aspect?:number }} opts
   */
  constructor(opts = {}) {
    this.id = 'human_application';
    this.applyingSide = opts.applyingSide === 'L' ? 'L' : 'R';
    this.disposed = false;
    this.lastFrame = null;

    this.scene = new THREE.Scene();
    // A mid-dark neutral, NOT the previous near-white: white cream on pale skin against a white
    // background has nothing to separate against at normal viewing size.
    this.scene.background = new THREE.Color(0x39424b);

    this.model = opts.gltf.scene;
    this.presentation = applyHumanPresentation(this.model, {
      cleanClothing: opts.cleanClothing !== false,   // watermark mitigation on by default here
    });
    this.scene.add(this.model);

    this.lighting = opts.renderer ? buildStudioLighting(this.scene, opts.renderer) : null;

    // ---- ground shadow catcher (grounds the figure without adding set dressing) ----
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.ShadowMaterial({ opacity: 0.22 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.ground = ground;
    this.scene.add(ground);

    // ---- rig ----
    const boneByName = {}; const boneNames = [];
    this.model.traverse((o) => { if (o.isBone) { boneByName[o.name] = o; boneNames.push(o.name); } });
    this.boneByName = boneByName;
    this.boneMap = buildBoneMap(boneNames);

    const treated = this.applyingSide === 'R' ? 'L' : 'R';
    const forearmBone = this.boneMap.map[`forearm${treated}`];
    const handBone = this.boneMap.map[`hand${treated}`];

    // ---- cream layer, cut from the treated forearm ----
    this.bodyMesh = null;
    this.model.traverse((o) => {
      if (o.isSkinnedMesh && !this.bodyMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m && /body|skin/i.test(m.name || ''))) this.bodyMesh = o;
      }
    });
    this.cream = buildCreamLayer(this.bodyMesh, { forearm: forearmBone, hand: handBone });

    // ---- localized skin compression under the palm ----
    // Attached to BOTH the skin and the cream film, with identical uniforms, so the cream stays
    // welded to the deformed surface instead of floating over the dent.
    this.skinDeform = [];
    if (this.bodyMesh) {
      for (const m of (Array.isArray(this.bodyMesh.material) ? this.bodyMesh.material : [this.bodyMesh.material])) {
        if (m) this.skinDeform.push(attachSkinDeformation(m));
      }
    }
    if (this.cream.material) this.skinDeform.push(attachSkinDeformation(this.cream.material));
    this._worldToLocal = new THREE.Matrix4();

    // ---- NANODERM product: tube (held / dispensing) + carton (set dressing for the opening) ----
    this.tube = buildCreamTube();
    this.tube.group.visible = false;
    this.scene.add(this.tube.group);
    this.product = PRODUCT;

    this.dispenser = buildCreamDispenser();
    this.scene.add(this.dispenser.group);

    this.rig = new ApplicationRig({
      boneNames,
      lookupBone: (n) => boneByName[n] || null,
      applyingSide: this.applyingSide,
      forearmRadius: this.cream.stats.built ? this.cream.stats.meanRadius : undefined,
      nozzleLocalY: this.tube.nozzleTip.position.y,
      tubeGripRadius: 0.015,
    });

    // ---- camera ----
    this.camera = new THREE.PerspectiveCamera(38, opts.aspect || 1, 0.01, 60);
    this._camTarget = new THREE.Vector3();
    this._frustum = new THREE.Frustum();
    this._projView = new THREE.Matrix4();

    // ground the figure on whatever the model's actual floor level is
    const box = new THREE.Box3().setFromObject(this.model);
    if (Number.isFinite(box.min.y)) ground.position.y = box.min.y;
  }

  get ready() { return !!(this.rig && this.rig.ready); }

  /** SceneDirector contract. Entering is idempotent; the scene owns no per-entry state. */
  enter() { this.model.visible = true; return this; }
  exit() { return this; }

  /**
   * Drive the whole shot from the master timeline.
   * @param {{progress:number}} ctx  the SceneDirector's update context
   */
  update(ctx = {}) {
    if (this.disposed) return null;
    const p = typeof ctx === 'number' ? ctx : ctx.progress;
    if (!Number.isFinite(p)) return null;          // unavailable progress renders nothing new

    const frame = this.rig.solve(p);
    if (this.cream.setState) this.cream.setState(frame.choreography.cream);
    this._updateSkinContact(frame);
    this._updateProduct(frame);
    this._updateCamera(frame);
    this.lastFrame = frame;
    return frame;
  }

  /** Press the forearm skin in under the palm. Pure in the frame state. */
  _updateSkinContact(frame) {
    if (!this.skinDeform.length) return;
    const press = frame.choreography.apply.press;      // metres of authored pressure
    const inContact = frame.contact.expected && press > 0;
    if (this.bodyMesh) this._worldToLocal.copy(this.bodyMesh.matrixWorld).invert();
    const c = inContact
      ? {
        position: frame.contact.palmCentre,
        normal: frame.deposit.normal,
        // the dent replaces the old overlap: scale the authored press up into a real indentation
        depth: Math.min(0.0075, press * 1.5),
        worldToLocal: this._worldToLocal,
      }
      : null;
    for (const d of this.skinDeform) d.setContact(c);
  }

  /** Place the tube and drive the dispensing strand/bead. Pure in the frame state. */
  _updateProduct(frame) {
    const ch = frame.choreography;
    const pose = frame.productPose;
    // Hide the tube only once it is genuinely outside the camera frustum — popping it out while
    // still on screen is the artefact this replaces.
    let offScreen = false;
    if (pose && pose.stowed) {
      this.camera.updateMatrixWorld();
      this._frustum.setFromProjectionMatrix(
        this._projView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
      );
      offScreen = !this._frustum.containsPoint(pose.position);
    }
    const visible = !!(ch.product.visible && pose && !offScreen);
    this.tube.group.visible = visible;
    if (visible) {
      this.tube.group.position.copy(pose.position);
      this.tube.group.quaternion.copy(pose.quaternion);
      this.tube.cap.visible = !!ch.product.capOn;
    }
    // finger pressure deforms the barrel; dispensed volume empties the tail
    this.tube.setSqueeze(ch.dispense.squeeze || 0, ch.dispense.extrusion || 0);
    this.dispenser.setState(
      ch.dispense,
      frame.nozzleWorld,
      frame.deposit ? frame.deposit.point : null,
      frame.deposit ? frame.deposit.normal : null,
    );
  }

  _updateCamera(frame) {
    const c = frame.choreography.camera;
    const a = frame.anchors;
    if (!a) return;
    const from = a[c.fromAnchor] || a.upper_body;
    const to = a[c.toAnchor] || from;
    this._camTarget.copy(from).lerp(to, c.mix);

    const ce = Math.cos(c.elev), se = Math.sin(c.elev);
    const dir = new THREE.Vector3(Math.sin(c.az) * ce, se, Math.cos(c.az) * ce).normalize();
    this.camera.position.copy(this._camTarget).addScaledVector(dir, c.dist);
    this.camera.lookAt(this._camTarget);
    this.camera.updateMatrixWorld();
  }

  /** Seek / reset are the same pure call as play — the determinism guarantee. */
  seek(p) { return this.update({ progress: p }); }
  reset() { return this.update({ progress: 0 }); }

  setAspect(aspect) {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.disposed) return;
    if (this.cream.dispose) this.cream.dispose();
    if (this.tube) this.tube.dispose();
    if (this.dispenser) this.dispenser.dispose();
    if (this.rig) this.rig.dispose();
    if (this.lighting) this.lighting.dispose();
    disposeObject(this.ground);
    disposeObject(this.model);
    this.scene.environment = null;
    this.scene.clear();
    this.disposed = true;
    this.lastFrame = null;
  }
}

export default HumanApplicationScene;
