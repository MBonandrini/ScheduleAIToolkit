# AI Setup Guide

Default endpoint: `http://localhost:20128/v1`. Use AI Settings or Tutorial / AI Setup to test the connection.

## Ollama
Default host: `http://localhost:11434`. The toolkit uses `/api/tags` to discover models and `/api/chat` for chat. Local Ollama does not require an API key.

For GitHub Pages, set `OLLAMA_ORIGINS` to the exact site origin, restart Ollama, then use Tutorial / AI Setup → Ollama → Detect models → Test & Save.

Example:
`ollama run gemma3`

## Browser AI
CPU/WASM and WebGPU models load only on demand and show a RAM/VRAM warning.

## Security
Do not embed paid-provider API keys in public GitHub Pages source.

## Deterministic Analysis
AI is explanatory. Schedule calculations and forensic metrics are generated independently.


## Advanced AI runtime controls

The Settings workspace now centralises reasoning, generation and reliability controls for the whole suite. Key controls include reasoning mode, a reasoning timeout with optional fallback to thinking-off, total request timeout, first-response/model-load timeout, streaming inactivity timeout, retry count and retry delay, maximum answer tokens, context tokens, temperature, Top P, Top K sampling, repeat penalty, Ollama keep-alive, and the `/api/generate` empty-response fallback.

Ollama keep-alive is restricted to validated values (`default`, `0`, `5m`, `15m`, `30m`, `1h`, `2h`, `4h`). Older saved `-1` string values are migrated to `30m` and are never sent to Ollama.
