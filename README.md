# Project Controls AI Suite / Schedule AI Toolkit v1.3.0

A static GitHub Pages-compatible project-controls workbench for Primavera P6 XER, Microsoft Project XML and Microsoft Project MPP-derived schedule analysis.

## Key behaviour

- **No AI is used by default.** AI can be enabled only from **Settings**. The top-right model field is read-only.
- Chat boxes send with **Enter** and insert a new line with **Shift+Enter**.
- Uploaded schedules are treated as **independent files/projects** unless the user explicitly selects them together in a comparison, lineage, forensic or time-machine view.
- XER and Microsoft Project XML are parsed in-browser.
- Binary `.mpp` files use the included **local MPP parser bridge**, then are normalised into the same internal schedule model used by XER/XML.

## GitHub Pages

This site is intentionally static. No API key should be embedded in the repository.

1. Copy the **contents** of this package into the repository root.
2. Push to `main`.
3. In **Repository Settings → Pages**, select **GitHub Actions** as the source.
4. The included `.github/workflows/pages.yml` runs `npm run test:exhaustive` before deployment.
5. Deployment proceeds only when the test job passes.

The included `.nojekyll` file prevents Jekyll processing.

## Local Ollama (optional)

AI remains off until explicitly selected. For a free/local model:

1. Run `setup-ollama.bat`, or install/start Ollama yourself.
2. Open **Settings → Ollama**.
3. Use **Check Ollama**.
4. Select the Ollama model in Settings and click **Apply model**.

Default local endpoint: `http://localhost:11434`.

For a hosted GitHub Pages site, the browser must be permitted to reach the local Ollama service and `OLLAMA_ORIGINS` must allow the Pages origin. The supplied BAT file explains/configures the local Windows setup.

## Microsoft Project `.mpp` import

A browser-hosted GitHub Pages site cannot reliably decode Microsoft Project's proprietary binary MPP format using ordinary browser JavaScript alone. v1.3 therefore keeps the conversion **local on the user's PC** and does not upload the MPP file to a paid/cloud service.

### Windows setup

1. Keep the complete package folder structure, including `tools/`.
2. Run `setup-mpp-bridge.bat`.
3. The helper checks for Node.js 20+, installs the local parser dependency under `tools/`, and starts the parser at `http://127.0.0.1:8765`.
4. Leave that command window open while importing `.mpp` files.
5. In the site, import or link the MPP file normally. The site sends the binary file to the **local loopback parser only**, receives MSPDI XML, and parses it into the internal schedule model.
6. Use **Schedule Assessment → Activity Register → Edit this schedule in Schedule Builder** to copy the parsed schedule into the editable builder.

The converted model includes WBS/summary hierarchy, activities, milestones, dates/durations, constraints, calendars, predecessor links, resources, assignments, work/units and cost fields where present in the source MSPDI data.

## v1.3 Schedule Assessment highlights

- Explicit schedule dropdowns for Schedule Comparison, Week-on-Week, Delay Analysis, Baseline & Lookahead, Time Machine and multi-schedule Forensic Review.
- Critical Path and WBS/Gantt have weeks/months/quarters/years timescales, relationship links, and a draggable WBS/Activity band.
- Logic & Health and Forecast Confidence expose definitions on hover.
- DCMA-style checks include visual quality graphics beneath the statistics.
- S-Curve/Histogram can be based on activities, units/man-hours, cost or a selected resource; chart points/bars show exact hover values and Friday week-ending labels.
- Nodes have relationship/issue hover details and zoom controls.
- Baseline & Lookahead shows four-week activity detail grouped by WBS.
- Schedule Narrative includes phase/WBS, resource/manpower, cost, near-term work and roadblock commentary.

## NotebookLM+

NotebookLM+ now has **Chat** and **Outputs** tabs. Outputs include:

- downloadable HTML project-controls report;
- downloadable SVG schedule summary graphic;
- downloadable activity-data CSV;
- audio-ready briefing script with local browser speech playback and downloadable text script.

The browser SpeechSynthesis API can speak text but does not reliably expose its generated audio bytes, so the site does not falsely offer a WAV/MP3 download that it cannot produce.

## AI architecture

AI configuration is centralised in **Settings**. The supported catalogue can include browser CPU/WASM, WebGPU/WebLLM and Ollama models, but **No AI** is the startup/default state. Unsupported saved browser GPU selections can fall back safely rather than leaving chat controls unusable.

Checked Project Repository files are shared context across the toolkit. Parsed schedules are exposed through structured schedule-query tools so large XER/XML/MPP schedules do not need to be injected wholesale into every prompt.

## Tests

Normal regression suite:

```bash
npm test
```

Full release suite:

```bash
npm run test:exhaustive
```

The full suite covers parser fuzzing, large XER volume tests, deep network tests, comparison/forensic functions, Monte Carlo determinism, Ollama compatibility/failure handling, repository isolation, AI context integration, GitHub Pages import/dependency checks, security contracts, MSPDI golden parsing, v1.2 regressions and v1.3 request-specific contracts.

See `V1_3_VALIDATION_REPORT.md` and `CHANGELOG_V1_3.md` for release detail.
