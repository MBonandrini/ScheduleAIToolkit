/**
 * Bring-your-own-key cloud AI adapters.
 *
 * Provider-specific differences are normalized behind cloudChat().  OpenAI-style
 * Chat Completions endpoints (xAI, DeepSeek, NVIDIA NIM and Custom) all share one
 * adapter, while OpenAI Responses, Gemini and Anthropic retain their native
 * payloads.  Keys/configuration are stored only in the current browser profile.
 */
const PREFIX = "pcai.cloud.";
export const CLOUD_PROVIDERS = {
  gemini: { label: "Gemini", model: "gemini-3.8-flash", protocol: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  grok: { label: "Grok", model: "grok-4.6", protocol: "openai-chat", baseUrl: "https://api.x.ai/v1/chat/completions" },
  openai: { label: "OpenAI", model: "gpt-5.6", protocol: "openai-responses", baseUrl: "https://api.openai.com/v1/responses" },
  anthropic: { label: "Claude", model: "claude-sonnet-5", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1/messages" },
  deepseek: { label: "DeepSeek", model: "deepseek-flash", protocol: "openai-chat", baseUrl: "https://api.deepseek.com/chat/completions" },
  nvidia: { label: "NVIDIA NIM", model: "nvidia/nemotron-3-super-120b-a12b", protocol: "openai-chat", baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions" },
  custom: { label: "Custom OpenAI-compatible", model: "", protocol: "openai-chat", baseUrl: "" }
};

function storage() { return typeof localStorage !== "undefined" ? localStorage : null; }
function key(provider, field) { return `${PREFIX}${provider}.${field}`; }
export function cloudProviderMeta(provider) {
  const meta = CLOUD_PROVIDERS[provider];
  if (!meta) throw new Error(`Unknown cloud AI provider: ${provider}`);
  return meta;
}
export function cloudProviderIds() { return Object.keys(CLOUD_PROVIDERS); }
export function cloudConfig(provider) {
  const p = cloudProviderMeta(provider), s = storage();
  return {
    provider,
    model: s?.getItem(key(provider, "model")) ?? p.model,
    apiKey: s?.getItem(key(provider, "key")) || "",
    baseUrl: s?.getItem(key(provider, "baseUrl")) ?? p.baseUrl,
    protocol: s?.getItem(key(provider, "protocol")) || p.protocol,
    remember: true
  };
}
export function saveCloudConfig(provider, { model, apiKey, baseUrl, protocol } = {}) {
  const p = cloudProviderMeta(provider), s = storage();
  if (!s) throw new Error("Browser local storage is unavailable.");
  if (model != null) s.setItem(key(provider, "model"), String(model).trim() || p.model);
  if (apiKey != null) s.setItem(key(provider, "key"), String(apiKey).trim());
  if (baseUrl != null) s.setItem(key(provider, "baseUrl"), String(baseUrl).trim());
  if (protocol != null) s.setItem(key(provider, "protocol"), String(protocol).trim() || p.protocol);
  return cloudConfig(provider);
}
export function clearCloudKey(provider) {
  storage()?.removeItem(key(provider, "key"));
  return cloudConfig(provider);
}
function friendlyFetchError(provider, error) {
  const name = CLOUD_PROVIDERS[provider]?.label || provider, msg = String(error?.message || error || "");
  if (error instanceof TypeError || /failed to fetch|networkerror|cors/i.test(msg)) return `${name} could not be reached from this browser. Check the API key, endpoint, internet connection and browser CORS policy. For multi-user/public deployment, use a server/Worker proxy so long-lived keys are not exposed to the page.`;
  return msg || `${name} request failed.`;
}
async function request(url, options, provider) {
  let res;
  try { res = await fetch(url, options); } catch (error) { throw new Error(friendlyFetchError(provider, error)); }
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || data?.raw || `${res.status} ${res.statusText}`;
    throw new Error(`${CLOUD_PROVIDERS[provider]?.label || provider} API error: ${detail}`);
  }
  return data;
}
function splitMessages(messages = []) {
  return { system: messages.filter(m => m.role === "system").map(m => m.content).join("\n\n"), chat: messages.filter(m => m.role !== "system") };
}
function extractOpenAIChat(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map(x => x?.text || x?.content || "").join("").trim();
  return "";
}
async function openAICompatibleChat(provider, cfg, messages, selected) {
  if (!cfg.baseUrl) throw new Error(`${CLOUD_PROVIDERS[provider].label} endpoint/base URL is required.`);
  if (!selected) throw new Error(`${CLOUD_PROVIDERS[provider].label} model is required.`);
  const data = await request(cfg.baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: selected, messages: messages.map(m => ({ role: m.role, content: String(m.content || "") })), max_tokens: 16000 })
  }, provider);
  return extractOpenAIChat(data);
}
export async function cloudChat(provider, messages, { model = null, onProgress = null } = {}) {
  const cfg = cloudConfig(provider), meta = cloudProviderMeta(provider), selected = model || cfg.model;
  if (!cfg.apiKey) throw new Error(`${meta.label} API key is not configured. Open Settings and paste your key first.`);
  onProgress?.({ title: `Contacting ${meta.label}`, detail: selected || cfg.baseUrl, indeterminate: true });
  let text = "";
  if (cfg.protocol === "openai-chat") {
    text = await openAICompatibleChat(provider, cfg, messages, selected);
  } else if (provider === "gemini" || cfg.protocol === "gemini") {
    const { system, chat } = splitMessages(messages), contents = chat.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }));
    const body = { contents };
    if (system) body.system_instruction = { parts: [{ text: system }] };
    const data = await request(`${cfg.baseUrl}/models/${encodeURIComponent(selected)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": cfg.apiKey }, body: JSON.stringify(body) }, provider);
    text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
  } else if (provider === "openai" || cfg.protocol === "openai-responses") {
    const { system, chat } = splitMessages(messages), body = { model: selected, input: chat.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })), max_output_tokens: 16000 };
    if (system) body.instructions = system;
    const data = await request(cfg.baseUrl, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${cfg.apiKey}` }, body: JSON.stringify(body) }, provider);
    text = String(data.output_text || "").trim() || (data.output || []).flatMap(x => x.content || []).map(x => x.text || x.output_text || "").join("").trim();
  } else if (provider === "anthropic" || cfg.protocol === "anthropic") {
    const { system, chat } = splitMessages(messages), body = { model: selected, max_tokens: 16000, messages: chat.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") })) };
    if (system) body.system = system;
    const data = await request(cfg.baseUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify(body) }, provider);
    text = (data.content || []).filter(x => x.type === "text").map(x => x.text || "").join("").trim();
  } else throw new Error(`Unsupported cloud AI protocol: ${cfg.protocol}`);
  if (!text) throw new Error(`${meta.label} returned no text response.`);
  onProgress?.({ title: `${meta.label} complete`, detail: selected, percent: 100 });
  return { text, model: selected, provider };
}
export async function testCloudAI(provider) {
  try {
    const r = await cloudChat(provider, [{ role: "user", content: "Reply with OK only." }]);
    return { ok: true, message: `${cloudProviderMeta(provider).label} responded using ${r.model}.`, text: r.text };
  } catch (error) { return { ok: false, message: error.message || String(error) }; }
}

/**
 * Best-effort model discovery for OpenAI-compatible providers.
 *
 * Not every provider exposes /models to browser clients and CORS policies can
 * vary.  The Settings page therefore treats discovery as an optional helper;
 * users can always type a model identifier manually.
 */
export async function listCloudModels(provider) {
  const cfg = cloudConfig(provider), meta = cloudProviderMeta(provider);
  if (!cfg.apiKey) throw new Error(`${meta.label} API key is not configured.`);
  if (!["openai-chat", "openai-responses"].includes(cfg.protocol)) return [];
  if (!cfg.baseUrl) return [];
  let url = cfg.baseUrl.replace(/\/+$/, "");
  url = url.replace(/\/(chat\/completions|responses)$/i, "/models");
  if (!/\/models$/i.test(url)) {
    // A custom base can be either .../v1 or the full endpoint.
    if (/\/v\d+$/i.test(url)) url += "/models";
    else return [];
  }
  const data = await request(url, {
    method: "GET",
    headers: { "Authorization": `Bearer ${cfg.apiKey}` }
  }, provider);
  const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : [];
  return rows.map(x => typeof x === "string" ? x : x?.id || x?.name).filter(Boolean).sort((a,b) => a.localeCompare(b));
}
