# Tumor-Response Limitations (Phase 6D)

Phase 6D is a deliberately narrow, honest layer. This document states plainly what it does **not**
represent, so no reader mistakes the schematic tumour response for a biological or clinical result.

## The tumour burden is an abstraction

- It is a **schematic virtual tumour-cell burden**, normalized `[0, 1.5]` with a baseline of 1.0 as
  a simulation reference — **not** real tumour geometry.
- **No real tumour volume (mm³), diameter, weight, cellularity, or RECIST measurement is claimed.**
  "Relative tumour burden is normalized and schematic unless primary quantitative data are
  explicitly loaded" (and none are).

## Evidence limitations

- The one verified quantitative-status primary study (Chen 2012, doi:10.2147/IJN.S32476, B16BL6)
  supports treatment **direction** and formulation **ranking** only; every exact tumour value is
  `NOT_REPORTED`.
- B16 and B16-F10 tumour records are qualitative (`citation: NOT_REPORTED`).
- Human tumour response is `UNAVAILABLE` at runtime (no active human melanoma population); a
  predictive-exploratory human view would be a mechanistic extrapolation only, never validated for
  clinical response. Rat is `NOT_REPORTED`.

## Model limitations

- The burden is derived from **one** population trajectory plus schematic pressure parameters; it is
  not an agent-based tumour simulation.
- The default growth model is **ordinal / normalized schematic**; no exponential / logistic /
  Gompertz curve is activated (their parameters are `NOT_REPORTED`).
- The **minimal residual** floor is a schematic resistant-residual stand-in, not a measured residual
  fraction. Reaching a low burden is **never** a cure.
- **Rebound** is a `MECHANISTIC_PREDICTION`; no genetic resistance or clonal evolution is modelled.
- **Cell-cycle** contribution is only a schematic `cyclingCapacity` modifier — no G1/S/G2/M
  populations.
- Timing is schematic simulation steps, not a biological timescale; no dosing interval or dose is
  invented.

## Hard stop boundary (NOT evaluated)

The simulator stops at the schematic treatment-response trajectory + normalized burden. It does
**not** represent, and reports `NOT_EVALUATED` / does not compute:

human clinical response, patient-level prediction, RECIST, survival analysis, recurrence
probability, cure, metastasis, invasion, angiogenesis, vascular remodelling, immune recruitment /
clearance, lymphatics, systemic circulation, organ distribution, liver metabolism, renal
clearance, PBPK, clinical PK, toxicity, adverse events, therapeutic index, dose recommendation,
personalized medicine, clinical decision support.

There is also **no population growth beyond the schematic carrying capacity**, no negative burden,
and no instant regression.

## Future phases

Phase 7 and later may build clinical-, PK-, immune-, and outcome-level layers **on top of** this one
(reading it read-only). Until then, the schematic treatment-response trajectory is the end of the
chain, and any clinical interpretation is out of scope.
