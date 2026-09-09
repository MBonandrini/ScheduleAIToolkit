# Project Controls AI Suite / Schedule AI Toolkit v1.2.0

A static GitHub Pages-compatible project-controls workbench for Primavera P6 XER and Microsoft Project XML analysis.

## AI model architecture

There is **one global AI model selector** in the suite header. Settings owns configuration and diagnostics; mini-tools do not keep separate model selectors or status badges.

Restored browser model choices:

- Browser CPU/WASM — Qwen2.5 0.5B
- Browser CPU/WASM — Qwen2.5 1.5B
- Browser CPU/WASM — Llama 3.2 1B
- Browser WebGPU / Transformers.js — Qwen2.5 0.5B
- Browser WebGPU / Transformers.js — Qwen2.5 1.5B
- Browser WebGPU / Transformers.js — Llama 3.2 1B
- WebLLM — Llama 3.2 1B
- WebLLM — Llama 3.2 3B
- WebLLM — Llama 3.1 8B
- WebLLM — Phi 3.5 Mini
- Ollama — any installed chat-capable local model selected in Settings

The default is **Qwen2.5 0.5B CPU/WASM** because it works without WebGPU or Ollama. If a saved WebGPU model is opened in a browser without WebGPU support, the suite automatically falls back to the lightweight CPU model instead of leaving chat in a broken state.

### Browser AI downloads

Browser models download on first test/use and are cached by the browser. The bottom-right progress HUD reports download/loading progress and generation activity.

Transformers.js is pinned to `4.2.0` and WebLLM to `0.2.85`.

## Large schedule AI context

Raw XER/XML text is **not dumped into small browser-model prompts**. The AI receives:

1. structured schedule tool results;
2. a compact schedule portfolio/revision summary;
3. query-relevant excerpts from checked non-schedule repository files;
4. filenames/metadata for checked schedule files.

This fixes the ONNX Runtime `Gather` / `indices element out of data bounds` failure that occurred when multiple XERs pushed the Qwen context to the 32,768-token boundary.

## Project Repository

Checked files form the shared AI evidence context across the toolkit. XER/XML schedules are parsed automatically and become available as structured schedule evidence. The repository supports multiple projects, linked folders where the browser supports the File System Access API, and folder-upload fallback.

## Themes

The first-run/default theme is **Light · Dark Blue Contrast**. The header Theme dropdown also provides **Dark** and **Light**. The Gantt remains light in every theme for professional print/export readability.

## GitHub Pages deployment

1. Copy the contents of this package into the repository root.
2. Push to `main`.
3. In **Settings → Pages**, select **GitHub Actions** as the source.
4. The included deployment workflow runs the exhaustive release tests before Pages deployment.
5. `.nojekyll` is included.

All local JS module imports and worker URLs carry the v1.2.0 cache token so a new deployment does not mix old and new JavaScript modules.

### Ollama on GitHub Pages

Default local endpoint: `http://localhost:11434`.

Use **Settings → Ollama → Check Ollama**, then **Detect & classify**, choose a chat-capable model, and **Test & Save**.

If Ollama is not detected, the toolkit explains the three indistinguishable browser-side possibilities: not installed, installed but not running, or blocked by local-network/CORS policy. For GitHub Pages, allow the exact Pages origin in `OLLAMA_ORIGINS`, then restart Ollama.

## Tests

Normal:

```bash
npm test
```

Exhaustive:

```bash
npm run test:exhaustive
```

The suite covers parser regression/fuzzing, 50k/200k scale, deep network paths, deterministic Monte Carlo, schedule comparison, repository isolation, all AI agent roles, all restored browser-model routes, Ollama native/failure paths, the reported large-XER browser-AI regression, GitHub Pages import/deployment contracts, UI/theme contracts, security, and the master feature-completeness contract.
