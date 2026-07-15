# =============================================================================
# Default parameter sets and validation
# -----------------------------------------------------------------------------
# Physically plausible defaults for a polymeric (e.g. PLGA) nanoparticle so the
# app / notebook produce sensible curves out of the box. Values are order-of-
# magnitude representative, not fitted to a specific formulation; users override
# them for their own system.
#
# Working units: micrometres (um), hours (h). Diffusion coefficients are then in
# um^2/h. This keeps the numbers human-readable (radius ~ 100 nm = 0.1 um,
# release over hours) while staying unit-consistent across both modules.
# =============================================================================

default_parameters <- function() {
  list(
    # --- nanoparticle geometry & loading ---
    r          = 0.10,    # core radius            [um]  (100 nm particle)
    h          = 0.02,    # polymer shell thickness [um] (20 nm coating)
    C0         = 100,     # drug loading            [arb. conc. units]
    Cs         = 20,      # solubility in matrix    [same units as C0]
    K          = 0.5,     # shell/core partition    [-]

    # --- release (Module 1) ---
    D_release  = 5e-4,    # drug diffusivity in particle [um^2/h]
    k_first    = 0.15,    # first-order rate constant    [1/h]
    k_zero     = 0.03,    # zero-order rate constant     [1/h]
    k_peppas   = 0.20,    # Korsmeyer-Peppas constant    [1/h^n]
    n_peppas   = 0.43,    # Peppas exponent (0.43 = Fickian sphere)
    k_higuchi  = 0.25,    # Higuchi constant             [1/sqrt(h)]

    # --- tissue diffusion (Module 2) ---
    D_tissue   = 50,      # drug diffusivity in tissue   [um^2/h]
    r_outer    = 20,      # tissue domain outer radius   [um]
    k_e        = 0.1,     # tissue clearance rate        [1/h]
    outer_bc   = "sink",

    # --- simulation controls ---
    t_end      = 48,      # total simulated time         [h]
    n_time     = 200L     # number of time points
  )
}

# Coarse sanity checks; returns the parameter list invisibly or stops.
validate_parameters <- function(p) {
  pos <- c("r", "h", "C0", "Cs", "K", "D_release", "D_tissue",
           "r_outer", "t_end")
  for (nm in pos) {
    if (is.null(p[[nm]]) || p[[nm]] <= 0) {
      stop(sprintf("parameter '%s' must be present and > 0", nm))
    }
  }
  if (p$Cs > p$C0) stop("solubility Cs cannot exceed loading C0")
  if (p$r_outer <= p$r) stop("tissue outer radius must exceed particle radius")
  if (p$k_e < 0) stop("clearance k_e must be >= 0")
  invisible(p)
}

# Standard time grid from a parameter list.
time_grid <- function(p) {
  seq(0, p$t_end, length.out = p$n_time)
}
