// Phase-7B TUMOUR VASCULATURE / ANGIOGENESIS tests. Validates the active-vascular-modulator
// runtime: evidence vocabulary, registry integrity, profile loading, vessel architecture /
// perfusion / oxygen + nutrient supply / permeability -> delivery modifier, delivery states,
// species isolation (no silent transfer), prediction presentation, deterministic replay,
// timeline, renderer frame, evidence panel, validation (registry + consistency), integration
// with Phase 7A (combined delivery x penetration), and that vasculature MODIFIES delivery only
// (never signals / induces apoptosis / remodels / touches immune / VEGF / HIF / metastasis).
// All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { VascularEngine } from '../src/biology/vascularEngine.js';
import { MicroenvironmentEngine } from '../src/biology/microenvironmentEngine.js';
import {
  VASCULAR_EVIDENCE_LEVELS, isVascularEvidenceLevel, isVascularPrediction, isVascularTransfer, vascularLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('tumour vasculature & angiogenesis (Phase 7B)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const load = (f) => loader.load(f, 'generic');
  const V = {}; for (const [k, f] of Object.entries(APP_CONFIG.vascularSources)) V[k] = await load(f);
  const ME = {}; for (const [k, f] of Object.entries(APP_CONFIG.tmeSources)) ME[k] = await load(f);
  const micro = (species) => new MicroenvironmentEngine({ contextRegistry: ME.context, ecmRegistry: ME.ecm, diffusionRegistry: ME.diffusion, mechanicalRegistry: ME.mechanical, oxygenRegistry: ME.oxygen, hypoxiaRegistry: ME.hypoxia, penetrationRegistry: ME.penetration, evidenceRegistry: ME.evidence, predictionRegistry: ME.prediction, species });
  const mk = (species, opts = {}) => new VascularEngine({
    contextRegistry: opts.ctx || V.context, angiogenesisRegistry: V.angiogenesis, perfusionRegistry: V.perfusion, oxygenSupplyRegistry: V.oxygenSupply,
    nutrientRegistry: V.nutrient, permeabilityRegistry: V.permeability, deliveryRegistry: V.delivery, evidenceRegistry: V.evidence, predictionRegistry: V.prediction,
    microenvironmentEngine: opts.micro !== undefined ? opts.micro : micro(species), species,
  });

  // ---- evidence vocabulary (additive; predictions + not-reported only, no experimental) ----
  eq(VASCULAR_EVIDENCE_LEVELS.length, 8, 'vascular evidence vocabulary has 8 levels');
  ok(!VASCULAR_EVIDENCE_LEVELS.some((l) => /EXPERIMENTAL/.test(l)), 'no EXPERIMENTAL tier (vasculature is never experimental here)');
  ok(isVascularEvidenceLevel('MECHANISTIC_PREDICTION') && !isVascularEvidenceLevel('EXPERIMENTAL_FORMULATION_SPECIFIC'), 'level validity');
  ok(isVascularPrediction('MECHANISTIC_PREDICTION') && isVascularPrediction('CONTEXT_TRANSFER_PREDICTION'), 'prediction classifier');
  ok(isVascularTransfer('CONTEXT_TRANSFER_PREDICTION') && !isVascularTransfer('MECHANISTIC_PREDICTION'), 'transfer classifier');
  ok(!vascularLevelActive('NOT_REPORTED') && !vascularLevelActive('UNAVAILABLE') && vascularLevelActive('MECHANISTIC_PREDICTION'), 'active classifier');

  // ---- registry integrity + profile loading ----
  eq(V.context.profiles.mouse_b16bl6_vascular.evidence_level, 'MECHANISTIC_PREDICTION', 'B16BL6 vascular mechanistic prediction');
  eq(V.context.profiles.human_skin_vascular.evidence_level, 'MECHANISTIC_PREDICTION', 'human vascular mechanistic prediction (exploratory)');
  eq(V.context.profiles.rat_skin_vascular.evidence_level, 'NOT_REPORTED', 'rat vascular NOT_REPORTED');
  ok(V.context.profiles.human_skin_vascular.predictive_exploratory && V.context.profiles.human_skin_vascular.default_shown === false, 'human vascular is predictive-exploratory, not shown by default');
  ok(Object.keys(V.angiogenesis.angiogenic_states).length === 4, 'four angiogenic states');
  ok(Object.keys(V.angiogenesis.vessel_maturity).length === 4, 'four vessel-maturity states');
  ok(Object.keys(V.perfusion.perfusion_states).length === 5, 'five perfusion states');
  ok(Object.keys(V.oxygenSupply.oxygen_supply_states).length === 5, 'five oxygen-supply states');
  ok(Object.keys(V.nutrient.nutrient_states).length === 4, 'four nutrient states');
  ok(Object.keys(V.permeability.permeability_states).length === 4, 'four permeability states');
  ok(V.delivery.delivery_states.length === 5, 'five delivery states');

  // ---- mouse B16BL6: available, predicted, tumour paradox (high density + leaky, poorly perfused) ----
  const M = mk('mouse');
  eq(M.tumourModel, 'B16BL6', 'default mouse tumour model is B16BL6');
  ok(M.available && !M.isIdle(), 'mouse vasculature available');
  ok(M.frame().predicted, 'mouse vasculature is a labelled prediction');
  ok(!M.frame().contextTransfer, 'mouse vasculature is not a context transfer');
  const mf = M.frame();
  eq(mf.vessels.angiogenicState, 'highly_vascularized', 'mouse melanoma is highly vascularized');
  eq(mf.vessels.maturity, 'immature', 'mouse melanoma vessels are immature');
  eq(mf.perfusion.state, 'low', 'mouse melanoma is poorly perfused');
  eq(mf.permeability.state, 'high', 'mouse melanoma vessels are leaky (high permeability)');

  // ---- delivery modifier bounds + monotonic responses ----
  const dm = M.deliveryModifier();
  ok(dm >= (V.delivery.delivery_floor ?? 0.05) && dm <= 1, 'delivery modifier in [floor,1]');
  ok(['limited_delivery', 'moderate_delivery', 'good_delivery'].includes(mf.delivery.deliveryState), 'mouse delivery state reflects the mixed vasculature');
  ok(mf.delivery.deliveryModifier === dm, 'frame delivery modifier equals accessor');

  // ---- STOP boundary: modifies delivery only; downstream NOT evaluated ----
  ok(mf.modifiesDelivery === true && mf.modifiesSignalling === false && mf.inducesApoptosis === false && mf.remodels === false, 'modifies delivery only; never signals / apoptosis / remodels');
  eq(mf.immuneEvidence, 'NOT_EVALUATED', 'immune NOT_EVALUATED');
  eq(mf.vegfSignallingEvidence, 'NOT_EVALUATED', 'VEGF signalling NOT_EVALUATED');
  eq(mf.hifRegulationEvidence, 'NOT_EVALUATED', 'HIF regulation NOT_EVALUATED');
  eq(mf.metastasisEvidence, 'NOT_EVALUATED', 'metastasis NOT_EVALUATED');

  // ---- integration with Phase 7A (combined delivery x penetration) ----
  const combined = M.effectiveDeliveryPenetration();
  ok(combined <= dm + 1e-9 && combined > 0, 'combined delivery x penetration <= delivery modifier (7A read-only)');
  const Mno = mk('mouse', { micro: null });
  ok(Mno.effectiveDeliveryPenetration() === Mno.deliveryModifier(), 'without a microenvironment engine, combined == delivery modifier');

  // ---- species isolation: distinct human values (no silent transfer), rat idle ----
  const H = mk('human');
  ok(H.available && H.frame().predicted, 'human vasculature available + predicted (exploratory)');
  ok(!!H.frame().humanTranslationWarning, 'human vasculature carries the required non-clinical warning');
  ok(H.deliveryModifier() !== M.deliveryModifier(), 'human delivery modifier is DISTINCT from mouse (not copied)');
  ok(H.frame().vessels.angiogenicState !== mf.vessels.angiogenicState || H.frame().perfusion.state !== mf.perfusion.state, 'human component choices differ from mouse');
  const Rt = mk('rat');
  ok(Rt.isIdle() && Rt.summaryLevel() === 'NOT_REPORTED', 'rat vasculature idle / NOT_REPORTED');
  eq(Rt.deliveryModifier(), 1, 'idle rat delivery modifier defaults to 1');
  ok(Rt.getTimeline().length === 0, 'idle rat records no evaluation timeline');

  // ---- deterministic transitions across component states (registry-driven) ----
  const dmFor = (comp) => { const c = JSON.parse(JSON.stringify(V.context)); c.profiles.mouse_b16bl6_vascular.components = { ...V.context.profiles.mouse_b16bl6_vascular.components, ...comp }; return mk('mouse', { ctx: c, micro: null }).deliveryModifier(); };
  // perfusion transitions monotonic
  ok(dmFor({ perfusion: 'very_low' }) < dmFor({ perfusion: 'very_high' }), 'higher perfusion -> higher delivery modifier');
  ok(dmFor({ perfusion: 'low' }) < dmFor({ perfusion: 'moderate' }) && dmFor({ perfusion: 'moderate' }) < dmFor({ perfusion: 'high' }), 'perfusion transitions are monotonic');
  // permeability transitions monotonic
  ok(dmFor({ permeability: 'low' }) < dmFor({ permeability: 'very_high' }), 'higher permeability -> higher delivery modifier');
  // vascular (density) transitions monotonic
  ok(dmFor({ angiogenic_state: 'poorly_vascularized' }) < dmFor({ angiogenic_state: 'hypervascular' }), 'higher vascularization -> higher delivery modifier');
  // maturity transitions monotonic (mature vessels deliver more efficiently)
  ok(dmFor({ vessel_maturity: 'immature' }) < dmFor({ vessel_maturity: 'stable' }), 'more mature vessels -> higher delivery modifier');
  // oxygen supply transitions surfaced monotonic via stats
  const oxyFor = (o) => { const c = JSON.parse(JSON.stringify(V.context)); c.profiles.mouse_b16bl6_vascular.components = { ...V.context.profiles.mouse_b16bl6_vascular.components, oxygen_supply: o, perfusion: o === 'very_low' ? 'low' : o === 'very_high' ? 'high' : 'moderate' }; return mk('mouse', { ctx: c, micro: null }).stats().oxygenSupply; };
  ok(oxyFor('very_low') < oxyFor('very_high'), 'higher oxygen supply state -> higher oxygen supply value');

  // registry ordinal monotonicity
  ok(V.perfusion.perfusion_states.very_low.efficiency < V.perfusion.perfusion_states.very_high.efficiency, 'perfusion efficiency monotonic in registry');
  ok(V.angiogenesis.angiogenic_states.poorly_vascularized.vessel_density < V.angiogenesis.angiogenic_states.hypervascular.vessel_density, 'vessel density monotonic in registry');
  ok(V.permeability.permeability_states.low.value < V.permeability.permeability_states.very_high.value, 'permeability monotonic in registry');
  ok(V.oxygenSupply.oxygen_supply_states.very_low.supply < V.oxygenSupply.oxygen_supply_states.very_high.supply, 'oxygen supply monotonic in registry');
  ok(V.nutrient.nutrient_states.limited.availability < V.nutrient.nutrient_states.abundant.availability, 'nutrient monotonic in registry');
  ok(V.angiogenesis.vessel_maturity.immature.delivery_efficiency < V.angiogenesis.vessel_maturity.stable.delivery_efficiency, 'maturity delivery efficiency monotonic in registry');

  // ---- deterministic replay (frame + timeline + stats) ----
  const A1 = mk('mouse', { micro: null }); const A2 = mk('mouse', { micro: null });
  ok(JSON.stringify(A1.frame()) === JSON.stringify(A2.frame()), 'frame is deterministic');
  ok(JSON.stringify(A1.getTimeline()) === JSON.stringify(A2.getTimeline()), 'timeline is deterministic');
  ok(JSON.stringify(A1.stats()) === JSON.stringify(A2.stats()), 'stats are deterministic');
  const s0 = A1.deliveryModifier(); A1.run(20, 0.5); ok(A1.deliveryModifier() === s0, 'vascular field is static across steps (no recalculation drift)');
  A2.step(0.5); A2.step(0.5); const beforeState = JSON.stringify(A2.frame().delivery); A2.restart(); ok(JSON.stringify(A2.frame().delivery) === beforeState, 'restart reproduces the vascular field (replay compatible)');

  // ---- timeline events (evaluation order) ----
  const tl = M.getTimeline().map((e) => e.event);
  for (const ev of ['vascular_profile_loaded', 'vascular_network_generated', 'perfusion_calculated', 'oxygen_supply_updated', 'nutrient_environment_updated', 'permeability_applied', 'drug_delivery_modified', 'transport_continues']) {
    ok(tl.includes(ev), `timeline event present: ${ev}`);
  }
  ok(tl.indexOf('vascular_network_generated') < tl.indexOf('drug_delivery_modified'), 'network generated before delivery modified');

  // ---- validation: positive + negative + consistency ----
  const vr = M.validate();
  ok(vr.ok, `validation passes on shipped registries (${vr.errors.join('; ')})`);
  const validateWith = (mutate) => { const c = JSON.parse(JSON.stringify(V.context)); mutate(c); return mk('mouse', { ctx: c, micro: null }).validate(); };
  // (a) active profile labelled experimental (forbidden)
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_vascular.evidence_level = 'EXPERIMENTAL_FORMULATION_SPECIFIC'; return c; }); ok(!r.ok, 'negative: experimental vascular level caught'); }
  // (b) rat made available (no rat fallback)
  { const r = validateWith((c) => { c.profiles.rat_skin_vascular.vascular_available = true; c.profiles.rat_skin_vascular.evidence_level = 'MECHANISTIC_PREDICTION'; return c; }); ok(!r.ok && r.errors.some((e) => /no rat fallback/.test(e)), 'negative: rat fallback caught'); }
  // (c) inconsistent oxygen/perfusion (very_high oxygen + very_low perfusion)
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_vascular.components.oxygen_supply = 'very_high'; c.profiles.mouse_b16bl6_vascular.components.perfusion = 'very_low'; return c; }); ok(!r.ok && r.errors.some((e) => /inconsistent oxygen\/perfusion/.test(e)), 'negative: very_high oxygen + very_low perfusion caught'); }
  // (d) unsupported component variant
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_vascular.components.perfusion = 'ultra'; return c; }); ok(!r.ok && r.errors.some((e) => /unsupported perfusion/.test(e)), 'negative: unsupported perfusion variant caught'); }
  // (e) available profile missing evidence refs
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_vascular.evidence_refs = []; return c; }); ok(!r.ok && r.errors.some((e) => /no evidence_refs/.test(e)), 'negative: available profile without evidence caught'); }
  // (f) unsupported species
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_vascular.species = 'zebrafish'; return c; }); ok(!r.ok && r.errors.some((e) => /unsupported species/.test(e)), 'negative: unsupported species caught'); }
  // (g) angiogenic state not in supported list
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_vascular.supported_vascular_state = ['poorly_vascularized']; return c; }); ok(!r.ok && r.errors.some((e) => /not in supported_vascular_state/.test(e)), 'negative: unsupported-in-profile angiogenic state caught'); }

  // ---- controls: only supported entries accepted ----
  const Fok = mk('mouse'); Fok.setFormulation('neutral_nlc'); eq(Fok.formulation, 'neutral_nlc', 'setFormulation accepts a supported formulation');
  const Fbad = mk('mouse'); const before = Fbad.formulation; Fbad.setFormulation('made_up'); eq(Fbad.formulation, before, 'setFormulation rejects an unsupported formulation');
  const Tm = mk('mouse'); Tm.setTumourModel('nonexistent_model'); ok(Tm.isIdle(), 'unsupported tumour model -> idle (no fallback)');

  // ---- cross-species / cross-tumour isolation ----
  ok(H.frame().vessels.maturity !== mf.vessels.maturity || H.frame().permeability.state !== mf.permeability.state, 'human vessel maturity/permeability differ from mouse');

  // ---- prediction + evidence record integrity ----
  ok(V.prediction.prediction_records.pred_va_b16bl6.quantitative_status === 'NOT_REPORTED' && V.prediction.prediction_records.pred_va_b16bl6.may_show_by_default === true, 'B16BL6 prediction NOT_REPORTED + shown by default');
  ok(V.prediction.prediction_records.pred_va_human.may_show_by_default === false, 'human prediction not shown by default');
  ok(!!V.prediction.prediction_records.pred_va_b16bl6.rationale && !!V.prediction.prediction_records.pred_va_b16bl6.confidence, 'prediction records carry rationale + confidence');
  for (const [id, rec] of Object.entries(V.evidence.evidence_records)) ok(/NOT_REPORTED/.test(rec.citation), `evidence record ${id} citation is NOT_REPORTED-qualitative (no fabricated quantity)`);

  // ---- context rules + summary ----
  ok(/modifies/i.test(V.context.context_rules.modifier_not_replacement), 'context declares modifier-not-replacement rule');
  ok(/delivery modifier/i.test(M.summaryMessage()) && /schematic/i.test(M.summaryMessage()), 'summary message states schematic delivery modifier');
  ok(/Not Reported|Unavailable/i.test(Rt.summaryMessage()), 'idle rat summary message reads Not Reported / Unavailable');

  // ---- stats fields present + bounded ----
  const st = M.stats();
  for (const k of ['vesselDensity', 'perfusion', 'oxygenSupply', 'nutrient', 'permeability', 'deliveryModifier']) {
    ok(typeof st[k] === 'number' && st[k] >= 0 && st[k] <= 1, `stats.${k} present + in [0,1]`);
  }

  // ---- full app wiring + renderer frame + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.vascular && app.vascular.engine, 'app exposes the vascular engine');
  app.setSpecies('mouse');
  app.renderer.draw();
  ok(app.renderer.lastVascularFrame && app.renderer.lastVascularFrame.available, 'renderer produced a vascular frame');
  ok(app.renderer.lastVascularFrame.field && app.renderer.lastVascularFrame.delivery, 'renderer frame has a vessel field + delivery data');
  ok(app.renderer.lastVascularFrame.predicted, 'renderer flags the mouse prediction');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.vascular, 'MECHANISTIC_PREDICTION', 'panel: mouse vasculature = mechanistic prediction');
  eq(el.microenvironment, 'MECHANISTIC_PREDICTION', 'previous phase unchanged: microenvironment = mechanistic prediction');
  const vi = app.panelModels.information.vascular;
  ok(vi && vi.title === 'Tumor Vasculature & Angiogenesis', 'panel: independent vascular section present');
  ok(vi.predictionStatus === 'PREDICTION' && vi.modifiesDelivery === true && vi.modifiesSignalling === false, 'panel: prediction status + modifies-delivery-only surfaced');
  ok(vi.immuneEvidence === 'NOT_EVALUATED' && vi.vegfSignallingEvidence === 'NOT_EVALUATED' && vi.hifRegulationEvidence === 'NOT_EVALUATED', 'panel: immune / VEGF / HIF NOT_EVALUATED');
  ok(Array.isArray(vi.excludedBiology) && vi.excludedBiology.length > 0, 'panel: excluded biology listed');

  // rat via full app: idle vasculature; earlier layers intact
  app.setSpecies('rat');
  app.renderer.draw();
  ok(app.vascular.engine.isIdle(), 'rat vasculature idle via full app');
  ok(!app.renderer.lastVascularFrame.available, 'renderer draws no vessel field for idle rat');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');

  app.setSpecies('mouse');
}
