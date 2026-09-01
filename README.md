# Project Controls AI Suite

## Structure

- `index.html` — application shell and top navigation
- `assets/css/shell.css` — shell-only styling
- `assets/css/shared.css` — common design system used by all tools
- `assets/js/core.js` — shared document parser, schedule model, AI service, and risk engine
- `assets/js/shell.js` — tab navigation and application lifecycle
- `apps/contract-manager/` — Contract Manager feature
- `apps/drawing-measurement/` — Drawing Measurement feature
- `apps/schedule-assessment/` — Schedule Assessment, Gantt, Monte Carlo, Week-on-Week and comparison reports
- `apps/schedule-builder/` — Schedule Builder feature

## GitHub Pages

Upload the complete folder contents to the repository root. `index.html` must remain at the root and the `assets` and `apps` folders must keep their relative paths.

## Local testing

Because the suite uses JavaScript modules and iframe access, test it through a local web server or GitHub Pages rather than opening `index.html` directly with a `file://` URL.


## OmniRoute AI (default)

The suite uses OmniRoute as the default shared AI gateway. The default route is `auto` at `http://localhost:20128/v1`. Use **AI Settings** to change the OmniRoute base URL. Provider authentication is configured inside OmniRoute; the website does not request an OmniRoute endpoint API key.

Available OmniRoute routes in every AI-enabled tool are `auto`, `auto/smart`, `auto/fast`, `auto/cheap`, `auto/coding`, and `auto/offline`. Browser CPU/WASM and WebGPU models remain optional and display a RAM/performance warning before loading.

For an HTTPS GitHub Pages deployment, a browser may block calls to an HTTP local endpoint. If that happens, expose OmniRoute through an HTTPS reverse proxy or remote deployment and enter its `/v1` URL in **AI Settings**. Configure OmniRoute CORS to allow the GitHub Pages origin.
AI model selectors are generated from `assets/js/core.js` through `assets/js/ai-options.js`, so every application exposes the same OmniRoute, hosted, lightweight browser, CPU/WASM, routed WebGPU, and direct MLC options.

## Stark White interface

The default interface is Stark White: white and ice-blue surfaces, navy typography and electric-blue controls. Use the moon/sun toggle in the suite header or inside any tool to switch between Stark White and the deep-navy command theme. The choice is shared across the suite and saved in browser local storage.

AI defaults to OmniRoute Auto. Provider credentials are configured in OmniRoute itself. Browser and local model choices display a memory warning before loading. Puter has been removed. Proprietary Schedule AI Toolkit and Ollama are visible as disabled future integrations. Schedule Assessment includes a Nodes & Links report with tabbed network analysis.


Claims & Forensics is available as a fifth suite tab and shares the ScheduleContractManagementDB browser repository with Contract Manager.


## Shared Project Repository
Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis and Claims & Forensics share the shell-level left repository. Schedule Builder remains independent.

## Global Theme
Light/dark mode is controlled only from the main suite navigation. All application pages follow the shell theme.


## Master Schedule Intelligence Expansion

Schedule Assessment now includes a searchable Schedule Viewer/Activity Inspector, What Changed dashboard, Critical Path Intelligence, Why Did My Date Move?, dedicated Float/Logic/Progress analysis, Time Machine, Milestone Trends, Forecast Stability, Resources/EVM/Productivity, Calendar/Constraint/Baseline analysis, Lookahead, evidence-based Narrative, Executive Dashboard, Import Diagnostics, configurable thresholds, Excel export and portable project backup/restore. See `MASTER_FEATURE_MATRIX.md` and `SOFTWARE_VALIDATION_REPORT.md`.


## Tutorial / AI Setup

The suite now includes a top-level **Tutorial / AI Setup** workspace.

It provides guided setup and connection testing for:

- OmniRoute
- Ollama
- CPU/WASM browser AI
- WebGPU browser AI

Ollama is now a working shared AI provider. The toolkit discovers installed Ollama models using `/api/tags` and uses `/api/chat` for completions.

See `AI_SETUP_GUIDE.md` for deployment details.


## NotebookLM+

The suite includes NotebookLM+ as a separate top-level workspace for document/notebook research. It retains its notebook/source/indexing architecture while sharing the suite shell and global theme.

NotebookLM+ AI options include:

- Ollama local or remote
- OmniRoute Auto / routed AI
- Generic OpenAI-compatible hosted AI

See `NOTEBOOKLM_INTEGRATION.md` and the NotebookLM+ in-app tutorial for configuration.


## Restored configuration workspaces — 1 September 2026

The combined suite includes three dedicated utility workspaces in the top navigation:

- **AI / Ollama Configuration** — configure/test OmniRoute and Ollama.
- **Setup Tutorial** — guided connection and troubleshooting instructions for OmniRoute, Ollama and browser-local AI.
- **Settings** — global theme, shared AI status, browser AI release and connection-reset controls.

The compact **AI Settings** button in the shell is retained as a quick OmniRoute diagnostic shortcut.
