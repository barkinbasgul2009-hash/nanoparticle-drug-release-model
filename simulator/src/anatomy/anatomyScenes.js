// Anatomy scene builder (Phase 2). Turns the registry's scene list into Scene
// objects and registers them with the Phase-1 SceneManager. Each scene contains
// ANATOMY ONLY: on enter it sets the renderer's scale level (which selects the
// visible layers + depth window) and redraws a STATIC frame. No motion, no
// biology, no particles.

/**
 * @param {{
 *   model: import('./anatomyModel.js').AnatomyModel,
 *   sceneManager: object, zoom: object, renderer: object,
 *   state?: object, logger?: object
 * }} deps
 * @returns {string[]} registered scene ids
 */
export function registerAnatomyScenes(deps) {
  const { model, sceneManager, zoom, renderer, state, logger } = deps;
  const ids = [];
  for (const s of model.scenes) {
    const scene = {
      meta: { id: s.id, title: s.title, scale: s.scale, kind: 'anatomy' },
      enter() {
        // Static: pick the scene's scale level -> visibility/depth window.
        zoom.setLevel(s.scale);
        if (renderer && renderer.setLevel) renderer.setLevel(s.scale);
        if (state && state.setScene) state.setScene(s.id);
        if (logger && logger.info) logger.info('scene', `anatomy scene: ${s.id} @ ${s.scale}`);
      },
    };
    sceneManager.register(scene);
    ids.push(s.id);
  }
  return ids;
}

export default registerAnatomyScenes;
