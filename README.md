# Project Controls AI Suite / Schedule AI Toolkit v1.4.0

A static GitHub Pages-compatible project-controls workbench for Primavera P6 XER, Microsoft Project XML and Microsoft Project MPP-derived schedule analysis.

## Key behaviour

- **No AI is used by default.** AI can be enabled only from **Settings**. The top-right model field is read-only.
- Chat boxes send with **Enter** and insert a new line with **Shift+Enter**.
- Uploaded schedules are treated as **independent files/projects** unless the user explicitly selects them together in a comparison, lineage, forensic or time-machine view.
- XER and Microsoft Project XML are parsed in-browser.
- Binary `.mpp` files use the included **local MPP parser bridge**, then are normalised into the same internal schedule model used by XER/XML.

## GitHub Pages

This site remains a static GitHub Pages application. No API key is embedded in the repository or release package.

1. Copy the **contents** of this package into the repository root.
2. Push to `main`.
3. Use your existing GitHub Pages deployment configuration.
4. Keep the included `.nojekyll` file in the repository root.

Asset URLs are cache-bumped to `v=1.4.0` so browsers request the revised JavaScript/CSS after deployment.

## AI options

AI is disabled until the user selects a model in **Settings**.

Available categories include:
- local Ollama;
- browser CPU/WASM;
- browser WebGPU/WebLLM where supported;
- Google Gemini using the user's own API key;
- xAI Grok using the user's own API key.

### Gemini / Grok locally stored keys

Settings now contains password boxes for Gemini and Grok API keys plus editable model names. The user can **Save locally**, **Test**, or **Clear** each key. Keys are stored in that browser profile's `localStorage`; they are not committed to Git and are not inserted into source files.

Default cloud model names in v1.4.0:
- Gemini: `gemini-3.8-flash`
- Grok: `grok-4.6`

**Security note:** browser-local storage is persistent and convenient, but a long-lived API key in a browser is not a server-side secret. For a production/shared deployment, a backend/Worker proxy with server-side secret storage is safer. The direct local-key option is retained because this build is designed to let an individual user bring their own key on their own computer.

## Local Ollama (optional)

1. Run `setup-ollama.bat`, or install/start Ollama yourself.
2. Open **Settings → Ollama**.
3. Use **Check Ollama**.
4. Select the Ollama model in Settings and click **Apply model**.

Default local endpoint: `http://localhost:11434`.

For a hosted GitHub Pages site, the browser must be permitted to reach the local Ollama service and `OLLAMA_ORIGINS` must allow the Pages origin. The supplied BAT file explains/configures the local Windows setup.

## Microsoft Project `.mpp` import

A browser-hosted GitHub Pages site cannot reliably decode Microsoft Project's proprietary binary MPP format using ordinary browser JavaScript alone. The supplied local bridge keeps conversion on the user's PC and does not upload the MPP file to a paid/cloud service.

### Windows setup

1. Keep the complete package folder structure, including `tools/`.
2. Run `setup-mpp-bridge.bat`.
3. The helper checks for Node.js 20+, installs the local parser dependency under `tools/`, and starts the parser at `http://127.0.0.1:8765`.
4. Leave that command window open while importing `.mpp` files.
5. Import or link the MPP file normally. The site sends the binary file to the **local loopback parser only**, receives MSPDI XML, and parses it into the internal schedule model.
6. Use **Schedule Assessment → Activity Register → Edit this schedule in Schedule Builder** to copy the parsed schedule into the editable builder.

The converted model includes WBS/summary hierarchy, activities, milestones, dates/durations, constraints, calendars, predecessor links, resources, assignments, work/units and cost fields where present in the source MSPDI data.

## v1.4 Schedule Assessment highlights

### Schedule Comparison
The comparison now covers:
- activities;
- relationships;
- calendar master data and activity calendar assignment changes;
- resource master data;
- activity/resource assignment and loading changes.

Deleted activities, relationships, calendars, resources and assignments are shown in red.

### Critical Path and WBS/Gantt
Both views now provide:
- Weeks / Months / Quarters / Years timescale selection;
- explicit Timescale Start and Timescale Finish date controls;
- Full Range reset;
- adaptive timescale text that shrinks/rotates when segments are narrow;
- orthogonal P6-style dependency lines;
- draggable WBS/Activity width;
- relationship-line visibility control.

### DCMA-style checks
The visual section now uses threshold graphics rather than arbitrary decorative chart types. Every visual compares the measured value directly with its applicable limit and displays the PASS/FAIL result.

### Schedule Narrative
The narrative includes a collapsed activity-detail register containing all activities. Critical and zero-float activity values are red.

Other v1.3 functionality remains: explicit schedule dropdowns for comparison views, multi-schedule Forensic Review, S-Curve/Histogram basis selection, exact chart hover values, Friday week-ending labels, smarter Nodes, Time Machine, and detailed Baseline & Lookahead.

## NotebookLM+

NotebookLM+ is now a two-pane workspace:
- **left:** project chat, with the message composer kept at the bottom of the available centre-pane height;
- **right:** an Outputs studio.

There is no separate Outputs tab. The output studio provides:
- Report → custom prompt → HTML preview/download;
- Graphic → custom prompt → SVG preview/download;
- Data Extract → custom prompt/filter → CSV download;
- Audio Brief → custom prompt → local speech playback + text-script download.

If AI is enabled, Report and Audio customisation can use the selected model. With No AI selected, deterministic schedule outputs still work.

## Tests

Normal regression suite:

```bash
npm test
```

Full release suite:

```bash
npm run test:exhaustive
```

The full suite covers parser fuzzing, large XER volume tests, deep network tests, comparison/forensic functions, Monte Carlo determinism, Ollama compatibility/failure handling, cloud-AI routing contracts, repository isolation, AI context integration, GitHub Pages import/dependency checks, security contracts, MSPDI golden parsing, v1.2/v1.3 regressions and v1.4 request-specific tests.

See `V1_4_VALIDATION_REPORT.md` and `CHANGELOG_V1_4.md` for release detail.
