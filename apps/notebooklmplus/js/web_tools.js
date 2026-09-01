let researchToken = '';
let transcriptToken = '';
let transcriptionToken = '';

export function setResearchTokens({ research='', transcript='', transcription='' }={}) {
  researchToken = String(research || ''); transcriptToken = String(transcript || ''); transcriptionToken = String(transcription || '');
}
export function getResearchTokens() { return { research:researchToken, transcript:transcriptToken, transcription:transcriptionToken }; }

export function validateHttpUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('Enter a valid http/https URL.'); }
  if (!['http:','https:'].includes(url.protocol)) throw new Error('Only http/https URLs are supported.');
  return url.toString();
}

function endpointUrl(endpoint, params={}) {
  let raw = String(endpoint || '').trim();
  if (!raw) throw new Error('No endpoint is configured for this feature.');
  for (const [k,v] of Object.entries(params)) raw = raw.replaceAll(`{${k}}`, encodeURIComponent(v));
  if (/\{\w+\}/.test(raw)) return raw;
  const u = new URL(raw);
  if (!['http:','https:'].includes(u.protocol)) throw new Error('Tool endpoints must use http or https.');
  for (const [k,v] of Object.entries(params)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  return u.toString();
}

async function fetchWithTimeout(url, init={}, timeoutSeconds=45) {
  const c = new AbortController(); const t = setTimeout(()=>c.abort(new DOMException('Request timed out','TimeoutError')), Math.max(1,Number(timeoutSeconds)||45)*1000);
  try { return await fetch(url, { ...init, signal:c.signal, mode:'cors' }); }
  finally { clearTimeout(t); }
}

function authHeaders(token, extra={}) { const h = new Headers(extra); if (token) h.set('Authorization',`Bearer ${token}`); return h; }

export function extractReadableText(html, sourceUrl='') {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,noscript,svg,canvas,nav,footer,form,iframe').forEach(n=>n.remove());
  const title = (doc.querySelector('title')?.textContent || doc.querySelector('h1')?.textContent || sourceUrl || 'Web page').trim();
  const candidates = [...doc.querySelectorAll('article,main,[role="main"]')];
  const root = candidates.sort((a,b)=>(b.textContent?.length||0)-(a.textContent?.length||0))[0] || doc.body;
  const text = (root?.innerText || root?.textContent || '').replace(/[\t ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  return { title, text };
}

export async function fetchWebPage({ url, proxyEndpoint='', timeoutSeconds=60 }) {
  const clean = validateHttpUrl(url);
  let target = clean;
  if (proxyEndpoint) target = endpointUrl(proxyEndpoint, { url:clean });
  const res = await fetchWithTimeout(target, { headers:{ 'Accept':'text/html,text/plain,application/json' } }, timeoutSeconds);
  if (!res.ok) throw new Error(`Web fetch failed (${res.status}) for ${clean}.`);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const body = await res.text();
  if (contentType.includes('application/json')) {
    try {
      const obj = JSON.parse(body);
      const text = obj.text || obj.content || obj.markdown || obj.data?.text || '';
      const title = obj.title || obj.data?.title || new URL(clean).hostname;
      if (text) return { url:clean, title, text:String(text) };
    } catch { /* fall through */ }
  }
  const parsed = extractReadableText(body, clean);
  if (!parsed.text) throw new Error('The web page returned no readable text. It may require JavaScript, authentication, or a configured CORS proxy.');
  return { url:clean, ...parsed };
}

function normalizeSearchRows(data) {
  const rows = data?.results || data?.items || data?.data?.results || data?.webPages?.value || data?.organic || [];
  return (Array.isArray(rows) ? rows : []).map((r,i)=>({
    id:String(r.id || i+1), title:String(r.title || r.name || r.url || 'Result'), url:String(r.url || r.link || ''),
    snippet:String(r.snippet || r.description || r.content || r.body || ''), score:Number(r.score ?? r.rank ?? 0) || 0,
  })).filter(r=>{ try { validateHttpUrl(r.url); return true; } catch { return false; } });
}

export async function searchWeb({ query, endpoint, token=researchToken, timeoutSeconds=60, maxResults=10 }) {
  const q = String(query || '').trim(); if (!q) throw new Error('Enter a research question.');
  if (!endpoint) throw new Error('Configure a Web Search endpoint in Settings → Research & tools. The endpoint may use a {q} placeholder or accept ?q=.');
  const url = endpointUrl(endpoint, { q, query:q, limit:String(maxResults) });
  const res = await fetchWithTimeout(url, { headers:authHeaders(token,{Accept:'application/json'}) }, timeoutSeconds);
  if (!res.ok) throw new Error(`Search endpoint returned HTTP ${res.status}.`);
  return normalizeSearchRows(await res.json());
}

export async function fetchYouTubeTranscript({ url, endpoint, token=transcriptToken, timeoutSeconds=90 }) {
  const clean = validateHttpUrl(url);
  if (!/(youtube\.com|youtu\.be)/i.test(new URL(clean).hostname)) throw new Error('Enter a YouTube URL.');
  if (!endpoint) throw new Error('Configure a YouTube transcript endpoint in Settings → Research & tools.');
  const target = endpointUrl(endpoint, { url:clean });
  const res = await fetchWithTimeout(target, { headers:authHeaders(token,{Accept:'application/json'}) }, timeoutSeconds);
  if (!res.ok) throw new Error(`Transcript endpoint returned HTTP ${res.status}.`);
  const obj = await res.json();
  const segments = obj.segments || obj.transcript?.segments || [];
  const text = obj.text || obj.transcript || (Array.isArray(segments) ? segments.map(s=>`${s.start != null ? `[${s.start}s] ` : ''}${s.text || ''}`).join('\n') : '');
  if (!String(text).trim()) throw new Error('Transcript endpoint returned no transcript text.');
  return { url:clean, title:obj.title || 'YouTube transcript', text:String(text), segments:Array.isArray(segments)?segments:[] };
}

export async function transcribeAudio({ file, endpoint, token=transcriptionToken, timeoutSeconds=600 }) {
  if (!file) throw new Error('Choose an audio file first.');
  if (!endpoint) throw new Error('Configure an audio transcription endpoint in Settings → Research & tools.');
  const form = new FormData(); form.append('file', file, file.name); form.append('response_format','json');
  const res = await fetchWithTimeout(String(endpoint).trim(), { method:'POST', headers:authHeaders(token), body:form }, timeoutSeconds);
  if (!res.ok) throw new Error(`Transcription endpoint returned HTTP ${res.status}.`);
  const obj = await res.json(); const text = obj.text || obj.transcript || obj.data?.text || '';
  if (!String(text).trim()) throw new Error('Transcription endpoint returned no text.');
  return { title:file.name, text:String(text), segments:obj.segments || [] };
}
