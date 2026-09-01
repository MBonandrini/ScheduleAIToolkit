# NotebookLM+ Integration

NotebookLM+ v0.7.0 is integrated as a top-level Project Controls AI Suite workspace under `apps/notebooklmplus`.

## Unified AI configuration

NotebookLM+ no longer owns an independent AI provider selection. The active AI engine is selected once under **Settings → Unified AI Configuration** and is shared by every AI-enabled module in the suite.

Supported shared choices include OmniRoute routes, Ollama, and the browser-local CPU/WebGPU models exposed by the shared AI core.

- OmniRoute uses the shared OmniRoute endpoint and selected global route.
- Ollama uses the shared Ollama host and selected chat model. NotebookLM+ may also use the shared optional Ollama embedding model for semantic retrieval.
- Browser-local AI uses the shared suite runtime for answer generation; NotebookLM+ uses keyword retrieval when a compatible embedding provider is unavailable.

NotebookLM+'s visible tabs are now **Workspace** and **Studio**. Its former AI configuration, tutorial and local settings tabs were consolidated into the suite's top-level **Settings** workspace.
