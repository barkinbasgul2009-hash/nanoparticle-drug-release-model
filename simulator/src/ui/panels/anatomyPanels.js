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
  const { model, state, presets, citations, scaleLevels, transport, release, uptake, endocytosis, intracellular, targetEngagement, signalPropagation, transcription, translation, proteinFunction, apoptosis, population, tumor, microenvironment, vascular } = deps;
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
  // Phase 5D: translation / protein synthesis summary level (idle => NOT_REPORTED).
  const translationLevel = translation && translation.engine ? translation.engine.summaryLevel() : null;
  // Phase 6A: protein function & early cellular response summary level (idle => NOT_REPORTED).
  const functionLevel = proteinFunction && proteinFunction.engine ? proteinFunction.engine.summaryLevel() : null;
  // Phase 6B: apoptosis commitment & execution summary level (idle => NOT_REPORTED/UNAVAILABLE).
  const apoptosisLevel = apoptosis && apoptosis.engine ? apoptosis.engine.summaryLevel() : null;
  // Phase 6C: population-response summary level (idle => NOT_REPORTED/UNAVAILABLE).
  const populationLevel = population && population.engine ? population.engine.summaryLevel() : null;
  // Phase 6D: tumour-response summary level (idle => NOT_REPORTED/UNAVAILABLE).
  const tumorLevel = tumor && tumor.engine ? tumor.engine.summaryLevel() : null;
  // Phase 7A: passive microenvironment summary level (idle => NOT_REPORTED/UNAVAILABLE).
  const microenvironmentLevel = microenvironment && microenvironment.engine ? microenvironment.engine.summaryLevel() : null;
  // Phase 7B: vascular summary level (idle => NOT_REPORTED/UNAVAILABLE).
  const vascularLevel = vascular && vascular.engine ? vascular.engine.summaryLevel() : null;
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
    translation: translationLevel,
    proteinFunction: functionLevel,
    apoptosis: apoptosisLevel,
    populationResponse: populationLevel,
    tumorResponse: tumorLevel,
    microenvironment: microenvironmentLevel,
    vascular: vascularLevel,
    messages: {
      transport: transport && transport.engine ? transport.engine.message() : null,
      passiveUptake: uptake && uptake.engine ? uptake.engine.message() : null,
      endocytosis: endocytosis && endocytosis.engine ? endocytosis.engine.message() : null,
      intracellularTrafficking: endocytosis && endocytosis.engine ? endocytosis.engine.traffickingMessage() : null,
      intracellularRelease: intracellular && intracellular.engine ? intracellular.engine.message() : null,
      targetEngagement: targetEngagement && targetEngagement.engine ? targetEngagement.engine.message() : null,
      signalTransduction: signalPropagation && signalPropagation.engine ? signalPropagation.engine.summaryMessage() : null,
      geneRegulation: transcription && transcription.engine ? transcription.engine.summaryMessage() : null,
      translation: translation && translation.engine ? translation.engine.summaryMessage() : null,
      proteinFunction: proteinFunction && proteinFunction.engine ? proteinFunction.engine.summaryMessage() : null,
      apoptosis: apoptosis && apoptosis.engine ? apoptosis.engine.summaryMessage() : null,
      populationResponse: population && population.engine ? population.engine.summaryMessage() : null,
      tumorResponse: tumor && tumor.engine ? tumor.engine.summaryMessage() : null,
      microenvironment: microenvironment && microenvironment.engine ? microenvironment.engine.summaryMessage() : null,
      vascular: vascular && vascular.engine ? vascular.engine.summaryMessage() : null,
    },
  };
  // Phase 6B: apoptosis commitment & execution detail (data only). Separates apoptosis /
  // pathway / intervention / cell-model-transfer evidence; population + tumour outcome
  // remain NOT_EVALUATED.
  const apoptosisInfo = apoptosis && apoptosis.engine && !apoptosis.engine.isIdle() ? (() => {
    const fr = apoptosis.engine.frame();
    return {
      level: apoptosis.engine.summaryLevel(), cellModel: fr.cellModel, state: fr.state, reversibility: fr.reversibility,
      committed: fr.committed, contextTransfer: fr.contextTransfer, predicted: fr.predicted,
      apoptosisEvidence: fr.evidenceLevel, mitochondria: fr.mitochondria, caspaseBranch: fr.caspaseBranch, aifBranch: fr.aifBranch,
      totalExecutionDrive: fr.totalExecutionDrive, morphology: fr.morphology, interventions: fr.interventions,
      timingWarning: 'Apoptosis timing is schematic and is not a validated biological timescale.',
      populationOutcomeEvidence: 'NOT_EVALUATED', tumourResponseEvidence: 'NOT_EVALUATED',
    };
  })() : (apoptosis && apoptosis.engine ? { level: apoptosis.engine.summaryLevel(), cellModel: apoptosis.engine.cellModel, state: apoptosis.engine.apop.state, committed: false, populationOutcomeEvidence: 'NOT_EVALUATED', tumourResponseEvidence: 'NOT_EVALUATED' } : null);
  // Phase 6C: population-response detail (data only). A schematic virtual population derived
  // from the single-cell apoptosis trajectory; normalized fractions only (never cell counts).
  // Clearly separates prediction / context-transfer evidence; tumour / survival / clinical
  // outcome remains NOT_EVALUATED (the stop boundary).
  const populationInfo = population && population.engine && !population.engine.isIdle() ? (() => {
    const fr = population.engine.frame();
    const p = population.engine.profile || {};
    return {
      title: 'Population Response',
      species: population.engine.species, cellModel: fr.cellModel, populationModel: p.population_model || null,
      populationState: fr.populationState, populationEvidence: fr.evidenceLevel, predictionLevel: p.prediction_level || fr.evidenceLevel,
      predicted: fr.predicted, contextTransfer: fr.contextTransfer, confidence: fr.confidence, uncertainty: fr.uncertainty,
      populationViability: { living: fr.livingFraction, apoptotic: fr.apoptoticFraction },
      populationComposition: { living: fr.livingFraction, adaptive: fr.adaptedFraction, recovered: fr.recoveredFraction, apoptotic: fr.apoptoticFraction, cumulativeApoptosis: fr.cumulativeApoptosis },
      supportedEvidence: (p.supported_predictions || []),
      unsupportedEvidence: ['tumour_response', 'survival', 'immune_clearance', 'clinical_outcome', 'pharmacokinetics', 'pharmacodynamics'],
      contextTransferRecord: p.context_transfer || null,
      notReportedFields: (population.engine.species === 'human' || population.engine.species === 'rat') ? ['population_apoptotic_fraction'] : [],
      stopBoundary: 'population composition / viability / state / history',
      populationLimitations: 'Schematic normalized fractions (not real cell counts / density / cellularity); derived from the single-cell apoptosis trajectory; population predictions are labelled, never experimental.',
      populationCompositionEvidence: fr.populationCompositionEvidence,
      tumourResponseEvidence: 'NOT_EVALUATED', survivalEvidence: 'NOT_EVALUATED', clinicalOutcomeEvidence: 'NOT_EVALUATED',
    };
  })() : (population && population.engine ? {
    title: 'Population Response', species: population.engine.species, cellModel: population.engine.cellModel,
    populationState: population.engine.pop.populationState, populationEvidence: population.engine.summaryLevel(),
    notReportedFields: ['population_apoptotic_fraction'], stopBoundary: 'population composition',
    tumourResponseEvidence: 'NOT_EVALUATED', survivalEvidence: 'NOT_EVALUATED', clinicalOutcomeEvidence: 'NOT_EVALUATED',
  } : null);
  // Phase 6D: tumour growth & treatment-response detail (data only). A schematic normalized
  // tumour burden + treatment-response trajectory derived from the population; clearly
  // distinguishes experimental direction / prediction / context-transfer / human-extrapolation
  // / unavailable. Clinical / RECIST / survival / metastasis / PK stay NOT_EVALUATED.
  const tumorInfo = tumor && tumor.engine && !tumor.engine.isIdle() ? (() => {
    const fr = tumor.engine.frame();
    const p = tumor.engine.profile || {};
    return {
      title: 'Tumor Growth & Treatment Response',
      species: fr.species, cellModel: fr.cellModel, tumorModel: fr.tumorModel, drug: p.drug || null,
      formulation: fr.formulation, route: p.route || null, treatmentContext: fr.treatmentState,
      responseState: fr.responseState, responseDirection: fr.netGrowthPressure < 0 ? 'regression' : fr.netGrowthPressure > 0 ? 'growth' : 'stable',
      tumourResponseEvidence: fr.evidenceLevel, growthModelType: fr.tumorModel, quantitativeDataAvailability: fr.quantitativeStatus,
      predictionLevel: fr.predictionLevel, confidence: fr.confidence, uncertainty: fr.uncertainty,
      experimental: fr.experimental, predicted: fr.predicted, contextTransfer: fr.contextTransfer,
      relativeBurden: fr.currentBurden, viableBurden: fr.normalizedViableBurden, apoptoticBurden: fr.normalizedApoptoticBurden,
      growthPressure: fr.growthPressure, lossPressure: fr.lossPressure, netGrowthPressure: fr.netGrowthPressure,
      timingType: 'schematic_simulation',
      burdenWarning: fr.burdenWarning,
      humanTranslationWarning: fr.humanTranslationWarning,
      sourceReferences: (p.evidence_refs || []),
      stopBoundary: 'schematic treatment-response trajectory + normalized burden',
      excludedClinicalOutcomes: (p.excluded_downstream_processes || []),
      clinicalResponseEvidence: 'NOT_EVALUATED', survivalEvidence: 'NOT_EVALUATED', recistEvidence: 'NOT_EVALUATED',
      metastasisEvidence: 'NOT_EVALUATED', immuneEvidence: 'NOT_EVALUATED', pkEvidence: 'NOT_EVALUATED',
    };
  })() : (tumor && tumor.engine ? {
    title: 'Tumor Growth & Treatment Response', species: tumor.engine.species, cellModel: tumor.engine.cellModel,
    responseState: tumor.engine.burden.responseState, tumourResponseEvidence: tumor.engine.summaryLevel(),
    humanTranslationWarning: (tumor.engine.profile && tumor.engine.profile.human_translation_warning) || null,
    reason: (tumor.engine.profile && tumor.engine.profile.reason) || null,
    stopBoundary: 'schematic treatment-response trajectory + normalized burden',
    clinicalResponseEvidence: 'NOT_EVALUATED', survivalEvidence: 'NOT_EVALUATED', recistEvidence: 'NOT_EVALUATED',
  } : null);
  // Phase 7A: passive tumour-microenvironment detail (data only). A passive modulator that
  // modifies penetration; each modifier exposes its evidence / prediction status, confidence,
  // species, tumour model, uncertainty, limitations, and excluded biology. Immune / vascular /
  // remodeling / metastasis stay NOT_EVALUATED.
  const microenvironmentInfo = microenvironment && microenvironment.engine && !microenvironment.engine.isIdle() ? (() => {
    const fr = microenvironment.engine.frame();
    const p = microenvironment.engine.profile || {};
    return {
      title: 'Passive Tumor Microenvironment',
      species: fr.species, tumourModel: fr.tumourModel, drug: p.drug || null, formulation: fr.formulation,
      microenvironmentState: fr.microenvironmentState,
      microenvironmentEvidence: fr.evidenceLevel, predictionLevel: fr.predictionLevel, predictionStatus: fr.predicted ? 'PREDICTION' : (fr.contextTransfer ? 'CONTEXT_TRANSFER' : 'NOT_REPORTED'),
      predicted: fr.predicted, contextTransfer: fr.contextTransfer, confidence: fr.confidence, uncertainty: fr.uncertainty,
      ecm: fr.ecm, diffusion: fr.diffusion, mechanical: fr.mechanical, oxygen: fr.oxygen, hypoxia: fr.hypoxia,
      penetrationModifier: fr.penetration.penetrationModifier, effectiveAvailability: fr.penetration.effectiveAvailability, combinedRestriction: fr.penetration.combinedRestriction,
      supportingLiterature: (p.evidence_refs || []),
      limitations: p.limitations || null,
      humanTranslationWarning: fr.humanTranslationWarning,
      modifiesTransport: fr.modifiesTransport, replacesTransport: fr.replacesTransport, modifiesSignalling: fr.modifiesSignalling,
      excludedBiology: (p.excluded_processes || []),
      stopBoundary: 'microenvironment modifies penetration',
      immuneEvidence: 'NOT_EVALUATED', vascularEvidence: 'NOT_EVALUATED', remodelingEvidence: 'NOT_EVALUATED', metastasisEvidence: 'NOT_EVALUATED',
    };
  })() : (microenvironment && microenvironment.engine ? {
    title: 'Passive Tumor Microenvironment', species: microenvironment.engine.species, tumourModel: microenvironment.engine.tumourModel,
    microenvironmentEvidence: microenvironment.engine.summaryLevel(), reason: (microenvironment.engine.profile && microenvironment.engine.profile.reason) || null,
    stopBoundary: 'microenvironment modifies penetration',
    immuneEvidence: 'NOT_EVALUATED', vascularEvidence: 'NOT_EVALUATED', remodelingEvidence: 'NOT_EVALUATED', metastasisEvidence: 'NOT_EVALUATED',
  } : null);
  // Phase 7B: tumour-vasculature detail (data only). The active vascular component that
  // modifies drug delivery; each modifier exposes its evidence / prediction status, confidence,
  // species, tumour model, supporting literature, uncertainty, limitations, and excluded
  // biology. Immune / VEGF / HIF / metastasis stay NOT_EVALUATED.
  const vascularInfo = vascular && vascular.engine && !vascular.engine.isIdle() ? (() => {
    const fr = vascular.engine.frame();
    const p = vascular.engine.profile || {};
    return {
      title: 'Tumor Vasculature & Angiogenesis',
      species: fr.species, tumourModel: fr.tumourModel, drug: p.drug || null, formulation: fr.formulation,
      angiogenicState: fr.vessels.angiogenicState, vesselMaturity: fr.vessels.maturity, deliveryState: fr.delivery.deliveryState,
      vascularEvidence: fr.evidenceLevel, predictionLevel: fr.predictionLevel, predictionStatus: fr.predicted ? 'PREDICTION' : (fr.contextTransfer ? 'CONTEXT_TRANSFER' : 'NOT_REPORTED'),
      predicted: fr.predicted, contextTransfer: fr.contextTransfer, confidence: fr.confidence, uncertainty: fr.uncertainty,
      vessels: fr.vessels, perfusion: fr.perfusion, oxygenSupply: fr.oxygenSupply, nutrient: fr.nutrient, permeability: fr.permeability,
      deliveryModifier: fr.delivery.deliveryModifier, effectiveArrival: fr.delivery.effectiveArrival, effectiveDeliveryPenetration: fr.effectiveDeliveryPenetration,
      supportingLiterature: (p.evidence_refs || []),
      limitations: p.limitations || null,
      humanTranslationWarning: fr.humanTranslationWarning,
      modifiesDelivery: fr.modifiesDelivery, modifiesSignalling: fr.modifiesSignalling, inducesApoptosis: fr.inducesApoptosis, remodels: fr.remodels,
      excludedBiology: (p.excluded_processes || []),
      stopBoundary: 'vascular delivery modifies drug availability',
      immuneEvidence: 'NOT_EVALUATED', vegfSignallingEvidence: 'NOT_EVALUATED', hifRegulationEvidence: 'NOT_EVALUATED', metastasisEvidence: 'NOT_EVALUATED',
    };
  })() : (vascular && vascular.engine ? {
    title: 'Tumor Vasculature & Angiogenesis', species: vascular.engine.species, tumourModel: vascular.engine.tumourModel,
    vascularEvidence: vascular.engine.summaryLevel(), reason: (vascular.engine.profile && vascular.engine.profile.reason) || null,
    stopBoundary: 'vascular delivery modifies drug availability',
    immuneEvidence: 'NOT_EVALUATED', vegfSignallingEvidence: 'NOT_EVALUATED', hifRegulationEvidence: 'NOT_EVALUATED', metastasisEvidence: 'NOT_EVALUATED',
  } : null);
  // Phase 6A: protein-function & early-cellular-response detail (data only). Clearly
  // separates protein-abundance / protein-function / cellular-response / cell-fate evidence.
  const proteinFunctionInfo = proteinFunction && proteinFunction.engine && !proteinFunction.engine.isIdle() ? {
    level: proteinFunction.engine.summaryLevel(),
    timingWarning: 'Functional-response timing is schematic and is not a validated biological timescale.',
    stateWarning: 'Cellular-state values are schematic cellular-state abstractions (not concentrations or biomarkers).',
    cellFateEvidence: 'NOT_EVALUATED',
    functions: proteinFunction.engine.frame().functions.map((f) => ({
      protein: f.proteinId, functionType: f.functionType, functionalState: f.functionalState,
      proteinFunctionEvidence: f.evidenceLevel, prediction: f.predictionLevel, confidence: f.confidence,
    })),
    cellularStates: proteinFunction.engine.frame().states.map((s) => ({
      name: s.name, stateType: s.stateType, value: s.ordinal, reversible: s.reversible,
      cellularResponseEvidence: s.evidenceLevel, prediction: s.predictionLevel, confidence: s.confidence,
    })),
  } : (proteinFunction && proteinFunction.engine ? { level: 'NOT_REPORTED', functions: [], cellularStates: [], cellFateEvidence: 'NOT_EVALUATED' } : null);
  // Phase 5D: translation & protein-synthesis detail (data only) for the new panel section.
  // Clearly separates mRNA / translation / protein-abundance / protein-function evidence.
  const translationInfo = translation && translation.engine && !translation.engine.isIdle() ? {
    level: translation.engine.summaryLevel(),
    capacity: translation.engine.frame().capacityOrdinal,
    timingWarning: 'Translation timing is schematic and is not a validated biological timescale.',
    proteinFunctionEvidence: 'NOT_EVALUATED',
    outputs: translation.engine.frame().outputs.map((o) => ({
      protein: o.proteinName, mrnaSource: o.mrnaId, translationAvailable: o.evidenceLevel !== 'UNAVAILABLE' && o.evidenceLevel !== 'NOT_REPORTED',
      translationEvidence: o.evidenceLevel, proteinAbundance: o.abundanceState, abundanceOrdinal: o.abundanceOrdinal,
      predictionCategory: o.predictionLevel, confidence: o.confidence,
      biologicalHalfLife: o.halfLifeH, simulationDecayClass: o.degradationClass, turnover: o.turnoverState,
      geneEfficiency: undefined, functionalState: o.functionalState,
    })),
  } : (translation && translation.engine ? { level: 'NOT_REPORTED', capacity: 'suppressed', outputs: [], proteinFunctionEvidence: 'NOT_EVALUATED' } : null);
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
      translation: translationInfo,
      proteinFunction: proteinFunctionInfo,
      apoptosis: apoptosisInfo,
      populationResponse: populationInfo,
      tumorResponse: tumorInfo,
      microenvironment: microenvironmentInfo,
      vascular: vascularInfo,
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
