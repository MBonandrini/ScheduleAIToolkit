# Free AI Setup

## Option 1 — Offline (default)

No setup is required. The planning engine continues to build and validate plans using deterministic rules, historical schedule evidence and estimating data.

## Option 2 — Local Ollama

This is the recommended free AI option for normal Windows workstations.

1. Install Ollama from its official installer.
2. Pull a local model, for example:

```text
ollama pull gemma3:4b
```

3. A GitHub Pages site has a different web origin from `127.0.0.1`, so allow your GitHub Pages origin in `OLLAMA_ORIGINS`.
4. Restart Ollama.
5. In Planning Engine → AI Advisor → AI settings:
   - AI mode: **Local Ollama**
   - endpoint: `http://127.0.0.1:11434`
   - model: the installed model name
6. Select **Test selected mode**.

No project context is sent to a paid AI service. Inference happens on the local computer.

## Option 3 — Browser AI / WebLLM

This requires no Ollama installation and no API key.

1. Use a recent Chromium-based browser with WebGPU support.
2. Open AI settings.
3. Select **Browser AI / WebLLM**.
4. Start with **Llama 3.2 1B**.
5. Select **Test selected mode**.
6. The first run downloads free model files from public model hosting. They are then cached by the browser where supported.

The browser AI path uses local WebGPU inference. Prompts are not sent to a paid AI inference API.

### Available presets

- Llama 3.2 1B — lightest recommended preset.
- Llama 3.2 3B — stronger but requires more memory.
- SmolLM2 1.7B — compact alternative.

## Security / privacy

- No paid AI API key exists in this codebase.
- The Offline mode performs no AI inference.
- Ollama inference stays on the local machine.
- Browser AI inference runs in the browser; model files are fetched from public hosting on first load.
- PDF/DOCX/XLSX parsing uses public CDN-hosted JavaScript libraries in the current GitHub build. Vendor those libraries into the repository if you require a completely self-contained/no-CDN deployment.
