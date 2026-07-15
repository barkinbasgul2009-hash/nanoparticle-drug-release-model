# =============================================================================
# Shiny web application: Nanoparticle Drug-Release & Tissue-Penetration Simulator
# -----------------------------------------------------------------------------
# The community-facing "browser tool" deliverable. Run locally with:
#   Rscript -e "shiny::runApp('app', launch.browser = TRUE)"
# or deploy to shinyapps.io / Posit Connect.
#
# Only dependency is 'shiny' itself; all plotting is base-R graphics so the app
# runs anywhere shiny does, with no further installation.
# =============================================================================

library(shiny)

# Source the model core (works whether launched from repo root or app/).
.src <- function(f) {
  for (path in c(file.path("R", f), file.path("..", "R", f))) {
    if (file.exists(path)) { source(path); return(invisible()) }
  }
  stop(sprintf("cannot locate R/%s", f))
}
invisible(lapply(c("release_models.R", "tissue_diffusion.R",
                   "parameters.R", "metrics.R"), .src))

P    <- default_parameters()
LABS <- release_model_labels()

# Inline "About" panel, built without requiring the markdown package.
about_panel <- function() {
  tags$div(style = "max-width:820px;",
    tags$h4("What this tool does"),
    tags$p("Two coupled modules for nanoparticle-based drug delivery:"),
    tags$ul(
      tags$li(tags$b("Module 1 — Release:"), " Higuchi, first-order, ",
              "zero-order, Korsmeyer-Peppas, exact Fickian-sphere (Crank), ",
              "and a membrane-controlled core-shell reservoir model."),
      tags$li(tags$b("Module 2 — Tissue diffusion:"), " Fick's second law ",
              "with first-order clearance, solved in spherical symmetry, ",
              "driven by the release curve.")
    ),
    tags$p(tags$b("Novel elements:"), " a reusable interactive tool (most ",
           "studies publish only static figures), side-by-side model ",
           "comparison on shared parameters, and fitting to user data with ",
           "AICc-based model selection."),
    tags$p("Units: micrometres and hours throughout. See the repository ",
           "README for the model equations and references.")
  )
}

# ---- UI ---------------------------------------------------------------------
ui <- fluidPage(
  titlePanel("Nanoparticle Drug-Release & Tissue-Penetration Simulator"),
  tags$p(style = "color:#555;",
    "Compare drug-release models and simulate diffusion into tissue for ",
    "different nanoparticle designs — before going to the bench."),

  sidebarLayout(
    sidebarPanel(
      width = 3,
      h4("Nanoparticle design"),
      sliderInput("r",  "Core radius (um)", min = 0.02, max = 1, value = P$r, step = 0.01),
      sliderInput("h",  "Shell thickness (um)", min = 0.005, max = 0.5, value = P$h, step = 0.005),
      sliderInput("C0", "Drug loading", min = 10, max = 500, value = P$C0, step = 10),
      sliderInput("K",  "Shell/core partition K", min = 0.05, max = 2, value = P$K, step = 0.05),

      h4("Release kinetics (Module 1)"),
      sliderInput("D_release", "Drug diffusivity in particle (um^2/h)",
                  min = 1e-4, max = 5e-3, value = P$D_release, step = 1e-4),
      sliderInput("k_first", "First-order rate k (1/h)",
                  min = 0.01, max = 1, value = P$k_first, step = 0.01),
      sliderInput("n_peppas", "Peppas exponent n",
                  min = 0.2, max = 1, value = P$n_peppas, step = 0.01),

      h4("Tissue diffusion (Module 2)"),
      sliderInput("D_tissue", "Diffusivity in tissue (um^2/h)",
                  min = 5, max = 200, value = P$D_tissue, step = 5),
      sliderInput("r_outer", "Tissue radius (um)",
                  min = 5, max = 50, value = P$r_outer, step = 1),
      sliderInput("k_e", "Clearance rate k_e (1/h)",
                  min = 0, max = 1, value = P$k_e, step = 0.05),
      selectInput("outer_bc", "Outer boundary",
                  c("Perfect sink" = "sink", "Reflective" = "reflect")),

      h4("Simulation"),
      sliderInput("t_end", "Total time (h)", min = 6, max = 120, value = P$t_end, step = 6)
    ),

    mainPanel(
      width = 9,
      tabsetPanel(
        tabPanel("Release comparison",
          br(),
          plotOutput("releasePlot", height = "480px"),
          tags$p(style = "color:#555;",
            "All six release models evaluated on the current design. ",
            "The membrane-controlled model is the one that responds to shell ",
            "thickness — the key formulation knob.")
        ),
        tabPanel("Tissue penetration",
          br(),
          fluidRow(
            column(8, plotOutput("tissuePlot", height = "480px")),
            column(4,
              br(), br(),
              selectInput("drive_model", "Release model driving the source",
                          setNames(names(LABS), LABS), selected = "first_order"),
              wellPanel(
                strong("Penetration depth (10% of surface):"),
                textOutput("penDepth")
              )
            )
          )
        ),
        tabPanel("Fit your data",
          br(),
          fluidRow(
            column(4,
              fileInput("userfile", "Upload release data (CSV: time, fraction)",
                        accept = c(".csv")),
              helpText("Two columns: 'time' and 'fraction' (0–1). ",
                       "Leave empty to use a synthetic demo dataset."),
              tableOutput("fitTable")
            ),
            column(8, plotOutput("fitPlot", height = "420px"))
          )
        ),
        tabPanel("About",
          br(),
          about_panel()
        )
      )
    )
  )
)

# ---- Server -----------------------------------------------------------------
server <- function(input, output, session) {

  tvec <- reactive(seq(0, input$t_end, length.out = 200))

  release_all <- reactive({
    t <- tvec()
    models <- list(
      higuchi          = list(k_H = P$k_higuchi),
      first_order      = list(k = input$k_first),
      zero_order       = list(k = P$k_zero),
      korsmeyer_peppas = list(k = P$k_peppas, n = input$n_peppas),
      fickian_sphere   = list(D = input$D_release, r = input$r),
      membrane_shell   = list(D = input$D_release, r = input$r, h = input$h,
                              K = input$K, C0 = input$C0)
    )
    lapply(names(models), function(m) release_curve(m, t, models[[m]]))
  })

  output$releasePlot <- renderPlot({
    curves <- release_all()
    cols <- c("#1f77b4", "#d62728", "#2ca02c", "#9467bd", "#ff7f0e", "#17becf")
    plot(NA, xlim = c(0, input$t_end), ylim = c(0, 1),
         xlab = "Time (h)", ylab = "Cumulative fraction released",
         main = "Module 1: Release model comparison")
    grid()
    for (i in seq_along(curves)) {
      lines(curves[[i]]$time, curves[[i]]$fraction, col = cols[i], lwd = 2.5)
    }
    legend("bottomright", legend = LABS, col = cols, lwd = 2.5,
           cex = 0.9, bg = "white")
  })

  tissue_sol <- reactive({
    t <- tvec()
    rel <- release_curve(input$drive_model, t,
      switch(input$drive_model,
        higuchi          = list(k_H = P$k_higuchi),
        first_order      = list(k = input$k_first),
        zero_order       = list(k = P$k_zero),
        korsmeyer_peppas = list(k = P$k_peppas, n = input$n_peppas),
        fickian_sphere   = list(D = input$D_release, r = input$r),
        membrane_shell   = list(D = input$D_release, r = input$r, h = input$h,
                                K = input$K, C0 = input$C0)))
    surf <- approxfun(rel$time, input$C0 * rel$fraction, rule = 2)
    solve_tissue_diffusion(
      D = input$D_tissue, r_inner = input$r, r_outer = input$r_outer,
      t_end = input$t_end, surface_conc = surf, k_e = input$k_e,
      n_x = 120, outer_bc = input$outer_bc)
  })

  output$tissuePlot <- renderPlot({
    sol <- tissue_sol()
    snap_times <- pretty(c(0, input$t_end), n = 4)
    snap_times <- snap_times[snap_times > 0 & snap_times <= input$t_end]
    cols <- colorRampPalette(c("#fdae61", "#a50026"))(length(snap_times))
    ymax <- max(sol$C, na.rm = TRUE)
    plot(NA, xlim = c(input$r, input$r_outer), ylim = c(0, ymax),
         xlab = "Distance from particle centre (um)",
         ylab = "Tissue concentration",
         main = "Module 2: Tissue concentration profiles")
    grid()
    for (i in seq_along(snap_times)) {
      prof <- profile_at_time(sol, snap_times[i])
      lines(prof$x, prof$C, col = cols[i], lwd = 2.5)
    }
    legend("topright", legend = sprintf("t = %g h", snap_times),
           col = cols, lwd = 2.5, cex = 0.9, bg = "white")
  })

  output$penDepth <- renderText({
    sprintf("%.2f um", penetration_depth(tissue_sol(), threshold = 0.1))
  })

  # --- fit-your-data tab ---
  user_data <- reactive({
    if (is.null(input$userfile)) {
      # synthetic demo: Korsmeyer-Peppas with noise
      t <- seq(0, input$t_end, length.out = 40)
      f <- release_korsmeyer_peppas(t, k = 0.18, n = 0.55)
      set.seed(1)
      data.frame(time = t, fraction = pmin(pmax(f + rnorm(length(t), sd = 0.03), 0), 1))
    } else {
      df <- read.csv(input$userfile$datapath)
      names(df) <- tolower(names(df))
      validate(need(all(c("time", "fraction") %in% names(df)),
                    "CSV must have columns 'time' and 'fraction'"))
      df[order(df$time), c("time", "fraction")]
    }
  })

  fit_result <- reactive({
    d <- user_data()
    fit_all_models(d$time, d$fraction)
  })

  output$fitTable <- renderTable({
    r <- fit_result()$ranking
    data.frame(Model = LABS[r$model], `R2` = round(r$r2, 4),
               RMSE = round(r$rmse, 4), AICc = round(r$aicc, 1),
               check.names = FALSE)
  })

  output$fitPlot <- renderPlot({
    d <- user_data()
    fr <- fit_result()
    best <- fr$best
    pred <- fr$fits[[best]]$predicted
    plot(d$time, d$fraction, pch = 19, col = "#333333",
         xlab = "Time (h)", ylab = "Fraction released",
         main = sprintf("Best-fit model: %s", LABS[best]),
         ylim = c(0, 1))
    grid()
    lines(d$time, pred, col = "#d62728", lwd = 3)
    legend("bottomright", legend = c("data", "best fit"),
           pch = c(19, NA), lty = c(NA, 1), lwd = c(NA, 3),
           col = c("#333333", "#d62728"), bg = "white")
  })
}

shinyApp(ui, server)
