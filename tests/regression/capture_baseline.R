#!/usr/bin/env Rscript
# Regenerates tests/regression/baseline_release.json from the R model core.
# The golden values it writes are the R reference used by BOTH the R regression
# test and the JavaScript equivalence test. Run only when intentionally
# recording a model change:
#   Rscript tests/regression/capture_baseline.R
# Prints the values; the JSON is updated by hand or by redirecting as noted.
# (Kept dependency-free: emits plain numbers, no jsonlite requirement.)

root <- Sys.getenv("NP_ROOT", ".")
for (f in c("release_models.R", "tissue_diffusion.R", "parameters.R", "metrics.R"))
  source(file.path(root, "R", f))

p <- list(r = 0.1, h = 0.02, C0 = 100, K = 0.5, Dr = 5e-4,
          kf = 0.15, np = 0.43, kz = 0.03, kH = 0.25, kp = 0.20,
          Dt = 50, ro = 20, ke = 0.1, te = 48)
times <- c(0, 1, 6, 12, 24, 48)

rel <- list(
  higuchi          = release_higuchi(times, k_H = p$kH),
  first_order      = release_first_order(times, k = p$kf),
  zero_order       = release_zero_order(times, k = p$kz),
  korsmeyer_peppas = release_korsmeyer_peppas(times, k = p$kp, n = p$np),
  fickian_sphere   = release_fickian_sphere(times, D = p$Dr, r = p$r),
  membrane_shell   = release_membrane_shell(times, D = p$Dr, r = p$r, h = p$h, K = p$K, C0 = p$C0)
)
for (m in names(rel))
  cat(sprintf("%-16s %s\n", m, paste(sprintf("%.17g", rel[[m]]), collapse = ", ")))

t <- seq(0, p$te, length.out = 201)
surf <- approxfun(t, p$C0 * release_first_order(t, k = p$kf), rule = 2)
sol <- solve_tissue_diffusion(D = p$Dt, r_inner = p$r, r_outer = p$ro, t_end = p$te,
                              surface_conc = surf, k_e = p$ke, n_x = 120, outer_bc = "sink")
xs <- c(0.1, 1, 2, 5, 10, 20)
Cend <- sol$C[nrow(sol$C), ]
Cfin <- sapply(xs, function(xq) Cend[which.min(abs(sol$x - xq))])
cat(sprintf("tissue_C_final   %s\n", paste(sprintf("%.17g", Cfin), collapse = ", ")))
