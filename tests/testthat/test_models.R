# Unit tests for the nanoparticle drug-release simulator core.
# Run with:  Rscript tests/run_tests.R
# Uses a tiny built-in assertion helper so the suite has no package dependency;
# if 'testthat' is installed the same file also works under test_dir().

source_core <- function() {
  root <- Sys.getenv("NP_ROOT", ".")
  for (f in c("release_models.R", "tissue_diffusion.R",
              "parameters.R", "metrics.R")) {
    source(file.path(root, "R", f))
  }
}

# --- minimal assertion helpers (no dependencies) -----------------------------
.n_pass <- 0L; .n_fail <- 0L
expect_true <- function(cond, msg = "") {
  if (isTRUE(cond)) {
    .n_pass <<- .n_pass + 1L
  } else {
    .n_fail <<- .n_fail + 1L
    cat(sprintf("  FAIL: %s\n", msg))
  }
}
expect_close <- function(a, b, tol = 1e-6, msg = "") {
  expect_true(all(abs(a - b) < tol), sprintf("%s (|%.6g - %.6g|)", msg, a, b))
}

run_tests <- function() {
  source_core()
  t <- seq(0, 48, length.out = 200)

  # --- release models: bounds and monotonicity ---
  for (m in c("higuchi", "first_order", "zero_order",
              "korsmeyer_peppas", "fickian_sphere", "membrane_shell")) {
    params <- switch(m,
      higuchi          = list(k_H = 0.1),
      first_order      = list(k = 0.1),
      zero_order       = list(k = 0.01),
      korsmeyer_peppas = list(k = 0.1, n = 0.5),
      fickian_sphere   = list(D = 5e-4, r = 0.1),
      membrane_shell   = list(D = 5e-4, r = 0.1, h = 0.02, K = 0.5, C0 = 100)
    )
    df <- release_curve(m, t, params)
    expect_true(all(df$fraction >= 0 & df$fraction <= 1),
                sprintf("%s: fraction within [0,1]", m))
    expect_true(all(diff(df$fraction) >= -1e-9),
                sprintf("%s: monotonically non-decreasing", m))
    expect_close(df$fraction[1], 0, 1e-9, sprintf("%s: f(0) = 0", m))
  }

  # --- first-order: exact analytic value ---
  f_fo <- release_first_order(c(0, 10), k = 0.1)
  expect_close(f_fo[2], 1 - exp(-1), 1e-9, "first-order f(10) = 1-e^-1")

  # --- Fickian sphere: approaches full release at long time ---
  f_end <- release_fickian_sphere(1e6, D = 5e-4, r = 0.1)
  expect_close(f_end, 1, 1e-3, "fickian sphere -> 1 at long time")

  # --- membrane shell: thicker shell releases slower ---
  # Use a thick enough shell that neither curve has saturated at t = 10.
  f_thin  <- release_membrane_shell(10, D = 5e-4, r = 0.1, h = 0.1, K = 0.5, C0 = 100)
  f_thick <- release_membrane_shell(10, D = 5e-4, r = 0.1, h = 0.3, K = 0.5, C0 = 100)
  expect_true(f_thin < 1 && f_thick < 1, "membrane test params unsaturated")
  expect_true(f_thin > f_thick, "thinner shell -> faster release")

  # --- tissue diffusion: conservation-ish sanity + decay with distance ---
  sol <- solve_tissue_diffusion(D = 50, r_inner = 0.1, r_outer = 20,
                                t_end = 24, surface_conc = 100,
                                k_e = 0.1, n_x = 80)
  Cend <- sol$C[nrow(sol$C), ]
  expect_close(Cend[1], 100, 1e-6, "inner BC held at surface conc")
  expect_true(Cend[length(Cend)] <= Cend[1], "conc decreases outward (sink)")
  expect_true(all(is.finite(Cend)), "tissue solution stays finite (stable)")
  depth <- penetration_depth(sol, threshold = 0.1)
  expect_true(depth > 0 && depth <= (20 - 0.1), "penetration depth in range")

  # --- clearance reduces penetration ---
  sol_hi_ke <- solve_tissue_diffusion(D = 50, r_inner = 0.1, r_outer = 20,
                                      t_end = 24, surface_conc = 100,
                                      k_e = 1.0, n_x = 80)
  expect_true(penetration_depth(sol_hi_ke) <= penetration_depth(sol) + 1e-9,
              "higher clearance -> shallower penetration")

  # --- fitting: recover known parameters from synthetic data ---
  set.seed(1)
  k_true <- 0.2
  f_syn <- 1 - exp(-k_true * t)
  fit <- fit_first_order(t, f_syn)
  expect_close(fit$par[["k"]], k_true, 1e-3, "recover first-order k")
  expect_true(fit$r2 > 0.999, "fit R^2 high on clean data")

  fit_all <- fit_all_models(t, f_syn)
  expect_true(fit_all$best == "first_order",
              "model selection picks the true model")

  # --- parameter validation ---
  p <- default_parameters()
  expect_true(!is.null(validate_parameters(p)), "default params validate")

  cat(sprintf("\n%d passed, %d failed\n", .n_pass, .n_fail))
  if (.n_fail > 0) quit(status = 1)
}

# Entry point is tests/run_tests.R, which sources this file and calls
# run_tests(). Sourcing here only defines helpers; it does not execute the suite.
