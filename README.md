# Project Controls AI Suite / Schedule AI Toolkit

A static, GitHub Pages-compatible project-controls workbench for Primavera P6 XER and Microsoft Project XML analysis.

## GitHub Pages

This rebuild is intentionally static. There is no server build step and no API key should be embedded in the site.

### Recommended deployment

1. Create or use your GitHub repository.
2. Copy the **contents** of this package into the repository root.
3. Push to the `main` branch.
4. In **Repository Settings → Pages**, select **GitHub Actions** as the Pages source.
5. The included `pages.yml` workflow runs the exhaustive test suite before deployment.
6. A deployment only proceeds when the test job passes.

The included `.nojekyll` file prevents Jekyll processing.

## Ollama

Default local endpoint:

`http://localhost:11434`

Use **Settings → Ollama → Check Ollama**.

If Ollama is not detected, the toolkit explains the three likely cases:
- Ollama is not installed;
- Ollama is installed but not running;
- the hosted GitHub Pages origin is not permitted to reach the local service.

For a GitHub Pages deployment, configure Ollama to permit the exact Pages origin with `OLLAMA_ORIGINS`, then restart Ollama.

## AI architecture

There is one global AI selector in the suite header.

AI configuration belongs in **Settings** only. Mini-tools do not maintain independent model selectors or conflicting model status indicators.

Checked Project Repository files are shared context across the toolkit. Parsed schedules are additionally exposed to the AI through structured schedule-query tools so large XER files do not need to be placed wholesale into every prompt.

## Tests

Normal:

```bash
npm test
```

Exhaustive:

```bash
npm run test:exhaustive
```

The exhaustive suite includes parser fuzzing, large XER volume tests, deep network tests, Monte Carlo determinism, Ollama compatibility/failure handling, repository isolation, AI context integration, GitHub Pages dependency checks, security contracts, and the master feature-completeness contract.


## Restored browser AI catalogue

The global AI dropdown now contains the full browser model catalogue again:

- Browser CPU/WASM — Qwen2.5 0.5B
- Browser CPU/WASM — Llama 3.2 1B
- Browser WebGPU — Qwen2.5 0.5B
- Browser WebGPU — Qwen2.5 1.5B
- WebLLM — Qwen2.5 1.5B
- WebLLM — Qwen2.5 3B
- WebLLM — Qwen3 8B
- WebLLM — Llama 3.2 1B
- WebLLM — Llama 3.2 3B
- WebLLM — Phi 3.5 Mini
- WebLLM — Llama 3.1 8B
- Ollama — selected local model

The lightweight Qwen2.5 0.5B CPU/WASM model is the safe first-run default. An unsupported saved WebGPU selection automatically falls back to CPU/WASM rather than leaving the chat in a broken state.

Browser models report both first-load/download progress and response-generation progress.

Raw XER contents are no longer injected wholesale into small browser-model prompts. The AI receives compact schedule portfolio metadata, structured schedule-tool results, and bounded relevant excerpts from checked non-schedule project files.

## Live browser acceptance

Automated release tests use deterministic browser-AI/Ollama mocks and production routing code. A real graphics/WebGPU model cannot be certified without the end user's actual browser/GPU. After GitHub Pages deployment, use **Settings → Global AI Model → Test selected browser AI** for each browser model you intend to use.

If WebGPU is unavailable, the toolkit will explain this before chat execution and the CPU/WASM model remains available.


## v1.2.0 behaviour

The site starts with **No AI**. To enable AI, open **Settings**, choose a model, and click **Apply model**. For a fully local/free option, use Ollama and the included `setup-ollama.bat` Windows helper. The top-right AI field is intentionally read-only so model changes can only be made from Settings.

Chat boxes send with **Enter** and create a new line with **Shift+Enter**.


## v1.2.1 Schedule Assessment fixes

- **Activity Register:** column boundaries are now visibly draggable. Widths persist in the browser using local storage.
- **Critical Path:** the Critical / zero-float activity table now uses fixed `<colgroup>` widths with explicit drag handles; widths persist between visits.
- **Milestone Control:** milestone recognition now checks normalized activity type, legacy/raw XER `task_type`, and stored schedules are re-hydrated when loaded. This covers Primavera codes including `TT_Mile`, `TT_StartMile`, and `TT_FinMile` and fixes older schedules already stored in IndexedDB.
- Asset cache-busting updated to **v1.2.1** for GitHub Pages.
