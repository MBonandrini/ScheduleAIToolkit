"use strict";

const Core = window.parent?.ProjectControlsCore || window.ProjectControlsCore;
const content = document.getElementById("settingsContent");
const status = document.getElementById("settingsStatus");
const PERF_KEY = "projectControlsNotebookPerformanceMode";
const THEME_KEY = "projectControlsTheme";
const PERF_OPTIONS = [
  ["cpu", "CPU / No GPU"],
  ["lightweight", "Lightweight"],
  ["local", "Local"],
  ["balanced", "Balanced"],
  ["power", "Power"],
  ["remote", "Remote / high-context"]
];
let page = "general";

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const siteOrigin = () => { try { return window.parent.location.origin || location.origin; } catch (_) { return location.origin; } };
const getStorage = (key, fallback="") => { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } };
const setStorage = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };

function setStatus(message, kind="") {
  status.textContent = message;
  status.className = `status-pill ${kind}`.trim();
}
function notifyAI() {
  try { window.parent.postMessage({type:"pc-ai-config-changed"}, "*"); } catch (_) {}
}
function notifyPerformance(value) {
  try { window.parent.postMessage({type:"pc-notebook-performance-changed", value}, "*"); } catch (_) {}
}
function selectPage(next) {
  if (!['general','ai','tutorial'].includes(next)) next = 'general';
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
  button.type = "button";
  button.setAttribute("role", "tab");
  button.addEventListener("click", () => selectPage(button.dataset.page));
});

function generalView() {
  if (!Core?.ai) return missingCoreView();
  const ai = Core.ai.status();
  const omni = Core.ai.config();
  const ollama = Core.ai.ollamaConfig();
  const theme = getStorage(THEME_KEY, "dark");
  const perf = getStorage(PERF_KEY, "balanced");
  return `<div class="grid">
    <section class="card">
      <div class="card-head">Appearance</div>
      <div class="card-body">
        <div class="field"><label for="themeSelect">Default theme</label><select id="themeSelect"><option value="dark" ${theme==='dark'?'selected':''}>Dark</option><option value="light" ${theme==='light'?'selected':''}>Light</option></select></div>
        <div class="note">Dark mode is the suite default. Your selection is remembered in this browser.</div>
        <div class="actions"><button id="applyTheme" class="btn primary" type="button">Apply theme</button></div>
      </div>
    </section>
    <section class="card">
      <div class="card-head">NotebookLM+ performance</div>
      <div class="card-body">
        <div class="field"><label for="notebookPerformanceSelect">Performance profile</label><select id="notebookPerformanceSelect">${PERF_OPTIONS.map(([value,label])=>`<option value="${value}" ${value===perf?'selected':''}>${esc(label)}</option>`).join('')}</select></div>
        <div class="note"><b>CPU / No GPU belongs here.</b> This changes NotebookLM+ context/retrieval performance only. It does not select a different AI provider. The AI provider/model is controlled globally from the top-right selector or Unified AI Configuration.</div>
        <div class="actions"><button id="saveNotebookPerformance" class="btn primary" type="button">Save performance profile</button></div>
      </div>
    </section>
    <section class="card">
      <div class="card-head">Unified AI status</div>
      <div class="card-body">
        <div class="rows">
          <div class="row"><span>Global selection</span><b>${esc(Core.ai.preferredLabel())}</b></div>
          <div class="row"><span>Loaded engine</span><b>${esc(ai.engine || "idle")}</b></div>
          <div class="row"><span>Runtime model</span><b>${esc(ai.model || "—")}</b></div>
        </div>
        <div class="actions"><button id="releaseAI" class="btn" type="button">Unload browser model</button><button id="goAI" class="btn primary" type="button">Open AI configuration</button></div>
      </div>
    </section>
    <section class="card wide">
      <div class="card-head">Saved connections</div>
      <div class="card-body">
        <div class="rows">
          <div class="row"><span>OmniRoute URL</span><b>${esc(omni.baseUrl)}</b></div>
          <div class="row"><span>Ollama URL</span><b>${esc(ollama.baseUrl)}</b></div>
          <div class="row"><span>Ollama chat model</span><b>${esc(ollama.model || "Not selected")}</b></div>
          <div class="row"><span>Ollama embedding model</span><b>${esc(Core.ai.ollamaEmbeddingModel() || "Keyword-only")}</b></div>
        </div>
        <div class="actions"><button id="clearAIConfig" class="btn danger" type="button">Reset AI settings</button></div>
        <div id="resetDiag" class="diag">Reset removes saved endpoints/model choices from this browser. It does not uninstall OmniRoute, Ollama or models.</div>
      </div>
    </section>
  </div>`;
}

function aiView() {
  if (!Core?.ai) return missingCoreView();
  const omni = Core.ai.config();
  const ollama = Core.ai.ollamaConfig();
  const preferred = Core.ai.preferred();
  const groups = new Map();
  Core.ai.catalog.filter(item => !item.disabled).forEach(item => {
    const group = item.engine === 'omniroute' ? 'OmniRoute' : item.engine === 'ollama' ? 'Ollama' : item.engine === 'mlc' ? 'Browser WebGPU' : 'Browser CPU / WASM';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  });
  const options = [...groups.entries()].map(([group,items]) => `<optgroup label="${esc(group)}">${items.map(item=>`<option value="${esc(item.value)}" ${item.value===preferred?'selected':''}>${esc(item.label)}</option>`).join('')}</optgroup>`).join('');
  return `<div class="grid">
    <section class="card wide emphasis">
      <div class="card-head">One AI selection for the entire suite</div>
      <div class="card-body">
        <div class="field"><label for="globalAISelect">Active AI model / route</label><select id="globalAISelect">${options}</select></div>
        <div class="note"><b>This is the same selector as the top-right model dropdown.</b> Contract Manager, Drawing Measurement, Schedule Assessment, Risk Analysis, Claims &amp; Forensics, Schedule Builder and NotebookLM+ all consume this single selection.</div>
        <div class="actions"><button id="saveGlobalAI" class="btn primary" type="button">Use this AI everywhere</button><button id="testSelectedAI" class="btn" type="button">Test selected AI</button></div>
        <div id="globalDiag" class="diag">Current: ${esc(Core.ai.preferredLabel())}</div>
      </div>
    </section>
    <section class="card">
      <div class="card-head">OmniRoute connection</div>
      <div class="card-body">
        <div class="field"><label for="omniUrl">API base URL</label><input id="omniUrl" value="${esc(omni.baseUrl)}"></div>
        <div class="field"><label for="omniKey">Endpoint key — optional, session only</label><input id="omniKey" type="password" autocomplete="off" placeholder="Leave blank for keyless local access"></div>
        <div class="actions"><button id="saveOmni" class="btn" type="button">Save connection</button><button id="testOmni" class="btn primary" type="button">Test OmniRoute</button></div>
        <div id="omniDiag" class="diag">Default: http://localhost:20128/v1</div>
      </div>
    </section>
    <section class="card">
      <div class="card-head">Ollama connection</div>
      <div class="card-body">
        <div class="field"><label for="ollamaUrl">Ollama host</label><input id="ollamaUrl" value="${esc(ollama.baseUrl)}"></div>
        <div class="form-grid"><div class="field"><label for="ollamaModel">Chat model</label><select id="ollamaModel"><option value="${esc(ollama.model)}">${esc(ollama.model || "Detect models first")}</option></select></div><div class="field"><label for="embeddingModel">Embedding model for NotebookLM+</label><select id="embeddingModel"><option value="${esc(Core.ai.ollamaEmbeddingModel())}">${esc(Core.ai.ollamaEmbeddingModel() || "Keyword-only")}</option></select></div></div>
        <div class="actions"><button id="detectOllama" class="btn" type="button">Detect models</button><button id="testOllama" class="btn primary" type="button">Test &amp; Save</button></div>
        <div id="ollamaDiag" class="diag">Default: http://localhost:11434</div>
      </div>
    </section>
    <section class="card wide"><div class="card-head">Browser/local models</div><div class="card-body"><div class="note">Browser CPU/WASM and WebGPU models use the same global selector. NotebookLM+ uses the shared suite runtime for answer generation. Semantic vector retrieval uses the configured Ollama embedding model when Ollama is selected; otherwise NotebookLM+ safely uses keyword retrieval.</div></div></section>
  </div>`;
}

function tutorialView() {
  return `<div class="tutorial-grid">
    <section class="card wide"><div class="card-head">Quick start</div><div class="card-body"><ol><li>Choose the suite AI model from the <b>top-right AI Model dropdown</b> or open <b>Unified AI Configuration</b>.</li><li>If using OmniRoute or Ollama, configure and test the local endpoint below.</li><li>If using NotebookLM+ on a slower computer, choose <b>General Settings → NotebookLM+ performance → CPU / No GPU</b>.</li><li>Open any module. Every module uses the same global AI selection.</li></ol><div class="note">Deterministic project-controls calculations do not depend on AI. AI is used for explanation, narrative, research and conversational analysis.</div></div></section>
    <section class="card"><div class="card-head">Ollama setup</div><div class="card-body"><p>Install and start Ollama. Its default local host is <code>http://localhost:11434</code>.</p><p>Install a chat model:</p><pre><code>ollama run gemma3</code></pre><p>For NotebookLM+ semantic retrieval, optionally install an embedding model:</p><pre><code>ollama pull embeddinggemma</code></pre><p><a class="btn primary" href="../notebooklmplus/downloads/NotebookLMPlus-Ollama-Setup.zip" download>Download Windows Ollama setup helper</a></p><div class="note warning">When this suite is hosted on GitHub Pages, add the exact origin to <b>OLLAMA_ORIGINS</b>, restart Ollama, and approve any browser local-network permission:<br><code>${esc(siteOrigin())}</code></div></div></section>
    <section class="card"><div class="card-head">OmniRoute setup</div><div class="card-body"><p>Default endpoint: <code>http://localhost:20128/v1</code>.</p><p>Allow this exact origin in OmniRoute CORS/security settings:</p><pre><code>${esc(siteOrigin())}</code></pre><p>For normal local keyless operation, leave the endpoint key blank. Then choose an OmniRoute route from the global model selector.</p></div></section>
    <section class="card"><div class="card-head">Browser AI</div><div class="card-body"><p>CPU/WASM and WebGPU models require no local service. They load only when selected and can consume substantial RAM or VRAM.</p><p>Use a smaller browser model or OmniRoute/Ollama on normal business laptops if performance is limited.</p></div></section>
    <section class="card"><div class="card-head">NotebookLM+ performance</div><div class="card-body"><p>The NotebookLM+ performance profile is separate from AI provider selection. It controls context size, retrieval depth, indexing workers and response budgets.</p><p>Choose <b>CPU / No GPU</b> in General Settings when local processing needs to be conservative.</p></div></section>
    <section class="card wide"><div class="card-head">Troubleshooting</div><div class="card-body"><table><thead><tr><th>Issue</th><th>Check</th></tr></thead><tbody><tr><td>Ollama unreachable</td><td>Ollama service, localhost:11434, OLLAMA_ORIGINS and browser local-network permission.</td></tr><tr><td>OmniRoute unreachable</td><td>OmniRoute service, localhost:20128/v1, CORS origin, endpoint authentication and provider availability.</td></tr><tr><td>NotebookLM+ is slow</td><td>General Settings → NotebookLM+ performance → CPU / No GPU or Lightweight.</td></tr><tr><td>No semantic retrieval in NotebookLM+</td><td>Select Ollama globally and configure an embedding model, or continue with keyword retrieval.</td></tr><tr><td>Browser model exhausts memory</td><td>Select a smaller model or switch globally to Ollama/OmniRoute.</td></tr></tbody></table><div class="note warning">Do not embed long-lived paid-provider API keys in public GitHub Pages JavaScript.</div></div></section>
  </div>`;
}

function missingCoreView() {
  return `<section class="card wide"><div class="card-head">Suite core unavailable</div><div class="card-body"><div class="note warning">Open Settings through the main Project Controls AI Suite. The unified AI runtime is provided by the parent suite.</div></div></section>`;
}
function render() {
  content.innerHTML = page === 'ai' ? aiView() : page === 'tutorial' ? tutorialView() : generalView();
  bindView();
}
function bindView() {
  document.getElementById('applyTheme')?.addEventListener('click', () => {
    const theme = document.getElementById('themeSelect').value === 'light' ? 'light' : 'dark';
    setStorage(THEME_KEY, theme);
    try {
      const root = window.parent.document.documentElement;
      root.dataset.theme = theme;
      root.classList.toggle('dark-mode', theme === 'dark');
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('dark-mode', theme === 'dark');
      window.parent.document.dispatchEvent(new CustomEvent('pc-theme-change', {detail:{theme}}));
    } catch (_) {}
    setStatus(`${theme === 'dark' ? 'Dark' : 'Light'} theme applied`, 'ok');
  });
  document.getElementById('saveNotebookPerformance')?.addEventListener('click', () => {
    const value = document.getElementById('notebookPerformanceSelect').value;
    setStorage(PERF_KEY, value);
    notifyPerformance(value);
    setStatus(`NotebookLM+ profile: ${PERF_OPTIONS.find(x=>x[0]===value)?.[1] || value}`, 'ok');
  });
  document.getElementById('releaseAI')?.addEventListener('click', async () => { await Core.ai.release(); setStatus('AI runtime unloaded', 'ok'); render(); });
  document.getElementById('goAI')?.addEventListener('click', () => selectPage('ai'));
  document.getElementById('clearAIConfig')?.addEventListener('click', () => {
    try { ['projectControlsOmniRouteBaseUrl','projectControlsOllamaBaseUrl','projectControlsOllamaModel','projectControlsOllamaEmbeddingModel','projectControlsSharedAIModel'].forEach(key=>localStorage.removeItem(key)); sessionStorage.removeItem('projectControlsOmniRouteEndpointKey'); } catch (_) {}
    Core.ai.configure({baseUrl:'http://localhost:20128/v1', endpointKey:''});
    Core.ai.configureOllama({baseUrl:'http://localhost:11434', model:''});
    Core.ai.configureOllamaEmbedding('');
    Core.ai.setPreferred('omniroute:auto');
    notifyAI();
    document.getElementById('resetDiag').innerHTML = '<span class="ok">✓ AI settings reset.</span>';
    setStatus('AI settings reset', 'ok');
  });
  document.getElementById('saveGlobalAI')?.addEventListener('click', async () => {
    const value = document.getElementById('globalAISelect').value;
    Core.ai.setPreferred(value); await Core.ai.release(); notifyAI();
    document.getElementById('globalDiag').innerHTML = `<span class="ok">✓ ${esc(Core.ai.preferredLabel())} will now be used throughout the suite.</span>`;
    setStatus('Unified AI selection saved', 'ok');
  });
  document.getElementById('testSelectedAI')?.addEventListener('click', async event => {
    const button=event.currentTarget, diag=document.getElementById('globalDiag'), value=document.getElementById('globalAISelect').value;
    button.disabled=true; diag.textContent='Testing selected AI…';
    try { Core.ai.setPreferred(value); await Core.ai.release(); const runtime=await Core.ai.ensure(value); const out=await Core.ai.run([{role:'user',content:'Reply with exactly OK'}],{temperature:0,max_tokens:8}); diag.innerHTML=`<span class="ok">✓ ${esc(runtime.label||Core.ai.preferredLabel())} responded: ${esc(out?.choices?.[0]?.message?.content||'OK')}</span>`; notifyAI(); setStatus('AI test passed','ok'); }
    catch(error){ diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`; setStatus('AI test failed','bad'); }
    finally{ button.disabled=false; }
  });
  document.getElementById('saveOmni')?.addEventListener('click', () => {
    Core.ai.configure({baseUrl:document.getElementById('omniUrl').value, endpointKey:document.getElementById('omniKey').value});
    document.getElementById('omniKey').value=''; document.getElementById('omniDiag').innerHTML='<span class="ok">✓ OmniRoute connection saved.</span>'; notifyAI(); setStatus('OmniRoute saved','ok');
  });
  document.getElementById('testOmni')?.addEventListener('click', async event => {
    const button=event.currentTarget, diag=document.getElementById('omniDiag'); button.disabled=true; diag.textContent='Testing OmniRoute…';
    try { Core.ai.configure({baseUrl:document.getElementById('omniUrl').value, endpointKey:document.getElementById('omniKey').value}); const result=await Core.ai.testConnection(); diag.innerHTML=`<span class="ok">✓ Connected. ${result.modelCount} route(s); tested ${esc(result.testedModel)}.</span>`; setStatus('OmniRoute connected','ok'); }
    catch(error){ diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`; setStatus('OmniRoute test failed','bad'); }
    finally{ document.getElementById('omniKey').value=''; button.disabled=false; }
  });
  document.getElementById('detectOllama')?.addEventListener('click', async event => {
    const button=event.currentTarget, diag=document.getElementById('ollamaDiag'), chat=document.getElementById('ollamaModel'), embedding=document.getElementById('embeddingModel'); button.disabled=true; diag.textContent='Detecting models…';
    try { Core.ai.configureOllama({baseUrl:document.getElementById('ollamaUrl').value}); const models=await Core.ai.listOllamaModels(); const options=models.map(model=>`<option value="${esc(model.name)}">${esc(model.name)}${model.parameterSize?` · ${esc(model.parameterSize)}`:''}</option>`).join(''); chat.innerHTML=options||'<option value="">No models installed</option>'; const current=Core.ai.ollamaConfig().model; if([...chat.options].some(x=>x.value===current)) chat.value=current; embedding.innerHTML='<option value="">Keyword-only</option>'+options; const currentEmbedding=Core.ai.ollamaEmbeddingModel(); if([...embedding.options].some(x=>x.value===currentEmbedding)) embedding.value=currentEmbedding; diag.innerHTML=models.length?`<span class="ok">✓ ${models.length} model(s) detected.</span>`:'<span class="warn">Ollama is reachable but no models are installed.</span>'; setStatus('Ollama models detected','ok'); }
    catch(error){ diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`; setStatus('Ollama detection failed','bad'); }
    finally{ button.disabled=false; }
  });
  document.getElementById('testOllama')?.addEventListener('click', async event => {
    const button=event.currentTarget, diag=document.getElementById('ollamaDiag'); button.disabled=true; diag.textContent='Testing Ollama…';
    try { const result=await Core.ai.testOllamaConnection({baseUrl:document.getElementById('ollamaUrl').value, model:document.getElementById('ollamaModel').value}); if(!result.ok){diag.innerHTML=`<span class="warn">${esc(result.message)}</span>`;return;} Core.ai.configureOllama({baseUrl:document.getElementById('ollamaUrl').value,model:result.selectedModel}); Core.ai.configureOllamaEmbedding(document.getElementById('embeddingModel').value); diag.innerHTML=`<span class="ok">✓ Ollama ready: ${esc(result.selectedModel)}.</span>`; notifyAI(); setStatus('Ollama ready','ok'); }
    catch(error){ diag.innerHTML=`<span class="bad">✕ ${esc(error?.message||error)}</span>`; setStatus('Ollama test failed','bad'); }
    finally{ button.disabled=false; }
  });
}

const initialHash = location.hash.replace('#','');
selectPage(['general','ai','tutorial'].includes(initialHash) ? initialHash : 'general');
