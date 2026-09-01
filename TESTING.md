# Technical test summary

This build was hardened and smoke-tested on 24 August 2026.

## OmniRoute

- Base URL normalization (`/v1`, `/models`, `/chat/completions`)
- Keyless local compatibility header
- Optional endpoint-key authentication
- `/v1/models` diagnostic
- Real `/v1/chat/completions` diagnostic
- `auto` route and `felo/auto` fallback
- Authentication error classification
- CORS/local-browser diagnostic
- Localhost / 127.0.0.1 loopback retry
- Separate connection and completion timeouts

## Reliability and performance

- JavaScript syntax validation across every module
- Local HTML asset-reference validation
- Duplicate HTML ID scan
- CSS brace/parsing sanity scan
- Local AI heavyweight libraries removed from eager application startup
- Schedule Assessment advanced reports changed to on-demand calculation
- Monte Carlo remains worker-based
- Shared repository IndexedDB connections now close after each operation
- Shared repository filename rendering is HTML-escaped
- Large browser-held files warn before storage

## PDF

- Professional report header, metadata panel, typography and table treatment
- Chart canvases converted to images before PDF serialization
- Repeating page header and footer
- Page number and generation date
- `Schedule AI Toolkit` footer at bottom right
- Representative report PDF rendered and visually inspected

## Deployment note

Browser-to-local OmniRoute still requires the deployed website origin to be permitted by OmniRoute CORS settings. That server-side requirement cannot be removed by frontend code.


## 31 August 2026 iterative hardening cycle

### Direct Ollama integration

The shared AI service now supports Ollama as a real provider rather than a disabled placeholder.

Tested:

- Ollama catalog exposure
- base URL normalization
- `/api/tags` model discovery
- `/api/chat` completion
- selected-model persistence
- shared AI routing through Ollama
- no-model condition
- HTTP/server error surfacing
- network/CORS diagnostics
- `OLLAMA_ORIGINS` guidance
- local RAM/GPU warning
- live HTTP test against a mock Ollama-compatible server

### Parser regression

The 10,000-activity / 50,000-relationship synthetic stress test was repeated three times.

Observed parse times in this environment:

- 134 ms
- 248 ms
- 184 ms

Approximate heap increase remained about 29 MB.

### Static regression

Validated:

- JavaScript syntax for every module
- all local HTML asset references
- duplicate HTML IDs
- CSS brace balance
- 34 Schedule Assessment report definitions against 34 implemented report handlers
- all report handler function definitions
- shared AI catalogue usage across application tabs
- global theme ownership
- Tutorial / AI Setup route and assets
- Ollama dropdown availability
- absence of the disabled Ollama placeholder
- absence of Puter as a provider

### Browser test environment limitation

The automated Chromium runtime available during this test cycle blocks navigation to local/file URLs by administrator policy. Browser UI interaction tests could therefore not be executed in that sandbox. The UI was instead validated structurally and the Ollama request path was executed through Node's standards-compatible Fetch implementation, including a live local HTTP mock server.

A deployed-browser smoke test should still be performed after publishing to GitHub Pages because browser local-network permission and CORS policies depend on the user's browser and operating-system configuration.


## 1 September 2026 — NotebookLM+ integration cycle

NotebookLM+ v0.7.0 was merged as a standalone top-level suite workspace under `apps/notebooklmplus`.

Validation performed:

- Original NotebookLM+ JavaScript syntax suite — PASS
- NotebookLM+ retrieval/configuration tests — 26 PASS
- Ollama mock integration tests — 8 PASS
- Hosted OpenAI-compatible mock integration tests — 9 PASS
- New OmniRoute mock integration tests — 4 PASS
- Research/transcript/transcription integration tests — 4 PASS
- NotebookLM+ static contract tests — 42 PASS
- NotebookLM+ GitHub Pages static-server smoke test — PASS
- Project Controls shared AI provider regression suite — PASS
- Project Controls XER parser regression/performance suite — PASS
- JavaScript syntax across the merged suite — 42 files, PASS
- Local HTML/CSS/JS asset reference scan — PASS, zero missing local references
- Shell registration for NotebookLM+ — PASS
- Shared repository hidden for independent NotebookLM+ workspace — PASS by shell configuration

The Project Controls XER performance regression continued to parse 10,000 activities and 50,000 relationships in approximately 132 ms in this environment with about 29.7 MB heap growth.

OmniRoute-specific NotebookLM+ regression coverage verifies:

- `omniroute` provider sanitization/persistence
- dedicated `OmniRoute Auto` preset
- default `http://localhost:20128/v1` endpoint
- `auto` chat route
- non-empty placeholder bearer for normal keyless local OmniRoute
- route discovery through `/v1/models`
- streaming chat through `/v1/chat/completions`
- optional embeddings through `/v1/embeddings` when an embedding-capable route/model is selected
- actionable OmniRoute CORS/auth/quota diagnostics


## Release validation command

Run the complete repeatable validation suite with:

```bash
tests/run-release-validation.sh
```

It executes syntax/static checks, shell/configuration contracts, AI/Ollama tests, XER regression/fuzz/stress tests, the complete NotebookLM+ non-browser test suite, and HTTP route smoke tests.
