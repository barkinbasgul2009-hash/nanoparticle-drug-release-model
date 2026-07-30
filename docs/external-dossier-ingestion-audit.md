# External-Dossier Ingestion Audit

Audits the two user-provided artifacts (`docs/external/`) claim-by-claim. Rule:
a claim is **VERIFIED** only if it matches a primary source **this project actually
opened**; claims about sources not opened here are **SECONDARY / UNVERIFIED** and are
not propagated as production data.

## Verification status by source

| Dossier claim/source | Primary opened by us? | Verdict | Action |
|---|---|---|---|
| **Rothe 2017** — SC K/D for caffeine/resorcinol/7-EC, human+pig | **Yes** (PDF) | **VERIFIED & CONSISTENT** — matches our Table-2 extraction | Keep (already in registries) |
| **Iliopoulos 2020** — niacinamide, cumulative permeation 100.3–106.7 vs 1.3 µg/cm², IVIVC R²=0.98, Pearson R²=0.94 | **Yes** (PDF) | **VERIFIED & CONSISTENT** | Keep |
| **OECD TG 428** — 32±1 °C, split-thickness, mass balance | **Yes** (PDF) | **VERIFIED & CONSISTENT** | Keep |
| **Sarfraz 2022** — bladder review, qualitative environment | **Yes** (PDF) | **VERIFIED (review; qualitative only)** | Keep as secondary |
| **Chen 2024** — AuNP 15/22/60 nm, −35 mV, MDA-MB-231, 1 µg/mL, 12 h; XFM peaks ~924 ppm (22 nm) / 187 ppm (60 nm); peak depths 21/22/15 µm; DOI 10.1002/smll.202304693 | **No** (not provided; web-blocked) | **SECONDARY / UNVERIFIED** — plausible, self-consistent, but not read by us | Record as dossier-reported, unverified; do NOT use as production data |
| **Dreher 2006** — apparent permeability 154/32/9.5/9.8/1.7 ×10⁻⁷ cm/s for 3.3/10/40/70 kDa/2 MDa dextran; depth >35 µm (small) vs ~5–15 µm (large); DOI 10.1093/jnci/djj070, PMID 16507830 | **No** (not provided; web-blocked) | **SECONDARY / UNVERIFIED** | Record as dossier-reported, unverified |
| **Potts & Guy 1992** — Pharm Res 1992;**9:663–669**, DOI 10.1023/A:1015810312465 | **No** (uploaded file was Karadzovska 2013) | **BIBLIOGRAPHIC IDENTITY UPDATED; full text STILL MISSING** | Update identifiers; keep missing; coefficients not obtained |
| **Mitragotri 2011** — "Mathematical models of skin permeability: an overview", Int J Pharm 418(1):115–129 (dossier §2.7 / ref 8) | **No** | **IDENTIFIED (new); not opened** | Add to registry as identified skin-modeling review |

## Dossier conclusions — reconciliation with our repository

| Dossier conclusion | Our position | Resolution |
|---|---|---|
| Three separate modules (skin released-API; AuNP spheroid carrier; dextran vascular) that must NOT be joined | **Agree** — matches our §22 non-combination rule | Adopt; keep modules separate |
| No QUALIFIED profile; complete NP profile = INSUFFICIENT_EVIDENCE; overall OUTCOME B | **Agree** | Adopt |
| Primary Stage-3 = released-API multilayer human-skin submodel (niacinamide, non-NP), NP release disabled | **Agree it is the most VERIFIED submodel**, but note it is **not a nanoparticle**; a stronger *nanoparticle* candidate (celastrol/tripterine NLC skin) exists but is unverified | Refine: keep niacinamide as the verified submodel; add celastrol NLC as the strongest **NP candidate to pursue** |
| Chen/Dreher as parallel benchmarks | **Agree**, but flag values as secondary/unverified until primaries opened | Adopt with provenance flag |
| Robin/flux release-to-tissue coupling; multilayer equations; mass balance with M_cell for spheroid | **Agree (design)** — consistent with our coupling/mass-balance docs; adds M_cell (uptake) state | Integrate M_cell into mass-balance registry |

## New information the dossier added (beyond our prior work)
- Chen 2024 exact system + (secondary) quantitative peaks/depths.
- Dreher 2006 exact permeability table (secondary).
- Potts & Guy 1992 fuller citation (9:663–669; DOI 10.1023/A:1015810312465).
- Mitragotri 2011 skin-modeling review (model-structure support).
- A candidate spheroid **uptake–return** model (adds an intracellular state, i.e.
  pure Fickian diffusion is insufficient for intact-carrier transport).

## What the dossier did NOT resolve (still open)
- No exact nanoparticle formulation with a verified, continuous release→penetration
  chain **plus independent external validation**.
- Chen/Dreher primaries remain unopened (secondary only).
- Potts & Guy 1992 full text still missing.

## Corrections made to the dossier's framing
- The dossier's "primary" (niacinamide skin) is scientifically the most VERIFIED
  submodel but is **not a nanoparticle**; we make that explicit and add the
  celastrol/tripterine NLC skin system as the strongest *nanoparticle* candidate to
  pursue (unverified pending PDFs), so the project does not conflate "most verified"
  with "is a nanoparticle model".
