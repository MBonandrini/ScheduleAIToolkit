# NotebookLM+ Integration

NotebookLM+ v0.7.0 is integrated as a top-level Project Controls AI Suite tab under `apps/notebooklmplus`.

## AI providers

NotebookLM+ supports:

- Ollama local/remote
- OmniRoute Auto / routed AI
- Generic OpenAI-compatible hosted AI

OmniRoute default endpoint: `http://localhost:20128/v1`. In OmniRoute, allow the toolkit's deployed origin in CORS settings. Endpoint authentication is optional; when enabled the endpoint/client key is kept in page memory only.

The recommended OmniRoute chat route is `auto` when available. NotebookLM+ remains responsible for local source parsing, chunking, retrieval and evidence selection; OmniRoute only receives the retrieved context/prompt for AI generation.

Embedding models are optional. If no embedding-capable OmniRoute route/model is selected, NotebookLM+ continues with keyword retrieval.
