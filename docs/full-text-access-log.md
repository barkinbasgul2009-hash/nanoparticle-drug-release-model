# Full-Text Access Log

Status: **Stage 2. Decisive environment constraint documented here.**

## Environment access finding
In this build environment, **all direct outbound HTTPS fetching is blocked** by the
agent network proxy. Verified this session:

| Attempt | Tool | Result |
|---|---|---|
| PMC5484360 (stratum-corneum D/K) | WebFetch | HTTP 403 |
| JNCI Dreher 2006 full text | WebFetch | HTTP 403 |
| arXiv 2510.14606 (SC modelling PDF) | WebFetch | HTTP 403 |
| MDPI Pharmaceutics 12(9):887 | WebFetch | HTTP 403 |
| NCBI E-utilities esummary (PMID 16507830) | WebFetch | HTTP 403 |
| NCBI E-utilities (same) | curl via proxy | 56 CONNECT tunnel failed, 403 |

The proxy status endpoint showed no per-host relay failures, i.e. this is a
**policy block on outbound fetch**, not a transient error. **Only server-side
`WebSearch` is available.**

## Consequence for Stage 2 (honest)
`WebSearch` returns AI-generated summaries. The Stage-2 policy (§5) states these
may be used **only to identify possible sources**, never as quantitative evidence,
and that every quantitatively-used source must be **opened and inspected** with an
exact table/figure/page locator. Because full texts cannot be opened here:

- Candidate **systems and sources were identified** (with real DOIs/PMIDs where the
  search listing provided them).
- **No quantitative parameter values were extracted or recorded as data.** Numbers
  seen in search summaries are treated as *leads only* and are NOT entered into any
  parameter/profile registry.
- Therefore no candidate can be graded above **RESEARCH_SUPPORTED**, and even that
  is provisional pending full-text parameterization.

This is reported honestly rather than filled with plausible-looking numbers
(Stage-2 §5, §43 Outcome C). The specific full texts required to proceed are listed
in `critical-paywalled-sources.md`.
