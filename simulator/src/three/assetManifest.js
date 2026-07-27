// Phase-0 ASSET MANIFEST. Declares every asset the 3D phases need, its status, and its
// acceptance spec. NOTHING here is loaded yet. `status: 'MISSING'` entries are hard Phase-2
// prerequisites — a placeholder mannequin is explicitly NOT acceptable as the final human.

export const ASSET_STATUS = Object.freeze({ PRESENT: 'PRESENT', MISSING: 'MISSING', PROCEDURAL: 'PROCEDURAL' });

export const ASSETS = Object.freeze({
  // ---------------------------------------------------------------- Phase 2 (human)
  human: {
    id: 'human_topical_subject',
    status: ASSET_STATUS.MISSING,                 // repository contains NO 3D human asset
    path: 'simulator/assets/human/human.glb',     // target location once supplied
    format: 'GLB (glTF 2.0, Draco or Meshopt compressed)',
    spec: {
      budget: { triangles: '80k–150k total', textures: '2048² albedo/normal/roughness (1024² for minor maps)' },
      rig: 'humanoid skeleton, Mixamo-compatible naming (mixamorig:* or standard Hips/Spine/Arm chain)',
      required: [
        'believable human proportions; no mannequin/low-poly/plastic look',
        'face: correct eye placement, natural eyelids, no distorted mouth, no broken teeth, no empty sockets, no seam artefacts, stable under close + medium shots',
        'hands: separate finger bones (thumb + 4 fingers), clean topology — the subject must visibly rub cream onto the forearm',
        'forearm: clean quad topology + even UVs (this is the treatment area and receives a close-up + cream decal)',
        'skin material: PBR with roughness variation (not flat plastic); no uncanny frozen expression',
      ],
      licence: 'MUST ship an attribution/licence file permitting redistribution on GitHub Pages',
    },
    acceptanceGate: ['orientation Y-up / Z-forward', 'metre scale (~1.7m)', 'origin at feet', 'normals correct', 'textures resolve', 'skeleton binds', 'clips play', 'loads < 3s on broadband', 'disposable without leak'],
    fallbackIfMissing: 'Phase 2 stops and reports the gap — do NOT ship a placeholder dummy as the final human.',
  },
  humanAnimations: {
    id: 'human_clips',
    status: ASSET_STATUS.MISSING,
    needed: ['idle', 'arm_raise / forearm_present', 'cream_application (hand rub)', 'neutral_reset'],
    strategy: 'Prefer packaged clips; otherwise blend idle + procedural bone animation (shoulder/elbow/wrist) or a short two-bone IK reach. A full IK solver is NOT required.',
    bones: ['Hips', 'Spine', 'Shoulder.L/R', 'UpperArm.L/R', 'ForeArm.L/R', 'Hand.L/R', 'Hand*.Index/Thumb.*'],
  },
  // ---------------------------------------------------------------- Phases 3–5 (procedural)
  skinCrossSection:  { id: 'skin_layers',  status: ASSET_STATUS.PROCEDURAL, note: 'layer slabs + corneocyte instancing built in code; depths from transport registry (no new biology)' },
  capillaryTube:     { id: 'capillary',    status: ASSET_STATUS.PROCEDURAL, note: 'TubeGeometry along a CatmullRom curve; RBCs via InstancedMesh' },
  tissueCells:       { id: 'tissue_cells', status: ASSET_STATUS.PROCEDURAL, note: 'InstancedMesh spheres + ECM fibre lines' },
  drugParticles:     { id: 'particles',    status: ASSET_STATUS.PROCEDURAL, note: 'single InstancedMesh, pooled, count bounded by the render budget' },
  environmentHDR:    { id: 'studio_env',   status: ASSET_STATUS.MISSING, path: 'simulator/assets/env/studio.hdr', note: 'small (1k) HDR for believable skin shading; a RoomEnvironment fallback is acceptable' },
});

/** Assets that must exist before a given phase can be completed. */
export const PHASE_PREREQS = Object.freeze({
  1: [],                                  // runtime shell — no assets
  2: ['human', 'humanAnimations'],        // BLOCKING
  3: [], 4: [], 5: [],                    // procedural
  6: ['human'], 7: [],
});

export function missingFor(phase) {
  return (PHASE_PREREQS[phase] || []).filter((k) => ASSETS[k] && ASSETS[k].status === ASSET_STATUS.MISSING);
}

export default ASSETS;
