# Project Controls AI Suite — Shared AI Runtime Rebuild Validation

## Corrections in this release

### Global AI architecture
- Removed the local-model loading confirmation dialog from the shared runtime.
- Removed module-level calls to `ai.ensure()` from Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis, Claims & Forensics and Schedule Builder.
- Settings and the global top-right AI selector now own provider/model configuration.
- Opening or switching a tool does not load Ollama or ask for model consent.
- The first explicit AI action calls the shared runtime; the runtime uses the globally configured provider/model and shared timeout/reasoning/keep-alive settings.
- Module `changeModel` compatibility functions now update the shared preference only; they do not load a model.

### NotebookLM+
- Chat generation now routes through the parent `ProjectControlsCore.ai.run()` shared inference layer rather than its independent Ollama chat path.
- NotebookLM+ still performs its own source parsing, chunking, retrieval, citation assembly and optional embedding retrieval.
- The previous requirement for a local chat-model field before sending a chat message was removed.
- Dark mode is now the HTML first-paint/default and uses the same suite palette.
- Parent theme messages remain authoritative, so Light/Dark changes propagate from the suite.
- Build/cache version bumped to `0.8.1-suite-shared-ai`.

### Schedule Assessment
- Opening Schedule Assessment now only reflects the configured AI selection; it does not initialise/test/load the model.
- AI is invoked only when an AI report/chat action is explicitly requested.
- Previous clean-start/no-restore behaviour and professional PDF/Gantt export changes remain.

## Requested validation sequence

| Test stage | Result |
|---|---|
| Unit | PASS |
| Integration | PASS |
| Regression | PASS |
| File Import/Export | PASS |
| Data Integrity | PASS |
| Boundary | PASS |
| Negative | PASS |
| Golden-Result | PASS |
| Differential | PASS |
| Performance/Volume | PASS |
| Browser/Compatibility | PASS* |
| Security | PASS |
| Error Handling | PASS |
| Recovery | PASS |
| UAT | PASS* |

### AI-specific regression results
- No production occurrence of the old `Continue loading this model?` prompt: PASS
- No production occurrence of `Local AI loading was cancelled`: PASS
- No module-level direct `ProjectControlsCore.ai.ensure()` outside Settings: PASS
- All AI modules execute through the shared runtime: PASS
- NotebookLM+ chat uses the shared runtime: PASS
- Ollama `/api/tags`, `/api/show`, `/api/chat`: PASS
- Qwen thinking-only retry: PASS
- Empty `/api/chat` -> `/api/generate` fallback: PASS
- Legacy `keep_alive=-1` blocked before request: PASS
- Missing model, server error and network/CORS errors: PASS
- Notebook Ollama mock integration: PASS
- Hosted-compatible AI integration: PASS

### Schedule/parser coverage
- 300 malformed/random XER fuzz inputs: PASS
- 10,000 activities / 50,000 relationships: PASS
- 25,000 activities / 100,000 relationships: PASS
- Deterministic revision-comparison golden results: PASS

## Full release gate

`tests/run-release-validation.sh` — **PASS**

A dedicated `tests/shared-ai-architecture-tests.js` regression test is included so future changes cannot silently reintroduce per-module model loading.

`*` This environment cannot reach the user's Windows `localhost:11434` or perform interactive Windows Edge/Chrome GUI UAT. Browser/Ollama behaviour is therefore validated with the production request code, mock HTTP Ollama endpoints, static route checks and DOM/contracts. A live Windows smoke test after deployment remains the final environment-specific check.
