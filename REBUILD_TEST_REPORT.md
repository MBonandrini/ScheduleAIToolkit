# Project Controls AI Suite — Rebuild Validation Report

## Requested rebuild changes
- NotebookLM+ Studio tab removed from the user interface.
- NotebookLM+ follows the suite light/dark colour system.
- NotebookLM+ Sources includes **Add from shared repository**, resolving both directly stored repository files and linked Bulk Information files where browser permission remains available.
- Schedule Assessment PDF export has a dedicated white professional export surface, improved table/page-break rules, light Gantt export and consistent report header/meta layout.
- Schedule Assessment PDF button creates a PDF blob and immediately triggers a browser download without requiring the report modal.
- Export footer bottom-right: `https://mbonandrini.githib.io/ScheduleAIToolkit` (exact text requested).
- Schedule Assessment opens cleanly and never prompts to restore the previous saved project. Portable restore remains an explicit user action under Backup & portability.
- Claims/Forensics startup AI initialization was changed to lazy/on-demand, matching Contract Manager and Drawing Measurement, so changing tabs does not reload/execute Ollama.

## Validation matrix
| Stage | Result | Principal coverage |
|---|---|---|
| Unit | PASS | parser, Notebook retrieval/config, settings, chunking, ranking |
| Integration | PASS | shared Ollama adapter, Notebook Ollama mock API, hosted-compatible API, research tools |
| Regression | PASS | suite contracts, comparison UI, global AI architecture, requested UI changes |
| File Import/Export | PASS | XER parsing, repository source indexing contracts, PDF download contract, CSV/backup validation |
| Data Integrity | PASS | raw XER tables, duplicates/orphans, resource totals, embedding isolation |
| Boundary | PASS | token/chunk limits, timeout clamping, large schedules |
| Negative | PASS | 300 malformed/random XERs, missing model, auth/network/server failures |
| Golden-Result | PASS | schedule comparison expected values |
| Differential | PASS | assignment-derived resource fallback and revision comparisons |
| Performance/Volume | PASS | 10k/50k and 25k/100k synthetic schedules |
| Browser/Compatibility | PASS* | GitHub Pages static-route/assets and browser API contracts |
| Security | PASS | HTML escaping, backup validation, URL scheme validation, token handling |
| Error Handling | PASS | Ollama/CORS/network errors, malformed streams, PDF errors |
| Recovery | PASS | Qwen thinking retry, empty-chat generate fallback, keep-alive sanitisation, cancellation |
| UAT | PASS* | requested workflow/static UI acceptance contracts |

`*` Browser GUI automation and a live connection to the user's Windows `localhost:11434` are not available in this execution environment. Browser compatibility is therefore validated through static GitHub Pages routes, DOM/contracts and mock Ollama HTTP integration. A final live Windows/Edge + Ollama smoke test remains required after deployment.

## Performance observations
- 10,000 activities / 50,000 relationships: approximately 120–160 ms in this environment.
- 25,000 activities / 100,000 relationships: approximately 270–290 ms in this environment.

## Final gate
`tests/run-release-validation.sh` — **PASS**
