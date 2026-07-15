#!/usr/bin/env Rscript
# =============================================================================
# Worked example: compare release models and simulate tissue penetration.
# Run from the repository root:
#   Rscript examples/run_example.R
# Produces two PNGs in examples/ using only base-R graphics (no dependencies).
# =============================================================================

root <- Sys.getenv("NP_ROOT", ".")
for (f in c("release_models.R", "tissue_diffusion.R",
            "parameters.R", "metrics.R")) {
  source(file.path(root, "R", f))
}

p <- default_parameters()
validate_parameters(p)
t <- time_grid(p)

# --- Module 1: all release models on one axis --------------------------------
models <- list(
  higuchi          = list(k_H = p$k_higuchi),
  first_order      = list(k = p$k_first),
  zero_order       = list(k = p$k_zero),
  korsmeyer_peppas = list(k = p$k_peppas, n = p$n_peppas),
  fickian_sphere   = list(D = p$D_release, r = p$r),
  membrane_shell   = list(D = p$D_release, r = p$r, h = p$h, K = p$K, C0 = p$C0)
)
labs <- release_model_labels()
cols <- c("#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf")

png(file.path(root, "examples", "release_comparison.png"),
    width = 900, height = 600, res = 110)
plot(NA, xlim = c(0, p$t_end), ylim = c(0, 1),
     xlab = "Time (h)", ylab = "Cumulative fraction released",
     main = "Module 1: Nanoparticle drug-release models")
grid()
for (i in seq_along(models)) {
  m  <- names(models)[i]
  df <- release_curve(m, t, models[[m]])
  lines(df$time, df$fraction, col = cols[i], lwd = 2)
}
legend("bottomright", legend = labs[names(models)], col = cols, lwd = 2,
       cex = 0.8, bg = "white")
dev.off()
cat("wrote examples/release_comparison.png\n")

# --- Couple Module 1 -> Module 2 ---------------------------------------------
# Use the first-order release curve to drive the tissue surface concentration:
# surface conc is proportional to the instantaneous fraction released.
release_df <- release_curve("first_order", t, list(k = p$k_first))
surf_fun <- approxfun(release_df$time, p$C0 * release_df$fraction,
                      rule = 2)  # constant extrapolation beyond range

sol <- solve_tissue_diffusion(
  D = p$D_tissue, r_inner = p$r, r_outer = p$r_outer,
  t_end = p$t_end, surface_conc = surf_fun,
  k_e = p$k_e, n_x = 120, outer_bc = p$outer_bc
)

# --- Module 2: concentration profiles at several times -----------------------
png(file.path(root, "examples", "tissue_profiles.png"),
    width = 900, height = 600, res = 110)
snap_times <- c(2, 8, 24, 48)
prof_cols  <- c("#fdae61", "#f46d43", "#d73027", "#a50026")
plot(NA, xlim = c(p$r, p$r_outer), ylim = c(0, p$C0),
     xlab = "Distance from particle centre (um)",
     ylab = "Tissue concentration",
     main = "Module 2: Drug penetration into tissue (Fickian + clearance)")
grid()
for (i in seq_along(snap_times)) {
  prof <- profile_at_time(sol, snap_times[i])
  lines(prof$x, prof$C, col = prof_cols[i], lwd = 2)
}
legend("topright", legend = sprintf("t = %g h", snap_times),
       col = prof_cols, lwd = 2, cex = 0.9, bg = "white")
dev.off()
cat("wrote examples/tissue_profiles.png\n")

cat(sprintf("Penetration depth (10%% threshold) at t=%g h: %.2f um\n",
            p$t_end, penetration_depth(sol, threshold = 0.1)))

# --- Demonstrate model fitting on synthetic "experimental" data --------------
set.seed(42)
f_true <- release_korsmeyer_peppas(t, k = 0.18, n = 0.55)
f_noisy <- pmin(pmax(f_true + rnorm(length(t), sd = 0.02), 0), 1)
fit <- fit_all_models(t, f_noisy)
cat("\nModel-selection on synthetic Korsmeyer-Peppas data (k=0.18, n=0.55):\n")
print(fit$ranking, row.names = FALSE)
cat(sprintf("Best model by AICc: %s\n", fit$best))
