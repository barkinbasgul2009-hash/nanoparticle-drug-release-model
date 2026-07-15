#!/usr/bin/env Rscript
# Entry point for the test suite. Run from the repository root:
#   Rscript tests/run_tests.R
Sys.setenv(NP_ROOT = getwd())
source(file.path("tests", "testthat", "test_models.R"))
run_tests()
