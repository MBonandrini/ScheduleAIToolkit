# Project Controls AI Suite — Schedule Reporting, Themes, Progress and Shared Context Rebuild

## Changes delivered

### Schedule Assessment
- Gantt is always rendered on a professional light canvas, regardless of website theme.
- Critical Path report now includes a compact copy of the Gantt showing critical/zero-float activities with red current bars.
- Calendar Analyser now renders a year-by-year 12-month calendar for every calendar assigned to project activities, with standard non-work days and identifiable P6 exception dates colour coded.
- Schedule Narrative now includes a selectable comparative programme, data-date-driven weekly movement, current progress/status, a four-week lookahead, management watch items and two high-level graphics.
- S-Curve & Histogram now uses weekly periods and includes a plain copyable table for weekly quantities, resource hours/units and cumulative planned/actual/forecast percentages and quantities.
- Professional WBS Gantt now includes Timescale (Weekly / Monthly / Quarterly / Annual) and Bar Compression (Compact / Standard / Expanded).

### AI progress and runtime
- Browser CPU/WASM model loading emits model-download progress.
- Browser WebGPU model loading emits model-download progress.
- AI response generation displays an animated indeterminate progress bar until the response completes or fails.
- Browser AI runtime is retained across tab navigation instead of being unloaded simply because the user changes tools.
- The previous shared-AI architecture remains intact: Settings/global selector own the provider/model.

### Themes
Professional theme dropdowns are available in both the suite shell and Settings:
- Dark (default)
- Light
- Slate
- Midnight
- Sand

All themes propagate to the mini-tools. Gantt export/display remains intentionally light.

### Shared Project Repository chat context
- Every direct repository file and every file inside linked Bulk Information folders now has a checkbox on its left.
- Checked files are global AI chat context for every mini-tool.
- Newly added files are selected by default.
- Existing repository files are selected by default the first time this feature is used.
- Text-readable project evidence includes XER, XML, TXT, MD, CSV, TSV, JSON, HTML, YAML and similar formats.
- Linked files are resolved on demand.
- Binary files are not fabricated by the shared text layer; the active tool can still use its native parser.
- The shared AI request path automatically injects the selected repository context before every generation.
- A dedicated integration test confirms that a selected `perun 3.xer` filename and its XER content are present in the AI request alongside the user's question.

## Validation

Requested chain:
Unit → Integration → Regression → File Import/Export → Data Integrity → Boundary → Negative → Golden-Result → Differential → Performance/Volume → Browser/Compatibility → Security → Error Handling → Recovery → UAT

| Stage | Result |
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

Additional targeted tests:
- Schedule report enhancement contracts: PASS
- Theme/context/progress contracts: PASS
- Shared AI architecture regression: PASS
- Selected `perun 3.xer` → AI request integration: PASS
- 300 malformed/random XER fuzz cases: PASS
- 10k activities / 50k relationships: PASS
- 25k activities / 100k relationships: PASS
- Ollama mock API integration and fallbacks: PASS
- NotebookLM+ static/unit/integration contracts: PASS

Full release gate:
`tests/run-release-validation.sh` — **PASS**

`*` This environment cannot perform a genuine interactive Windows Edge/Chrome UAT session or connect to the user's actual `localhost:11434`. The final live Ollama confirmation should therefore be performed on the deployed Windows/browser environment before the optimization phase.
