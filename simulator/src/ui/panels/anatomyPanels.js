// Anatomy UI panels (Phase 2). Fills the previously-empty panels with ANATOMY
// content only: current anatomical layer, current zoom level, evidence
// references, scene selector, navigation. NO biological explanations. Each panel
// exposes a pure model() (testable in Node) and renders to the DOM only in a
// browser.

/**
 * Build panel content models from app state + anatomy model. Pure - returns
 * plain objects; no DOM. The UiFramework/browser layer renders these.
 * @param {{ model: object, state: object, presets: object, citations: object, scaleLevels: string[] }} deps
 * @returns {Record<string, object>}
 */
export function buildAnatomyPanelModels(deps) {
  const { model, state, presets, citations, scaleLevels } = deps;
  const s = state.get();
  const currentLayer = s.selectedStructure || null;
  const level = s.currentScale;
  const visible = model.visibleAt(level);

  // Evidence references: the anatomy registry's provenance sources + the active
  // preset's references (resolved to citations where possible).
  const provenance = (model.registry.provenance_sources || []);
  const preset = s.currentPreset ? presets.get(s.currentPreset) : null;
  const presetRefs = preset ? citations.resolveMany(preset.references) : [];

  return {
    information: {
      title: 'Current Anatomical Layer',
      currentLayer: currentLayer || '(none selected)',
      visibleLayers: visible,
      notToScale: model.notToScale,
      species: (s.species || model.activeSpecies || null),
    },
    navigation: {
      title: 'Navigation',
      zoomLevels: scaleLevels,
      currentLevel: level,
    },
    legend: {
      title: 'Anatomical Layers',
      layers: model.tissueLayers().map((l) => ({ id: l.id, name: l.name, color: model.colorOf(l.id) })),
    },
    evidence: {
      title: 'Evidence References',
      provenance,
      presetReferences: presetRefs.map((c) => ({ id: c.id, citation: c.citation || c.id, doi: c.doi || null })),
    },
    timeline: {
      title: 'Scene Selector',
      scenes: model.scenes.map((sc) => ({ id: sc.id, title: sc.title, scale: sc.scale })),
      activeScene: s.currentScene || null,
    },
  };
}

/**
 * Render the panel models into the browser DOM (no-op in Node). Replaces the
 * empty BasePanel bodies with lightweight anatomical content.
 * @param {object} uiFramework @param {Record<string, object>} models
 */
export function renderAnatomyPanels(uiFramework, models) {
  if (typeof document === 'undefined') return;
  for (const [panelId, m] of Object.entries(models)) {
    const panel = uiFramework.get(panelId);
    if (!panel || !panel.el) continue;
    const body = panel.el.querySelector('.sim-panel__body');
    if (body) body.textContent = summarize(m);
  }
}

function summarize(m) {
  if (m.zoomLevels) return `${m.currentLevel} of ${m.zoomLevels.join(' > ')}`;
  if (m.layers) return m.layers.map((l) => l.name).join(' | ');
  if (m.scenes) return m.scenes.map((s) => s.title).join(' | ');
  if (m.provenance) return `${m.presetReferences.length} preset refs + ${m.provenance.length} anatomy sources`;
  if (m.visibleLayers) return `${m.currentLayer} | visible: ${m.visibleLayers.join(', ')}${m.notToScale ? ' (not to scale)' : ''}`;
  return JSON.stringify(m);
}

export default buildAnatomyPanelModels;
