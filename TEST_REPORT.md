# Planning Engine — GitHub Free AI Edition — Test Report

## Result

- Automated tests: **124 passed / 0 failed**
- JavaScript syntax checks: **PASS** (`core.mjs`, `free_ai.mjs`, `app.mjs`)
- Static HTTP deployment smoke: **PASS**
- Maintainable build served: **PASS**
- Single-file `PlanningEngine.html` served: **PASS**

## Coverage retained from the operational GitHub build

The deterministic core tests cover:

- file classification and project tree routing;
- BOQ parsing and drawing-text quantity extraction;
- schedule guideline extraction;
- scope/system/date detection;
- historical XER parsing;
- FS/SS/FF/SF CPM calculations;
- total float and parallel-path calculations;
- cycle detection and safe failure;
- invalid relationship endpoints;
- negative/excessive lag checks;
- excessive duration checks;
- energisation, piping and concrete constructability tests;
- DXF and IFC text parsing;
- generated demo planning project;
- every combination of BOQ/scope/drawings/history being present or absent;
- 40 randomized DAG CPM networks;
- 20 randomized mixed-relationship networks;
- target-finish slippage;
- estimating norm application;
- historical-duration substitution;
- equipment procurement chains;
- all included construction-system schedule templates.

## Free-AI adapter tests

Additional tests verify:

- default AI mode is Offline;
- legacy paid `proxy` configuration migrates to Offline;
- obsolete proxy/model fields are discarded;
- only `offline`, `ollama`, and `webllm` modes are retained;
- WebGPU capability detection;
- browser-model preset uniqueness;
- correct local Ollama `/api/chat` request construction;
- Ollama response parsing;
- Ollama error propagation.

## Paid-service audit

The previous Cloudflare/OpenAI worker and worker test were removed. The deployable code contains no paid inference endpoint and no API-key input path.

## Runtime limitations of this test environment

A true browser WebGPU inference run could not be executed here because the test container does not expose a browser WebGPU device and cannot download the model package from the public CDN/model host. The WebLLM runtime path is therefore syntax-checked and adapter-tested, but the first real WebGPU model download should be smoke-tested once after GitHub Pages deployment on a compatible Chrome/Edge machine.

A real Ollama model call was not executed because the container does not have the user's local Ollama service/model. The local HTTP adapter is covered with success/error mocks. The deterministic engine does not depend on either AI path.
