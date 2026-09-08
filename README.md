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






## Stark White interface

The default interface is Stark White: white and ice-blue surfaces, navy typography and electric-blue controls. Use the moon/sun toggle in the suite header or inside any tool to switch between Stark White and the deep-navy command theme. The choice is shared across the suite and saved in browser local storage.



Claims & Forensics is available as a fifth suite tab and shares the ScheduleContractManagementDB browser repository with Contract Manager.


## Shared Project Repository
Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis and Claims & Forensics share the shell-level left repository. Schedule Builder remains independent.

## Global Theme
Light/dark mode is controlled only from the main suite navigation. All application pages follow the shell theme.


## Master Schedule Intelligence Expansion

Schedule Assessment now includes a searchable Schedule Viewer/Activity Inspector, What Changed dashboard, Critical Path Intelligence, Why Did My Date Move?, dedicated Float/Logic/Progress analysis, Time Machine, Milestone Trends, Forecast Stability, Resources/EVM/Productivity, Calendar/Constraint/Baseline analysis, Lookahead, evidence-based Narrative, Executive Dashboard, Import Diagnostics, configurable thresholds, Excel export and portable project backup/restore. See `MASTER_FEATURE_MATRIX.md` and `SOFTWARE_VALIDATION_REPORT.md`.


## Settings, AI Setup and Tutorial

The suite now has one top-level **Settings** workspace. It contains three internal sections:

- **General Settings** — theme, AI runtime status and reset controls.

The selected AI option is global. Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis, Claims & Forensics, Schedule Builder and NotebookLM+ all read the same selection. Individual modules do not persist their own AI provider choice.

Ollama model discovery uses `/api/tags` and chat uses `/api/chat`. See `AI_SETUP_GUIDE.md` for deployment details.


## NotebookLM+

NotebookLM+ remains a separate top-level research workspace, but its AI provider is now controlled by the suite-wide **Settings → Unified AI Configuration** selection. Its visible application tabs are Workspace and Studio; its former local AI configuration/tutorial/settings tabs have been consolidated into the main suite Settings workspace.


See `NOTEBOOKLM_INTEGRATION.md`.


### Bulk Information
The shared project pane now supports collapsible linked folders under **Bulk Information**. On supported Chromium/Edge browsers, **Link folder** retains a read-only local directory handle and resolves individual files only when the user presses **Use**. A directory-selection snapshot fallback is provided for browsers without the File System Access API. Linked folders can be refreshed or unlinked without modifying files on disk.


### Shared AI runtime settings
Settings → General Settings contains the suite-wide AI runtime controls. These include Qwen/Ollama reasoning mode and timeout/fallback, generation sampling, token/context limits, request/model-load/streaming timeouts, retry policy, Ollama keep-alive, and empty-response recovery. The settings apply to every module using the global AI selection.


## Shared AI runtime architecture

AI provider/model configuration is global. Configure Ollama or another enabled engine in **Settings → Unified AI Configuration**, then use the top-right suite selector. Individual tools do not load or configure their own model and do not display local-model consent prompts.

Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis, Claims & Forensics, Schedule Builder and NotebookLM+ all execute chat/generation through the shared `ProjectControlsCore.ai` runtime. NotebookLM+ retains its specialist document retrieval/RAG pipeline but hands the assembled prompt to the same shared runtime.

Opening or changing tabs never intentionally loads Ollama. Ollama is contacted when an explicit AI operation is run, and its lifetime is controlled by the global keep-alive setting.
