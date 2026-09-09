/**
 * Free-only AI adapters for Planning Engine GitHub Edition.
 *
 * Supported modes:
 *   - offline: deterministic engine only; no AI and no network AI calls
 *   - ollama: free local inference through the user's Ollama installation
 *   - webllm: free in-browser WebGPU inference through WebLLM
 *
 * There is deliberately NO paid API/proxy adapter in this module.
 */

export const FREE_BROWSER_MODELS = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 1B — light / recommended for browsers',
    vramMB: 879,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.2 3B — stronger / needs more GPU memory',
    vramMB: 2264,
  },
  {
    id: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    label: 'SmolLM2 1.7B — compact alternative',
    vramMB: 1774,
  },
];

export const DEFAULT_FREE_AI = Object.freeze({
  mode: 'offline',
  ollamaEndpoint: 'http://127.0.0.1:11434',
  ollamaModel: 'gemma3:4b',
  webllmModel: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
});

export function migrateAIConfig(ai = {}) {
  const src = ai && typeof ai === 'object' ? ai : {};
  // Older GitHub builds used mode='proxy' for a paid remote API.
  // Never preserve or call that path in the free-only edition.
  const safeMode = ['offline', 'ollama', 'webllm'].includes(src.mode) ? src.mode : 'offline';
  return {
    mode: safeMode,
    ollamaEndpoint: String(src.ollamaEndpoint || DEFAULT_FREE_AI.ollamaEndpoint),
    ollamaModel: String(src.ollamaModel || DEFAULT_FREE_AI.ollamaModel),
    webllmModel: String(src.webllmModel || DEFAULT_FREE_AI.webllmModel),
  };
}

export function aiModeLabel(mode) {
  return mode === 'ollama'
    ? 'Local Ollama'
    : mode === 'webllm'
      ? 'Browser AI (WebGPU)'
      : 'Offline / No AI';
}

export function modelLabel(ai = {}) {
  const c = migrateAIConfig(ai);
  if (c.mode === 'ollama') return c.ollamaModel;
  if (c.mode === 'webllm') return c.webllmModel;
  return 'None';
}

export function browserAIStatus(navigatorLike = globalThis.navigator) {
  if (!navigatorLike) return { ok: false, reason: 'Browser environment is unavailable.' };
  if (!navigatorLike.gpu) return { ok: false, reason: 'WebGPU is not available in this browser/device.' };
  return { ok: true, reason: 'WebGPU is available.' };
}

export function ollamaRequest(ai, systemPrompt, userPrompt) {
  const c = migrateAIConfig(ai);
  const endpoint = c.ollamaEndpoint.replace(/\/$/, '') + '/api/chat';
  return {
    endpoint,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: c.ollamaModel,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    },
  };
}

export async function callOllama(ai, systemPrompt, userPrompt, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is not available.');
  const { endpoint, init } = ollamaRequest(ai, systemPrompt, userPrompt);
  const response = await fetchImpl(endpoint, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error || data?.message || '';
    throw new Error(`Ollama HTTP ${response.status}${detail ? `: ${detail}` : ''}. Check Ollama, OLLAMA_ORIGINS, and browser local-network permission.`);
  }
  const text = data?.message?.content ?? data?.response;
  if (!text) throw new Error('Ollama returned no text response.');
  return String(text);
}

let webLLMEngine = null;
let webLLMModel = '';

export async function callWebLLM(ai, systemPrompt, userPrompt, onProgress = null) {
  const c = migrateAIConfig(ai);
  const status = browserAIStatus();
  if (!status.ok) throw new Error(status.reason + ' Use Local Ollama or Offline mode instead.');

  // Loaded only when the user explicitly chooses Browser AI.
  // Model weights are downloaded to/cached by the browser; no paid AI API is called.
  const webllm = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm');

  if (!webLLMEngine || webLLMModel !== c.webllmModel) {
    if (webLLMEngine?.unload) {
      try { await webLLMEngine.unload(); } catch {}
    }
    webLLMEngine = await webllm.CreateMLCEngine(c.webllmModel, {
      initProgressCallback: (p) => {
        if (typeof onProgress === 'function') onProgress(p);
      },
    });
    webLLMModel = c.webllmModel;
  }

  const response = await webLLMEngine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.15,
    max_tokens: 1000,
  });

  const text = response?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Browser AI returned no text response.');
  return String(text);
}

export async function unloadWebLLM() {
  if (webLLMEngine?.unload) {
    try { await webLLMEngine.unload(); } catch {}
  }
  webLLMEngine = null;
  webLLMModel = '';
}
