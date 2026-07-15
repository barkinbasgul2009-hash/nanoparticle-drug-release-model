# Scientific Limitations

Status: current, honest.

- Tissue defaults are **order-of-magnitude illustrative**, not literature-qualified.
- Geometry is 1-D spherical, homogeneous, isotropic, single-layer.
- Clearance is first-order and spatially uniform; no metabolism sub-model.
- **Release→tissue coupling** uses `C_surface = C0·f(t)` — a teaching-level
  approximation, not a flux/partition coupling (docs/boundary-conditions.md).
- No interface barrier/partition; no finite-donor depletion.
- Models **released free drug only** — not carrier transport, uptake, or
  whole-body biodistribution (docs/model-scope.md).
- **No calibration or external validation** of any tissue prediction.
- The Animated Tissue View is **ILLUSTRATIVE_ONLY**; its heatmap uses a
  perceptual √ colour scale for visibility (the quantitative graph is linear).
- Not a clinical decision tool; not patient-specific.
