// Anatomy UI panels (Phase 2). Fills the previously-empty panels with ANATOMY
// content only: current anatomical layer, current zoom level, evidence
// references, scene selector, navigation. NO biological explanations. Each panel
// exposes a pure model() (testable in Node) and renders to the DOM only in a
// browser.

/**
 * Build panel content models from app state + anatomy model. Pure - returns
 * plain objects; no DOM. The UiFramework/browser layer renders these.
 * @param {{ model: object, state: object, presets: object, citations: object, scaleLevels: string[], transport?: object }} deps
 * @returns {Record<string, object>}
 */
export function buildAnatomyPanelModels(deps) {
  const { model, state, presets, citations, scaleLevels, transport, release, uptake, endocytosis, intracellular, targetEngagement, signalPropagation, transcription } = deps;
  const s = state.get();
  const currentLayer = s.selectedStructure || null;
  const level = s.currentScale;
  const visible = model.visibleAt(level);
  // Phase 3.1: transport evidence level + message for the current species (data only).
  const species = s.species || model.activeSpecies || null;
  const transportEvidence = transport && transport.engine ? {
    evidenceLevel: transport.engine.evidenceLevelName(),
    message: transport.engine.message(),
    blocked: transport.engine.isBlocked(),
  } : null;
  // Phase 4: drug release status (data only; model + mean released + empty count).
  const releaseInfo = release && release.engine ? {
    model: release.model.modelId(),
    meanReleased: release.engine.stats().meanReleased,
    empty: release.engine.stats().empty,
    releasing: release.engine.stats().releasing,
  } : null;
  // Phase 4B: the three independent evidence levels (Transport / Release / Cell Uptake).
  // Release is a formulation-experimental MODEL, but the shown chain level is bounded by
  // transport (experimental only where transport is experimental, i.e. rat).
  const transportLevel = transport && transport.engine ? transport.engine.evidenceLevelName() : null;
  const uptakeLevel = uptake && uptake.engine ? uptake.engine.evidenceLevelName() : null;
  const releaseLevel = release ? (transportLevel || 'EXPERIMENTAL') : null;
  // Phase 4C: endocytosis + intracellular trafficking evidence levels.
  const endocytosisLevel = endocytosis && endocytosis.engine ? endocytosis.engine.evidenceLevelName() : null;
  const traffickingLevel = endocytosis && endocytosis.engine ? endocytosis.engine.traffickingLevelName() : null;
  // Phase 4D: intracellular release evidence level (B1 = NOT_REPORTED).
  const intracellularLevel = intracellular && intracellular.engine ? intracellular.engine.evidenceLevelName() : null;
  // Phase 5A: target engagement evidence level / prediction label (B1 = NOT_REPORTED).
  const targetLevel = targetEngagement && targetEngagement.engine ? targetEngagement.engine.evidenceLevelName() : null;
  // Phase 5B.2: signal transduction summary level (idle => NOT_REPORTED; else PREDICTIVE).
  const signalLevel = signalPropagation && signalPropagation.engine ? signalPropagation.engine.summaryLevel() : null;
  // Phase 5C: gene regulation / transcription summary level (idle => NOT_REPORTED).
  const geneLevel = transcription && transcription.engine ? transcription.engine.summaryLevel() : null;
  const evidenceLevels = {
    transport: transportLevel,
    release: releaseLevel,
    passiveUptake: uptakeLevel,
    endocytosis: endocytosisLevel,
    intracellularTrafficking: traffickingLevel,
    intracellularRelease: intracellularLevel,
    targetEngagement: targetLevel,
    signalTransduction: signalLevel,
    geneRegulation: geneLevel,
    messages: {
      transport: transport && transport.engine ? transport.engine.message() : null,
      passiveUptake: uptake && uptake.engine ? uptake.engine.message() : null,
      endocytosis: endocytosis && endocytosis.engine ? endocytosis.engine.message() : null,
      intracellularTrafficking: endocytosis && endocytosis.engine ? endocytosis.engine.traffickingMessage() : null,
      intracellularRelease: intracellular && intracellular.engine ? intracellular.engine.message() : null,
      targetEngagement: targetEngagement && targetEngagement.engine ? targetEngagement.engine.message() : null,
      signalTransduction: signalPropagation && signalPropagation.engine ? signalPropagation.engine.summaryMessage() : null,
      geneRegulation: transcription && transcription.engine ? transcription.engine.summaryMessage() : null,
    },
  };
  // Phase 5C: gene-regulation detail (data only) for the new panel section.
  const geneRegulationInfo = transcription && transcription.engine && !transcription.engine.isIdle() ? {
    level: transcription.engine.summaryLevel(),
    genes: transcription.engine.frame().genes.map((g) => ({
      symbol: g.symbol, expression: g.expressionState, polymerase: g.polymerase,
      mrna: g.mrna ? g.mrna.copyState : null, evidence: g.evidenceLevel, prediction: g.predictionLevel, confidence: g.confidence,
    })),
    tfs: transcription.engine.frame().tfs.map((t) => ({ name: t.name, state: t.state, prediction: t.predictionLevel })),
  } : (transcription && transcription.engine ? { level: 'NOT_REPORTED', genes: [], tfs: [] } : null);
  // Phase 5A: target engagement status (data only).
  const targetInfo = targetEngagement && targetEngagement.engine ? {
    level: targetEngagement.engine.evidenceLevelName(),
    predicted: targetEngagement.engine.isPredicted(),
    targets: targetEngagement.engine.stats().targets,
    bound: targetEngagement.engine.stats().bound,
    saturation: targetEngagement.engine.stats().saturation,
    saturationBucket: targetEngagement.engine.saturationBucket(),
  } : null;
  // Phase 4D: intracellular status (data only).
  const intracellularInfo = intracellular && intracellular.engine ? {
    level: intracellular.engine.evidenceLevelName(),
    molecules: intracellular.engine.stats().total,
    alive: intracellular.engine.stats().alive,
    degraded: intracellular.engine.stats().degraded,
    nuclearMembrane: intracellular.engine.stats().nuclearMembrane,
  } : null;
  // Phase 4C: endocytosis status (data only).
  const endocytosisInfo = endocytosis && endocytosis.engine ? {
    escapeAllowed: endocytosis.engine.escapeAllowed(),
    byState: endocytosis.engine.stats().byState,
    byPathway: endocytosis.engine.stats().byPathway,
  } : null;
  // Phase 4B: uptake status (data only).
  const uptakeInfo = uptake && uptake.engine ? {
    model: 'passive_membrane_crossing',
    molecules: uptake.engine.stats().total,
    cytoplasm: uptake.engine.stats().cytoplasm,
    extracellular: uptake.engine.stats().extracellular,
  } : null;

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
      species,
      transportEvidence,
      release: releaseInfo,
      uptake: uptakeInfo,
      endocytosis: endocytosisInfo,
      intracellular: intracellularInfo,
      targetEngagement: targetInfo,
      geneRegulation: geneRegulationInfo,
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
      // Phase 4B: three independent evidence levels (each Experimental/Predictive/Unavailable).
      evidenceLevels,
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
