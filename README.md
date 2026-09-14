# Project Controls AI Suite v2.1.1

A static, browser-based project-controls toolkit designed for GitHub Pages. The application works primarily in-browser and stores project/repository data in the browser's IndexedDB/local storage.

## Deploy to GitHub Pages

1. Copy the contents of this package to the root of your GitHub repository.
2. Keep the supplied folder structure (`assets/`, `src/`, `tools/`).
3. Enable GitHub Pages for the repository, or use the included Pages workflow if your repository deploys through GitHub Actions.
4. Open `index.html` through the GitHub Pages URL. Do not open it directly from the local filesystem for normal use because browser security rules differ for `file://` pages.

The application is marked **v2.1.1** in the header. Static assets use the `v=2.1.1` cache key.

## Supported schedule/file workflows

- Primavera P6 XER: parsed in-browser.
- Microsoft Project XML/MSPDI: parsed in-browser.
- Microsoft Project MPP: use the local MPP bridge (`setup-mpp-bridge.bat`). The bridge converts MPP to MSPDI XML locally; the browser then uses the standard XML parser.
- PDF schedule alignment: requires a readable PDF text layer.
- BOQ alignment: CSV is native; XLS/XLSX uses the browser spreadsheet helper when needed.

## Optional AI providers

No AI is selected by default. Configure a provider from **Settings** before using AI-assisted features.

Supported routes include:

- Local Ollama (`setup-ollama.bat`)
- Browser-local models where supported by the browser/device
- Gemini
- xAI / Grok
- OpenAI
- Anthropic Claude

Cloud API keys entered in Settings are stored in that browser profile's local storage and are not included in this source package. For a multi-user production deployment, route cloud calls through a server-side proxy rather than exposing long-lived keys in client-side storage.


## Schedule Builder generation pipeline

The final Schedule Builder generation now runs a visible nine-stage sequence after the AI draft: WBS build, calendar build, structured activity naming/smart IDs, calendar assignment, duration assignment, logic assignment, milestone-fit checking, logic testing, and final detailed checks/repairs. Structured activity names use the pattern `Area - Elevation - Discipline - Service - Step`, while generated IDs include responsibility and discipline codes.

## Monte Carlo options

Risk Analysis supports configurable iterations, random seed, uncertainty range, Triangular/Beta-PERT/Normal/Uniform duration distributions, target activity/milestone, target completion date, custom percentile, histogram resolution, mapped Risk Register impacts, and remaining-work-only simulation. Results include a completion-outcome histogram with P50/P80/planned markers plus the probability of meeting the selected target date.

## Local Ollama

Run `setup-ollama.bat` on Windows, then use **Settings → Ollama** to check connectivity and select a local model. GitHub Pages-to-loopback access depends on browser local-network permissions and the configured `OLLAMA_ORIGINS` value.

## Local MPP bridge

Run `setup-mpp-bridge.bat`. The helper under `tools/` requires Node.js 20+ and the dependency declared in `tools/package.json`.

## Source layout

- `src/core/` — canonical schedule model and shared utilities
- `src/parsers/` — XER, MSPDI/XML and PDF schedule parsing
- `src/repository/` — IndexedDB project/file/schedule persistence
- `src/analysis/` — health, comparison, forensic, risk, network, time-series and calendar logic
- `src/builder/` — deterministic Schedule Builder generation/validation pipeline
- `src/measurement/` — BOQ update/alignment logic
- `src/ai/` — model catalogue and provider/runtime adapters
- `src/ui/` — application controller, UI state and renderers
- `src/workers/` — large-calculation Web Workers
- `assets/` — application stylesheet
- `tools/` — optional local MPP helper

## Notes

Public-holiday profiles and automatically identified forensic/delay observations are planning aids. Project calendars, shutdowns, contractual entitlement, causation and responsibility must still be verified against the governing project documents.
