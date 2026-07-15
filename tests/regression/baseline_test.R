# =============================================================================
# Regression baseline for the EXISTING simulator.
# -----------------------------------------------------------------------------
# Locks in the current behaviour of all six release models and the tissue solver
# so that the planned "Animated Tissue View" extension cannot silently change any
# existing output. Golden values were captured at commit f7ca348 and mirror
# tests/regression/baseline_release.json (machine-readable copy for the JS side).
#
# Run:  Rscript tests/regression/baseline_test.R
# =============================================================================

root <- Sys.getenv("NP_ROOT", ".")
for (f in c("release_models.R", "tissue_diffusion.R", "parameters.R", "metrics.R"))
  source(file.path(root, "R", f))

# Golden reference (see baseline_release.json).
times  <- c(0, 1, 6, 12, 24, 48)
golden <- list(
  higuchi          = c(0, 0.25, 0.6123724356957945, 0.8660254037844386, 1, 1),
  first_order      = c(0, 0.13929202357494218, 0.5934303402594008, 0.8347011117784134, 0.9726762775527075, 0.9992534141916234),
  zero_order       = c(0, 0.03, 0.18, 0.36, 0.72, 1),
  korsmeyer_peppas = c(0, 0.2, 0.43215051344526245, 0.5822076819732053, 0.7843697378634437, 1),
  fickian_sphere   = c(0, 0.60693975667883193, 0.96852453511560066, 0.99837046884141822, 0.99999563208851339, 0.99999999996861688),
  membrane_shell   = c(0, 0.37499999999999994, 1, 1, 1, 1)
)
p <- list(r = 0.1, h = 0.02, C0 = 100, K = 0.5, Dr = 5e-4,
          kf = 0.15, np = 0.43, kz = 0.03, kH = 0.25, kp = 0.20,
          Dt = 50, ro = 20, ke = 0.1, te = 48)

fail <- 0L; pass <- 0L
chk <- function(cond, msg) {
  if (isTRUE(cond)) pass <<- pass + 1L
  else { fail <<- fail + 1L; cat("  FAIL:", msg, "\n") }
}

current <- list(
  higuchi          = release_higuchi(times, k_H = p$kH),
  first_order      = release_first_order(times, k = p$kf),
  zero_order       = release_zero_order(times, k = p$kz),
  korsmeyer_peppas = release_korsmeyer_peppas(times, k = p$kp, n = p$np),
  fickian_sphere   = release_fickian_sphere(times, D = p$Dr, r = p$r),
  membrane_shell   = release_membrane_shell(times, D = p$Dr, r = p$r, h = p$h, K = p$K, C0 = p$C0)
)
for (m in names(golden)) {
  d <- max(abs(current[[m]] - golden[[m]]))
  chk(d < 1e-9, sprintf("release model '%s' drifted from baseline (max|Δ|=%.2e)", m, d))
}

# Tissue solver, driven by the first-order release curve (as the app/web do).
t    <- seq(0, p$te, length.out = 201)
relc <- release_first_order(t, k = p$kf)
surf <- approxfun(t, p$C0 * relc, rule = 2)
sol  <- solve_tissue_diffusion(D = p$Dt, r_inner = p$r, r_outer = p$ro, t_end = p$te,
                               surface_conc = surf, k_e = p$ke, n_x = 120, outer_bc = "sink")
xs    <- c(0.1, 1, 2, 5, 10, 20)
Cend  <- sol$C[nrow(sol$C), ]
Cfin  <- sapply(xs, function(xq) Cend[which.min(abs(sol$x - xq))])
golden_tissue <- c(99.925341419162322, 11.756231550860356, 5.3233077892320706,
                   1.6843353770649474, 0.53524250285060659, 0)
chk(max(abs(Cfin - golden_tissue)) < 1e-6,
    sprintf("tissue profile drifted from baseline (max|Δ|=%.3e)", max(abs(Cfin - golden_tissue))))

# Structural invariants that must always hold for the EXISTING model.
chk(all(sapply(current, function(v) all(v >= 0 & v <= 1))), "all release fractions in [0,1]")
chk(all(Cend >= -1e-9), "tissue concentration non-negative everywhere")
chk(all(diff(current$first_order) >= -1e-12), "first-order release monotonic non-decreasing")
chk(Cend[1] >= Cend[length(Cend)], "tissue concentration decreases outward (sink BC)")

cat(sprintf("\nRegression baseline: %d passed, %d failed\n", pass, fail))
if (fail > 0) quit(status = 1)
