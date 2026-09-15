# Project Controls AI Suite v3.0.1

A static, browser-based project-controls, schedule-analysis and forensic-planning workbench designed for GitHub Pages. Project files and parsed schedule data are kept in the browser project repository unless the user explicitly calls a configured cloud AI provider.

## Deploy to GitHub Pages

1. Copy the contents of this package to the root of the GitHub repository.
2. Keep the supplied `assets/`, `src/` and `tools/` folders in place.
3. Enable GitHub Pages, or use the included Pages workflow.
4. Open the deployed HTTPS URL rather than `file://` so browser storage, modules and local-network permissions behave normally.

The application header is marked **v3.0.1** and static assets use the `v=3.0.1` cache key.

### v3.0.1 alignment patch

- Gantt activity rows now use one shared row-height value on both the table and timeline, with table text and milestones vertically centred on the same row centreline as activity bars.
- Resource/forensic assignment tables resolve P6 activity internal IDs back to visible Activity ID + Activity Name and display Resource ID + Resource Name where the source schedule contains the name.
- Resource delta evidence now retains budget, actual, remaining and at-completion deltas consistently.

## Schedule analysis and controls

- Primavera P6 XER and Microsoft Project XML/MSPDI parsing in-browser.
- Local MPP bridge for `.mpp` conversion to MSPDI XML.
- Full WBS/Gantt hierarchy with P6 WBS ordering, collapsible WBS bands, configurable fields/bars and locally saved named layouts.
- Activity Register, Activity Inspector, Schedule Issue Register and cross-report activity links.
- Complete DCMA/NASA-style 14-point schedule assessment with PASS/FAIL/N/A, drill-down and configurable QA profiles.
- Progress-integrity checks for status, actual dates, data date, expected finish, remaining duration and suspend/resume contradictions.
- Week-on-Week change register covering progress, forecast dates, actual dates, additions/deletions and adverse highlighting.
- Schedule Comparison, Why Date Moved, Delay Analysis, Critical Path, Float/Longest-Path Explorer and network analysis.
- Multi-revision Forensic Review with collapsible Activities, Progress, Resourcing, Calendars and Relationships evidence plus an Activity Revision Matrix.
- Contemporaneous Windows Analysis, Logic Change Explorer, Calendar Difference Viewer and Resource Forensics.
- Multi-baseline manager for BL1/BL2/BL3 against a selected current/status schedule.
- Forensic Evidence Pack ZIP export with CSV evidence and SHA-256 source hashes when the source blobs are available.
- S-curves, histograms, resource/cost analysis, EVM, forecast confidence, narratives, milestone control and data-centre readiness.

## Interactive analytical charts

Charts support grouped, stacked, 100% stacked, horizontal, line and area views; series show/hide; search; sort; Top-N; date filters; day/week/month/quarter/year aggregation on dated data; thresholds; average lines; zoom; value labels; full-screen; drag-to-focus for dated charts; and CSV/SVG/PNG export.

## Measurement and BOQ alignment

The Drawing Measurement page has separate repository trees for drawings and the BOQ target. CSV/XLS/XLSX BOQs can be updated, or a new BOQ can be created. Optional **Align to schedule** uses a selected XER/XML/PDF schedule to add `Recommended Activity ID(s)` without overwriting manually assigned Activity IDs.

## AI providers

**No AI is selected by default.** Settings supports local/browser models and bring-your-own-key cloud providers:

- Ollama (local)
- Browser CPU/WASM and WebGPU models where supported
- Gemini
- xAI / Grok
- OpenAI
- Anthropic Claude
- DeepSeek
- NVIDIA NIM
- Custom OpenAI-compatible endpoint

OpenAI-compatible providers can optionally refresh model identifiers from a `/models` endpoint; manual model entry always remains available. API keys are stored only in that browser profile and are never included in this package. For a public multi-user deployment, use a backend/Worker proxy rather than exposing long-lived provider keys in browser storage.

## Local helpers

- `setup-ollama.bat` configures the optional local Ollama workflow on Windows.
- `setup-mpp-bridge.bat` starts the local `.mpp` parser bridge. The helper under `tools/` requires Node.js 20+.

## Source layout

- `src/core/` — canonical schedule model, utilities and ZIP writer.
- `src/parsers/` — XER, MSPDI/XML and PDF schedule parsing.
- `src/repository/` — IndexedDB project/file/schedule persistence.
- `src/analysis/` — health, DCMA, QA profiles, comparison, forensic, progress, risk, network, time-series, resource and calendar logic.
- `src/measurement/` — BOQ update/alignment logic.
- `src/ai/` — model catalogue and provider/runtime adapters.
- `src/ui/` — application controller, state, renderers and chart workbench.
- `src/workers/` — large-calculation Web Workers.
- `assets/` — application stylesheet.
- `tools/` — optional local MPP helper.

## Important interpretation notes

DCMA-style results are internal analytical screening, not official certification. The Critical Path Test is a deterministic network-recalculation proxy and does not reproduce every native P6 calendar/constraint calculation. Analytical float paths are derived from the normalized logic network unless native float-path data is explicitly present. Automatically identified delay/forensic observations are schedule evidence, not automatic conclusions on contractual entitlement, causation or responsibility. Calendar/public-holiday profiles and all contractual conclusions must be verified against the governing project documents.
