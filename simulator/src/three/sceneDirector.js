// Phase-0 SCENE DIRECTOR (interface + minimal controller). ONE render loop, ONE authoritative
// narrative time. Scenes are registered shells implementing { id, enter, update, exit, dispose }
// (deliberately the same contract as the existing scene/sceneManager.js so the two stay compatible).
//
// TIME RULE: the director NEVER invents scientific time. `update(visualState)` is driven by the
// master timeline's progress (0..1) supplied by the caller. A rendering delta (from THREE.Clock)
// may be passed for rendering mechanics only (mixer/particle smoothing) and is never a second
// source of narrative time.

/** Shot list — scene ranges over normalized narrative progress [0..1]. Durations are cinematography. */
export const SHOTS = Object.freeze([
  { id: 'human_intro',      scene: 'human',      t0: 0.00, t1: 0.06, target: 'head_torso',  move: 'slow_dolly_in' },
  { id: 'medium_body',      scene: 'human',      t0: 0.06, t1: 0.11, target: 'upper_body',  move: 'arc' },
  { id: 'forearm_treat',    scene: 'human',      t0: 0.11, t1: 0.20, target: 'forearm',     move: 'push_in' },
  { id: 'cream_closeup',    scene: 'human',      t0: 0.20, t1: 0.26, target: 'application', move: 'macro_push' },
  { id: 'skin_approach',    scene: 'skin',       t0: 0.26, t1: 0.32, target: 'surface',     move: 'dive' },
  { id: 'skin_section',     scene: 'skin',       t0: 0.32, t1: 0.46, target: 'cross_section', move: 'lateral_track' },
  { id: 'capillary_entry',  scene: 'bloodstream',t0: 0.46, t1: 0.54, target: 'capillary',   move: 'enter' },
  { id: 'bloodstream_follow', scene: 'bloodstream', t0: 0.54, t1: 0.64, target: 'lumen',    move: 'follow' },
  { id: 'target_vessel',    scene: 'bloodstream',t0: 0.64, t1: 0.70, target: 'vessel_wall', move: 'slow_down' },
  { id: 'tissue_penetrate', scene: 'tissue',     t0: 0.70, t1: 0.82, target: 'ecm',         move: 'push_through' },
  { id: 'cellular_closeup', scene: 'tissue',     t0: 0.82, t1: 0.94, target: 'cell',        move: 'orbit_in' },
  { id: 'final_outcome',    scene: 'tissue',     t0: 0.94, t1: 1.00, target: 'cell',        move: 'pull_back' },
]);

export function shotAt(progress) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  let s = SHOTS[0];
  for (const sh of SHOTS) if (p >= sh.t0) s = sh;
  return s;
}

export class SceneDirector {
  /** @param {{ renderer?:object, logger?:object }} [opts] */
  constructor(opts = {}) {
    this.renderer = opts.renderer || null;
    this.logger = opts.logger || null;
    this.scenes = new Map();      // id -> scene shell
    this.activeId = null;
    this.lastShotId = null;
    this.disposed = false;
  }

  register(scene) {
    if (!scene || !scene.id) throw new Error('SceneDirector: scene needs an id');
    if (this.scenes.has(scene.id)) throw new Error(`SceneDirector: duplicate scene ${scene.id}`);
    this.scenes.set(scene.id, scene);
    return this;
  }

  has(id) { return this.scenes.has(id); }
  active() { return this.activeId ? this.scenes.get(this.activeId) : null; }

  /** Activate a scene, exiting the previous one (never two active scenes / never two loops). */
  activate(id, ctx = {}) {
    if (!this.scenes.has(id)) throw new Error(`SceneDirector: unknown scene ${id}`);
    if (this.activeId === id) return this.scenes.get(id);
    const prev = this.active();
    if (prev && prev.exit) prev.exit(ctx);
    this.activeId = id;
    const next = this.scenes.get(id);
    if (next.enter) next.enter(ctx);
    return next;
  }

  /**
   * Drive the active scene from the MASTER timeline. Pure function of visualState.progress —
   * so seek / reset / replay work identically to play (no hidden accumulated state).
   * @param {object} visualState from visualizationAdapter.buildVisualState()
   * @param {number} [renderDelta] seconds, rendering mechanics only (never narrative time)
   */
  update(visualState, renderDelta = 0) {
    if (this.disposed) return null;
    const p = visualState && visualState.progress ? visualState.progress.value : null;
    if (p == null) return null;                     // unavailable progress -> render nothing new
    const shot = shotAt(p);
    if (this.scenes.has(shot.scene) && this.activeId !== shot.scene) this.activate(shot.scene, { shot, visualState });
    this.lastShotId = shot.id;
    const scene = this.active();
    if (scene && scene.update) scene.update({ progress: p, shot, visualState, renderDelta });
    return shot;
  }

  /** Seek is just update() at a progress value — no separate code path. */
  seek(visualState) { return this.update(visualState, 0); }
  reset(ctx = {}) { const s = this.active(); if (s && s.exit) s.exit(ctx); this.activeId = null; this.lastShotId = null; }

  dispose() {
    for (const s of this.scenes.values()) if (s.dispose) s.dispose();
    this.scenes.clear(); this.activeId = null; this.disposed = true;
  }
}

export default SceneDirector;
