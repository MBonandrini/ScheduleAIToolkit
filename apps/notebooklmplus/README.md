# NotebookLM+ v0.7.0 — Research & Studio Workbench

NotebookLM+ is a browser-first notebook research application designed to run from GitHub Pages while keeping local notebook files, parsed text, indexes, embeddings, conversations and generated Studio artifacts in the browser.

It supports local Ollama, remote Ollama and configurable OpenAI-compatible hosted AI engines. No Python/FastAPI bridge is required for normal use.

## Major capabilities

### Workspace / source-grounded chat
- Create, clone and template notebooks.
- Notebook profiles: **General Research, Project Controls, Legal Research, Data Analysis, Study / Academic**.
- Chat with no sources, or use local RAG when indexed evidence exists.
- Collapsible source tree with nested folders and per-file selection.
- Source formats: PDF, DOCX, XLS/XLSX, PPTX, CSV/TSV, TXT, Markdown, JSON, HTML, XML, YAML and logs.
- Browser-local IndexedDB persistence and backup/restore.
- Enter sends; Shift+Enter creates a new line.
- Stream cancellation and separate model-load / inactivity timeouts.

### Studio
Studio artifacts are stored separately from notebook evidence and can be regenerated/deleted without contaminating the source index.

Generators:
- Executive Summary
- Briefing Document
- Study Guide
- Detailed Report
- Mind Map
- Quiz
- Flashcards
- Presentation
- Spreadsheet / Data Analysis
- Audio Overview

Structured Studio outputs render interactively: collapsible mind maps, revealable quiz answers, flip-style flashcards, slide cards, spreadsheet tables/charts and two-speaker audio scripts.

### Artifact export
Depending on artifact type, Studio supports download/export to:
- Markdown
- TXT
- HTML
- PDF
- DOCX
- JSON
- CSV
- XLSX
- PPTX

DOCX is generated in-browser using Open XML + JSZip. XLSX uses SheetJS. PDF uses jsPDF. PPTX uses PptxGenJS.

### Web pages, YouTube and audio
- Add a web URL directly as an indexed source when browser CORS permits it.
- Configure an optional web-fetch proxy for sites that block browser requests.
- Add YouTube transcripts through a configurable transcript endpoint.
- Add local audio files through a configurable transcription endpoint.
- Tool/service tokens are kept in **page memory only** and disappear on reload.

### Source discovery / Deep Research
Configure a JSON web-search endpoint in **Settings → Research & tools**.

Quick discovery:
1. Submit a research question.
2. Review candidate sources.
3. Select/unselect results.
4. Add selected pages to the notebook index.

Deep Research:
1. Searches for candidate sources.
2. Fetches a bounded set of top pages.
3. Produces a research report with `[R#]` source markers.
4. Saves the result as a Studio artifact.
5. Lets you selectively add fetched sources to the notebook evidence index.

The search endpoint may use `{q}` / `{query}` placeholders or accept query-string parameters. Returned JSON can use common `results`, `items`, `webPages.value` or `organic` arrays with `title/name`, `url/link`, and `snippet/description` fields.

### Audio Overview
The Studio Audio Overview generator creates a two-speaker dialogue from notebook evidence. Browsers with the Web Speech API can play the dialogue using locally available speech-synthesis voices.

This browser-only version does not generate a downloadable MP3 by itself; a future hosted TTS endpoint can be added without changing the notebook architecture.

### Analysis Lab
Analysis Lab runs JavaScript calculations inside a time-limited browser Worker. It can receive:
- indexed document metadata,
- selected notebook chunks, or
- the current Studio artifact.

The sandbox blocks common network, storage, nested-worker, dynamic-import and global-object escape primitives. It is intentionally a restricted calculation environment, not a general web-programming runtime.

## AI modes

| Mode | Intended use |
|---|---|
| CPU / No GPU | CPU-only/slow machines; keyword-first; one index worker; long first-response allowance |
| Lightweight | Older/smaller local machines |
| Local Ollama | Normal local Ollama use |
| Balanced | General default |
| Power | Strong GPU/RAM workstation |
| Remote Ollama | Ollama on another machine/server |
| Hosted AI Engine | OpenAI-compatible private/cloud endpoint |
| Custom | Fully configurable |

### CPU / No GPU defaults
- 4,096 context tokens
- Top K 4
- Maximum answer tokens 1,024
- One embedding/index worker
- Semantic retrieval off by default
- Keyword retrieval on
- 30-minute Ollama keep-alive
- 900-second model-load/first-response timeout
- 240-second stream-inactivity timeout
- Reasoning/thinking **Off** by default

Reasoning-capable Ollama models can consume their entire output budget in hidden thinking. NotebookLM+ tracks `message.thinking` and retries once with thinking disabled if the model finishes without visible answer text.

## Research/tool endpoint configuration

Open **Settings → Research & tools**.

Optional fields:
- Web Search JSON endpoint
- Web fetch proxy endpoint
- YouTube transcript endpoint
- Audio transcription endpoint
- timeout
- discovery result count
- memory-only tokens for search/transcript/transcription

Because NotebookLM+ is a static GitHub Pages application, do not embed long-lived production API secrets in the repository. Prefer a private gateway, VPN, authenticated reverse proxy or short-lived user credentials.

## Ollama setup

Local default:

```text
http://127.0.0.1:11434
```

The GitHub Pages origin must be allowed by Ollama. For this repository:

```text
https://MBonandrini.github.io
```

A Windows helper is included:

```text
downloads/NotebookLMPlus-Ollama-Setup.zip
```

It configures the exact origin rather than `OLLAMA_ORIGINS=*`.

## GitHub Pages

The repository includes:

```text
.github/workflows/pages.yml
```

The workflow runs the regression suite and a Playwright/Chromium E2E gate before deploying Pages.

## Tests

Run locally:

```bash
bash tests/run_tests.sh
```

The v0.7.0 release suite contains:
- 25 core/config/parser/security/fuzz/unit tests
- 8 Ollama protocol/integration tests
- 9 hosted-AI integration tests
- 4 research/transcript/transcription integration tests
- 42 static application-contract tests
- JavaScript syntax validation for every app module/service worker
- GitHub Pages HTTP smoke test
- Playwright browser E2E workflow covering notebook creation, model dropdowns, source-free chat, RAG chat, multi-file/folder selection, backup protection, profiles, Studio generation, URL sources, YouTube, audio, research, Analysis Lab, persistence and service workers

The current execution environment used to build this release blocks Chromium from navigating to its own `127.0.0.1` test server with `ERR_BLOCKED_BY_ADMINISTRATOR`; therefore the Playwright E2E test is retained as a GitHub Actions deployment gate rather than reported as locally executed.

## Browser/library dependencies

Third-party browser parsers/exporters are pinned:
- Mammoth 1.12.1 — DOCX parsing
- SheetJS 0.20.3 — XLS/XLSX parsing/export
- JSZip 3.10.1 — PPTX/DOCX handling
- PDF.js 4.10.38 — PDF parsing with scripting/eval disabled
- jsPDF 2.5.2 — PDF export
- PptxGenJS 3.12.0 — PowerPoint export

The application service worker caches only NotebookLM+'s own static files. It does not cache Ollama, hosted-AI, research-service or CDN/API responses.

## Important browser-only limitations

1. Web pages that block CORS require a proxy you control.
2. YouTube transcript extraction generally requires a configured transcript service.
3. Audio transcription requires a configured transcription service.
4. A closed browser cannot continuously watch local folders.
5. File/folder permissions can require re-approval.
6. Browser storage can be cleared; export backups for important notebooks.
7. Analysis Lab is a restricted local calculation sandbox, not a full Python environment.
8. Audio Overview uses browser speech synthesis for playback rather than producing an MP3 file.
9. Collaboration/sharing is intentionally not included in this release.

## Security principles
- Source documents are treated as untrusted evidence, not executable instructions.
- Model and imported Markdown is HTML-escaped before rendering.
- PDF scripting/eval is disabled.
- Hosted AI and research-service tokens are memory-only.
- Backup imports validate schema/records before replacing browser data and roll back on failure.
- Research URLs are limited to HTTP/HTTPS.
- Analysis Lab blocks network/storage/global escape primitives and terminates long-running workers.
- Service-worker cache versioning and build handshakes protect against mixed stale deployments.

