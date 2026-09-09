
import assert from "node:assert/strict";

class Store{constructor(){this.m=new Map()}getItem(k){return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
export async function run(){
  globalThis.localStorage=new Store();
  globalThis.location={origin:"https://example.github.io",href:"https://example.github.io/tool/"};
  const o=await import(`../src/ai/ollama.js?errors=${Date.now()}`);

  // localhost fails, 127.0.0.1 succeeds.
  const calls=[];
  globalThis.fetch=async(url,opts={})=>{
    calls.push(String(url));
    if(String(url).includes("localhost"))throw new TypeError("Failed to fetch");
    if(String(url).endsWith("/api/tags"))return new Response(JSON.stringify({models:[{name:"qwen3:4b"}]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/api/show"))return new Response(JSON.stringify({capabilities:["completion"]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/api/version"))return new Response(JSON.stringify({version:"0.12.0"}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error(`unexpected ${url}`);
  };
  o.saveOllamaConfig({baseUrl:"http://localhost:11434"});
  const models=await o.inspectModels();
  assert.equal(models[0].name,"qwen3:4b");
  assert.ok(calls.some(x=>x.includes("127.0.0.1")));

  const probe=await o.probeOllama();
  assert.equal(probe.ok,true);
  assert.equal(probe.version,"0.12.0");

  // Both loopbacks unavailable: actionable, non-crashing diagnostic.
  globalThis.fetch=async()=>{throw new TypeError("Failed to fetch")};
  const missing=await o.probeOllama();
  assert.equal(missing.ok,false);
  assert.equal(missing.likelyNotInstalled,true);
  assert.ok(missing.help.some(x=>/Install Ollama/.test(x)));
  assert.ok(missing.help.some(x=>/GitHub Pages|OLLAMA_ORIGINS/.test(x)));

  // HTTP error must preserve server detail.
  globalThis.fetch=async(url)=>{
    if(String(url).endsWith("/api/tags"))return new Response(JSON.stringify({error:"model registry unavailable"}),{status:500,headers:{"content-type":"application/json"}});
    throw new Error("unexpected");
  };
  let msg="";
  try{await o.listModels()}catch(e){msg=e.message}
  assert.ok(/model registry unavailable/.test(msg));

  // Reachable server with only embeddings is not a valid chat configuration.
  globalThis.fetch=async(url,opts={})=>{
    if(String(url).endsWith("/api/tags"))return new Response(JSON.stringify({models:[{name:"embeddinggemma:latest"}]}),{status:200,headers:{"content-type":"application/json"}});
    if(String(url).endsWith("/api/show"))return new Response(JSON.stringify({capabilities:["embedding"]}),{status:200,headers:{"content-type":"application/json"}});
    throw new Error("unexpected");
  };
  const result=await o.testOllama().catch(e=>({ok:false,message:e.message}));
  assert.notEqual(result.ok,true);

  return "ollama-errors";
}
