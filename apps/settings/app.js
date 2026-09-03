"use strict";

const Core = window.parent?.ProjectControlsCore || window.ProjectControlsCore;
const content = document.getElementById("settingsContent");
const status = document.getElementById("settingsStatus");
const PERF_KEY = "projectControlsNotebookPerformanceMode";
const THEME_KEY = "projectControlsTheme";
const NOTEBOOK_RUNTIME_KEY = "projectControlsNotebookRuntimeConfig";
const PERF_OPTIONS = [
  ["cpu", "CPU / No GPU"], ["lightweight", "Lightweight"], ["local", "Local"],
  ["balanced", "Balanced"], ["power", "Power"], ["remote", "Remote / high-context"]
];
let page = "general";
let aiProviderView = null;
let tutorialProviderView = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const siteOrigin = () => { try { return window.parent.location.origin || location.origin; } catch (_) { return location.origin; } };
const getStorage = (key, fallback="") => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
const setStorage = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
function safeKeepAlive(value){
  const raw=String(value ?? '').trim().toLowerCase();
  if(raw==='-1') return '30m';
  if(['default','0','5m','15m','30m','1h','2h','4h'].includes(raw)) return raw;
  return 'default';
}

function notebookRuntimeConfig(){
  try {
    const raw=JSON.parse(localStorage.getItem(NOTEBOOK_RUNTIME_KEY)||"{}");
    if(!raw || typeof raw!=="object") return {};
    // Legacy builds stored keepAlive as the invalid string "-1". Never render or
    // re-save that value; migrate it to the current safe default.
    if(String(raw.keepAlive||"")==="-1") raw.keepAlive="30m";
    return raw;
  } catch (_) { return {}; }
}

function setStatus(message, kind="") { status.textContent = message; status.className = `status-pill ${kind}`.trim(); }
function notifyAI() { try { window.parent.postMessage({type:"pc-ai-config-changed"}, "*"); } catch (_) {} }
function notifyPerformance(value) { try { window.parent.postMessage({type:"pc-notebook-performance-changed", value}, "*"); } catch (_) {} }
function providerForEntry(entry){ return entry?.engine === "ollama" ? "ollama" : entry?.engine === "mlc" ? "mlc" : "cpu"; }
function currentProvider(){ const entry=Core?.ai?.catalog?.find(x=>x.value===Core.ai.preferred()); return providerForEntry(entry); }
function providerLabel(value){ return ({ollama:"Ollama",cpu:"Browser CPU / WASM",mlc:"Browser WebGPU"})[value] || value; }
function providerEntries(provider){ return (Core?.ai?.catalog||[]).filter(x=>!x.disabled && providerForEntry(x)===provider); }
function preferredForProvider(provider){ const preferred=Core.ai.preferred(); return providerEntries(provider).find(x=>x.value===preferred)?.value || providerEntries(provider)[0]?.value || preferred; }

function selectPage(next) {
  if (!["general","ai","tutorial"].includes(next)) next = "general";
  page = next;
  document.querySelectorAll(".settings-tabs button").forEach(button => {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  render();
  try { history.replaceState(null, "", `#${page}`); } catch (_) {}
}
document.querySelectorAll(".settings-tabs button").forEach(button => {
  button.type = "button"; button.setAttribute("role", "tab");
  button.addEventListener("click", () => selectPage(button.dataset.page));
});

function generalView() {
  if (!Core?.ai) return missingCoreView();
  const ai = Core.ai.status(), ollama = Core.ai.ollamaConfig();
  const theme = getStorage(THEME_KEY, "dark"), perf = getStorage(PERF_KEY, "balanced");
  return `<div class="grid">
    <section class="card"><div class="card-head">Appearance</div><div class="card-body">
      <div class="field"><label for="themeSelect">Default theme</label><select id="themeSelect"><option value="dark" ${theme==='dark'?'selected':''}>Dark</option><option value="light" ${theme==='light'?'selected':''}>Light</option></select></div>
      <div class="note">Dark mode is the first-run default. Your choice is remembered in this browser.</div>
      <div class="actions"><button id="applyTheme" class="btn primary" type="button">Apply theme</button></div>
    </div></section>
    <section class="card"><div class="card-head">NotebookLM+ performance</div><div class="card-body">
      <div class="field"><label for="notebookPerformanceSelect">Performance profile</label><select id="notebookPerformanceSelect">${PERF_OPTIONS.map(([value,label])=>`<option value="${value}" ${value===perf?'selected':''}>${esc(label)}</option>`).join('')}</select></div>
      <div class="note"><b>CPU / No GPU belongs here.</b> This changes NotebookLM+ retrieval/context workload only; it never chooses a different AI provider.</div>
      <div class="actions"><button id="saveNotebookPerformance" class="btn primary" type="button">Save performance profile</button></div>
    </div></section>
    <section class="card wide"><div class="card-head">AI Runtime &amp; NotebookLM+ advanced settings</div><div class="card-body">
      ${(()=>{const n=notebookRuntimeConfig();return `
      <div class="runtime-group"><h3>Reasoning</h3><p class="group-help">Controls how reasoning-capable models such as Qwen3 think, and when the suite falls back to a faster non-thinking response.</p><div class="form-grid">
        <div class="field"><label for="nbThinking">Reasoning / thinking</label><select id="nbThinking"><option value="off" ${n.thinkingMode==='off'?'selected':''}>Off</option><option value="auto" ${!n.thinkingMode||n.thinkingMode==='auto'?'selected':''}>Automatic</option><option value="on" ${n.thinkingMode==='on'?'selected':''}>On</option></select></div>
        <div class="field"><label for="nbThinkingTimeout">Reasoning timeout / fallback (seconds)</label><input id="nbThinkingTimeout" type="number" min="15" max="1800" step="15" value="${esc(n.thinkingTimeoutSeconds ?? 180)}"><small>If a thinking request exceeds this time, the suite can retry with thinking disabled.</small></div>
        <div class="field"><label>Reasoning fallback</label><label class="checkline"><input id="nbFallbackThinking" type="checkbox" ${n.fallbackThinkingOff!==false?'checked':''}> Retry with thinking Off if reasoning times out or returns no final answer</label></div>
      </div></div>

      <div class="runtime-group"><h3>Response generation</h3><p class="group-help">Shared generation controls used throughout the suite.</p><div class="form-grid">
        <div class="field"><label for="nbContextTokens">Context tokens</label><input id="nbContextTokens" type="number" min="2048" max="131072" step="1024" value="${esc(n.contextTokens ?? 16384)}"></div>
        <div class="field"><label for="nbMaxAnswer">Maximum answer tokens</label><input id="nbMaxAnswer" type="number" min="128" max="32768" step="128" value="${esc(n.maxAnswerTokens ?? 2048)}"></div>
        <div class="field"><label for="nbTemperature">Temperature</label><input id="nbTemperature" type="number" min="0" max="2" step="0.05" value="${esc(n.temperature ?? 0.18)}"></div>
        <div class="field"><label for="nbTopP">Top P</label><input id="nbTopP" type="number" min="0.05" max="1" step="0.05" value="${esc(n.topP ?? 0.90)}"><small>Lower values make responses more focused.</small></div>
        <div class="field"><label for="nbTopKSampling">Top K sampling</label><input id="nbTopKSampling" type="number" min="0" max="200" step="1" value="${esc(n.topKSampling ?? 40)}"></div>
        <div class="field"><label for="nbRepeatPenalty">Repeat penalty</label><input id="nbRepeatPenalty" type="number" min="0.5" max="2" step="0.05" value="${esc(n.repeatPenalty ?? 1.10)}"></div>
      </div></div>

      <div class="runtime-group"><h3>Timeouts &amp; reliability</h3><p class="group-help">These settings prevent a slow or stalled local model from locking a module indefinitely.</p><div class="form-grid">
        <div class="field"><label for="nbRequestTimeout">Total AI request timeout (seconds)</label><input id="nbRequestTimeout" type="number" min="30" max="3600" step="30" value="${esc(n.requestTimeoutSeconds ?? 600)}"></div>
        <div class="field"><label for="nbFirstResponse">Model load / first response timeout (seconds)</label><input id="nbFirstResponse" type="number" min="30" max="1800" step="30" value="${esc(n.firstResponseTimeoutSeconds ?? 300)}"></div>
        <div class="field"><label for="nbInactivity">Streaming inactivity timeout (seconds)</label><input id="nbInactivity" type="number" min="30" max="900" step="30" value="${esc(n.inactivityTimeoutSeconds ?? 180)}"></div>
        <div class="field"><label for="nbRetryCount">Automatic retries</label><select id="nbRetryCount">${[0,1,2,3,4].map(v=>`<option value="${v}" ${Number(n.retryCount ?? 1)===v?'selected':''}>${v}</option>`).join('')}</select></div>
        <div class="field"><label for="nbRetryDelay">Retry delay (milliseconds)</label><input id="nbRetryDelay" type="number" min="0" max="10000" step="250" value="${esc(n.retryDelayMs ?? 1500)}"></div>
        <div class="field"><label>Empty-response recovery</label><label class="checkline"><input id="nbGenerateFallback" type="checkbox" ${n.generateFallback!==false?'checked':''}> Fall back from Ollama /api/chat to /api/generate if needed</label></div>
      </div></div>

      <div class="runtime-group"><h3>Ollama memory &amp; model lifetime</h3><p class="group-help">Controls how long Ollama keeps the model loaded after a request. All values are validated before being sent to Ollama.</p><div class="form-grid">
        <div class="field"><label for="nbKeepAlive">Ollama keep alive</label><select id="nbKeepAlive">
          <option value="default" ${n.keepAlive==='default'?'selected':''}>Ollama default</option>
          <option value="0" ${n.keepAlive==='0'?'selected':''}>Unload immediately</option>
          <option value="5m" ${n.keepAlive==='5m'?'selected':''}>5 minutes</option>
          <option value="15m" ${n.keepAlive==='15m'?'selected':''}>15 minutes</option>
          <option value="30m" ${(!n.keepAlive||n.keepAlive==='30m'||n.keepAlive==='-1')?'selected':''}>30 minutes (recommended)</option>
          <option value="1h" ${n.keepAlive==='1h'?'selected':''}>1 hour</option>
          <option value="2h" ${n.keepAlive==='2h'?'selected':''}>2 hours</option>
          <option value="4h" ${n.keepAlive==='4h'?'selected':''}>4 hours</option>
        </select><small>The legacy invalid value “-1” is automatically migrated to 30 minutes.</small></div>
      </div></div>

      <div class="runtime-group"><h3>NotebookLM+ retrieval &amp; indexing</h3><p class="group-help">These controls affect NotebookLM+ source processing and retrieval, not which AI model is selected.</p><div class="form-grid">
        <div class="field"><label for="nbTopK">Retrieved chunks</label><input id="nbTopK" type="number" min="2" max="50" value="${esc(n.topK ?? 12)}"></div>
        <div class="field"><label for="nbEmbedBatch">Embedding batch size</label><input id="nbEmbedBatch" type="number" min="1" max="128" value="${esc(n.embedBatch ?? 8)}"></div>
        <div class="field"><label for="nbWorkers">Index workers</label><input id="nbWorkers" type="number" min="1" max="8" value="${esc(n.workerCount ?? 3)}"></div>
        <div class="field"><label for="nbChunkSize">Source chunk size (characters)</label><input id="nbChunkSize" type="number" min="500" max="12000" step="100" value="${esc(n.chunkSize ?? 3200)}"></div>
        <div class="field"><label for="nbChunkOverlap">Chunk overlap (characters)</label><input id="nbChunkOverlap" type="number" min="0" max="2000" step="50" value="${esc(n.chunkOverlap ?? 400)}"></div>
        <div class="field"><label for="nbKeywordScore">Minimum keyword score</label><input id="nbKeywordScore" type="number" min="0" max="1" step="0.01" value="${esc(n.minKeywordScore ?? 0.02)}"></div>
        <div class="field"><label for="nbMaxFileSize">Maximum source file size (MB)</label><input id="nbMaxFileSize" type="number" min="1" max="2048" step="1" value="${esc(n.maxFileSizeMB ?? 256)}"></div>
        <div class="field"><label for="nbResearchTimeout">Research/web request timeout (seconds)</label><input id="nbResearchTimeout" type="number" min="5" max="1800" step="5" value="${esc(n.researchTimeoutSeconds ?? 90)}"></div>
        <div class="field"><label for="nbDiscoveryResults">Maximum discovery results</label><input id="nbDiscoveryResults" type="number" min="1" max="100" step="1" value="${esc(n.maxDiscoveryResults ?? 10)}"></div>
        <div class="field"><label for="nbSearchEndpoint">Research search endpoint</label><input id="nbSearchEndpoint" value="${esc(n.searchEndpoint ?? '')}" placeholder="Optional JSON search endpoint"></div>
        <div class="field"><label for="nbWebProxyEndpoint">Web proxy endpoint</label><input id="nbWebProxyEndpoint" value="${esc(n.webProxyEndpoint ?? '')}" placeholder="Optional CORS proxy"></div>
        <div class="field"><label for="nbYoutubeEndpoint">YouTube transcript endpoint</label><input id="nbYoutubeEndpoint" value="${esc(n.youtubeTranscriptEndpoint ?? '')}" placeholder="Optional transcript service"></div>
        <div class="field"><label for="nbAudioEndpoint">Audio transcription endpoint</label><input id="nbAudioEndpoint" value="${esc(n.audioTranscriptionEndpoint ?? '')}" placeholder="Optional transcription service"></div>
      </div><div class="actions"><label><input id="nbSemantic" type="checkbox" ${n.semanticSearch!==false?'checked':''}> Semantic/vector retrieval when embeddings are available</label><label><input id="nbKeyword" type="checkbox" ${n.keywordSearch!==false?'checked':''}> Keyword retrieval</label><label><input id="nbRescan" type="checkbox" ${n.rescanOnOpen!==false?'checked':''}> Rescan sources when a notebook opens</label></div></div>`})()}
      <div class="note"><b>Shared runtime:</b> reasoning, generation, timeout, retry and Ollama lifetime settings are consumed by every suite module that uses the global AI. NotebookLM+ retrieval/indexing settings remain specific to NotebookLM+.</div>
      <div class="actions"><button id="saveNotebookRuntime" class="btn primary" type="button">Save advanced settings</button><button id="resetNotebookRuntime" class="btn" type="button">Reset advanced values</button></div>
    </div></section>
    <section class="card"><div class="card-head">Unified AI status</div><div class="card-body"><div class="rows">
      <div class="row"><span>Global selection</span><b>${esc(Core.ai.preferredLabel())}</b></div><div class="row"><span>Loaded engine</span><b>${esc(ai.engine || "idle")}</b></div><div class="row"><span>Runtime model</span><b>${esc(ai.model || "—")}</b></div>
      </div><div class="actions"><button id="releaseAI" class="btn" type="button">Unload browser model</button><button id="goAI" class="btn primary" type="button">Open AI configuration</button></div>
    </div></section>
    <section class="card wide"><div class="card-head">Saved connections</div><div class="card-body"><div class="rows">
      <div class="row"><span>Ollama URL</span><b>${esc(ollama.baseUrl)}</b></div><div class="row"><span>Ollama chat model</span><b>${esc(ollama.model || "Not selected")}</b></div><div class="row"><span>Ollama embedding model</span><b>${esc(Core.ai.ollamaEmbeddingModel() || "Keyword-only")}</b></div>
      </div><div class="actions"><button id="clearAIConfig" class="btn danger" type="button">Reset AI settings</button></div><div id="resetDiag" class="diag">Reset removes saved endpoints/model choices from this browser. It does not uninstall AI software or models.</div>
    </div></section>
  </div>`;
}

function providerSelector(selected, id){
  return `<div class="field"><label for="${id}">AI provider</label><select id="${id}">${["ollama","cpu","mlc"].map(v=>`<option value="${v}" ${v===selected?'selected':''}>${providerLabel(v)}</option>`).join('')}</select></div>`;
}
function modelSelector(provider){
  const chosen=preferredForProvider(provider), entries=providerEntries(provider);
  return `<div class="field"><label for="globalAISelect">Model / route</label><select id="globalAISelect">${entries.map(item=>`<option value="${esc(item.value)}" ${item.value===chosen?'selected':''}>${esc(item.label)}</option>`).join('')}</select></div>`;
}
function aiView() {
  if (!Core?.ai) return missingCoreView();
  const provider = aiProviderView || currentProvider();
  const ollama = Core.ai.ollamaConfig();
  let configCard='';
  if(provider==='ollama'){
    configCard=`<section class="card wide"><div class="card-head">Ollama connection</div><div class="card-body">
      <div class="field"><label for="ollamaUrl">Ollama host</label><input id="ollamaUrl" value="${esc(ollama.baseUrl)}"></div>
      <div class="form-grid"><div class="field"><label for="ollamaModel">Chat model</label><select id="ollamaModel"><option value="${esc(ollama.model)}">${esc(ollama.model || "Detect models first")}</option></select><small>Only chat/completion-capable models are shown.</small></div><div class="field"><label for="embeddingModel">Embedding model for NotebookLM+</label><select id="embeddingModel"><option value="${esc(Core.ai.ollamaEmbeddingModel())}">${esc(Core.ai.ollamaEmbeddingModel() || "Keyword-only")}</option></select><small>Embedding-only models belong here, not in Chat model.</small></div></div>
      <div class="actions"><button id="detectOllama" class="btn" type="button">Detect &amp; classify models</button><button id="testOllama" class="btn primary" type="button">Test &amp; Save</button></div><div id="ollamaDiag" class="diag">Expected local API: http://localhost:11434</div>
    </div></section>`;
  } else if(provider==='cpu'){
    configCard=`<section class="card wide"><div class="card-head">Browser CPU / WASM</div><div class="card-body"><div class="note">No local server is required. The selected model is downloaded into the browser on first use and runs on CPU/WASM. This can use significant system RAM.</div><div class="diag">Use the model selector above. For NotebookLM+ retrieval, this mode uses keyword retrieval unless a separate embedding service is added later.</div></div></section>`;
  } else {
    configCard=`<section class="card wide"><div class="card-head">Browser WebGPU</div><div class="card-body"><div class="note">No Ollama service is required. The model runs in the browser using WebGPU and can consume substantial GPU memory and system RAM.</div><div class="diag">If WebGPU is unavailable or memory is limited, select Browser CPU/WASM or Ollama instead.</div></div></section>`;
  }
  return `<div class="grid">
    <section class="card wide emphasis"><div class="card-head">One AI selection for the entire suite</div><div class="card-body"><div class="form-grid">${providerSelector(provider,'aiProviderSelect')}${modelSelector(provider)}</div>
      <div class="note"><b>This configuration is global.</b> The top-right selector and every module use this same choice. There are no per-module AI selectors.</div>
      <div class="actions"><button id="saveGlobalAI" class="btn primary" type="button">Use this AI everywhere</button><button id="testSelectedAI" class="btn" type="button">Test selected AI</button></div><div id="globalDiag" class="diag">Current suite choice: ${esc(Core.ai.preferredLabel())}</div>
    </div></section>${configCard}</div>`;
}

function tutorialContent(provider){
  if(provider==='ollama') return `<section class="card wide"><div class="card-head">Ollama setup</div><div class="card-body"><ol><li>Install and start Ollama.</li><li>Install a chat model, for example <code>ollama run gemma3</code>.</li><li>Optional for NotebookLM+: install an embedding model, for example <code>ollama pull embeddinggemma</code>.</li><li>For a GitHub Pages deployment, set <code>OLLAMA_ORIGINS=${esc(siteOrigin())}</code> and restart Ollama.</li><li>Open Unified AI Configuration → Ollama → Detect &amp; classify models.</li><li>Choose a chat-capable model under Chat model. Put <code>embeddinggemma</code> only under Embedding model.</li><li>Press Test &amp; Save, then choose Ollama globally.</li></ol><div class="note warning">The error “embeddinggemma does not support chat” means an embedding-only model was incorrectly selected as the chat model. This build now prevents that selection after model detection.</div></div></section>`;
  if(provider==='cpu') return `<section class="card wide"><div class="card-head">Browser CPU / WASM setup</div><div class="card-body"><ol><li>Select Browser CPU / WASM in Unified AI Configuration.</li><li>Choose the smallest model first on normal laptops.</li><li>The model downloads on first use and may take time to initialize.</li><li>No Ollama, API key or local service is required.</li></ol><div class="note warning">CPU browser inference can consume several GB of RAM and may be slow. NotebookLM+ performance settings are controlled separately under General Settings.</div></div></section>`;
  return `<section class="card wide"><div class="card-head">Browser WebGPU setup</div><div class="card-body"><ol><li>Use a recent browser with WebGPU enabled.</li><li>Select Browser WebGPU in Unified AI Configuration.</li><li>Choose a model appropriate for available GPU memory.</li><li>Approve the local-model RAM/VRAM warning when loading it.</li></ol><div class="note warning">If WebGPU is unavailable or the model runs out of memory, choose a smaller model or switch to Ollama.</div></div></section>`;
}
function tutorialView() {
  const provider=tutorialProviderView || currentProvider();
  return `<div class="tutorial-grid"><section class="card wide emphasis"><div class="card-head">Setup Tutorial</div><div class="card-body">${providerSelector(provider,'tutorialProviderSelect')}<div class="note">Choose a provider above. The instructions below change to match that provider. The <b>top-right AI Model dropdown</b> remains the single live model selector for the entire suite.</div></div></section>${tutorialContent(provider)}
    <section class="card wide"><div class="card-head">Common troubleshooting</div><div class="card-body"><table><thead><tr><th>Issue</th><th>Check</th></tr></thead><tbody><tr><td>Local service unreachable</td><td>Service is running, correct localhost port, browser local-network permission, and CORS origin.</td></tr><tr><td>Ollama model does not support chat</td><td>Use a completion/chat model for Chat model; use embedding-only models only in the embedding field.</td></tr><tr><td>NotebookLM+ is slow</td><td>General Settings → NotebookLM+ performance → CPU / No GPU or Lightweight.</td></tr><tr><td>Browser model memory error</td><td>Select a smaller model or switch globally to Ollama.</td></tr></tbody></table></div></section></div>`;
}

function missingCoreView() { return `<section class="card wide"><div class="card-head">Suite core unavailable</div><div class="card-body"><div class="note warning">Open Settings through the main Project Controls AI Suite. The unified AI runtime is provided by the parent suite.</div></div></section>`; }
function render() { content.innerHTML = page === "ai" ? aiView() : page === "tutorial" ? tutorialView() : generalView(); bindView(); }

function bindView() {
  document.getElementById('applyTheme')?.addEventListener('click', () => {
    const theme=document.getElementById('themeSelect').value==='light'?'light':'dark'; setStorage(THEME_KEY,theme);
    try { const root=window.parent.document.documentElement; root.dataset.theme=theme; root.classList.toggle('dark-mode',theme==='dark'); document.documentElement.dataset.theme=theme; document.documentElement.classList.toggle('dark-mode',theme==='dark'); window.parent.document.dispatchEvent(new CustomEvent('pc-theme-change',{detail:{theme}})); } catch (_) {}
    setStatus(`${theme==='dark'?'Dark':'Light'} theme applied`,'ok');
  });
  document.getElementById('saveNotebookPerformance')?.addEventListener('click', () => { const value=document.getElementById('notebookPerformanceSelect').value; setStorage(PERF_KEY,value); notifyPerformance(value); setStatus(`NotebookLM+ profile: ${PERF_OPTIONS.find(x=>x[0]===value)?.[1]||value}`,'ok'); });
  document.getElementById('saveNotebookRuntime')?.addEventListener('click',()=>{
    const num=(id,min,max)=>Math.max(min,Math.min(max,Number(document.getElementById(id).value)||min));
    const cfg={contextTokens:num('nbContextTokens',2048,131072),topK:num('nbTopK',2,50),maxAnswerTokens:num('nbMaxAnswer',128,32768),embedBatch:num('nbEmbedBatch',1,128),workerCount:num('nbWorkers',1,8),temperature:num('nbTemperature',0,2),topP:num('nbTopP',0.05,1),topKSampling:num('nbTopKSampling',0,200),repeatPenalty:num('nbRepeatPenalty',0.5,2),thinkingMode:document.getElementById('nbThinking').value,thinkingTimeoutSeconds:num('nbThinkingTimeout',15,1800),fallbackThinkingOff:document.getElementById('nbFallbackThinking').checked,requestTimeoutSeconds:num('nbRequestTimeout',30,3600),firstResponseTimeoutSeconds:num('nbFirstResponse',30,1800),inactivityTimeoutSeconds:num('nbInactivity',30,900),retryCount:num('nbRetryCount',0,4),retryDelayMs:num('nbRetryDelay',0,10000),generateFallback:document.getElementById('nbGenerateFallback').checked,keepAlive:safeKeepAlive(document.getElementById('nbKeepAlive').value),semanticSearch:document.getElementById('nbSemantic').checked,keywordSearch:document.getElementById('nbKeyword').checked,chunkSize:num('nbChunkSize',500,12000),chunkOverlap:num('nbChunkOverlap',0,2000),minKeywordScore:num('nbKeywordScore',0,1),maxFileSizeMB:num('nbMaxFileSize',1,2048),researchTimeoutSeconds:num('nbResearchTimeout',5,1800),maxDiscoveryResults:num('nbDiscoveryResults',1,100),rescanOnOpen:document.getElementById('nbRescan').checked,searchEndpoint:document.getElementById('nbSearchEndpoint').value.trim(),webProxyEndpoint:document.getElementById('nbWebProxyEndpoint').value.trim(),youtubeTranscriptEndpoint:document.getElementById('nbYoutubeEndpoint').value.trim(),audioTranscriptionEndpoint:document.getElementById('nbAudioEndpoint').value.trim()};
    setStorage(NOTEBOOK_RUNTIME_KEY,JSON.stringify(cfg)); notifyPerformance(getStorage(PERF_KEY,'balanced')); setStatus('Advanced AI runtime settings saved','ok');
  });
  document.getElementById('resetNotebookRuntime')?.addEventListener('click',()=>{try{localStorage.removeItem(NOTEBOOK_RUNTIME_KEY)}catch(_){} notifyPerformance(getStorage(PERF_KEY,'balanced')); setStatus('Advanced AI runtime settings reset','ok'); render();});
  document.getElementById('releaseAI')?.addEventListener('click', async()=>{await Core.ai.release();setStatus('AI runtime unloaded','ok');render();});
  document.getElementById('goAI')?.addEventListener('click',()=>selectPage('ai'));
  document.getElementById('clearAIConfig')?.addEventListener('click',()=>{ try{['projectControlsOllamaBaseUrl','projectControlsOllamaModel','projectControlsOllamaEmbeddingModel','projectControlsSharedAIModel'].forEach(k=>localStorage.removeItem(k));}catch(_){} Core.ai.configureOllama({baseUrl:'http://localhost:11434',model:''});Core.ai.configureOllamaEmbedding('');Core.ai.setPreferred('ollama:auto');notifyAI();document.getElementById('resetDiag').innerHTML='<span class="ok">✓ AI settings reset.</span>';setStatus('AI settings reset','ok');});

  document.getElementById('aiProviderSelect')?.addEventListener('change', e=>{aiProviderView=e.target.value;render();});
  document.getElementById('tutorialProviderSelect')?.addEventListener('change',e=>{tutorialProviderView=e.target.value;render();});
  document.getElementById('saveGlobalAI')?.addEventListener('click',async()=>{const value=document.getElementById('globalAISelect').value;Core.ai.setPreferred(value);await Core.ai.release();notifyAI();document.getElementById('globalDiag').innerHTML=`<span class="ok">✓ ${esc(Core.ai.preferredLabel())} will now be used throughout the suite.</span>`;setStatus('Unified AI selection saved','ok');});
  document.getElementById('testSelectedAI')?.addEventListener('click',async event=>{const button=event.currentTarget,diag=document.getElementById('globalDiag'),value=document.getElementById('globalAISelect').value;button.disabled=true;diag.textContent='Testing selected AI…';try{Core.ai.setPreferred(value);await Core.ai.release();const runtime=await Core.ai.ensure(value);const out=await Core.ai.run([{role:'user',content:'Reply with exactly OK'}],{temperature:0,max_tokens:8});diag.innerHTML=`<span class="ok">✓ ${esc(runtime.label||Core.ai.preferredLabel())} responded: ${esc(out?.choices?.[0]?.message?.content||'OK')}</span>`;notifyAI();setStatus('AI test passed','ok');}catch(error){diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`;setStatus('AI test failed','bad');}finally{button.disabled=false;}});


  document.getElementById('detectOllama')?.addEventListener('click',async event=>{const button=event.currentTarget,diag=document.getElementById('ollamaDiag'),chat=document.getElementById('ollamaModel'),embedding=document.getElementById('embeddingModel');button.disabled=true;diag.textContent='Detecting and classifying installed models…';try{Core.ai.configureOllama({baseUrl:document.getElementById('ollamaUrl').value});const models=await Core.ai.inspectOllamaModels();const chatModels=models.filter(m=>m.supportsChat),embedModels=models.filter(m=>m.supportsEmbedding);chat.innerHTML=chatModels.length?chatModels.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}${m.parameterSize?` · ${esc(m.parameterSize)}`:''}</option>`).join(''):'<option value="">No chat-capable models installed</option>';const current=Core.ai.ollamaConfig().model;if([...chat.options].some(x=>x.value===current))chat.value=current;embedding.innerHTML='<option value="">Keyword-only</option>'+embedModels.map(m=>`<option value="${esc(m.name)}">${esc(m.name)}</option>`).join('');const currentEmbedding=Core.ai.ollamaEmbeddingModel();if([...embedding.options].some(x=>x.value===currentEmbedding))embedding.value=currentEmbedding;diag.innerHTML=`<span class="${chatModels.length?'ok':'warn'}">${chatModels.length?'✓':'!'} ${models.length} installed; ${chatModels.length} chat-capable; ${embedModels.length} embedding-capable.</span>`;setStatus('Ollama models classified',chatModels.length?'ok':'bad');}catch(error){diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`;setStatus('Ollama detection failed','bad');}finally{button.disabled=false;}});
  document.getElementById('testOllama')?.addEventListener('click',async event=>{const button=event.currentTarget,diag=document.getElementById('ollamaDiag'),model=document.getElementById('ollamaModel').value;button.disabled=true;diag.textContent='Testing Ollama chat…';try{if(!model)throw new Error('No chat-capable Ollama model is selected. Press Detect & classify models first.');const result=await Core.ai.testOllamaConnection({baseUrl:document.getElementById('ollamaUrl').value,model});if(!result.ok){diag.innerHTML=`<span class="warn">${esc(result.message)}</span>`;return;}Core.ai.configureOllama({baseUrl:document.getElementById('ollamaUrl').value,model:result.selectedModel});Core.ai.configureOllamaEmbedding(document.getElementById('embeddingModel').value);diag.innerHTML=`<span class="ok">✓ Ollama chat ready: ${esc(result.selectedModel)}.</span>`;notifyAI();setStatus('Ollama ready','ok');}catch(error){diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`;setStatus('Ollama test failed','bad');}finally{button.disabled=false;}});
}

const initialHash=location.hash.replace('#','');
selectPage(['general','ai','tutorial'].includes(initialHash)?initialHash:'general');
