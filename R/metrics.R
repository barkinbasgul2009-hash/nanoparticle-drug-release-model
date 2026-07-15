# =============================================================================
# Comparison metrics and parameter fitting
# -----------------------------------------------------------------------------
# Tools for the two novel components of the project:
#   (1) comparing several release models on the *same* data, and
#   (2) fitting a model's parameters to a user's own experimental release data.
# =============================================================================

# ---- goodness-of-fit metrics ------------------------------------------------

# Coefficient of determination.
r_squared <- function(observed, predicted) {
  ss_res <- sum((observed - predicted)^2)
  ss_tot <- sum((observed - mean(observed))^2)
  if (ss_tot == 0) return(NA_real_)
  1 - ss_res / ss_tot
}

# Root-mean-square error.
rmse <- function(observed, predicted) {
  sqrt(mean((observed - predicted)^2))
}

# Akaike Information Criterion (small-sample corrected, AICc) for ranking models
# with different parameter counts on the same data. Lower is better.
aicc <- function(observed, predicted, n_params) {
  n <- length(observed)
  rss <- sum((observed - predicted)^2)
  if (rss <= 0) return(-Inf)
  aic <- n * log(rss / n) + 2 * n_params
  if (n - n_params - 1 > 0) {
    aic + (2 * n_params * (n_params + 1)) / (n - n_params - 1)
  } else {
    aic
  }
}

# ---- parameter fitting ------------------------------------------------------
# Each fitter takes experimental (time, fraction) data and returns the best-fit
# parameters plus goodness-of-fit metrics. Fitting uses base R optim() so there
# are no package dependencies.

.fit_generic <- function(t, f_obs, predict_fun, start, n_params,
                         lower = -Inf, upper = Inf) {
  objective <- function(par) {
    pred <- predict_fun(par, t)
    sum((f_obs - pred)^2)
  }
  fit <- tryCatch(
    optim(start, objective, method = "L-BFGS-B",
          lower = lower, upper = upper),
    error = function(e) optim(start, objective)  # fall back to Nelder-Mead
  )
  pred <- predict_fun(fit$par, t)
  list(
    par      = fit$par,
    predicted = pred,
    r2       = r_squared(f_obs, pred),
    rmse     = rmse(f_obs, pred),
    aicc     = aicc(f_obs, pred, n_params),
    converged = isTRUE(fit$convergence == 0)
  )
}

fit_higuchi <- function(t, f_obs) {
  res <- .fit_generic(
    t, f_obs,
    predict_fun = function(par, tt) pmin(par[1] * sqrt(tt), 1),
    start = c(k_H = 0.2), n_params = 1, lower = 1e-8, upper = 100
  )
  names(res$par) <- "k_H"
  res$model <- "higuchi"; res
}

fit_first_order <- function(t, f_obs) {
  res <- .fit_generic(
    t, f_obs,
    predict_fun = function(par, tt) 1 - exp(-par[1] * tt),
    start = c(k = 0.1), n_params = 1, lower = 1e-8, upper = 100
  )
  names(res$par) <- "k"
  res$model <- "first_order"; res
}

fit_korsmeyer_peppas <- function(t, f_obs) {
  res <- .fit_generic(
    t, f_obs,
    predict_fun = function(par, tt) pmin(par[1] * tt^par[2], 1),
    start = c(k = 0.2, n = 0.5), n_params = 2,
    lower = c(1e-8, 1e-3), upper = c(100, 3)
  )
  names(res$par) <- c("k", "n")
  res$model <- "korsmeyer_peppas"; res
}

# Fit all supported empirical models and rank them by AICc.
fit_all_models <- function(t, f_obs) {
  fits <- list(
    higuchi          = fit_higuchi(t, f_obs),
    first_order      = fit_first_order(t, f_obs),
    korsmeyer_peppas = fit_korsmeyer_peppas(t, f_obs)
  )
  ranking <- data.frame(
    model = names(fits),
    r2    = vapply(fits, function(x) x$r2, numeric(1)),
    rmse  = vapply(fits, function(x) x$rmse, numeric(1)),
    aicc  = vapply(fits, function(x) x$aicc, numeric(1)),
    stringsAsFactors = FALSE
  )
  ranking <- ranking[order(ranking$aicc), ]
  ranking$rank <- seq_len(nrow(ranking))
  list(fits = fits, ranking = ranking, best = ranking$model[1])
}
