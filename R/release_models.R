# =============================================================================
# Module 1: Drug release from a nanoparticle
# -----------------------------------------------------------------------------
# Implements the classic empirical/semi-empirical release models plus a
# mechanistic Fickian solution for a sphere and a membrane-controlled
# (core-shell reservoir) model. All functions return the *cumulative fraction
# released*, f(t) in [0, 1], on a supplied time grid, so that different models
# can be compared on the same axes.
#
# Symbols
#   t   : time                                  [s]  (any consistent unit)
#   D   : drug diffusion coefficient            [m^2/s]
#   r   : nanoparticle core radius              [m]
#   h   : polymer shell (coating) thickness     [m]
#   K   : shell/core partition coefficient      [-]
#   C0  : initial drug loading (concentration)  [kg/m^3]
#   Cs  : drug solubility in the matrix         [kg/m^3]
#
# Units are the caller's responsibility; every model is unit-consistent as
# long as D, r, h and t share a length/time system.
# =============================================================================

# ---- helpers ----------------------------------------------------------------

.clamp_fraction <- function(f) {
  # Release fraction is physically bounded to [0, 1].
  f[f < 0] <- 0
  f[f > 1] <- 1
  f
}

.check_time <- function(t) {
  if (any(t < 0)) stop("time vector must be non-negative")
  if (is.unsorted(t)) stop("time vector must be sorted in ascending order")
  invisible(TRUE)
}

# ---- 1. Higuchi model -------------------------------------------------------
# Higuchi (1961/1963): drug release from a planar matrix is proportional to the
# square root of time. Widely used as the textbook diffusion-controlled model.
#
#   f(t) = k_H * sqrt(t)      (clamped to 1 once the depot is exhausted)
#
# The Higuchi constant k_H can be supplied directly, or derived from physical
# parameters via the planar Higuchi relation
#   Q(t) = sqrt(D * (2*C0 - Cs) * Cs * t)
# normalised by the total loading so that f = Q / (C0 * L_char).
release_higuchi <- function(t, k_H = NULL,
                            D = NULL, C0 = NULL, Cs = NULL, L_char = NULL) {
  .check_time(t)
  if (is.null(k_H)) {
    if (any(vapply(list(D, C0, Cs, L_char), is.null, logical(1)))) {
      stop("supply either k_H, or all of D, C0, Cs and L_char")
    }
    if (Cs > 2 * C0) stop("Higuchi model requires C0 >= Cs/2 (excess drug)")
    # Amount released per unit area, normalised by the total content per area.
    k_H <- sqrt(D * (2 * C0 - Cs) * Cs) / (C0 * L_char)
  }
  .clamp_fraction(k_H * sqrt(t))
}

# ---- 2. First-order kinetics ------------------------------------------------
# Release rate proportional to the amount of drug remaining. Typical of
# water-soluble drugs in porous matrices.
#
#   dM/dt = -k * M   =>   f(t) = 1 - exp(-k t)
release_first_order <- function(t, k) {
  .check_time(t)
  if (k <= 0) stop("first-order rate constant k must be > 0")
  .clamp_fraction(1 - exp(-k * t))
}

# ---- 3. Zero-order kinetics -------------------------------------------------
# Constant release rate (ideal controlled-release device).
#   f(t) = k * t
release_zero_order <- function(t, k) {
  .check_time(t)
  if (k <= 0) stop("zero-order rate constant k must be > 0")
  .clamp_fraction(k * t)
}

# ---- 4. Korsmeyer-Peppas power law ------------------------------------------
# Semi-empirical model that distinguishes release mechanisms through the
# exponent n:
#   n ~ 0.43  Fickian diffusion (sphere)
#   0.43<n<0.85 anomalous (diffusion + relaxation)
#   n ~ 0.85  case-II / zero-order (polymer relaxation controlled)
#
#   f(t) = k * t^n
release_korsmeyer_peppas <- function(t, k, n) {
  .check_time(t)
  if (k <= 0) stop("Peppas constant k must be > 0")
  if (n <= 0) stop("Peppas exponent n must be > 0")
  .clamp_fraction(k * t^n)
}

# ---- 5. Fickian diffusion from a sphere (Crank solution) --------------------
# Exact solution of Fick's second law for release from a uniform sphere of
# radius r into a perfect sink (Crank, "The Mathematics of Diffusion", 1975):
#
#   f(t) = 1 - (6/pi^2) * sum_{n=1..N} (1/n^2) * exp(-D n^2 pi^2 t / r^2)
#
# This is the mechanistic reference curve the empirical models approximate.
release_fickian_sphere <- function(t, D, r, n_terms = 50L) {
  .check_time(t)
  if (D <= 0) stop("diffusion coefficient D must be > 0")
  if (r <= 0) stop("radius r must be > 0")
  n <- seq_len(n_terms)
  # Outer product: rows = time points, cols = series terms.
  series <- outer(t, n, function(tt, nn) {
    (1 / nn^2) * exp(-D * nn^2 * pi^2 * tt / r^2)
  })
  f <- 1 - (6 / pi^2) * rowSums(series)
  # At t = 0 the series equals sum(1/n^2) = pi^2/6 exactly, so f = 0; a finite
  # truncation leaves a small positive residual, so pin the initial value.
  f[t == 0] <- 0
  .clamp_fraction(f)
}

# ---- 6. Membrane-controlled core-shell reservoir ----------------------------
# For a coated (core-shell) nanoparticle the polymer shell of thickness h is the
# rate-limiting barrier. While drug remains in the core the flux across a thin
# shell is quasi-steady (Fick's first law):
#
#   dM/dt = -A * D * K * Cs / h      (A = 4 pi r^2 outer core area)
#
# giving near zero-order release until the core is exhausted, after which f = 1.
# Release slows as the shell thickens (1/h dependence) -- the key design knob a
# formulator tunes, and the reason this model is included alongside the classics.
release_membrane_shell <- function(t, D, r, h, K, C0, Cs = C0) {
  .check_time(t)
  if (any(c(D, r, h, K, C0) <= 0)) {
    stop("D, r, h, K and C0 must all be > 0")
  }
  A <- 4 * pi * r^2                 # core surface area
  M_total <- (4 / 3) * pi * r^3 * C0  # total drug in the core
  flux <- A * D * K * Cs / h        # constant mass release rate
  M_released <- flux * t
  f <- M_released / M_total
  .clamp_fraction(f)
}

# ---- dispatcher -------------------------------------------------------------
# Convenience wrapper so the Shiny app / notebook can request a model by name
# with a single parameter list. Returns a data.frame(time, fraction, model).
release_curve <- function(model, t, params = list()) {
  f <- switch(
    model,
    "higuchi"            = do.call(release_higuchi,           c(list(t = t), params)),
    "first_order"        = do.call(release_first_order,       c(list(t = t), params)),
    "zero_order"         = do.call(release_zero_order,        c(list(t = t), params)),
    "korsmeyer_peppas"   = do.call(release_korsmeyer_peppas,  c(list(t = t), params)),
    "fickian_sphere"     = do.call(release_fickian_sphere,    c(list(t = t), params)),
    "membrane_shell"     = do.call(release_membrane_shell,    c(list(t = t), params)),
    stop(sprintf("unknown release model: '%s'", model))
  )
  data.frame(time = t, fraction = f, model = model, stringsAsFactors = FALSE)
}

# Human-readable labels for plotting / UI.
release_model_labels <- function() {
  c(
    higuchi          = "Higuchi (sqrt-t diffusion)",
    first_order      = "First-order kinetics",
    zero_order       = "Zero-order kinetics",
    korsmeyer_peppas = "Korsmeyer-Peppas power law",
    fickian_sphere   = "Fickian diffusion (sphere, Crank)",
    membrane_shell   = "Membrane-controlled core-shell"
  )
}
