// Phase-0 cleanup utilities. Three.js does not garbage-collect GPU resources: every geometry,
// material and texture must be disposed explicitly or the scale transitions (human -> skin ->
// bloodstream -> tissue) will leak VRAM across scene swaps.

/** Dispose a material and every texture it references. */
export function disposeMaterial(material) {
  if (!material) return;
  const mats = Array.isArray(material) ? material : [material];
  for (const m of mats) {
    if (!m) continue;
    for (const k of Object.keys(m)) {
      const v = m[k];
      if (v && v.isTexture && typeof v.dispose === 'function') v.dispose();
    }
    if (typeof m.dispose === 'function') m.dispose();
  }
}

/** Recursively dispose an Object3D subtree (geometries + materials + textures) and detach it. */
export function disposeObject(root) {
  if (!root) return 0;
  let n = 0;
  root.traverse((obj) => {
    if (obj.geometry && typeof obj.geometry.dispose === 'function') { obj.geometry.dispose(); n += 1; }
    if (obj.material) { disposeMaterial(obj.material); n += 1; }
  });
  if (root.parent) root.parent.remove(root);
  return n;
}

/** Dispose an entire scene's children (used on scene swap). */
export function disposeScene(scene) {
  if (!scene) return 0;
  let n = 0;
  for (const child of [...scene.children]) n += disposeObject(child);
  return n;
}

/** Full teardown for a renderer + composer + controls (called when leaving 3D mode). */
export function disposeRuntime({ renderer, composer, controls, scene, mixers } = {}) {
  if (mixers) for (const m of mixers) if (m && typeof m.stopAllAction === 'function') m.stopAllAction();
  if (scene) disposeScene(scene);
  if (controls && typeof controls.dispose === 'function') controls.dispose();
  if (composer && typeof composer.dispose === 'function') composer.dispose();
  if (renderer) {
    if (typeof renderer.dispose === 'function') renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }
}

export default disposeObject;
