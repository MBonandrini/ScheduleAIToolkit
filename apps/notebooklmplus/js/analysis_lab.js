const WORKER_SOURCE = `
self.fetch = undefined; self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.EventSource = undefined;
self.WebTransport = undefined; self.BroadcastChannel = undefined; self.Worker = undefined; self.SharedWorker = undefined;
self.indexedDB = undefined; self.caches = undefined; self.importScripts = undefined;
self.onmessage = async event => {
  const { code, data } = event.data || {};
  const logs = [];
  const console = { log:(...a)=>logs.push(a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')), warn:(...a)=>logs.push('WARN '+a.join(' ')), error:(...a)=>logs.push('ERROR '+a.join(' ')) };
  try {
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('data','console','Math','JSON','Date', '"use strict";\n' + String(code || ''));
    const result = await fn(data, console, Math, JSON, Date);
    self.postMessage({ ok:true, result: result === undefined ? null : result, logs });
  } catch (error) {
    self.postMessage({ ok:false, error:error?.message || String(error), stack:error?.stack || '', logs });
  }
};`;

export async function runAnalysisCode({ code, data, timeoutMs=5000 }) {
  const source = String(code || '');
  if (!source.trim()) throw new Error('Enter analysis code first.');
  if (source.length > 100000) throw new Error('Analysis code is too large.');
  // This is intentionally a restricted calculation sandbox, not a general web
  // programming environment. Block escape/network/storage primitives before
  // the code reaches the Worker. The allowed surface is data, console, Math,
  // JSON and Date plus ordinary language syntax.
  const forbidden = /(?:\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|WebTransport|BroadcastChannel|Worker|SharedWorker|importScripts|indexedDB|caches|globalThis|self|window|document|navigator|location|eval|Function|constructor)\b|\bimport\s*\()/;
  if (forbidden.test(source)) throw new Error('Analysis code uses a blocked network, storage, dynamic-code or global-object primitive.');
  const blob = new Blob([WORKER_SOURCE], { type:'text/javascript' });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); reject(new Error(`Analysis timed out after ${Math.round(timeoutMs/1000)} seconds.`)); }, Math.max(100, Number(timeoutMs)||5000));
    worker.onmessage = event => {
      clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url);
      const payload = event.data || {};
      if (!payload.ok) reject(Object.assign(new Error(payload.error || 'Analysis failed.'), { stack:payload.stack, logs:payload.logs }));
      else resolve({ result:payload.result, logs:payload.logs || [] });
    };
    worker.onerror = event => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); reject(new Error(event.message || 'Analysis worker failed.')); };
    try { worker.postMessage({ code:source, data:structuredClone(data) }); }
    catch (error) { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); reject(new Error(`Analysis input could not be cloned: ${error.message}`)); }
  });
}

export const ANALYSIS_STARTERS = Object.freeze({
  summary: `// data is an array of selected notebook records.\nconst count = Array.isArray(data) ? data.length : 0;\nreturn { rows: count, sample: Array.isArray(data) ? data.slice(0, 5) : data };`,
  numeric: `// Find simple numeric statistics across object rows.\nconst rows = Array.isArray(data) ? data : [];\nconst numeric = {};\nfor (const row of rows) {\n  if (!row || typeof row !== 'object') continue;\n  for (const [key,value] of Object.entries(row)) {\n    const n = Number(value);\n    if (!Number.isFinite(n)) continue;\n    (numeric[key] ||= []).push(n);\n  }\n}\nconst out = {};\nfor (const [key,values] of Object.entries(numeric)) {\n  const sum = values.reduce((a,b)=>a+b,0);\n  out[key] = { count:values.length, min:Math.min(...values), max:Math.max(...values), mean:sum/values.length };\n}\nreturn out;`,
});
