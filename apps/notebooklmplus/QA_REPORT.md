# NotebookLM+ v0.7.0 — QA Report

## Release scope

This release expands NotebookLM+ from a browser-first notebook/RAG chat tool into a broader research and Studio workbench while retaining local-first Ollama support, remote/hosted AI providers, the hierarchical source tree, per-file selection, CPU/no-GPU mode, and browser-local storage.

### Added feature families

- Studio: Executive Summary, Briefing Document, Study Guide, Detailed Report, Mind Map, Quiz, Flashcards, Presentation, Spreadsheet/Data Analysis, Audio Overview.
- Structured interactive artifact rendering and separate IndexedDB artifact storage.
- Website URL sources with optional user-controlled CORS proxy.
- YouTube transcript sources through a configurable endpoint.
- Audio transcription sources through a configurable endpoint.
- Quick source discovery and Deep Research through a configurable search endpoint.
- Selective addition of discovered research sources into the notebook evidence index.
- DOCX, PDF, XLSX, PPTX, JSON, CSV, HTML, TXT/Markdown artifact exports where appropriate.
- Restricted browser-worker Data Analysis Lab with time limits and blocked network/storage/dynamic-code primitives.
- Optional chart payload/rendering for structured spreadsheet/data-analysis artifacts.
- Specialised notebook profiles: General Research, Project Controls, Legal Research, Data Analysis, Study/Academic.
- Ollama hidden-thinking handling and retry when a reasoning model exhausts its output budget without visible text.
- Increased CPU/no-GPU visible answer budget while retaining long first-response timeout support.

## Automated release suite

Final release gate:

| Suite | Result |
|---|---:|
| Core/unit/parser/security/fuzz | 25 / 25 PASS |
| Ollama protocol/integration | 8 / 8 PASS |
| Hosted AI protocol/integration | 9 / 9 PASS |
| Research/transcript/transcription integration | 4 / 4 PASS |
| Static application contract | 42 / 42 PASS |
| JavaScript syntax validation | PASS |
| GitHub Pages HTTP smoke test | PASS |

**Named automated tests: 88 / 88 PASS**, plus syntax and deployment smoke checks.

## Iterative QA cycles

### Cycle 1 — architecture/integration

Validated that Studio, profiles, research tools, exports, analysis, existing chat/RAG, source indexing and mode configuration can coexist without breaking the v0.6 workflows. Updated stale version assertions uncovered by the first regression run.

### Cycle 2 — provider/protocol execution

Expanded mocked integrations for:

- local Ollama streaming;
- hosted OpenAI-compatible streaming/non-streaming responses;
- web search/discovery endpoint;
- YouTube transcript endpoint;
- audio transcription endpoint;
- authentication and timeout/error paths.

### Cycle 3 — artifact/data-analysis coverage

Added structured-output contracts for mind maps, quizzes, flashcards, presentations, spreadsheet analysis and chart payloads. Hardened the Analysis Lab against network/storage/global-object/dynamic-code escape primitives.

### Cycle 4 — final release gate

Re-ran the complete non-browser suite after documentation, version, service-worker and dependency updates. Verified static serving and packaging integrity.

## Browser E2E coverage

A Playwright/Chromium E2E test is included in the repository and GitHub Actions deployment gate. It covers:

- selectable chat and embedding models;
- specialised notebook profile creation;
- source-free chat;
- multiple-file indexing and hierarchical source selection;
- source-backed RAG chat;
- Enter/Shift+Enter chat behaviour;
- nested folder source handling;
- research endpoint settings;
- website URL source ingestion;
- YouTube transcript source ingestion;
- source discovery and adding selected research results;
- Studio summary generation;
- structured mind-map generation/rendering;
- Analysis Lab execution;
- audio transcription source ingestion;
- malformed backup protection;
- IndexedDB persistence after reload;
- service-worker registration.

The execution environment used to prepare this release blocks Chromium navigation to its own localhost test server with `ERR_BLOCKED_BY_ADMINISTRATOR`. Therefore the browser E2E test could not be executed locally here. It remains a required GitHub Actions deployment gate rather than being reported as a local PASS.

## Security/data-integrity controls checked

- Hosted/search/transcript/transcription secrets are page-memory-only.
- Generated HTML/UI output is escaped before rendering.
- Imported backup structures are validated before replacing local data.
- Analysis Lab denies network, storage, nested worker, dynamic import/eval/Function and common global-object escape paths.
- Analysis worker has a hard execution timeout.
- Web source URLs are restricted to HTTP/HTTPS.
- PDF scripting/eval remains disabled.
- Service worker caches only same-origin application assets and uses the versioned v0.7.0 cache.
- Studio artifacts are stored separately from evidence and are not silently re-indexed as sources.

## Known intentional limitations

- No sharing/collaboration/public notebooks (explicitly excluded from this release).
- Browser Audio Overview uses SpeechSynthesis playback; this release does not render/download an MP3.
- Web search, YouTube transcript and audio transcription require endpoints configured by the user. A static GitHub Pages app cannot securely embed long-lived third-party provider credentials.
- Some websites block browser CORS; an optional proxy endpoint can be configured.
- Analysis Lab is restricted JavaScript computation, not a full Python runtime or OS sandbox.
- Closed browsers cannot continuously watch local folders.
