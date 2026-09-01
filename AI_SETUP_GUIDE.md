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
