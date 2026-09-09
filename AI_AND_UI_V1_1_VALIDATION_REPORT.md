# Project Controls AI Suite v1.1 — AI & UI Validation

## Release result

**PASS**

Final automated validation after restoring the complete AI catalogue and revising the application layout:

- JavaScript syntax: PASS
- Primary automated suites: **21 / 21 PASS**
- Exhaustive stress suite: **PASS**

## AI corrections

The global model dropdown has been restored with:
- Qwen2.5 0.5B CPU/WASM
- Llama 3.2 1B CPU/WASM
- Qwen2.5 0.5B WebGPU
- Qwen2.5 1.5B WebGPU
- Qwen2.5 1.5B WebLLM
- Qwen2.5 3B WebLLM
- Qwen3 8B WebLLM
- Llama 3.2 1B WebLLM
- Llama 3.2 3B WebLLM
- Phi 3.5 Mini WebLLM
- Llama 3.1 8B WebLLM
- Ollama selected local model

All mini-tools use the single global model selection.

### Reported CPU/Gather error

The reported ONNX Runtime `Gather` / index 32768 boundary failure was reproduced as a regression condition.

The architectural fix prevents large selected XER files from being dumped verbatim into small browser model prompts. Browser models now receive:
- compact active-schedule summary;
- schedule-portfolio/revision summary;
- structured schedule-tool evidence;
- bounded relevant excerpts from checked non-schedule files.

A regression test imports two additional large XERs (5,000 and 3,000 activities) and asks:
`What do you think about my current schedules?`

PASS criteria:
- response completes through the CPU model route;
- total generated prompt stays below the browser-model safety budget;
- portfolio summary contains the schedule filenames;
- raw `%T TASK` XER table data is not injected into the prompt.

### Browser model routing

Every restored browser model route is executed using deterministic mocked inference runtimes:
- CPU models route through WASM;
- Transformers WebGPU models route through WebGPU;
- WebLLM models route through WebLLM;
- model-download progress is emitted;
- response-generation progress is emitted.

Cross-agent validation also passes for:
- Planner
- Forensic Planner
- Risk Analyst
- Commercial Manager
- Contract Analyst
- Project Controls Manager
- Executive Reviewer

Each role uses the same global AI runtime and receives checked Project Repository evidence.

## WebGPU handling

If WebGPU is unavailable:
- an incompatible model is marked unavailable in the selector/settings;
- selecting it is blocked before chat execution;
- a saved incompatible WebGPU selection is automatically replaced by the safe Qwen2.5 0.5B CPU/WASM model;
- the user receives a clear compatibility message.

## Layout revision

The first-run theme is now **Light · Dark Blue Contrast**, with:
- dark navy application chrome;
- light professional workspace;
- clearer tab hierarchy;
- improved spacing and panel treatment;
- improved chat proportions;
- cleaner Project Repository controls;
- removal of the duplicated project-name field;
- responsive layouts for smaller screens.

Dark mode remains available in the Theme dropdown, as does Light mode.

## Exhaustive test results

Most recent exhaustive run:
- 3,000 malformed/random XER cases: PASS
- 50,000 activities / 200,000 relationships parse: PASS
- health analysis at 50k / 200k: PASS
- 10,000-activity revision comparison: PASS
- 20,000-activity deep network chain: PASS
- 5,000-iteration deterministic Monte Carlo: PASS

Measured in this environment:
- fuzz 3,000: ~120 ms
- 50k / 200k parse: ~667 ms
- 50k / 200k health: ~335 ms
- 10k comparison: ~109 ms
- 20k deep chain: ~183 ms
- Monte Carlo test pair: ~33 ms

## Important live-environment limitation

Automated validation is complete and passing. Actual WebGPU execution depends on the user's browser, GPU driver and available VRAM; actual Ollama execution depends on the user's Windows Ollama service and `OLLAMA_ORIGINS` configuration.

Use the Settings self-test buttons after deployment to complete live hardware acceptance.
