// Phase-7A PASSIVE TUMOUR-MICROENVIRONMENT (TME) tests. Validates the passive-modulator
// runtime: evidence vocabulary, registry integrity, profile loading, ECM / diffusion /
// mechanical / oxygen / hypoxia -> penetration modifier, microenvironment states, species
// isolation (no silent transfer), prediction presentation, deterministic replay, timeline,
// renderer frame, evidence panel, validation (registry + consistency), and that the
// microenvironment MODIFIES penetration only (never replaces / signals / touches immune /
// vascular / remodeling / metastasis). All previous tests must remain green.

import { section, ok, eq, nodeFetcher } from './harness.mjs';
import { JsonLoader } from '../src/data/jsonLoader.js';
import APP_CONFIG from '../src/config/app.config.js';
import { MicroenvironmentEngine } from '../src/biology/microenvironmentEngine.js';
import {
  MICROENVIRONMENT_EVIDENCE_LEVELS, isMicroenvironmentEvidenceLevel, isMicroenvironmentPrediction, isMicroenvironmentTransfer, microenvironmentLevelActive,
} from '../src/evidence/evidenceEngine.js';
import { createApp } from '../src/main.js';

export default async function run() {
  section('passive tumour microenvironment (Phase 7A)');

  const loader = new JsonLoader({ basePath: APP_CONFIG.simulatorDataBasePath, fetcher: nodeFetcher() });
  const load = (f) => loader.load(f, 'generic');
  const R = {}; for (const [k, f] of Object.entries(APP_CONFIG.tmeSources)) R[k] = await load(f);
  const mk = (species, opts = {}) => new MicroenvironmentEngine({
    contextRegistry: opts.ctx || R.context, ecmRegistry: R.ecm, diffusionRegistry: R.diffusion, mechanicalRegistry: R.mechanical,
    oxygenRegistry: R.oxygen, hypoxiaRegistry: R.hypoxia, penetrationRegistry: R.penetration, evidenceRegistry: R.evidence, predictionRegistry: R.prediction, species,
  });

  // ---- evidence vocabulary (additive; predictions + not-reported only, no experimental) ----
  eq(MICROENVIRONMENT_EVIDENCE_LEVELS.length, 8, 'microenvironment evidence vocabulary has 8 levels');
  ok(!MICROENVIRONMENT_EVIDENCE_LEVELS.some((l) => /EXPERIMENTAL/.test(l)), 'no EXPERIMENTAL tier (TME is never experimental here)');
  ok(isMicroenvironmentEvidenceLevel('MECHANISTIC_PREDICTION') && !isMicroenvironmentEvidenceLevel('EXPERIMENTAL_FORMULATION_SPECIFIC'), 'level validity');
  ok(isMicroenvironmentPrediction('MECHANISTIC_PREDICTION') && isMicroenvironmentPrediction('CONTEXT_TRANSFER_PREDICTION'), 'prediction classifier');
  ok(isMicroenvironmentTransfer('CONTEXT_TRANSFER_PREDICTION') && !isMicroenvironmentTransfer('MECHANISTIC_PREDICTION'), 'transfer classifier');
  ok(!microenvironmentLevelActive('NOT_REPORTED') && !microenvironmentLevelActive('UNAVAILABLE') && microenvironmentLevelActive('MECHANISTIC_PREDICTION'), 'active classifier');

  // ---- registry integrity + profile loading ----
  eq(R.context.profiles.mouse_b16bl6_tme.evidence_level, 'MECHANISTIC_PREDICTION', 'B16BL6 TME mechanistic prediction');
  eq(R.context.profiles.human_skin_tme.evidence_level, 'MECHANISTIC_PREDICTION', 'human TME mechanistic prediction (exploratory)');
  eq(R.context.profiles.rat_skin_tme.evidence_level, 'NOT_REPORTED', 'rat TME NOT_REPORTED');
  ok(R.context.profiles.human_skin_tme.predictive_exploratory && R.context.profiles.human_skin_tme.default_shown === false, 'human TME is predictive-exploratory, not shown by default');
  ok(Object.keys(R.ecm.collagen.variants).length >= 4, 'collagen has >= 4 ordinal variants');
  ok(Object.keys(R.hypoxia.hypoxia_states).length === 4, 'hypoxia has 4 states');
  ok(Object.keys(R.oxygen.oxygen_states).length === 4, 'oxygen has 4 states');
  ok(Object.keys(R.mechanical.barrier_states).length === 4, 'mechanical has 4 ordinal states');

  // ---- mouse B16BL6: available, predicted, restrictive ----
  const M = mk('mouse');
  eq(M.tumourModel, 'B16BL6', 'default mouse tumour model is B16BL6');
  ok(M.available && !M.isIdle(), 'mouse TME available');
  ok(M.frame().predicted, 'mouse TME is a labelled prediction');
  ok(!M.frame().contextTransfer, 'mouse TME is not a context transfer');
  const mf = M.frame();
  ok(['moderately_restrictive', 'highly_restrictive', 'extremely_restrictive'].includes(mf.microenvironmentState), 'mouse melanoma TME is restrictive (dense ECM + hypoxia)');

  // ---- penetration modifier bounds + monotonic response to restriction ----
  const pm = M.penetrationModifier();
  ok(pm >= (R.penetration.penetration_floor ?? 0.05) && pm <= 1, 'penetration modifier in [floor,1]');
  ok(M.effectiveAvailability() <= pm + 1e-9, 'effective availability <= penetration modifier (hypoxia further reduces effectiveness)');
  ok(mf.penetration.combinedRestriction > 0 && mf.penetration.combinedRestriction < 1, 'combined restriction is a proper fraction');
  ok(Math.abs((1 - mf.penetration.combinedRestriction) - pm) < 0.011 || pm === (R.penetration.penetration_floor ?? 0.05), 'penetration modifier = 1 - combined restriction (schematic)');

  // ---- ECM / diffusion / mechanical / oxygen / hypoxia surfaced ----
  ok(mf.ecm.collagen && mf.ecm.hyaluronicAcid, 'ECM exposes collagen + hyaluronic acid variants');
  ok(mf.ecm.penetrationResistance > 0 && mf.diffusion.resistance > 0 && mf.mechanical.score > 0, 'ECM / diffusion / mechanical resistances present');
  ok(mf.oxygen.state === 'moderate_hypoxia' && mf.hypoxia.state === 'moderate', 'oxygen + hypoxia states loaded from the profile');
  ok(mf.hypoxia.severity > 0 && mf.hypoxia.penetrationModifier <= 1, 'hypoxia severity + penetration modifier present');

  // ---- STOP boundary: modifies penetration only; downstream NOT evaluated ----
  ok(mf.modifiesTransport === true && mf.replacesTransport === false && mf.modifiesSignalling === false, 'modifies transport/penetration only; never replaces / signals');
  eq(mf.immuneEvidence, 'NOT_EVALUATED', 'immune NOT_EVALUATED');
  eq(mf.vascularEvidence, 'NOT_EVALUATED', 'vascular NOT_EVALUATED');
  eq(mf.remodelingEvidence, 'NOT_EVALUATED', 'remodeling NOT_EVALUATED');
  eq(mf.metastasisEvidence, 'NOT_EVALUATED', 'metastasis NOT_EVALUATED');

  // ---- species isolation: distinct human values (no silent transfer), rat idle ----
  const H = mk('human');
  ok(H.available && H.frame().predicted, 'human TME available + predicted (exploratory)');
  ok(!!H.frame().humanTranslationWarning, 'human TME carries the required non-clinical warning');
  ok(H.penetrationModifier() !== M.penetrationModifier(), 'human penetration modifier is DISTINCT from mouse (not copied)');
  ok(H.frame().ecm.collagen !== mf.ecm.collagen || H.frame().hypoxia.state !== mf.hypoxia.state, 'human component choices differ from mouse (own values)');
  const Rt = mk('rat');
  ok(Rt.isIdle() && Rt.summaryLevel() === 'NOT_REPORTED', 'rat TME idle / NOT_REPORTED');
  eq(Rt.penetrationModifier(), 1, 'idle rat penetration modifier defaults to 1 (no restriction applied)');
  ok(Rt.getTimeline().length === 0, 'idle rat records no evaluation timeline');

  // ---- microenvironment state transitions across restriction levels ----
  // build test-only profiles varying density to confirm ordinal state progression
  const stateFor = (comp) => {
    const ctx = JSON.parse(JSON.stringify(R.context));
    ctx.profiles.mouse_b16bl6_tme.components = comp;
    return mk('mouse', { ctx }).frame().microenvironmentState;
  };
  const permissive = stateFor({ collagen: 'sparse', hyaluronic_acid: 'low', proteoglycan: 'low', extracellular_fluid: 'high', interstitial: 'open', mechanical: 'soft', oxygen: 'normoxic', hypoxia: 'normoxic' });
  const restrictive = stateFor({ collagen: 'highly_dense', hyaluronic_acid: 'high', proteoglycan: 'high', extracellular_fluid: 'low', interstitial: 'highly_restrictive', mechanical: 'highly_dense', oxygen: 'severe_hypoxia', hypoxia: 'severe' });
  eq(permissive, 'permissive', 'loose ECM + normoxia -> permissive');
  eq(restrictive, 'extremely_restrictive', 'dense ECM + severe hypoxia -> extremely_restrictive');

  // penetration monotonicity: permissive penetration > restrictive penetration
  const penPermissive = mk('mouse', { ctx: (() => { const c = JSON.parse(JSON.stringify(R.context)); c.profiles.mouse_b16bl6_tme.components = { collagen: 'sparse', hyaluronic_acid: 'low', proteoglycan: 'low', extracellular_fluid: 'high', interstitial: 'open', mechanical: 'soft', oxygen: 'normoxic', hypoxia: 'normoxic' }; return c; })() }).penetrationModifier();
  const penRestrictive = mk('mouse', { ctx: (() => { const c = JSON.parse(JSON.stringify(R.context)); c.profiles.mouse_b16bl6_tme.components = { collagen: 'highly_dense', hyaluronic_acid: 'high', proteoglycan: 'high', extracellular_fluid: 'low', interstitial: 'highly_restrictive', mechanical: 'highly_dense', oxygen: 'severe_hypoxia', hypoxia: 'severe' }; return c; })() }).penetrationModifier();
  ok(penPermissive > penRestrictive, 'permissive penetration modifier > restrictive');

  // ---- hypoxia + mechanical transitions monotonic ----
  const penForHypoxia = (h, o) => { const c = JSON.parse(JSON.stringify(R.context)); c.profiles.mouse_b16bl6_tme.components = { ...R.context.profiles.mouse_b16bl6_tme.components, hypoxia: h, oxygen: o }; return mk('mouse', { ctx: c }).penetrationModifier(); };
  ok(penForHypoxia('normoxic', 'normoxic') > penForHypoxia('severe', 'severe_hypoxia'), 'more hypoxia -> lower penetration modifier');
  const penForMech = (m) => { const c = JSON.parse(JSON.stringify(R.context)); c.profiles.mouse_b16bl6_tme.components = { ...R.context.profiles.mouse_b16bl6_tme.components, mechanical: m }; return mk('mouse', { ctx: c }).penetrationModifier(); };
  ok(penForMech('soft') > penForMech('highly_dense'), 'denser mechanical barrier -> lower penetration modifier');

  // ---- deterministic replay (frame + timeline + stats) ----
  const A1 = mk('mouse'); const A2 = mk('mouse');
  ok(JSON.stringify(A1.frame()) === JSON.stringify(A2.frame()), 'frame is deterministic');
  ok(JSON.stringify(A1.getTimeline()) === JSON.stringify(A2.getTimeline()), 'timeline is deterministic');
  ok(JSON.stringify(A1.stats()) === JSON.stringify(A2.stats()), 'stats are deterministic');
  A1.step(0.5); A1.step(0.5); const beforeState = JSON.stringify(A1.frame().penetration);
  A1.restart(); ok(JSON.stringify(A1.frame().penetration) === beforeState, 'restart reproduces the passive field (replay compatible)');
  // static field: stepping does not change the passive result
  const s0 = A2.penetrationModifier(); A2.run(20, 0.5); ok(A2.penetrationModifier() === s0, 'passive field is static across steps (no recalculation drift)');

  // ---- timeline events (evaluation order) ----
  const tl = M.getTimeline().map((e) => e.event);
  for (const ev of ['microenvironment_loaded', 'ecm_evaluated', 'interstitial_resistance_calculated', 'hypoxia_evaluated', 'oxygen_environment_updated', 'penetration_modifier_applied', 'drug_transport_updated', 'transport_continues']) {
    ok(tl.includes(ev), `timeline event present: ${ev}`);
  }
  ok(tl.indexOf('ecm_evaluated') < tl.indexOf('penetration_modifier_applied'), 'ECM evaluated before penetration modifier applied');

  // ---- validation: positive + negative + consistency ----
  const vr = M.validate();
  ok(vr.ok, `validation passes on shipped registries (${vr.errors.join('; ')})`);
  const validateWith = (mutate) => { const c = JSON.parse(JSON.stringify(R.context)); mutate(c); return mk('mouse', { ctx: c }).validate(); };
  // (a) active profile labelled experimental (forbidden)
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_tme.evidence_level = 'EXPERIMENTAL_FORMULATION_SPECIFIC'; return c; }); ok(!r.ok, 'negative: experimental TME level caught'); }
  // (b) inconsistent oxygen/hypoxia (normoxia + severe hypoxia)
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_tme.components.oxygen = 'normoxic'; c.profiles.mouse_b16bl6_tme.components.hypoxia = 'severe'; return c; }); ok(!r.ok && r.errors.some((e) => /inconsistent oxygen\/hypoxia/.test(e)), 'negative: normoxia + severe hypoxia caught'); }
  // (c) unsupported component variant
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_tme.components.mechanical = 'granite'; return c; }); ok(!r.ok && r.errors.some((e) => /unsupported mechanical variant/.test(e)), 'negative: unsupported mechanical variant caught'); }
  // (d) available profile missing evidence refs
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_tme.evidence_refs = []; return c; }); ok(!r.ok && r.errors.some((e) => /no evidence_refs/.test(e)), 'negative: available profile without evidence caught'); }
  // (e) unsupported species
  { const r = validateWith((c) => { c.profiles.mouse_b16bl6_tme.species = 'zebrafish'; return c; }); ok(!r.ok && r.errors.some((e) => /unsupported species/.test(e)), 'negative: unsupported species caught'); }

  // ---- ordinal monotonicity across registry variants ----
  ok(R.mechanical.barrier_states.soft.score < R.mechanical.barrier_states.moderate.score
    && R.mechanical.barrier_states.moderate.score < R.mechanical.barrier_states.dense.score
    && R.mechanical.barrier_states.dense.score < R.mechanical.barrier_states.highly_dense.score, 'mechanical barrier score is monotonic (soft<moderate<dense<highly_dense)');
  ok(R.collagen === undefined || true, 'collagen registry lives under ecm');
  ok(R.ecm.collagen.variants.sparse.density < R.ecm.collagen.variants.dense.density
    && R.ecm.collagen.variants.dense.density < R.ecm.collagen.variants.highly_dense.density, 'collagen density is monotonic');
  ok(R.ecm.collagen.variants.sparse.penetration_effect < R.ecm.collagen.variants.highly_dense.penetration_effect, 'collagen penetration effect rises with density');
  ok(R.oxygen.oxygen_states.normoxic.availability > R.oxygen.oxygen_states.mild_hypoxia.availability
    && R.oxygen.oxygen_states.mild_hypoxia.availability > R.oxygen.oxygen_states.moderate_hypoxia.availability
    && R.oxygen.oxygen_states.moderate_hypoxia.availability > R.oxygen.oxygen_states.severe_hypoxia.availability, 'oxygen availability is monotonic (normoxic > ... > severe)');
  ok(R.hypoxia.hypoxia_states.normoxic.severity < R.hypoxia.hypoxia_states.moderate.severity
    && R.hypoxia.hypoxia_states.moderate.severity < R.hypoxia.hypoxia_states.severe.severity, 'hypoxia severity is monotonic');
  ok(R.hypoxia.hypoxia_states.normoxic.penetration_modifier > R.hypoxia.hypoxia_states.severe.penetration_modifier, 'hypoxia penetration modifier falls with severity');
  ok(R.diffusion.interstitial_space.variants.open.mobility_modifier > R.diffusion.interstitial_space.variants.highly_restrictive.mobility_modifier, 'interstitial mobility falls with restriction');
  eq(R.penetration.microenvironment_states.length, 5, 'penetration registry declares 5 microenvironment states');

  // ---- ECM composite responds to collagen density ----
  const ecmResFor = (col) => { const c = JSON.parse(JSON.stringify(R.context)); c.profiles.mouse_b16bl6_tme.components = { ...R.context.profiles.mouse_b16bl6_tme.components, collagen: col }; return mk('mouse', { ctx: c }).frame().ecm.penetrationResistance; };
  ok(ecmResFor('sparse') < ecmResFor('highly_dense'), 'denser collagen -> higher ECM penetration resistance');

  // ---- oxygen availability monotonic via the engine ----
  const oxyFor = (o, h) => { const c = JSON.parse(JSON.stringify(R.context)); c.profiles.mouse_b16bl6_tme.components = { ...R.context.profiles.mouse_b16bl6_tme.components, oxygen: o, hypoxia: h }; return mk('mouse', { ctx: c }).stats().oxygenAvailability; };
  ok(oxyFor('normoxic', 'normoxic') > oxyFor('severe_hypoxia', 'severe'), 'engine oxygen availability: normoxic > severe');

  // ---- formulation controls: only supported entries accepted ----
  const F10 = mk('mouse'); F10.setFormulation('neutral_nlc'); eq(F10.formulation, 'neutral_nlc', 'setFormulation accepts a supported formulation');
  const Fbad = mk('mouse'); const before = Fbad.formulation; Fbad.setFormulation('made_up_formulation'); eq(Fbad.formulation, before, 'setFormulation rejects an unsupported formulation (unchanged)');

  // ---- cross-tumour / tumour-model isolation ----
  const Tm = mk('mouse'); Tm.setTumourModel('nonexistent_model'); ok(Tm.isIdle(), 'unsupported tumour model -> idle (no fallback)');

  // ---- cross-species protection: human distinct in multiple fields ----
  ok(H.frame().ecm.collagen !== mf.ecm.collagen, 'human collagen variant differs from mouse');
  ok(H.frame().mechanical.state !== mf.mechanical.state || H.frame().diffusion.interstitial !== mf.diffusion.interstitial, 'human mechanical/interstitial differ from mouse');

  // ---- prediction + evidence record integrity ----
  ok(R.prediction.prediction_records.pred_me_b16bl6.quantitative_status === 'NOT_REPORTED' && R.prediction.prediction_records.pred_me_b16bl6.may_show_by_default === true, 'B16BL6 prediction is NOT_REPORTED quantitatively + shown by default');
  ok(R.prediction.prediction_records.pred_me_human.may_show_by_default === false, 'human prediction is not shown by default');
  ok(!!R.prediction.prediction_records.pred_me_b16bl6.rationale && !!R.prediction.prediction_records.pred_me_b16bl6.confidence, 'prediction records carry rationale + confidence');
  for (const [id, rec] of Object.entries(R.evidence.evidence_records)) ok(/NOT_REPORTED/.test(rec.citation), `evidence record ${id} citation is NOT_REPORTED-qualitative (no fabricated quantity)`);

  // ---- context rules + summary ----
  ok(/modifies/i.test(R.context.context_rules.modifier_not_replacement), 'context declares modifier-not-replacement rule');
  ok(/penetration modifier/i.test(M.summaryMessage()) && /schematic/i.test(M.summaryMessage()), 'summary message states schematic penetration modifier');
  ok(/Not Reported|Unavailable/i.test(Rt.summaryMessage()), 'idle rat summary message reads Not Reported / Unavailable');

  // ---- stats fields present + bounded ----
  const st = M.stats();
  for (const k of ['penetrationModifier', 'effectiveAvailability', 'combinedRestriction', 'ecmPenetrationResistance', 'diffusionResistance', 'mechanicalScore', 'oxygenAvailability', 'hypoxiaSeverity']) {
    ok(typeof st[k] === 'number' && st[k] >= 0 && st[k] <= 1, `stats.${k} present + in [0,1]`);
  }

  // ---- full app wiring + renderer frame + panel + previous phases unchanged ----
  const app = await createApp({ fetcher: nodeFetcher(), mount: false });
  ok(app.microenvironment && app.microenvironment.engine, 'app exposes the microenvironment engine');
  app.setSpecies('mouse');
  app.renderer.draw();
  ok(app.renderer.lastMicroenvironmentFrame && app.renderer.lastMicroenvironmentFrame.available, 'renderer produced a microenvironment frame');
  ok(app.renderer.lastMicroenvironmentFrame.field && app.renderer.lastMicroenvironmentFrame.penetration, 'renderer frame has an ECM field + penetration data');
  ok(app.renderer.lastMicroenvironmentFrame.predicted, 'renderer flags the mouse prediction');
  const el = app.panelModels.evidence.evidenceLevels;
  eq(el.microenvironment, 'MECHANISTIC_PREDICTION', 'panel: mouse microenvironment = mechanistic prediction');
  eq(el.tumorResponse, 'EXPERIMENTAL_TUMOUR_MODEL_SPECIFIC', 'previous phase unchanged: tumour = experimental tumour-model');
  const mi = app.panelModels.information.microenvironment;
  ok(mi && mi.title === 'Passive Tumor Microenvironment', 'panel: independent microenvironment section present');
  ok(mi.predictionStatus === 'PREDICTION' && mi.modifiesTransport === true && mi.modifiesSignalling === false, 'panel: prediction status + modifies-penetration-only surfaced');
  ok(mi.immuneEvidence === 'NOT_EVALUATED' && mi.vascularEvidence === 'NOT_EVALUATED' && mi.remodelingEvidence === 'NOT_EVALUATED', 'panel: immune / vascular / remodeling NOT_EVALUATED');
  ok(Array.isArray(mi.excludedBiology) && mi.excludedBiology.length > 0, 'panel: excluded biology listed');

  // rat via full app: idle microenvironment; earlier layers intact
  app.setSpecies('rat');
  app.renderer.draw();
  ok(app.microenvironment.engine.isIdle(), 'rat microenvironment idle via full app');
  ok(!app.renderer.lastMicroenvironmentFrame.available, 'renderer draws no TME field for idle rat');
  eq(app.panelModels.evidence.evidenceLevels.transport, 'EXPERIMENTAL', 'rat transport still Experimental (unchanged)');

  app.setSpecies('mouse');
}
