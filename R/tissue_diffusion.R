# =============================================================================
# Module 2: Diffusion of the released drug into the surrounding tissue
# -----------------------------------------------------------------------------
# Solves Fick's second law with an optional first-order clearance (elimination)
# term in 1D spherical symmetry around the nanoparticle:
#
#   dC/dt = D * (1/x^2) d/dx( x^2 dC/dx )  -  k_e * C
#
#   C     : drug concentration in tissue        [kg/m^3]
#   x     : radial distance from particle centre [m]
#   D     : tissue diffusion coefficient        [m^2/s]
#   k_e   : first-order clearance rate           [1/s]   (metabolism / perfusion)
#
# The solver is a self-contained explicit finite-difference scheme (base R only,
# no external packages) so it always runs. deSolve/ReacTran can be swapped in
# for stiff problems; see solve_tissue_diffusion_deSolve() below (optional).
#
# Boundary conditions
#   inner (x = r_inner, particle surface): Dirichlet, C = surface_conc(t).
#       surface_conc may be a constant or a function of time, letting Module 1's
#       release curve drive the tissue source.
#   outer (x = r_outer): "sink" (Dirichlet C = 0) or "reflect" (zero flux).
# =============================================================================

# ---- explicit finite-difference solver --------------------------------------
solve_tissue_diffusion <- function(D, r_inner, r_outer,
                                    t_end, surface_conc,
                                    k_e = 0,
                                    n_x = 100L, n_t = NULL,
                                    outer_bc = c("sink", "reflect"),
                                    C_init = 0) {
  outer_bc <- match.arg(outer_bc)
  if (D <= 0) stop("diffusion coefficient D must be > 0")
  if (r_outer <= r_inner) stop("r_outer must be greater than r_inner")
  if (t_end <= 0) stop("t_end must be > 0")
  if (k_e < 0) stop("clearance rate k_e must be >= 0")

  # Spatial grid.
  x  <- seq(r_inner, r_outer, length.out = n_x)
  dx <- x[2] - x[1]

  # Time step: honour the explicit-scheme stability limit dt <= dx^2 / (2D),
  # with a safety factor, unless the caller fixed n_t.
  dt_stable <- 0.4 * dx^2 / D
  if (is.null(n_t)) {
    n_t <- max(2L, as.integer(ceiling(t_end / dt_stable)))
  }
  dt <- t_end / n_t
  if (dt > dx^2 / (2 * D)) {
    warning(sprintf(
      "time step dt=%.3g exceeds stability limit %.3g; increasing n_t",
      dt, dx^2 / (2 * D)))
    n_t <- max(2L, as.integer(ceiling(t_end / dt_stable)))
    dt <- t_end / n_t
  }

  # Surface concentration as a function of time.
  surf_fun <- if (is.function(surface_conc)) surface_conc else function(tt) surface_conc

  # State.
  C <- rep(C_init, n_x)
  C[1] <- surf_fun(0)

  # Store a modest number of snapshots for plotting (not every step).
  n_snap  <- min(n_t + 1L, 200L)
  snap_at <- unique(round(seq(0, n_t, length.out = n_snap)))
  snaps   <- matrix(NA_real_, nrow = length(snap_at), ncol = n_x)
  snap_t  <- numeric(length(snap_at))
  si <- 1L
  if (0 %in% snap_at) { snaps[si, ] <- C; snap_t[si] <- 0; si <- si + 1L }

  alpha <- D * dt / dx^2

  for (step in seq_len(n_t)) {
    tt   <- step * dt
    Cnew <- C

    # Interior nodes: spherical Laplacian via a conservative central difference.
    #   (1/x^2) d/dx(x^2 dC/dx) ~
    #   [ x_{i+1/2}^2 (C_{i+1}-C_i) - x_{i-1/2}^2 (C_i-C_{i-1}) ] / (x_i^2 dx^2)
    i    <- 2:(n_x - 1)
    xp   <- (x[i] + x[i + 1]) / 2      # x_{i+1/2}
    xm   <- (x[i] + x[i - 1]) / 2      # x_{i-1/2}
    lap  <- (xp^2 * (C[i + 1] - C[i]) - xm^2 * (C[i] - C[i - 1])) /
            (x[i]^2 * dx^2)
    Cnew[i] <- C[i] + dt * (D * lap - k_e * C[i])

    # Inner boundary: Dirichlet (particle surface concentration).
    Cnew[1] <- surf_fun(tt)

    # Outer boundary.
    if (outer_bc == "sink") {
      Cnew[n_x] <- 0
    } else { # reflect: zero-flux (mirror node)
      xp_o <- (x[n_x] + x[n_x - 1]) / 2
      lap_o <- (xp_o^2 * (C[n_x - 1] - C[n_x])) / (x[n_x]^2 * dx^2)
      Cnew[n_x] <- C[n_x] + dt * (D * lap_o - k_e * C[n_x])
    }

    C <- Cnew

    if (step %in% snap_at) {
      snaps[si, ] <- C
      snap_t[si]  <- tt
      si <- si + 1L
    }
  }

  list(
    x       = x,           # radial grid
    time    = snap_t,      # snapshot times
    C       = snaps,       # matrix [time x space] of concentrations
    dx      = dx,
    dt      = dt,
    n_t     = n_t,
    params  = list(D = D, r_inner = r_inner, r_outer = r_outer,
                   k_e = k_e, outer_bc = outer_bc)
  )
}

# ---- derived metrics --------------------------------------------------------

# Penetration depth: distance from the particle surface at which the
# concentration first falls below `threshold` * surface concentration, at the
# final simulated time. A clinically meaningful "how far did the drug reach".
penetration_depth <- function(sol, threshold = 0.1) {
  last <- nrow(sol$C)
  Cend <- sol$C[last, ]
  Csurf <- Cend[1]
  if (Csurf <= 0) return(0)
  cutoff <- threshold * Csurf
  below <- which(Cend < cutoff)
  if (length(below) == 0) return(sol$x[length(sol$x)] - sol$x[1])
  sol$x[below[1]] - sol$x[1]
}

# Concentration profile at a chosen snapshot time (nearest available).
profile_at_time <- function(sol, t_query) {
  idx <- which.min(abs(sol$time - t_query))
  data.frame(x = sol$x, C = sol$C[idx, ], time = sol$time[idx])
}

# ---- optional deSolve / ReacTran backend ------------------------------------
# Mentor's suggested stack. Only used if the packages are installed; the base-R
# solver above is the always-available default.
solve_tissue_diffusion_deSolve <- function(D, r_inner, r_outer, t_end,
                                            surface_conc, k_e = 0,
                                            n_x = 100L, n_out = 50L) {
  if (!requireNamespace("ReacTran", quietly = TRUE) ||
      !requireNamespace("deSolve", quietly = TRUE)) {
    stop("packages 'ReacTran' and 'deSolve' are required for this backend")
  }
  grid <- ReacTran::setup.grid.1D(x.up = r_inner, x.down = r_outer, N = n_x)
  surf_fun <- if (is.function(surface_conc)) surface_conc else function(tt) surface_conc

  deriv <- function(tt, C, parms) {
    tran <- ReacTran::tran.1D(
      C = C, D = D,
      C.up = surf_fun(tt),
      flux.down = 0,
      dx = grid, A = grid$x.mid^2   # spherical geometry via area weighting
    )
    list(tran$dC - k_e * C)
  }

  times <- seq(0, t_end, length.out = n_out)
  out <- deSolve::ode.1D(y = rep(0, n_x), times = times, func = deriv,
                         parms = NULL, nspec = 1, dimens = n_x)
  list(x = grid$x.mid, time = times, C = out[, -1],
       params = list(D = D, r_inner = r_inner, r_outer = r_outer, k_e = k_e))
}
