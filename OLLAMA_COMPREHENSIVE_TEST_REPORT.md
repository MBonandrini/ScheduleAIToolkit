# Ollama Comprehensive Validation Report

## Result

**PASS** — the release gate and the extended Ollama compatibility suite pass after one defect was found and corrected.

## Defect found during deep testing

The shared `ai.run()` wrapper treated the default `temperature=null` as numeric zero because JavaScript evaluates `Number(null)` as `0`. That meant the globally configured temperature could be silently ignored when a module did not explicitly pass a temperature.

This was corrected so a missing/null/blank temperature now uses the globally configured Settings value. A permanent regression test verifies the configured temperature is sent in the Ollama request.

## Ollama API compatibility tested

The suite was tested against mock servers implementing the native Ollama REST shape used by current Ollama releases:

- `GET /api/tags`
- `POST /api/show`
- `POST /api/chat`
- `POST /api/generate` fallback

Verified:
- base URL normalization, including an `/api` suffix;
- `localhost` to `127.0.0.1` loopback fallback after a network failure;
- model discovery and chat-vs-embedding capability classification;
- preservation of the selected installed chat model;
- safe fallback when a saved model is no longer installed;
- explicit rejection of embedding-only models as chat models;
- `stream:false` request mode;
- Qwen-style thinking Auto / On / Off behavior;
- thinking-only response retry with thinking disabled;
- successful-but-empty `/api/chat` fallback to `/api/generate`;
- response parsing from `message.content`, `response`, `content`, `message.text`, and content arrays;
- `num_ctx`, `num_predict`, temperature, Top P, Top K and repeat penalty request options;
- keep-alive values `default`, `0`, `5m`, `1h`, legacy `-1`, and malformed persisted values;
- HTTP 500 error surfacing;
- network/CORS error guidance mentioning `OLLAMA_ORIGINS`;
- progress HUD start/completion events;
- selected Shared Project Repository XER content reaching the actual Ollama chat request body.

## Concurrency / runtime stress

25 simultaneous shared-AI requests were executed against the mock Ollama service.

PASS:
- 25/25 responses completed;
- model discovery occurred once;
- capability inspection occurred once;
- all 25 chat requests executed;
- the shared runtime did not reload the model lifecycle per request.

## Schedule context

A selected repository schedule named `perun 3.xer` was injected into the actual `/api/chat` request in the integration harness. Both its filename and representative XER content were present alongside the user's question.

## Existing release coverage retained

- JavaScript syntax: PASS
- Suite architecture contracts: PASS
- Ollama provider integration: PASS
- NotebookLM+ Ollama mock integration: PASS
- Shared repository context integration: PASS
- 300 malformed/random XER fuzz inputs: PASS
- 10,000 activities / 50,000 relationships: PASS
- 25,000 activities / 100,000 relationships: PASS
- Schedule comparison golden results: PASS
- Static route compatibility: PASS
- All application routes: PASS
- Full `tests/run-release-validation.sh`: **PASS**

## Environment limitation

The test environment does not have a real Ollama service running on `localhost:11434`, so it cannot execute the user's installed Windows Ollama model. The release was validated using the production request code against native-shape mock Ollama HTTP services plus the existing integration suites.

The final environment-specific acceptance test should therefore be:
1. Windows Ollama running.
2. Settings → Unified AI Configuration → Ollama.
3. Detect & classify models.
4. Select a chat-capable installed model.
5. Test & Save.
6. Select Ollama in the global top dropdown.
7. Tick a repository XER file and ask a question about it in two different mini-tools.
8. Confirm the progress HUD appears while inference is running.

If the site is hosted from a web origin such as GitHub Pages or Cloudflare Pages, that origin must be allowed by Ollama using `OLLAMA_ORIGINS`, followed by an Ollama restart.
