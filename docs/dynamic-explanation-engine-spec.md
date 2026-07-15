# Dynamic "Why Did the Result Change?" Engine — Specification (Stage-3 design)

On a parameter change the app explains, tied to the model (never generic text):
which model term changed; which mechanism; expected qualitative effect; computed
quantitative effect; monotonic or not; interacting parameters; whether still inside
the evidence domain; whether uncertainty increased; whether it is extrapolation.

Statements are generated from `data/parameter-effect-statements.json` (qualitative,
physics-based, sourced where possible), combined with the actual computed delta from
the solver. Examples (qualitative; magnitudes from computation):
- "Increasing shell thickness slowed release, lowering the boundary source, so
  tissue concentration and penetration depth decreased."
- "Increasing local clearance removed drug faster, so the penetration front became
  shallower."

The engine must not assert a direction where evidence is mixed; such parameters are
flagged context-dependent.
