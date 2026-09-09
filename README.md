# Planning Engine — GitHub Edition (Free AI Only)

A browser-native planning, estimating and schedule-generation workbench designed for GitHub Pages.

## Important: there are no paid AI services in this edition

The application contains **no OpenAI/Anthropic/Gemini API integration, no paid proxy, no API-key field and no Cloudflare AI worker**.

The optional AI modes are:

1. **Offline / deterministic only** — default. No AI is used.
2. **Local Ollama** — free local inference on the user's own computer.
3. **Browser AI (WebLLM/WebGPU)** — free in-browser inference. Model weights are downloaded on first use and cached locally by the browser.

The planning engine itself — WBS generation, quantities, man-hours, CPM, logic and QA — works without AI.

## Files

- `index.html` + `styles.css` + `js/` — maintainable GitHub Pages deployment.
- `PlanningEngine.html` — self-contained single HTML build.
- `FREE_AI_SETUP.md` — setup instructions for Ollama and browser AI.
- `tests/` — deterministic planning and free-AI adapter tests.

## What it does

- Maintains Current Information and Previous Reference Documents trees.
- Stores imported files locally in IndexedDB.
- Reads TXT/CSV/XER/XML/MPX/DXF/IFC directly.
- Reads XLSX/XLSM through SheetJS, DOCX through Mammoth and PDF text through PDF.js.
- Parses BOQ quantities/norms and scope systems/areas.
- Parses XER history for durations and relationship patterns.
- Generates WBS, activities, procurement chains, quantities, man-hours and CPM logic.
- Calculates FS/SS/FF/SF relationships, dates, total float and critical activities.
- Runs deterministic QA and constructability checks.
- Continues working when drawings, BOQ, scope or historical schedules are missing.
- Generates missing-information questions.
- Exports project JSON and CSVs.

## Local run

```bash
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

## GitHub Pages

Upload the package contents to the repository root and enable **Settings → Pages → Deploy from a branch → main / root**.

## Browser limitations

- `.mpp`: export to XER/XML/MPX for browser analysis.
- DWG: use PDF/DXF/IFC.
- Folder access is permissioned/imported; the browser cannot silently crawl local folders.
- Browser WebGPU AI requires a compatible modern browser/device and enough memory for the selected model.
- Browser AI model downloads can be large. The light Llama 3.2 1B preset is roughly 0.9 GB of VRAM at runtime according to WebLLM's current model configuration.
- For weak/non-WebGPU machines, use Ollama or Offline mode.

## Tests

```bash
node --test tests/*.test.mjs
```
