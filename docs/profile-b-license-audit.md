# Profile B — Visual Reference License Audit

Documentation only. Machine-readable: `data/profile-b-license-registry.json`.

## Method & limitation
Web **fetch** is blocked (search-only), so this audit records each source's **known
site/policy-level license** and flags **`verify_before_use`** on every entry. Individual
per-file license verification (Wikimedia files, individual PMC figures, NCI images) is a
**required user step** before any reuse/trace/crop. No image file was individually opened.

## License classification per source
| Source | Class | Reuse / trace / crop | Notes |
|---|---|---|---|
| Human Protein Atlas | **CC-BY** | yes (attribute) | site-wide CC BY 4.0; cite specific image |
| OpenStax A&P | **CC-BY** | yes (attribute) | check 3rd-party figure credits |
| Pharmaceutics 2017;9(3):33 (PMC5620574) | **CC-BY** | yes (attribute) | MDPI CC BY 4.0 |
| PMC SC-lamellae TEM articles | **UNKNOWN (per-article)** | verify | many CC BY; confirm per article |
| Wikimedia — Histology of skin | **UNKNOWN (per-file)** | verify | CC0/CC BY/CC BY-SA/PD vary per file |
| NCI Visuals Online | **PUBLIC_DOMAIN (mostly)** | verify | some credited images restricted |
| Libre Pathology | **CC-BY-SA** | yes + share-alike | verify per page/image |
| Open Histology (Galway) | **UNKNOWN** | verify | confirm CC per page |
| Histology at SIU | **REFERENCE_ONLY** | no | teaching collection, no open license |
| StatPearls (NBK537325) | **REFERENCE_ONLY** | text only | figures restricted |
| ATCC (CRL-6475 etc.) | **COPYRIGHTED_DO_NOT_REUSE** | description only | morphology text as reference |
| DermNet NZ | **COPYRIGHTED_DO_NOT_REUSE** | no | principles reference only |
| Nature Modern Pathology | **COPYRIGHTED_DO_NOT_REUSE** | text only | authoritative criteria |

## License distribution (source-level)
- **CC-BY:** 3 (HPA, OpenStax, PMC5620574) — strongest direct-reuse candidates.
- **CC-BY-SA:** 1 (Libre Pathology).
- **Public domain (mostly):** 1 (NCI).
- **Unknown / per-file:** 3 (Wikimedia, PMC SC-TEM, Open Histology).
- **Reference-only / copyrighted:** 5 (SIU, StatPearls figures, ATCC, DermNet, Modern Pathology).

## Reuse policy
Direct reuse/trace/crop is **conditional on opening the specific file and confirming CC
BY / CC BY-SA / CC0 / PD**. Reference-only and copyrighted sources inform biological
appearance only. Every future embedded asset must carry source + license + attribution.
**Nothing is embedded in this phase.**
