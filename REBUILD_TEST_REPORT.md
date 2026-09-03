# Project Controls AI Suite — Clean Rebuild Validation Report

## Rebuild basis
Clean release workspace reconstructed from the latest corrected suite baseline, with the current unified architecture retained:
Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis, Claims & Forensics, NotebookLM+, Settings, Schedule Builder, shared repository/Bulk Information, global progress HUD, and one global AI selection.

OmniRoute is absent. Ollama is the primary local provider. Browser AI and NotebookLM+'s generic hosted OpenAI-compatible engine remain where supported.

## Test matrix

| Stage | Coverage | Result |
|---|---|---|
| Unit | NotebookLM retrieval/config, ranking, chunking, token budgeting, parsers, settings clamping | PASS |
| Integration | Shared Ollama adapter; NotebookLM Ollama mock API; hosted AI mock API; research/transcript/transcription | PASS |
| Regression | Shell contracts, global AI architecture, comparison UI, schedule reports, repository/Bulk Information | PASS |
| File Import/Export | XER parsing, raw-table preservation, backup validation, CSV artifact escaping, static project package contracts | PASS* |
| Data Integrity | Duplicate activity/orphan relationship detection, raw TASK preservation, embedding model isolation, ordered resource totals | PASS |
| Boundary | Extreme overlap/chunk bounds, small token budgets, timeout clamps, 10k/50k and 25k/100k schedule sizes | PASS |
| Negative | 300 malformed/random XER inputs, invalid model selection, auth/server/network errors, malformed NDJSON | PASS |
| Golden-Result | Deterministic schedule-comparison expectations: data date, progress, constraints, calendars, resources, relationships, duration, float | PASS |
| Differential | Activity-level resource totals vs assignment-derived fallback; revision-to-revision comparison sequence | PASS |
| Performance/Volume | 10k activities/50k relationships ~125–156 ms; 25k/100k ~286–288 ms in this environment | PASS |
| Browser/Compatibility | GitHub Pages-style static HTTP serving and all 9 routes | PASS* |
| Security | Active HTML escaping, malicious backup-role rejection, non-http URL rejection, token held in module memory, no OmniRoute references | PASS |
| Error Handling | Ollama server/network/CORS errors, empty chat response generate fallback, malformed streaming line tolerance | PASS |
| Recovery | Legacy `keep_alive=-1` sanitised before Ollama request; thinking-only retry; cancellation; linked-folder refresh/unlink | PASS |
| UAT | Static workflow contracts for all modules, one global AI selector, Bulk Information, progress HUD, comparison pane | PASS* |

`*` Environment limitations: this container cannot connect to the user's Windows Ollama instance, cannot perform real Chrome/Edge/Firefox GUI automation, and does not contain real user XER/XML/PDF/Office acceptance files. Those portions are validated with mocks, synthetic fixtures, static HTTP smoke tests and contract tests rather than a live Windows UAT session.

## Ollama-specific validation
- `/api/tags` discovery: PASS
- `/api/show` capability classification: PASS
- `/api/chat`: PASS
- Qwen-style thinking-only response retry with thinking disabled: PASS
- empty `/api/chat` -> `/api/generate` fallback: PASS
- legacy `keep_alive="-1"` blocked/sanitised before HTTP boundary: PASS
- embedding-only model rejected as chat model: PASS
- no-model condition: PASS
- server error propagation: PASS
- network/CORS actionable diagnostic: PASS
- streaming inactivity vs first-response timeout separation in NotebookLM+: PASS
- malformed NDJSON recovery: PASS
- cancellation: PASS

## Iterative defects found and corrected during rebuild validation
1. Release test harness reused fixed `/tmp` log names, causing permission collisions on repeated runs. Changed to per-run temporary log names.
2. NotebookLM+ smoke test used a fixed local port that was occupied in the validation environment. Changed the test harness port for repeatable validation.
3. Re-ran the complete release pipeline after those corrections: PASS.

## Final release gate
`tests/run-release-validation.sh`: **PASS**

All nine static routes: **PASS**

Archive integrity: verified during packaging.
