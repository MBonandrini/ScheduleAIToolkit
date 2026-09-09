# Project Controls AI Suite v1.2.0 — Final Validation Report

## Release status

**AUTOMATED RELEASE GATE: PASS**

The rebuilt GitHub Pages toolkit passes the complete primary suite and exhaustive stress suite after the browser-AI failures shown in UAT were reproduced in regression tests and corrected.

## Browser-AI failures corrected

### 1. CPU/WASM Qwen `Gather` / out-of-bounds failure

Observed error:

`indices element out of data bounds, idx=32768 must be within the inclusive range [-32768,32767]`

Root cause: multiple selected XER files could be inserted as raw text into the prompt, allowing a small browser model to reach its context/index boundary.

Correction:
- raw XER/XML text is no longer placed into small browser-model prompts;
- checked schedule files contribute filename/metadata plus structured parsed schedule evidence;
- a compact portfolio/revision summary is generated for all current schedules;
- non-schedule text files use query-relevant excerpts with per-model budgets;
- history is restricted for small browser models;
- failed browser runtimes are released so the next attempt starts cleanly.

A regression test imports large XER revisions and asks the reported question, `What do you think about my current schedules?`. It verifies that the prompt remains below the browser safety budget, contains the schedule portfolio summary, contains the XER filenames, and does not contain raw `%T TASK` XER tables.

### 2. WebGPU selected where WebGPU is unavailable

Correction:
- WebGPU models are compatibility-checked before selection/use;
- unsupported WebGPU options are labelled unavailable in the global dropdown;
- a saved WebGPU selection automatically falls back to Qwen2.5 0.5B CPU/WASM on startup if WebGPU is not available;
- Settings exposes a model compatibility table and a live `Test selected browser AI` action;
- the inference runtime also validates that a WebGPU adapter can actually be obtained.

### 3. Model versions had disappeared from the global selector

The global catalogue is restored and grouped by execution engine. Verified model choices in this release are:

CPU/WASM / Transformers.js:
- Qwen2.5 0.5B
- Qwen2.5 1.5B
- Llama 3.2 1B

WebGPU / Transformers.js:
- Qwen2.5 0.5B
- Qwen2.5 1.5B
- Llama 3.2 1B

WebGPU / WebLLM:
- Llama 3.2 1B
- Llama 3.2 3B
- Llama 3.1 8B
- Phi 3.5 Mini

Ollama remains a separate global option and uses the chat-capable model selected in Settings.

Transformers.js is pinned to `4.2.0`; WebLLM is pinned to `0.2.85`.

## Shared AI architecture

PASS:
- one global AI model selector only;
- Settings owns model diagnostics/configuration;
- all mini-tools use the same shared runtime;
- no module-local model status/selector conflicts;
- all seven specialist roles were executed through the same selected browser model in regression testing;
- checked repository files are available to every AI role;
- parsed schedules are exposed through structured schedule tools.

## Professional UI revision

PASS:
- first-run theme is `Light · Dark Blue Contrast`;
- Dark and Light remain available from the Theme dropdown;
- navigation is two-tiered and less cramped at desktop widths;
- project selector no longer duplicates the editable project-name field;
- repository/file controls, cards, tables, filters and chat spacing have been tightened and normalised;
- responsive breakpoints were added for 1450 px, 1100 px and 780 px widths;
- Gantt remains white/light in all themes and critical bars remain red.

## GitHub Pages / cache safety

PASS:
- fully static architecture;
- `.nojekyll` present;
- project-subpath-compatible relative URLs;
- every production local JS module import carries `?v=1.2.0`;
- worker URLs carry the same cache token;
- top-level CSS/app assets carry the same token;
- this prevents a new Pages deployment from combining old cached modules with the new shell.

Static subpath smoke test returned HTTP 200 for the page, CSS, app module, AI catalogue, browser runtime, shared AI runtime, schedule worker and `.nojekyll`.

## Primary automated test suites

**21 / 21 PASS**

1. Parser & file import
2. Network/driving path
3. Schedule comparison/golden movement
4. Health, confidence, narrative, weekly series
5. Calendar & data-centre readiness
6. Risk/QSRA & claims
7. Structured AI schedule tools
8. Microsoft Project XML golden
9. Ollama native API compatibility
10. Ollama failure/recovery paths
11. All restored browser AI models
12. Repository/multi-project integration
13. Shared AI runtime + repository context
14. All toolkit AI agent roles
15. Parser fuzz
16. Performance/volume
17. UI/GitHub Pages contracts
18. Model catalogue + professional UI regression
19. Master feature completeness contract
20. GitHub Pages deployment/import graph
21. Security

Most recent primary-suite result:

`ALL TESTS PASS · 21/21 suites`

## Exhaustive stress suite

PASS:
- 3,000 randomized malformed XER inputs;
- 50,000 activities / 200,000 relationships parse;
- schedule health at 50,000 / 200,000;
- 10,000-activity revision comparison;
- 20,000-activity deep dependency path;
- 5,000-iteration deterministic Monte Carlo.

Most recent run in this environment:
- 3,000-input fuzz: ~108 ms
- 50k / 200k parse: ~563 ms
- 50k / 200k health: ~294 ms
- 10k comparison: ~105 ms
- 20k deep path: ~181 ms
- Monte Carlo pair: ~27 ms

Timings are environment-specific, not contractual guarantees.

## Important live-browser limitation

The automated suite confirms the application logic, model routing, progress events, error recovery, prompt budgeting, repository integration and supported upstream model identifiers. It cannot physically execute a multi-gigabyte WebGPU model on the user's GPU from this container, nor can it reach the user's Windows Ollama service.

For that reason, the final operational acceptance test remains a short live UAT on the deployed GitHub Pages site:
1. open Settings;
2. select a browser CPU model and use `Test selected browser AI`;
3. if WebGPU is supported, test one WebGPU model;
4. select several real XERs and ask `What do you think about my current schedules?`;
5. confirm the model-download/generation progress HUD;
6. test Ollama with `Check Ollama`, `Detect & classify`, then `Test & Save`;
7. ask the same project question in Contract Manager and Schedule Assessment.

The release is suitable for that live acceptance test and the automated release gate is fully passing.
